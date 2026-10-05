import { describe, it } from "vitest";
import { loadGameData } from "data";
import { printPvpSim, runPvpSim } from "./pvp-sim";

const enabled = Boolean(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PLAYTEST_PVP,
);

describe("pvp simulation", () => {
  it.skipIf(!enabled)("cặp đội bốc mẫu, trần không trang bị + trang bị PvP cơ bản", { timeout: 3_600_000 }, () => {
    const data = loadGameData();
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
    const sample = Number(env.PLAYTEST_PVP_SAMPLE ?? 4000);
    // 14 Hero → C(14,3) = 364 đội: quét toàn bộ quá chậm, bốc mẫu 4000 cặp mỗi
    // lượt (seed cố định của file; sai số tỉ lệ thắng Hero ~±3 điểm ở ~570 trận/Hero).
    printPvpSim(`Bộ cơ bản, không trang bị (mẫu ${sample})`, runPvpSim(data, { seedsPerPair: 12, sampleMatches: sample }));
    printPvpSim(`Bộ cơ bản, trang bị PvP cơ bản ngẫu nhiên (mẫu ${sample})`, runPvpSim(data, { seedsPerPair: 12, sampleMatches: sample, geared: true }));
  });
});
