import { describe, expect, it } from "vitest";
import { applyAction, getEffectiveCost } from "../src/index";
import {
  endTestTurn,
  idleEnemies,
  instanceIdOf,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  setHand,
} from "./helpers";

describe("moon power economy", () => {
  it("T128: base moon power ramps by round and caps at the configured cap", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    const { start, perRound, cap } = data.combatConfig.moonPower;
    expect(p0(state).moonPower).toBe(start);
    let current = state;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      p0(current).moonPower = 0; // spend everything: no reserve
      current = endTestTurn(data, current).state;
      seen.push(p0(current).moonPower);
    }
    expect(seen).toEqual(
      Array.from({ length: 7 }, (_, i) => Math.min(cap, start + perRound * (i + 1))),
    );
  });

  it("T129: unspent moon power carries over as reserve (max 3) and can exceed the cap", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    const { start, perRound, cap } = data.combatConfig.moonPower;
    const reserveMax = data.combatConfig.moonReserveMax;
    const r2 = endTestTurn(data, state);
    expect(p0(r2.state).moonReserve).toBe(reserveMax);
    expect(p0(r2.state).moonPower).toBe(start + perRound + reserveMax);
    expect(r2.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: reserveMax });

    p0(r2.state).moonPower = 5; // more than the reserve max left unspent
    const r3 = endTestTurn(data, r2.state);
    expect(p0(r3.state).moonReserve).toBe(reserveMax);
    expect(p0(r3.state).moonPower).toBe(Math.min(cap, start + perRound * 2) + reserveMax);

    let current = r3.state;
    for (let i = 0; i < 4; i++) current = endTestTurn(data, current).state;
    expect(current.round).toBe(7);
    expect(p0(current).moonPower).toBe(Math.min(cap, start + perRound * 6) + reserveMax);

    p0(current).moonPower = 0;
    const drained = endTestTurn(data, current);
    expect(p0(drained.state).moonReserve).toBe(0);
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: 0 });
  });

  it("T146: leveled-up M06 gets −3 on his first own card each turn, never below 0, not on bond cards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m06", "f02", "f03"],
      setup: (s) => {
        const m06 = s.heroes[0]!;
        m06.leveledUp = true;
        m06.firstCardDiscountActive = true;
        p0(s).moonPower = 11;
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
    expect(p0(played.state).moonPower).toBe(11 - 1);
    expect(getEffectiveCost(data, played.state, amTien)).toBe(2);

    // Moon phase reduction applies first: Thượng Huyền control −2, then −3, floored at 0.
    state.moonIndex = 2;
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_nguyet_anh_an"))).toBe(0);
  });
});
