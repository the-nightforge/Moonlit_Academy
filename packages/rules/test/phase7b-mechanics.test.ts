import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, LevelUpPassive, SummonDef } from "../src/index";
import {
  applyAction,
  coopBot,
  createCoopCombat,
  createPvpCombat,
  getEffectiveCost,
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

  it("T286b: coopBot picking an ally target to finish a Hợp Kích does not throw when a Linh Thú is a valid target", () => {
    const data = testData();
    withRabbits(data);
    makeEnemiesIdle(data);
    // A fake combo whose "mine" half is an ally-target card and whose "theirs"
    // half the partner (seat 1) already played this turn.
    data.coopCombos["test_combo"] = {
      id: "test_combo", name: "T", text: "",
      parts: [{ effect: "gainMoonPower" }, { effect: "heal" }],
      limit: { perRound: 1 },
      effects: [{ type: "heal", amount: 1, to: "allAllies" }],
    };
    data.cards["test_partner_heal"] = card({ id: "test_partner_heal", ownerId: "m05", target: "ally", effects: [{ type: "heal", amount: 1, to: "chosen" }] });
    const side = { heroIds: ["m05", "f04", "m06"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    const f04 = state.heroes.find((h) => h.player === 0 && h.defId === "f04")!;
    summonEffect(data, state, f04, "test_rabbit", []);
    const partnerInstanceId = "p1_test_partner_heal";
    state.cards[partnerInstanceId] = { instanceId: partnerInstanceId, cardId: "test_partner_heal", ownerIds: ["m05"], player: 1, heldTurns: 0 };
    state.playedThisTurn = [{ player: 1, instanceId: partnerInstanceId, cardId: "test_partner_heal", moonAfter: state.moonIndex }];
    const myCard = card({ id: "test_combo_card", ownerId: "f04", target: "ally", effects: [{ type: "gainMoonPower", amount: 0 }] });
    injectCard(state, data, myCard);
    expect(() => coopBot(data, state, 0)).not.toThrow();
  });
});

describe("phase 7b — Mê Hoặc", () => {
  it("T287: a charmed enemy's single-target intent hits another living enemy (highest HP), consuming one charge; alone it fizzles; the preview shows the redirect", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.statuses.push({ id: "charm", value: 1, sourceId: "hero:f04" });
        setIntent(s, 0, strike6, "hero:m05");
        setIntent(s, 1, idleIntent, null);
      },
    });
    expect(previewEnemyIntent(data, state, state.enemies[0]!)!.intents[0]!.targetId).toBe("enemy:1");
    const r = applyAction(data, state, { type: "endTurn" });
    if (!r.ok) throw new Error(r.error);
    expect(r.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "enemy:1" }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 6 }));
    expect(r.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);

    const alone = structuredClone(state);
    alone.enemies[1]!.alive = false;
    alone.enemies[1]!.hp = 0;
    const r2 = applyAction(data, alone, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.events).toContainEqual({ type: "intentFizzled", enemyId: "enemy:0", intentId: "t_strike6" });
    expect(r2.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T288: charmsApplied counts; charmMastery adds a charge and ×1.5; stealthOnCharm hides the charmer; PvP charm turns the first attack onto an ally", () => {
    const charmCard = card({ id: "test_charm", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "charm", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "charmsApplied", threshold: 99 }) });
    expect(play(counting.data, counting.state, charmCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const mastery = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "charmMastery", extraCharges: 1, damageMultiplier: 1.5 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; setIntent(s, 0, strike6, "hero:m05"); setIntent(s, 1, idleIntent, null); },
    });
    const charmed = play(mastery.data, mastery.state, charmCard, "enemy:0");
    expect(charmed.state.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 2, sourceId: "hero:f04" });
    const hit = applyAction(mastery.data, charmed.state, { type: "endTurn" });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 9 }));

    const vuY = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "stealthOnCharm", rounds: 1 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    expect(play(vuY.data, vuY.state, charmCard, "enemy:0").state.heroes[1]!.statuses).toContainEqual({ id: "stealth", value: 1 });

    // PvP
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const myM06 = pvp.heroes.find((h) => h.player === me && h.defId === "m06")!;
    myM06.statuses.push({ id: "charm", value: 1, sourceId: "x" });
    const myM05 = pvp.heroes.find((h) => h.player === me && h.defId === "m05")!; // HP 52 in PvP: highest ally
    const foe = pvp.heroes.find((h) => h.player !== me)!;
    const strike = injectCard(pvp, data, card({ id: "test_pvp_strike", ownerId: "m06", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 4, to: "chosen" }] }));
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== strike);
    pvp.cards[strike]!.player = me;
    pvp.players[me]!.hand.push(strike);
    const turned = applyAction(data, pvp, { type: "playCard", instanceId: strike, targetId: foe.id, player: me });
    if (!turned.ok) throw new Error(turned.error);
    expect(turned.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: myM06.id, targetId: myM05.id }));
    expect(turned.state.heroes.find((h) => h.id === myM06.id)!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T294: debuffsApplied counts debuffs from the hero; debuffDurationBonus lengthens them; bonusVsDebuffed adds damage; extendDebuffs lengthens existing debuffs", () => {
    const weakCard = card({ id: "test_weak", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "weak", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "debuffsApplied", threshold: 99 }) });
    expect(play(counting.data, counting.state, weakCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const longer = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "debuffDurationBonus", amount: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    expect(play(longer.data, longer.state, weakCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 2 });

    const bonus = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "bonusVsDebuffed", minDebuffs: 2, amount: 3 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "mark", value: 1, sourceId: "x" }); },
    });
    const hit = play(bonus.data, bonus.state, card({ id: "test_hit", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const extend = makeTestCombat({ setup: (s) => { s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "burn", value: 3 }); } });
    const ext = play(extend.data, extend.state, card({ id: "test_ext", ownerId: "f04", target: "enemy", effects: [{ type: "extendDebuffs", amount: 1, to: "chosen" }] }), "enemy:0");
    expect(ext.state.enemies[0]!.statuses).toEqual([{ id: "weak", value: 2 }, { id: "burn", value: 3 }]);
  });
});

