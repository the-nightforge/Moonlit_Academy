import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction } from "../src/index";
import { stealOneCard, twoHitCard } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setHand } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f03", "f02"];

function play(data: GameData, state: CombatState, cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((h) => h.defId === defId)!;
}

describe("F02 Diệp Linh Lung", () => {
  it("T69: a leveled-up F02 gets +1 on each buff she steals", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM });
    injectCard(state, data, stealOneCard);
    hero(state, "f02").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = play(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").statuses).toEqual([{ id: "strength", value: 3 }]);
  });

  it("stealBonus does not apply to the bond card Ảnh Đấu", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "m06", "f02"],
      setup: (s) => {
        s.moonPower = 10;
        s.enemies[0]!.moonPower = 3;
        setHand(s, ["bond_anh_dau"]);
      },
    });
    hero(state, "f02").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = play(data, state, "bond_anh_dau", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").statuses).toEqual([{ id: "strength", value: 2 }]);
    expect(result.state.enemies[0]?.moonPower).toBe(2);
    expect(result.state.moonPower).toBe(9);
  });
});

describe("F03 Tần Sương", () => {
  it("T88: a leveled-up F03 deals double damage to a frozen target", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM });
    injectCard(state, data, twoHitCard);
    hero(state, "f03").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });

    const result = play(data, state, twoHitCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits = result.events.filter((e) => e.type === "damageDealt");
    expect(hits.map((e) => e.type === "damageDealt" && e.amount)).toEqual([8, 8]);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 16);
  });

  it("T89: freezing an already frozen target does not count", () => {
    const { data, state } = makeTestCombat({
      heroIds: TEAM,
      setup: (s) => setHand(s, ["f03_han_an"]),
    });
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });

    const result = play(data, state, "f03_han_an", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(hero(result.state, "f03").levelUpCounter).toBe(0);
  });

  it("T90: F03 levels up after freezing 3 different enemies", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM, encounterId: "enc_02" });
    let current = state;
    for (const [index, targetId] of ["enemy:0", "enemy:1", "enemy:2"].entries()) {
      setHand(current, ["f03_han_an"]);
      current.moonPower = 3;
      const result = play(data, current, "f03_han_an", targetId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const leveled = result.events.some((e) => e.type === "heroLeveledUp" && e.heroId === "hero:f03");
      expect(leveled).toBe(index === 2);
      current = result.state;
    }
    expect(hero(current, "f03").leveledUp).toBe(true);
  });
});
