// Per-entry win rates for a sim run — slices records back to pool entries via
// blockId + leg (pair(block) is deterministic: a=block%N, b=(block+1+floor(block/N))%N).
//   node scripts/playtest/entry-winrates.mjs --input <run dir> --pool <pool json> --seedBase <n> [--blockCount 30] [--band 40,60]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  strict: true,
  options: {
    input: { type: "string" },
    pool: { type: "string" },
    seedBase: { type: "string" },
    blockCount: { type: "string", default: "30" },
    band: { type: "string", default: "40,60" },
  },
});
for (const k of ["input", "pool", "seedBase"]) if (!values[k]) throw new Error(`entry-winrates: --${k} required`);
const [lo, hi] = values.band.split(",").map(Number);
const blockCount = Number(values.blockCount);
const seedBase = Number(values.seedBase);

const pool = JSON.parse(readFileSync(resolve(values.pool), "utf8")).entries;
const N = pool.length;
const pair = (i) => [i % N, (i + 1 + Math.floor(i / N)) % N];

const stats = new Map(); // entryId -> { n, w }
const bump = (idx, won) => {
  const e = pool[idx];
  const s = stats.get(e.id) ?? { n: 0, w: 0 };
  s.n++; s.w += won ? 1 : 0; stats.set(e.id, s);
};

let records = 0, matched = 0;
for (const line of readFileSync(resolve(values.input, "records.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  records++;
  if (r.winnerSeat === null) continue;
  const m = /blk(\d+)-([A-Z]+)$/.exec(r.scenarioId);
  if (!m) continue;
  const seed = Number(m[1]);
  const leg = m[2];
  const blockIdx = (seed - seedBase) % blockCount;
  if (blockIdx < 0 || blockIdx >= blockCount) continue;
  const [a, b] = pair(blockIdx);
  // AB leg: seat0=a, seat1=b ; BA leg: seat0=b, seat1=a
  const aSeat = leg === "AB" ? 0 : 1;
  const aWon = r.winnerSeat === aSeat;
  bump(a, aWon);
  bump(b, !aWon);
  matched++;
}

console.log(`records: ${records} (matched: ${matched})`);
const rows = [...stats.entries()]
  .map(([id, s]) => ({ id, n: s.n, wr: (s.w / s.n) * 100 }))
  .sort((x, y) => y.wr - x.wr);
for (const r of rows) {
  const flag = r.wr > hi ? "HIGH" : r.wr < lo ? "LOW" : "";
  console.log(`  ${r.id.padEnd(26)} ${r.wr.toFixed(1)}%  (n=${r.n}) ${flag}`);
}
