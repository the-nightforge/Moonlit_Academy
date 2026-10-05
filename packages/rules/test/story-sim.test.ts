import { describe, it } from "vitest";
import { loadGameData } from "data";
import { printStorySim } from "./story-sim";

const enabled = Boolean(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PLAYTEST_STORY,
);

// The three 7c sample teams: standard (m05+f04+m06), damage-spread
// (m05+f03+f02) and the weakest listed support stack (m01+m02+f04).
const TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"],
  ["m05", "f03", "f02"],
  ["m01", "m02", "f04"],
];

describe("story simulation", () => {
  it.skipIf(!enabled)("16 màn Cốt Truyện × 3 đội mẫu", { timeout: 3_600_000 }, () => {
    const data = loadGameData();
    const seeds = Array.from({ length: 80 }, (_, i) => i + 1);
    printStorySim("Cốt Truyện — Bộ cơ bản, 80 seed", data, TEAMS, seeds);
  });
});
