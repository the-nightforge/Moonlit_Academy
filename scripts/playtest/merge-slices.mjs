// Merge sharded CI sim slices into one run dir for `playtest report`.
//   node scripts/playtest/merge-slices.mjs --input <dir of sim-*> --output <dir>
// Each slice dir holds manifest.json + records.jsonl written by the simulate
// command. All slices must share engine/data/pool/policy hashes — a mismatch
// means the shards were produced from different code or content.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  strict: true,
  options: { input: { type: "string" }, output: { type: "string" } },
});
if (!values.input || !values.output) throw new Error("merge-slices: --input and --output required");

const inputDir = resolve(values.input);
const sliceDirs = readdirSync(inputDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith("sim-"))
  .map((e) => e.name)
  .sort();
if (sliceDirs.length === 0) throw new Error(`merge-slices: no sim-* dirs under ${inputDir}`);

const HASH_KEYS = ["engineHash", "dataHash", "policyHash", "poolHash", "stage", "evidence"];
const manifests = [];
const records = [];
const seen = new Set();
for (const dir of sliceDirs) {
  const manifest = JSON.parse(readFileSync(resolve(inputDir, dir, "manifest.json"), "utf8"));
  manifests.push(manifest);
  for (const line of readFileSync(resolve(inputDir, dir, "records.jsonl"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const key = `${record.experimentId}|${record.scenarioId}|${record.blockId}|${record.leg}`;
    if (seen.has(key)) continue; // ids are unique per slice; guard against double-uploads
    seen.add(key);
    records.push(record);
  }
}

const first = manifests[0];
for (const manifest of manifests.slice(1)) {
  for (const key of HASH_KEYS) {
    if (JSON.stringify(manifest[key]) !== JSON.stringify(first[key])) {
      throw new Error(`merge-slices: ${key} mismatch between slices (mixed code/data)`);
    }
  }
}

const merged = {
  ...first,
  id: `${first.id}-merged`,
  scenarios: manifests.flatMap((m) => m.scenarios),
};
const out = resolve(values.output);
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify(merged, null, 2)}\n`);
for (const record of records) appendFileSync(resolve(out, "records.jsonl"), `${JSON.stringify(record)}\n`);
console.log(`merge-slices: ${sliceDirs.length} slices → ${records.length} records, ${merged.scenarios.length} scenarios → ${out}`);
