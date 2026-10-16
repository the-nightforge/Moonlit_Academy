// Per-hero and per-team win rates from a sim run dir (manifest.json +
// records.jsonl). Records carry no heroIds — join through scenarioId.
//   node scripts/playtest/hero-winrates.mjs --input <run dir> [--band 40,60]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  strict: true,
  options: { input: { type: "string" }, band: { type: "string", default: "40,60" } },
});
if (!values.input) throw new Error("hero-winrates: --input <run dir> required");
const [lo, hi] = values.band.split(",").map(Number);
if (!(lo < hi)) throw new Error("hero-winrates: --band must be \"lo,hi\"");

const dir = resolve(values.input);
const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
const scenarioById = new Map(manifest.scenarios.map((s) => [s.id, s]));

const hero = new Map(); // heroId -> { n, w }
const team = new Map(); // heroIds.join("+") -> { n, w }
const outcomes = { won: 0, lost: 0, draw: 0, truncated: 0, error: 0, other: 0 };
let records = 0;
let matched = 0;

for (const line of readFileSync(resolve(dir, "records.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  records++;
  outcomes[r.outcome in outcomes ? r.outcome : "other"]++;
  const scenario = scenarioById.get(r.scenarioId);
  if (!scenario || scenario.mode !== "pvp" || r.winnerSeat === null) continue;
  matched++;
  const players = scenario.setup.players;
  for (let seat = 0; seat < 2; seat++) {
    const heroIds = players[seat].heroIds ?? players[seat].heroes;
    const won = seat === r.winnerSeat;
    const tKey = heroIds.join("+");
    const t = team.get(tKey) ?? { n: 0, w: 0 };
    t.n++; t.w += won ? 1 : 0; team.set(tKey, t);
    for (const h of heroIds) {
      const e = hero.get(h) ?? { n: 0, w: 0 };
      e.n++; e.w += won ? 1 : 0; hero.set(h, e);
    }
  }
}

const pct = (w, n) => ((w / n) * 100).toFixed(1);
console.log(`records: ${records} (decisive joined: ${matched}) — outcomes: ${JSON.stringify(outcomes)}`);
console.log(`\n=== per-hero (band ${lo}–${hi}%) ===`);
const rows = [...hero.entries()].sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
for (const [id, { n, w }] of rows) {
  const p = w / n * 100;
  const flag = p < lo ? " LOW" : p > hi ? " HIGH" : "";
  console.log(`  ${id.padEnd(4)} ${pct(w, n).padStart(5)}%  (n=${n})${flag}`);
}
console.log(`\n=== per-team ===`);
const tRows = [...team.entries()].sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
for (const [id, { n, w }] of tRows) {
  const p = w / n * 100;
  const flag = p < lo ? " LOW" : p > hi ? " HIGH" : "";
  console.log(`  ${id.padEnd(14)} ${pct(w, n).padStart(5)}%  (n=${n})${flag}`);
}
