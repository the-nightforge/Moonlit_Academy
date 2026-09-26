import { describe, it } from "vitest";
import { loadGameData } from "data";
import { printPvpSim, runPvpSim } from "./pvp-sim";

const enabled = Boolean(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PLAYTEST_PVP,
);

describe("pvp simulation", () => {
  it.skipIf(!enabled)("toàn bộ đội × đội, trần không trang bị + trang bị PvP cơ bản", { timeout: 3_600_000 }, () => {
    const data = loadGameData();
    // 10 đội × 10 đội × 12 seed = 1200 trận → sai số ±~2.9 điểm cho tỉ lệ người đi trước.
    printPvpSim("Bộ cơ bản, không trang bị", runPvpSim(data, { seedsPerPair: 12 }));
    printPvpSim("Bộ cơ bản, trang bị PvP cơ bản ngẫu nhiên", runPvpSim(data, { seedsPerPair: 12, geared: true }));
  });
});
