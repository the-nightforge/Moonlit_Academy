import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, isCardPlayable } from "../src/index";
import { idleIntent, stealOneCard, strike9Intent, twoHitCard } from "./fixtures";
import {
  idleEnemies,
  injectCard,
  instanceIdOf,
  makeEnemiesIdle,
  makeTestCombat,
  setHand,
  setIntent,
} from "./helpers";

const PHASE2_TEAM: [string, string, string] = ["m05", "f03", "f02"];

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

describe("reflect", () => {
  it("T61: a hit on a reflecting hero makes the attacker lose HP", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    hero(state, "f03").statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, strike9Intent, "hero:f03");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f03").hp).toBe(23);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 2);
    const hit = result.events.findIndex((e) => e.type === "damageDealt" && e.targetId === "hero:f03");
    expect(result.events[hit + 1]).toEqual({
      type: "hpLost",
      targetId: "enemy:0",
      amount: 2,
      cause: "reflect",
    });
  });

  it("T62: reflect triggers even when armor blocks the whole hit", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    const f03 = hero(state, "f03");
    f03.armor = 20;
    f03.statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, strike9Intent, "hero:f03");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetId: "hero:f03", blocked: 9, hpLost: 0 }),
    );
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 2);
  });

  it("T63: reflect triggers on every hit of a multi-hit attack", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    hero(state, "f03").statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, idleIntent, null);
    setIntent(state, 1, data.enemies["shadow_fox"]!.intents.find((i) => i.id === "twin_claw")!, "hero:f03");

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[1]?.hp).toBe(state.enemies[1]!.hp - 4);
  });

  it("T64: reflect is removed together with armor at the start of its side's turn", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    hero(state, "f03").statuses.push({ id: "reflect", value: 2 });
    state.enemies[0]!.statuses.push({ id: "reflect", value: 3 });

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f03").statuses).toEqual([]);
    expect(result.state.enemies[0]?.statuses).toEqual([]);
    const enemyTurn = result.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    const heroTurn = result.events.findIndex((e) => e.type === "turnStarted" && e.side === "hero");
    const removed = (targetId: string) =>
      result.events.findIndex(
        (e) => e.type === "statusRemoved" && e.targetId === targetId && e.status === "reflect",
      );
    expect(removed("enemy:0")).toBeGreaterThan(enemyTurn);
    expect(removed("hero:f03")).toBeGreaterThan(heroTurn);
  });

  it("T65: an attacker killed by reflect stops its card; the card is still discarded", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      encounterId: "enc_04",
    });
    const twoHit = injectCard(state, data, twoHitCard);
    hero(state, "f03").hp = 3;
    state.enemies[0]!.statuses.push({ id: "reflect", value: 3 });

    const result = play(data, state, twoHitCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const f03 = hero(result.state, "f03");
    expect(f03.alive).toBe(false);
    expect(result.events.filter((e) => e.type === "damageDealt")).toHaveLength(1);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 4);
    expect(result.events).toContainEqual({ type: "unitDied", unitId: "hero:f03", killerId: "enemy:0" });
    expect(result.state.discardPile).toContain(twoHit);
  });

  it("T66: an enemy killed by reflect credits the reflector but not enemiesKilled", () => {
    const { data, state } = makeTestCombat();
    hero(state, "m06").statuses.push({ id: "reflect", value: 2 });
    state.enemies[0]!.hp = 2;
    setIntent(state, 0, strike9Intent, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.alive).toBe(false);
    expect(result.events).toContainEqual({ type: "unitDied", unitId: "enemy:0", killerId: "hero:m06" });
    expect(hero(result.state, "m06").levelUpCounter).toBe(0);
    expect(hero(result.state, "m06").hp).toBe(19);
  });
});

