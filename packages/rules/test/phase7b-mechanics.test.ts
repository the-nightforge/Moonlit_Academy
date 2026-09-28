import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, LevelUpPassive, SummonDef } from "../src/index";
import {
  applyAction,
  createCoopCombat,
  createPvpCombat,
  getValidTargets,
  previewEnemyIntent,
  summonEffect,
  viewFor,
} from "../src/index";
import { idleIntent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, setIntent, testData, withLevelUp } from "./helpers";

const rabbit: SummonDef = {
  id: "test_rabbit", name: "Thỏ", maxHp: 12, targeting: "lowestHp",
  action: [{ type: "damage", amount: 3, to: "chosen" }], awakenedId: "test_rabbit_up",
};
const rabbitUp: SummonDef = { ...rabbit, id: "test_rabbit_up", maxHp: 24, action: [{ type: "damage", amount: 6, to: "chosen" }] };
delete (rabbitUp as { awakenedId?: string }).awakenedId;

const withRabbits = (d: GameData) => {
  d.summons[rabbit.id] = rabbit;
  d.summons[rabbitUp.id] = rabbitUp;
};

const card = (partial: Partial<CardDef>): CardDef => ({
  id: "test_c", name: "C", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
  effects: [{ type: "gainMoonPower", amount: 0 }], text: "", ...partial,
});
const summonCard = card({ id: "test_summon", effects: [{ type: "summon", summonId: "test_rabbit" }] });

function play(data: GameData, state: CombatState, def: CardDef, targetId?: string) {
  const instanceId = injectCard(state, data, def);
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("phase 7b — Linh Thú: triệu hồi và hành động", () => {
  it("T280: summon creates one Linh Thú per hero; summoning again heals it and adds Sức Mạnh 1; summonsMade counts both", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { counter: "summonsMade", threshold: 99 })(d); },
    });
    const first = play(data, state, summonCard);
    expect(first.state.summons).toHaveLength(1);
    expect(first.state.summons![0]).toMatchObject({
      id: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04", side: "hero", player: 0,
      hp: 12, maxHp: 12, alive: true, position: 1,
    });
    expect(first.events).toContainEqual({ type: "summoned", unitId: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04" });

    first.state.summons![0]!.hp = 5;
    const again = play(data, first.state, { ...summonCard, id: "test_summon2" });
    expect(again.state.summons).toHaveLength(1);
    expect(again.state.summons![0]!.hp).toBe(12);
    expect(again.state.summons![0]!.statuses).toContainEqual({ id: "strength", value: 1 });
    expect(again.state.heroes[1]!.levelUpCounter).toBe(2);
    expect(state.summons).toBeUndefined(); // the input state was not mutated
  });

  it("T281: at the end of the player turn each Linh Thú acts on its targeting before the enemy turn; strength and weak apply", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); makeEnemiesIdle(d); },
    });
    const summoned = play(data, state, summonCard);
    const s = summoned.state;
    s.enemies[0]!.hp = 20;
    s.enemies[1]!.hp = 10; // lowestHp picks enemy:1
    s.summons![0]!.statuses.push({ id: "strength", value: 2 });
    const ended = applyAction(data, s, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    const acted = ended.events.findIndex((e) => e.type === "summonActed");
    const enemyTurn = ended.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    expect(acted).toBeGreaterThanOrEqual(0);
    expect(acted).toBeLessThan(enemyTurn);
    expect(ended.events).toContainEqual({ type: "damageDealt", sourceId: "summon:f04", targetId: "enemy:1", amount: 5, blocked: 0, hpLost: 5 });
  });
});

const strike6 = { id: "t_strike6", name: "Đánh", kind: "attack" as const, targeting: "lowestHp" as const, effects: [{ type: "damage" as const, amount: 6, to: "chosen" as const }] };
const sweep4 = { id: "t_sweep4", name: "Quét", kind: "attack" as const, effects: [{ type: "damage" as const, amount: 4, to: "allEnemies" as const }] };

