import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { botOutcomes, PLAYERS, printEconomy, simulateEconomy } from "./economy-sim";

describe("economy simulation", () => {
  it("60 ngày × 200 người chơi ảo", { timeout: 600_000 }, () => {
    const stats = simulateEconomy(loadGameData(), botOutcomes());
    printEconomy("Kinh tế: 200 người chơi × 60 ngày, 2 lượt/ngày + nhiệm vụ", stats);
    expect(stats.allHeroesDay).toHaveLength(PLAYERS);
  });
});