describe("stealBuff", () => {
  it("T67: steals the first buff in status order and counts it", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    injectCard(state, data, stealOneCard);
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 }, { id: "regen", value: 1 });

    const result = play(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.statuses).toEqual([{ id: "regen", value: 1 }]);
    const f02 = hero(result.state, "f02");
    expect(f02.statuses).toContainEqual({ id: "strength", value: 2 });
    expect(f02.levelUpCounter).toBe(1);
    const removed = result.events.findIndex((e) => e.type === "statusRemoved" && e.targetId === "enemy:0");
    expect(result.events[removed + 1]).toEqual({
      type: "statusApplied",
      targetId: "hero:f02",
      status: "strength",
      value: 2,
    });
  });

  it("T68: a stolen buff merges with the same buff on the thief", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    injectCard(state, data, stealOneCard);
    hero(state, "f02").statuses.push({ id: "strength", value: 1 });
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = play(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").statuses).toEqual([{ id: "strength", value: 3 }]);
  });

  it("T95: Ảnh Tập steals first, so a stolen strength boosts its own hit", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      setup: (s) => setHand(s, ["f02_anh_tap"]),
    });
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = play(data, state, "f02_anh_tap", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").statuses).toEqual([{ id: "strength", value: 2 }]);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", sourceId: "hero:f02", targetId: "enemy:0", amount: 8 }),
    );
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 8);
  });

  it("T70: nothing happens when the target has no buff", () => {
    const { data, state } = makeTestCombat({ heroIds: PHASE2_TEAM });
    injectCard(state, data, stealOneCard);
    state.enemies[0]!.statuses.push({ id: "weak", value: 1 });

    const result = play(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.events.filter((e) => e.type === "statusRemoved" || e.type === "statusApplied"),
    ).toEqual([]);
    expect(result.state.enemies[0]?.statuses).toEqual([{ id: "weak", value: 1 }]);
    expect(hero(result.state, "f02").levelUpCounter).toBe(0);
  });
});

describe("blood moon", () => {
  it("T71: Đổi Vận Chú starts a 2-round blood moon and shifts the moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });

    const result = play(data, state, "f02_doi_van_chu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(2);
    expect(result.state.moonIndex).toBe(2);
    expect(result.events).toContainEqual({ type: "bloodMoonChanged", rounds: 2, cause: "card" });
  });

  it("T72: the last blood moon round ends at round end without an HP loss", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 1;

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(0);
    expect(result.events).toContainEqual({ type: "bloodMoonChanged", rounds: 0, cause: "roundEnd" });
    expect(result.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon")).toBe(false);
    expect(result.state.heroes.map((h) => h.hp)).toEqual(result.state.heroes.map((h) => h.maxHp));
  });

  it("T73: every living hero loses 2 HP at turn start, after status ticks", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 2;
    hero(state, "m05").statuses.push({ id: "burn", value: 1 });

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(1);
    const losses = result.events.filter((e) => e.type === "hpLost");
    expect(losses.map((e) => e.type === "hpLost" && [e.targetId, e.cause])).toEqual([
      ["hero:m05", "burn"],
      ["hero:m05", "bloodMoon"],
      ["hero:f03", "bloodMoon"],
      ["hero:f02", "bloodMoon"],
    ]);
    expect(hero(result.state, "m05").hp).toBe(37);
    expect(hero(result.state, "m05").levelUpCounter).toBe(3);
    expect(hero(result.state, "f02").hp).toBe(24);
  });

  it("T74: a requiresBloodMoon card is rejected outside blood moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      setup: (s) => setHand(s, ["f02_phe_hon"]),
    });

    const result = play(data, state, "f02_phe_hon", "enemy:0");
    expect(result).toEqual({ ok: false, error: "requires blood moon" });
    expect(isCardPlayable(data, state, instanceIdOf(state, "f02_phe_hon"))).toBe(false);
  });

  it("T75: Phệ Hồn is playable during blood moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["f02_phe_hon"]);
      },
    });
    state.bloodMoonRounds = 1;
    expect(isCardPlayable(data, state, instanceIdOf(state, "f02_phe_hon"))).toBe(true);

    const result = play(data, state, "f02_phe_hon", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").hp).toBe(23);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 16);
  });

  it("T76: a shorter bloodMoon does not shorten an active one", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });
    state.bloodMoonRounds = 3;

    const result = play(data, state, "f02_doi_van_chu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(3);
    expect(result.events.some((e) => e.type === "bloodMoonChanged")).toBe(false);
  });

  it("T77: blood moon HP loss can lose the combat", () => {
    const { data, state } = makeTestCombat({
      heroIds: PHASE2_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 2;
    for (const h of state.heroes) {
      if (h.defId !== "f02") {
        h.hp = 0;
        h.alive = false;
      }
    }
    hero(state, "f02").hp = 2;

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("lost");
    expect(result.events).toContainEqual({ type: "combatEnded", result: "lost" });
  });
});
