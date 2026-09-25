import { describe, expect, it } from "vitest";
import { makeTestCombat } from "./helpers";

describe("createCombat", () => {
  it("T01: initializes the combat state per spec", () => {
    const pending = makeTestCombat({ mulligan: "pending" });
    expect(pending.state.status).toBe("mulligan");
    expect(pending.state.hand).toHaveLength(6);
    expect(pending.events.some((e) => e.type === "turnStarted")).toBe(false);

    const { data, state, events } = makeTestCombat();
    expect(state.status).toBe("playerTurn");
    expect(state.round).toBe(1);
    expect(state.moonIndex).toBe(1);
    expect(state.moonPower).toBe(3);
    expect(state.bloodMoonRounds).toBe(0);

    const deckSize = ["m05", "f04", "m06"]
      .flatMap((heroId) => data.heroes[heroId]!.cardIds)
      .reduce((total, cardId) => total + data.cards[cardId]!.copies, 0);
    expect(state.hand).toHaveLength(6);
    expect(state.drawPile).toHaveLength(deckSize - 6);
    expect(state.discardPile).toHaveLength(0);
    expect(Object.keys(state.cards)).toHaveLength(deckSize);

    expect(state.heroes.map((hero) => hero.defId)).toEqual(["m05", "f04", "m06"]);
    expect(state.heroes.map((hero) => [hero.hp, hero.maxHp])).toEqual([
      [40, 40],
      [30, 30],
      [28, 28],
    ]);
    for (const hero of state.heroes) {
      expect(hero.armor).toBe(0);
      expect(hero.statuses).toEqual([]);
      expect(hero.alive).toBe(true);
      expect(hero.leveledUp).toBe(false);
    }

    expect(state.enemies.map((enemy) => enemy.defId)).toEqual(["puppet_guard", "shadow_fox"]);
    for (const enemy of state.enemies) {
      expect(enemy.currentIntent).not.toBeNull();
      expect(enemy.patternIndex).toBe(1);
    }
    expect(state.enemies[0]?.currentIntent?.intent.id).toBe("heavy_strike");
    expect(state.enemies[1]?.currentIntent?.intent.id).toBe("twin_claw");

    const eventTypes = events.map((event) => event.type);
    expect(eventTypes).toContain("combatStarted");
    expect(eventTypes).toContain("deckShuffled");
    expect(eventTypes).toContain("turnStarted");
    expect(eventTypes).toContain("cardsDrawn");
    expect(events.filter((event) => event.type === "intentRevealed")).toHaveLength(2);
  });

  it("T02: same seed produces identical drawPile and hand", () => {
    const first = makeTestCombat();
    const second = makeTestCombat();

    expect(second.state.drawPile).toEqual(first.state.drawPile);
    expect(second.state.hand).toEqual(first.state.hand);
    expect(second.state.rngState).toBe(first.state.rngState);
  });
});