describe("phase 7b — Phong Ấn", () => {
  const sealCard = card({ id: "test_seal", ownerId: "f04", target: "enemy", effects: [{ type: "sealIntent", to: "chosen" }] });
  const cheap = { id: "t_cheap", name: "Rẻ", kind: "attack" as const, targeting: "front" as const, effects: [{ type: "damage" as const, amount: 1, to: "chosen" as const }] };
  const dear = { ...cheap, id: "t_dear", name: "Đắt", effects: [{ type: "damage" as const, amount: 9, to: "chosen" as const }] };

  const withPlan = (s: CombatState) => {
    s.enemies[0]!.plannedIntents = [
      { intent: cheap, cost: 1, targetId: "hero:m05" },
      { intent: dear, cost: 3, targetId: "hero:m05" },
    ];
    setIntent(s, 1, idleIntent, null);
  };

  it("T289: sealIntent cancels the priciest planned intent, it cannot lead next round; the first seal each turn cancels one more with sealExtraFirstPerTurn; sealWeakens applies weak; intentsSealed counts", () => {
    const t = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "intentsSealed", threshold: 99 }), setup: withPlan });
    const sealed = play(t.data, t.state, sealCard, "enemy:0");
    expect(sealed.events).toContainEqual({ type: "intentsCancelled", enemyId: "enemy:0", intentIds: ["t_dear"] });
    expect(sealed.state.enemies[0]!.plannedIntents.map((p) => p.intent.id)).toEqual(["t_cheap"]);
    expect(sealed.state.heroes[1]!.levelUpCounter).toBe(1);
    const next = applyAction(t.data, sealed.state, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.enemies[0]!.sealedIntentIds).toBeUndefined();
    // lastIntentIds after the enemy turn carried the sealed id, so planning could not lead with it.
    expect(
      next.events
        .filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0")
        .map((e) => (e as { intentId: string }).intentId),
    ).toEqual(["t_cheap"]);

    const extra = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealExtraFirstPerTurn" } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    const twice = play(extra.data, extra.state, sealCard, "enemy:0");
    expect(twice.state.enemies[0]!.plannedIntents).toEqual([]);
    expect(twice.state.heroes[1]!.firstSealUsedThisTurn).toBe(true);

    const weakens = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    expect(play(weakens.data, weakens.state, sealCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 1 });
  });

  it("T290: PvP sealIntent makes the opponent's priciest hand card cost 1 more during their next turn only", () => {
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const them = 1 - me;
    const seal = injectCard(pvp, data, sealCard);
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== seal);
    pvp.cards[seal]!.player = me;
    pvp.players[me]!.hand.push(seal);
    const foe = pvp.heroes.find((h) => h.player === them && h.alive)!;
    const sealed = applyAction(data, pvp, { type: "playCard", instanceId: seal, targetId: foe.id, player: me });
    if (!sealed.ok) throw new Error(sealed.error);
    const marked = sealed.state.players[them]!.hand.filter((id) => sealed.state.cards[id]!.sealSurcharge === 1);
    expect(marked).toHaveLength(1);
    const cost = (s: CombatState, id: string) => getEffectiveCost(data, s, id);
    // The marked card was the priciest when sealed (its cost now includes the +1).
    const unsealed = sealed.state.players[them]!.hand.map((id) => cost(sealed.state, id) - (id === marked[0] ? 1 : 0));
    expect(cost(sealed.state, marked[0]!) - 1).toBe(Math.max(...unsealed));

    // My own turn end must not clear it; it holds through their turn (the moon may have moved — compare with the surcharge removed).
    const theirTurn = applyAction(data, sealed.state, { type: "endTurn", player: me });
    if (!theirTurn.ok) throw new Error(theirTurn.error);
    const plain = structuredClone(theirTurn.state);
    delete plain.cards[marked[0]!]!.sealSurcharge;
    expect(cost(theirTurn.state, marked[0]!)).toBe(cost(plain, marked[0]!) + 1);

    const afterTheirs = applyAction(data, theirTurn.state, { type: "endTurn", player: them });
    if (!afterTheirs.ok) throw new Error(afterTheirs.error);
    expect(afterTheirs.state.cards[marked[0]!]!.sealSurcharge).toBeUndefined();
  });

  it("T290b: PvP seal on an empty hand does nothing; sealWeakens weakens the target hero", () => {
    const data = testData();
    withLevelUp("f04", { counter: "intentsSealed", threshold: 99 })(data);
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const them = 1 - me;
    const seal = injectCard(pvp, data, sealCard);
    pvp.cards[seal]!.player = me;
    pvp.players[me]!.hand.push(seal);
    const foe = pvp.heroes.find((h) => h.player === them && h.alive)!;
    // Empty hand → no surcharge, no intentsSealed bump (`01` §5.6 "tay rỗng → không có tác dụng").
    const empty = structuredClone(pvp);
    empty.players[them]!.hand = [];
    const noop = applyAction(data, empty, { type: "playCard", instanceId: seal, targetId: foe.id, player: me });
    if (!noop.ok) throw new Error(noop.error);
    expect(noop.state.heroes.find((h) => h.player === me && h.defId === "f04")!.levelUpCounter).toBe(0);
    // Chép Sử: a real surcharge carries the weak rider onto the target hero (×2, `01` §15.3).
    const data2 = testData();
    withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } })(data2);
    let pvp2 = createPvpCombat(data2, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data2, pvp2, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp2 = r.state;
    }
    const seal2 = injectCard(pvp2, data2, sealCard);
    pvp2.cards[seal2]!.player = me;
    pvp2.players[me]!.hand.push(seal2);
    pvp2.heroes.find((h) => h.player === me && h.defId === "f04")!.leveledUp = true;
    const hit = applyAction(data2, pvp2, { type: "playCard", instanceId: seal2, targetId: foe.id, player: me });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.state.heroes.find((h) => h.id === foe.id)!.statuses).toContainEqual({ id: "weak", value: 2 });
  });
});

