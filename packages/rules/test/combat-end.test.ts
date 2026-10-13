import { describe, expect, it } from "vitest";
import { applyAction, createPvpCombat, isCardPlayable } from "../src/index";
import { aoeFiveCard, healFiveCard, idleIntent, killThenArmorCard, strike9Intent } from "./fixtures";
import { injectCard, instanceIdOf, makeEnemiesIdle, makeTestCombat, setIntent, testData, p0 } from "./helpers";

describe("combat end", () => {
  it("T57: killing the last enemy wins the combat", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
      },
    });
    const aoe = injectCard(state, data, aoeFiveCard);
    const result = applyAction(data, state, { type: "playCard", instanceId: aoe });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(result.events.some((event) => event.type === "unitDied" && event.unitId === "enemy:1")).toBe(true);
    expect(result.events.at(-1)).toMatchObject({ type: "combatEnded", result: "won" });
  });

  it("T58: actions are rejected after the combat ended", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
      },
    });
    const aoe = injectCard(state, data, aoeFiveCard);
    const heal = injectCard(state, data, healFiveCard);
    const won = applyAction(data, state, { type: "playCard", instanceId: aoe });
    expect(won.ok).toBe(true);
    if (!won.ok) return;

    const play = applyAction(data, won.state, {
      type: "playCard",
      instanceId: heal,
      targetId: "hero:m05",
    });
    expect(play.ok).toBe(false);
    expect(applyAction(data, won.state, { type: "endTurn" }).ok).toBe(false);
  });

  it("T60: remaining effects are skipped once the combat ends", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
      },
    });
    const instanceId = injectCard(state, data, killThenArmorCard);
    const result = applyAction(data, state, { type: "playCard", instanceId, targetId: "enemy:1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(result.state.heroes[0]?.armor).toBe(0);
    expect(result.events.some((event) => event.type === "armorGained")).toBe(false);
  });

  it("T55: a dead hero's cards become broken", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[2]!.hp = 5;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[2]?.alive).toBe(false);
    expect(
      result.events.some((e) => e.type === "unitDied" && e.unitId === "hero:m06"),
    ).toBe(true);

    const m06Card = instanceIdOf(result.state, "m06_am_tien");
    p0(result.state).hand.push(m06Card);
    expect(isCardPlayable(data, result.state, m06Card)).toBe(false);
    const attempt = applyAction(data, result.state, {
      type: "playCard",
      instanceId: m06Card,
      targetId: "enemy:0",
    });
    expect(attempt.ok).toBe(false);
  });

  it("T56: a dead hero cannot be targeted by ally cards", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[2]!.hp = 5;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const heal = injectCard(result.state, data, healFiveCard);
    const attempt = applyAction(data, result.state, {
      type: "playCard",
      instanceId: heal,
      targetId: "hero:m06",
    });
    expect(attempt.ok).toBe(false);
  });

  it("T59: losing the last hero loses the combat", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[0]!.alive = false;
    state.heroes[0]!.hp = 0;
    state.heroes[2]!.alive = false;
    state.heroes[2]!.hp = 0;
    state.heroes[1]!.hp = 3;
    setIntent(state, 0, heavy, "hero:f04");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("lost");
    expect(result.events.at(-1)).toMatchObject({ type: "combatEnded", result: "lost" });
  });

  it("T343: Kiệt Sức does not tick before startRound", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => makeEnemiesIdle(d),
      setup: (s) => {
        s.round = 18; // enemy turn ticks at 18, next player turn at 19 — both < 20
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.some((e) => e.type === "hpLost" && e.cause === "fatigue")).toBe(false);
    expect(result.state.status).toBe("playerTurn");
  });

  it("T344: Kiệt Sức ticks both sides on their turn starts, escalating +1 per round", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => makeEnemiesIdle(d),
      setup: (s) => {
        s.round = 20; // enemy turn ticks 20-20+1=1; player turn 21 ticks 21-20+1=2
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fatigue = result.events.filter((e) => e.type === "hpLost" && e.cause === "fatigue");
    // Enemy side bled 1 each at enemy turn start (round 20).
    expect(fatigue).toContainEqual({ type: "hpLost", targetId: "enemy:0", amount: 1, cause: "fatigue" });
    expect(fatigue).toContainEqual({ type: "hpLost", targetId: "enemy:1", amount: 1, cause: "fatigue" });
    // Hero side bled 2 each at the next player turn start (round 21).
    for (const id of ["hero:m05", "hero:f04", "hero:m06"]) {
      expect(fatigue).toContainEqual({ type: "hpLost", targetId: id, amount: 2, cause: "fatigue" });
    }
  });

  it("T345: Kiệt Sức kills — a stalled fight resolves", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => makeEnemiesIdle(d),
      setup: (s) => {
        s.round = 20;
        s.enemies[0]!.hp = 1;
        s.enemies[1]!.hp = 1;
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(result.events.filter((e) => e.type === "unitDied")).toHaveLength(2);
    expect(result.events.at(-1)).toMatchObject({ type: "combatEnded", result: "won" });
  });

  it("T346: surrender concedes a live PvE combat at any status; PvP rejects it", () => {
    // Mid player turn.
    const mid = makeTestCombat();
    const r1 = applyAction(mid.data, mid.state, { type: "surrender" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.status).toBe("lost");
    expect(r1.events).toContainEqual({ type: "combatEnded", result: "lost" });

    // During mulligan — combat still live.
    const mull = makeTestCombat({ mulligan: "pending" });
    const r2 = applyAction(mull.data, mull.state, { type: "surrender" });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.status).toBe("lost");

    // After the combat ended — rejected.
    expect(applyAction(mid.data, r1.state, { type: "surrender" }).ok).toBe(false);

    // PvP — resign must go through server `forfeit`, not client surrender.
    const pvpData = testData();
    const side = (heroIds: [string, string, string]) => ({ heroIds, loadout: { heroes: {}, pvp: true as const } });
    const pvp = createPvpCombat(pvpData, {
      seed: 7,
      players: [side(["m05", "f04", "m06"]), side(["f03", "f02", "m03"])],
    }).state;
    const r3 = applyAction(pvpData, pvp, { type: "surrender", player: 0 });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toContain("pve");
  });
});
