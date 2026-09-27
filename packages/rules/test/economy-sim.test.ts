import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { botOutcomes, PLAYERS, printCoop, printEconomy, printPvp, simulateCoop, simulateEconomy, simulatePvp } from "./economy-sim";

describe("economy simulation", () => {
  it("60 ngày × 200 người chơi ảo + kiểu người chơi PvP + Liên Thủ", { timeout: 600_000 }, () => {
    const data = loadGameData();
    const stats = simulateEconomy(data, botOutcomes());
    printEconomy("Kinh tế: 200 người chơi × 60 ngày, 2 lượt/ngày + nhiệm vụ", stats);
    const pvp = simulatePvp(data);
    printPvp(pvp, stats.jadePerDay);
    const coop = simulateCoop(data);
    printCoop(coop, stats.jadePerDay);
    expect(stats.allHeroesDay).toHaveLength(PLAYERS);
    // 6 trận/ngày × thắng 50% = 84 Vinh Dự/ngày, dưới trần 120 (`17` §6.4).
    expect(pvp.honorPerDay).toBeCloseTo(84, 1);
    // Honor shop must not outpace the PvE moon-jade income (`15` §8 gói J).
    expect(pvp.jadePerDay).toBeLessThan(stats.jadePerDay);
    // 1 trận co-op/ngày thêm tối đa +20% Nguyệt Ngọc so với chỉ PvE (`17` §9.2).
    expect(coop.jadePerDay).toBeLessThanOrEqual(stats.jadePerDay * 0.2);
  });
});