describe("phase 7b — Hồi Hồn", () => {
  const reviveCard = card({ id: "test_revive", ownerId: "f04", target: "fallenAlly", effects: [{ type: "revive", ratio: 0.5, to: "chosen" }] });
  const down = (s: CombatState, index: number) => {
    const hero = s.heroes[index]!;
    hero.hp = 0;
    hero.alive = false;
  };

  it("T291: revive raises a fallen ally once at ratio × maxHp, reshuffles its purged cards into the draw pile; fallenAlly lists only fallen, unrevived allies", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle });
    // Kill m05 through the real path so its draw-pile cards are purged.
    state.heroes[0]!.hp = 1;
    const s = structuredClone(state);
    const m05Pile = p0(s).drawPile.filter((id) => s.cards[id]!.ownerIds.includes("m05"));
    const cut = card({ id: "test_cut", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 1, to: "chosen" }] });
    const killed = play(data, s, cut, "hero:m05");
    expect(killed.state.heroes[0]!.alive).toBe(false);
    expect(killed.state.players[0]!.purged!["hero:m05"]).toEqual(m05Pile);

    const reviveId = injectCard(killed.state, data, reviveCard);
    expect(getValidTargets(data, killed.state, reviveId)).toEqual(["hero:m05"]);
    const raised = applyAction(data, killed.state, { type: "playCard", instanceId: reviveId, targetId: "hero:m05" });
    if (!raised.ok) throw new Error(raised.error);
    const m05 = raised.state.heroes[0]!;
    expect(m05).toMatchObject({ alive: true, hp: Math.floor(0.5 * m05.maxHp), armor: 0, statuses: [], revived: true });
    expect(raised.events).toContainEqual({ type: "heroRevived", heroId: "hero:m05", hp: m05.hp });
    for (const id of m05Pile) expect(p0(raised.state).drawPile).toContain(id);
    for (const id of m05Pile) expect(p0(raised.state).discardPile).not.toContain(id);

    const again = structuredClone(raised.state);
    down(again, 0);
    const second = injectCard(again, data, { ...reviveCard, id: "test_revive2" });
    expect(getValidTargets(data, again, second)).toEqual([]);
  });

  it("T292: alliesFallen counts for the seat; an onLevelUp revive to lastFallen raises the ally that just fell; armorOnAllyFall shields the survivors", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        withLevelUp("f04", { counter: "alliesFallen", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "revive", ratio: 0.3, to: "lastFallen" }];
      },
    });
    const cut = card({ id: "test_cut2", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 99, to: "chosen" }] });
    const r = play(data, state, cut, "hero:m05");
    expect(r.state.heroes[1]!.leveledUp).toBe(true);
    expect(r.state.heroes[0]).toMatchObject({ alive: true, hp: Math.max(1, Math.floor(0.3 * r.state.heroes[0]!.maxHp)), revived: true });

    const shield = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "armorOnAllyFall", amount: 6 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    const fell = play(shield.data, shield.state, { ...cut, id: "test_cut3" }, "hero:m05");
    expect(fell.state.heroes[1]!.armor).toBe(6);
    expect(fell.state.heroes[2]!.armor).toBe(6);
  });
});

