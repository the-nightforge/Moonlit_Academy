// Generate one slice config for the sharded CI sim workflow.
//   node scripts/playtest/slice-config.mjs --id ci --slice 0 --seedBase 9000 \
//     --blockCount 30 --poolPath <abs> --profilePath <abs> --stage screen --output <file>
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  strict: true,
  options: {
    id: { type: "string" },
    slice: { type: "string" },
    seedBase: { type: "string" },
    blockCount: { type: "string" },
    poolPath: { type: "string" },
    profilePath: { type: "string" },
    stage: { type: "string", default: "screen" },
    mode: { type: "string", default: "pvp" },
    output: { type: "string" },
  },
});

for (const key of ["id", "slice", "seedBase", "blockCount", "poolPath", "profilePath", "output"]) {
  if (values[key] === undefined) throw new Error(`slice-config: --${key} required`);
}
const slice = Number.parseInt(values.slice, 10);
const seedBase = Number.parseInt(values.seedBase, 10);
const blockCount = Number.parseInt(values.blockCount, 10);
if (!Number.isInteger(slice) || slice < 0) throw new Error("slice-config: --slice must be ≥ 0");
if (!Number.isInteger(seedBase)) throw new Error("slice-config: --seedBase must be an integer");
if (!Number.isInteger(blockCount) || blockCount <= 0) throw new Error("slice-config: --blockCount must be > 0");

const config = {
  schemaVersion: 1,
  id: values.id,
  stage: values.stage,
  mode: values.mode,
  // Each slice owns a disjoint seed band; the manifest's pairing cycle is
  // per-config, so every slice still covers the whole pool.
  seedStart: seedBase + slice * blockCount,
  blockCount,
  poolPath: resolve(values.poolPath),
  profilePath: resolve(values.profilePath),
};
const out = resolve(values.output);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log(`slice-config ${slice}: seeds ${config.seedStart}..${config.seedStart + blockCount - 1} → ${out}`);
