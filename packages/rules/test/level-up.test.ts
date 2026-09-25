import { describe, expect, it } from "vitest";
import { applyAction, getEffectiveCost } from "../src/index";
import { idleIntent, regenThreeCard, stealthOneCard, strike9Intent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, setHand, setIntent, instanceIdOf } from "./helpers";

describe("hero level up", () => {
  it("T46: damageTaken counter levels M05 up mid-card", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[0]!.levelUpCounter = 12;
        setHand(s, ["m05_tran_bac_huyet_tinh"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_tran_bac_huyet_tinh"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.levelUpCounter).toBe(15);
    expect(result.state.heroes[0]?.leveledUp).toBe(true);
    expect(
      result.events.some((e) => e.type === "heroLeveledUp" && e.heroId === "hero:m05"),
    ).toBe(true);
  });

  it("T47: leveled M05's attack cards gain +3 damage", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.heroes[0]!.leveledUp = true;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_liet_hoa_xung_phong"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 11 });
  });

  it("T48: damageTaken counts only real HP lost, not blocked damage", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[0]!.armor = 5;
    setIntent(state, 0, heavy, "hero:m05");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.hp).toBe(36);
    expect(result.state.heroes[0]?.levelUpCounter).toBe(4);
  });

  it("T49: turnsWithAllyRegen ticks once per player turn and levels F04", () => {
    const { data, state } = makeTestCombat({
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.heroes[0]!.statuses.push({ id: "regen", value: 5 });
      },
    });
    let current = state;
    for (const expected of [1, 2, 3]) {
      const result = applyAction(data, current, { type: "endTurn" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
      expect(current.heroes[1]?.levelUpCounter).toBe(expected);
    }
    expect(current.heroes[1]?.leveledUp).toBe(true);
  });

  it("T50: leveled F04 spreads regen to every living hero", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.leveledUp = true;
      },
    });
    const regen = injectCard(state, data, regenThreeCard);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: regen,
      targetId: "hero:m05",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const hero of result.state.heroes) {
      expect(hero.statuses).toContainEqual({ id: "regen", value: 3 });
    }
  });

  it("T51: killing with a card levels M06 but the discount starts next turn", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.enemies[0]!.hp = 5;
        setHand(s, ["m06_am_tien"]);
      },
    });
    const stealth = injectCard(state, data, { ...stealthOneCard, cost: 2 });
    const killed = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(killed.ok).toBe(true);
    if (!killed.ok) return;
    expect(killed.state.enemies[0]?.alive).toBe(false);
    expect(killed.state.heroes[2]?.levelUpCounter).toBe(1);
    expect(killed.state.heroes[2]?.leveledUp).toBe(true);

    const played = applyAction(data, killed.state, {
      type: "playCard",
      instanceId: stealth,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 2 });
    expect(played.state.moonPower).toBe(7);
  });

  it("T52: first own card each turn costs 0 after M06 leveled", () => {
    const { data, state } = makeTestCombat({
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.heroes[2]!.leveledUp = true;
      },
    });
    const next = applyAction(data, state, { type: "endTurn" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    setHand(next.state, ["m06_am_tien"]);
    const stealth = injectCard(next.state, data, { ...stealthOneCard, cost: 2 });

    const free = applyAction(data, next.state, {
      type: "playCard",
      instanceId: stealth,
    });
    expect(free.ok).toBe(true);
    if (!free.ok) return;
    const fund =
      data.combatConfig.moonPower.start +
      data.combatConfig.moonPower.perRound +
      data.combatConfig.moonReserveMax;
    expect(free.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 0 });
    expect(free.state.moonPower).toBe(fund);

    const paid = applyAction(data, free.state, {
      type: "playCard",
      instanceId: instanceIdOf(free.state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 2 });
    expect(paid.state.moonPower).toBe(fund - 2);
  });

  it("T53: a kill by another hero does not raise M06's counter", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.enemies[0]!.hp = 5;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_liet_hoa_xung_phong"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.alive).toBe(false);
    expect(result.state.heroes[2]?.levelUpCounter).toBe(0);
    expect(result.state.heroes[2]?.leveledUp).toBe(false);
  });

  it("T54: a leveled hero never emits heroLeveledUp twice", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[0]!.leveledUp = true;
        s.heroes[0]!.levelUpCounter = 12;
        setHand(s, ["m05_tran_bac_huyet_tinh"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_tran_bac_huyet_tinh"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.levelUpCounter).toBe(15);
    expect(result.events.some((e) => e.type === "heroLeveledUp")).toBe(false);
  });
});