describe("phase 7b — Xuyên", () => {
  const shot = card({ id: "test_shot", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });

  it("T293: backRowHits counts hits on non-front enemies; pierceOwnAttacks also hits the enemy right behind; firstHitMarks marks once per turn", () => {
    const count = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "backRowHits", threshold: 99 }) });
    expect(play(count.data, count.state, shot, "enemy:1").state.heroes[1]!.levelUpCounter).toBe(1);
    expect(play(count.data, count.state, { ...shot, id: "test_shot_front" }, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(0);

    const pierce = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "pierceOwnAttacks" } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const through = play(pierce.data, pierce.state, shot, "enemy:0");
    const hits = through.events.filter((e) => e.type === "damageDealt").map((e) => (e as { targetId: string }).targetId);
    expect(hits).toEqual(["enemy:0", "enemy:1"]);

    const marks = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "firstHitMarks", rounds: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const first = play(marks.data, marks.state, shot, "enemy:0");
    expect(first.state.enemies[0]!.statuses).toContainEqual({ id: "mark", value: 1, sourceId: "hero:f04" });
    const second = play(marks.data, first.state, { ...shot, id: "test_shot2" }, "enemy:1");
    expect(second.state.enemies[1]!.statuses.some((st) => st.id === "mark")).toBe(false);

    // `01` §5.6: counters and marks only fire off attack cards — a skill dealing
    // damage to a back-row enemy does neither.
    const count2 = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "backRowHits", threshold: 99 }) });
    const skill = card({ id: "test_skill_dmg", ownerId: "f04", type: "skill", tags: [], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });
    const skillHit = play(count2.data, count2.state, skill, "enemy:1");
    expect(skillHit.state.heroes[1]!.levelUpCounter).toBe(0);
    const skillMarks = play(marks.data, second.state, { ...skill, id: "test_skill_dmg2" }, "enemy:1");
    expect(skillMarks.state.enemies[1]!.statuses.some((st) => st.id === "mark")).toBe(false);
  });
});