describe("phase 7b — Linh Thú: bị nhắm và vòng đời", () => {
  const summoned = () => {
    const t = makeTestCombat({ mutateData: withRabbits });
    const r = play(t.data, t.state, summonCard);
    return { data: t.data, state: r.state };
  };

  it("T282: single-target intents skip a Linh Thú unless it taunts (heroes first); area intents hit it; planning never picks it", () => {
    const { data, state } = summoned();
    state.summons![0]!.hp = 1; // lowest HP on the board, still not picked
    setIntent(state, 0, strike6, "hero:m05");
    setIntent(state, 1, sweep4, null);
    const plain = applyAction(data, state, { type: "endTurn" });
    if (!plain.ok) throw new Error(plain.error);
    expect(plain.events).not.toContainEqual(expect.objectContaining({ type: "intentExecuted", targetId: "summon:f04" }));
    expect(plain.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:1", targetId: "summon:f04" }));

    const taunting = structuredClone(state);
    taunting.summons![0]!.hp = 12;
    taunting.summons![0]!.statuses.push({ id: "taunt", value: 1 });
    expect(previewEnemyIntent(data, taunting, taunting.enemies[0]!)!.intents[0]!.targetId).toBe("summon:f04");
    const soaked = applyAction(data, taunting, { type: "endTurn" });
    if (!soaked.ok) throw new Error(soaked.error);
    expect(soaked.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "summon:f04" }));

    const heroTaunts = structuredClone(taunting);
    heroTaunts.heroes[2]!.statuses.push({ id: "taunt", value: 1 });
    const heroFirst = applyAction(data, heroTaunts, { type: "endTurn" });
    if (!heroFirst.ok) throw new Error(heroFirst.error);
    expect(heroFirst.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m06" }));
  });

  it("T283: a Linh Thú dies and leaves; its owner's death dismisses it; summons never decide defeat; ally cards can target it", () => {
    const { data, state } = summoned();
    const healCard = card({ id: "test_heal", ownerId: "m05", target: "ally", effects: [{ type: "heal", amount: 2, to: "chosen" }] });
    state.summons![0]!.hp = 5;
    const healId = injectCard(state, data, healCard);
    expect(getValidTargets(data, state, healId)).toContain("summon:f04");

    const killed = structuredClone(state);
    killed.summons![0]!.hp = 1;
    setIntent(killed, 0, idleIntent, null);
    setIntent(killed, 1, sweep4, null);
    const r1 = applyAction(data, killed, { type: "endTurn" });
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.events).toContainEqual({ type: "unitDied", unitId: "summon:f04", killerId: "enemy:1" });
    expect(r1.state.summons).toEqual([]);

    const ownerDies = structuredClone(state);
    ownerDies.heroes[1]!.hp = 1;
    setIntent(ownerDies, 0, { ...strike6, targeting: "front" }, "hero:f04");
    ownerDies.heroes[0]!.statuses.push({ id: "stealth", value: 1 });
    setIntent(ownerDies, 1, idleIntent, null);
    const r2 = applyAction(data, ownerDies, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.events).toContainEqual({ type: "summonDismissed", unitId: "summon:f04" });
    expect(r2.state.summons).toEqual([]);

    const allHeroesDown = structuredClone(state);
    for (const hero of allHeroesDown.heroes) { hero.hp = 1; }
    setIntent(allHeroesDown, 0, idleIntent, null);
    setIntent(allHeroesDown, 1, sweep4, null);
    const r3 = applyAction(data, allHeroesDown, { type: "endTurn" });
    if (!r3.ok) throw new Error(r3.error);
    expect(r3.state.status).toBe("lost");
  });

  it("T283b: a Linh Thú that dies to its own action's reflect damage is removed cleanly (no throw)", () => {
    const { data, state } = summoned();
    // lowestHp targeting picks enemy:1; its reflect matches the summon's full HP.
    state.enemies[0]!.hp = 100;
    state.enemies[1]!.hp = 50;
    state.enemies[1]!.statuses.push({ id: "reflect", value: 12 });
    setIntent(state, 0, idleIntent, null);
    setIntent(state, 1, idleIntent, null);
    expect(() => applyAction(data, state, { type: "endTurn" })).not.toThrow();
    const r = applyAction(data, state, { type: "endTurn" });
    if (!r.ok) throw new Error(r.error);
    expect(r.events).toContainEqual({ type: "unitDied", unitId: "summon:f04", killerId: "enemy:1" });
    expect(r.state.summons).toEqual([]);
  });

  it("T284: awakenSummons swaps the Linh Thú to its awakened def on level-up (keeping the HP ratio); summonTaunts gives Khiêu Khích", () => {
    const t = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { counter: "summonsMade", threshold: 2, passive: { type: "awakenSummons" } })(d); },
    });
    const first = play(t.data, t.state, summonCard);
    first.state.summons![0]!.hp = 6; // half
    const second = play(t.data, first.state, { ...summonCard, id: "test_summon2" });
    // the refresh heals to 12 first, then the level-up awakens at a full ratio
    expect(second.state.heroes[1]!.leveledUp).toBe(true);
    expect(second.state.summons![0]).toMatchObject({ summonId: "test_rabbit_up", maxHp: 24, hp: 24 });

    const taunt = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { passive: { type: "summonTaunts", rounds: 1 } })(d); },
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    const tauntSummon = play(taunt.data, taunt.state, summonCard);
    expect(tauntSummon.state.summons![0]!.statuses).toContainEqual({ id: "taunt", value: 1 });
  });

  it("T285: PvP — an opposing Linh Thú is a valid single target and its taunt forces picks; viewFor shows both sides' summons", () => {
    const data = testData();
    withRabbits(data);
    const loadout = { heroes: {}, pvp: true as const };
    let state = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    const attacker = state.activePlayer;
    const defender = 1 - attacker;
    const defF04 = state.heroes.find((h) => h.player === defender && h.defId === "f04")!;
    summonEffect(data, state, defF04, "test_rabbit", []);
    const summonId = `p${defender}_summon:f04`;
    const poke = injectCard(state, data, card({ id: "test_poke", ownerId: "m06", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 3, to: "chosen" }] }));
    state.players[0]!.hand = state.players[0]!.hand.filter((id) => id !== poke);
    state.cards[poke]!.player = attacker;
    state.players[attacker]!.hand.push(poke);
    expect(getValidTargets(data, state, poke)).toContain(summonId);
    state.summons![0]!.statuses.push({ id: "taunt", value: 2 });
    expect(getValidTargets(data, state, poke)).toEqual([summonId]);
    expect(viewFor(state, attacker).summons!.map((s) => s.id)).toEqual([summonId]);
  });

  it("T286: co-op — both seats' Linh Thú act after both seats are done, seat 0 first", () => {
    const data = testData();
    withRabbits(data);
    makeEnemiesIdle(data);
    const side = { heroIds: ["m05", "f04", "m06"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    for (const hero of state.heroes.filter((h) => h.defId === "f04")) summonEffect(data, state, hero, "test_rabbit", []);
    const first = applyAction(data, state, { type: "endTurn", player: 0 });
    if (!first.ok) throw new Error(first.error);
    expect(first.events.some((e) => e.type === "summonActed")).toBe(false);
    const second = applyAction(data, first.state, { type: "endTurn", player: 1 });
    if (!second.ok) throw new Error(second.error);
    const acted = second.events.filter((e) => e.type === "summonActed").map((e) => (e as { unitId: string }).unitId);
    expect(acted).toEqual(["p0_summon:f04", "p1_summon:f04"]);
  });
});
