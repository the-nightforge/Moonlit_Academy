import { describe, expect, it } from "vitest";
import { applyAction, createCombat } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand, testData } from "./helpers";

describe("combat setup from a run", () => {
  it("uses deckCardIds, hero vitals and run relics from the setup", () => {
    const data = testData();
    const deck = [
      ...data.heroes["m05"]!.cardIds,
      ...data.heroes["f04"]!.cardIds,
      ...data.heroes["m06"]!.cardIds,
      "m05_huyet_chien",
    ];
    const { state } = createCombat(data, {
      heroIds: ["m05", "f04", "m06"],
      encounterId: "enc_01",
      seed: 42,
      deckCardIds: deck,
      heroes: [{ hp: 20, maxHp: 40 }, { hp: 30, maxHp: 30 }, { hp: 5, maxHp: 28 }],
      runRelicIds: ["anh_nguyet_chau"],
    });
    expect(Object.keys(state.cards)).toHaveLength(16);
    expect(state.cards["c16"]).toEqual({ instanceId: "c16", cardId: "m05_huyet_chien", ownerIds: ["m05"] });
    expect(state.heroes.map((h) => [h.hp, h.maxHp])).toEqual([[20, 40], [30, 30], [5, 28]]);
    expect(state.runRelicIds).toEqual(["anh_nguyet_chau"]);
    expect(state.runRelicCounters).toEqual({});
  });

  it("rejects a deck card whose owner is not in the team", () => {
    const data = testData();
    expect(() =>
      createCombat(data, {
        heroIds: ["m05", "f04", "m06"],
        encounterId: "enc_01",
        seed: 42,
        deckCardIds: ["f03_han_an"],
      }),
    ).toThrowError(/f03_han_an/);
  });

  it("T123: a run relic modifier stacks with the moon phase", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["anh_nguyet_chau"],
      setup: (s) => {
        s.moonIndex = 0;
        setHand(s, ["m06_am_tien"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(31);
  });
});
