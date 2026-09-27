import { describe, it } from "vitest";
import { loadGameData } from "data";
import { printCoopSim, runCoopSim } from "./coop-sim";

const enabled = Boolean(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PLAYTEST_COOP,
);

describe("co-op simulation", () => {
  it.skipIf(!enabled)("mọi cặp đội, Bộ cơ bản: trần không trang bị + R1 + R5·Tinh Hồn 6", { timeout: 3_600_000 }, () => {
    const data = loadGameData();
    // 10 đội × 10 đội × 4 seed = 400 trận mỗi lượt (spec `17` §8.8 mục tiêu đo).
    printCoopSim("Bộ cơ bản, không trang bị", runCoopSim(data, { seedsPerPair: 4 }));
    printCoopSim(
      "Bộ cơ bản, trang bị R1",
      runCoopSim(data, { seedsPerPair: 4, gear: { refinement: 1, constellation: 0 } }),
    );
    printCoopSim(
      "Bộ cơ bản, trang bị R5 + Tinh Hồn 6",
      runCoopSim(data, { seedsPerPair: 4, gear: { refinement: 5, constellation: 6 } }),
    );
  });
});
