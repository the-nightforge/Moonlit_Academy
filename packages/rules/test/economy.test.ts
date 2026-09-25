import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, getEffectiveCost } from "../src/index";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("moon power economy", () => {
  it("T128: base moon power ramps 3, 4, … 8 by round and caps at 8", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    expect(state.moonPower).toBe(3);
    let current = state;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      current.moonPower = 0; // spend everything: no reserve
      current = end(data, current).state;
      seen.push(current.moonPower);
    }
    expect(seen).toEqual([4, 5, 6, 7, 8, 8, 8]);
  });

  it("T129: unspent moon power carries over as reserve (max 3) and can exceed the cap", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    const r2 = end(data, state);
    expect(r2.state.moonReserve).toBe(3);
    expect(r2.state.moonPower).toBe(4 + 3);
    expect(r2.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: 3 });

    r2.state.moonPower = 5; // more than the reserve max left unspent
    const r3 = end(data, r2.state);
    expect(r3.state.moonReserve).toBe(3);
    expect(r3.state.moonPower).toBe(5 + 3);

    let current = r3.state;
    for (let i = 0; i < 4; i++) current = end(data, current).state;
    expect(current.round).toBe(7);
    expect(current.moonPower).toBe(8 + 3);

    current.moonPower = 0;
    const drained = end(data, current);
    expect(drained.state.moonReserve).toBe(0);
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: 0 });
  });

  it("T146: leveled-up M06 gets −3 on his first own card each turn, never below 0, not on bond cards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m06", "f02", "f03"],
      setup: (s) => {
        const m06 = s.heroes[0]!;
        m06.leveledUp = true;
        m06.firstCardDiscountActive = true;
        s.moonPower = 11;
        setHand(s, ["m06_doat_menh", "m06_am_tien", "m06_nguyet_anh_an", "bond_anh_dau"]);
      },
    });
    const doatMenh = instanceIdOf(state, "m06_doat_menh");
    const amTien = instanceIdOf(state, "m06_am_tien");
    const anhDau = instanceIdOf(state, "bond_anh_dau");
    expect(getEffectiveCost(data, state, doatMenh)).toBe(4 - 3);
    expect(getEffectiveCost(data, state, amTien)).toBe(0); // 2 − 3 → 0
    expect(getEffectiveCost(data, state, anhDau)).toBe(data.cards["bond_anh_dau"]!.cost);

    const played = applyAction(data, state, { type: "playCard", instanceId: doatMenh, targetId: "enemy:0" });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.moonPower).toBe(11 - 1);
    expect(getEffectiveCost(data, played.state, amTien)).toBe(2);

    // Moon phase reduction applies first: Thượng Huyền control −2, then −3, floored at 0.
    state.moonIndex = 2;
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_nguyet_anh_an"))).toBe(0);
  });
});
