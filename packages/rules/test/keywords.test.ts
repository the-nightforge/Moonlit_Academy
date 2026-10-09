import { describe, expect, it } from "vitest";
import { drawCards, type CardDef, type Effect, type IntentDef } from "../src/index";
import { idleIntent, stealOneCard, strike9Intent } from "./fixtures";
import {
  endTestTurn,
  heroByDefId,
  idleEnemies,
  injectCard,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  playCardById,
  playCardInstance,
  setHand,
  setIntent,
} from "./helpers";

function card(id: string, effects: Effect[], target: CardDef["target"] = "enemy", type: CardDef["type"] = "attack"): CardDef {
  return { id, name: id, ownerId: "m05", cost: 0, copies: 1, type, tags: [], target, effects, text: "" };
}



const idle = { mutateData: makeEnemiesIdle, setup: idleEnemies };

const heldCard = card("test_held", [
  {
    type: "conditional",
    condition: { type: "heldTurnsAtLeast", turns: 1 },
    then: [{ type: "damage", amount: 10, to: "chosen" }],
    else: [{ type: "damage", amount: 1, to: "chosen" }],
  },
]);

const comboCard = card("test_combo", [
  {
    type: "conditional",
    condition: { type: "cardsPlayedThisTurnAtLeast", count: 1 },
    then: [{ type: "damage", amount: 10, to: "chosen" }],
    else: [{ type: "damage", amount: 1, to: "chosen" }],
  },
]);

describe("phase 4b keywords", () => {
  it("T149: Tích Tụ counts turns held in hand; drawn cards start at 0", () => {
    const fresh = makeTestCombat(idle);
    const now = injectCard(fresh.state, fresh.data, heldCard);
    const hp = fresh.state.enemies[0]!.hp;
    expect(playCardInstance(fresh.data, fresh.state, now, "enemy:0").state.enemies[0]!.hp).toBe(hp - 1);

    const held = makeTestCombat(idle);
    const later = injectCard(held.state, held.data, heldCard);
    const next = endTestTurn(held.data, held.state);
    expect(next.state.cards[later]!.heldTurns).toBe(1);
    const before = next.state.enemies[0]!.hp;
    expect(playCardInstance(held.data, next.state, later, "enemy:0").state.enemies[0]!.hp).toBe(before - 10);

    const top = p0(next.state).drawPile[0]!;
    next.state.cards[top]!.heldTurns = 5;
    drawCards(held.data, next.state, p0(next.state), 1, []);
    expect(next.state.cards[top]!.heldTurns).toBe(0);
  });

  it("T150: Liên Hoàn counts cards already played this turn, excluding the current one", () => {
    const { data, state } = makeTestCombat(idle);
    const first = injectCard(state, data, comboCard);
    const hp = state.enemies[0]!.hp;
    const afterFirst = playCardInstance(data, state, first, "enemy:0");
    expect(afterFirst.state.enemies[0]!.hp).toBe(hp - 1);
    expect(p0(afterFirst.state).cardsPlayedThisTurn).toBe(1);
    const second = injectCard(afterFirst.state, data, { ...comboCard, id: "test_combo_2" });
    const afterSecond = playCardInstance(data, afterFirst.state, second, "enemy:0");
    expect(afterSecond.state.enemies[0]!.hp).toBe(hp - 1 - 10);
    expect(p0(endTestTurn(data, afterSecond.state).state).cardsPlayedThisTurn).toBe(0);
  });

  it("T151: Tỏa Nguyệt drains the fund and cancels intents from the chain's end", () => {
    const { data, state } = makeTestCombat();
    setIntent(state, 0, idleIntent, null);
    const fox = state.enemies[1]!;
    const second: IntentDef = { ...strike9Intent, id: "second" };
    fox.plannedIntents = [
      { intent: idleIntent, cost: 0, targetId: null },
      { intent: strike9Intent, cost: 2, targetId: "hero:m05" },
      { intent: second, cost: 2, targetId: "hero:m05" },
    ];
    fox.moonPower = 4;
    fox.moonReserve = 0;
    const drainOne = injectCard(state, data, card("test_drain_1", [{ type: "drainMoonPower", amount: 1, to: "chosen" }], "enemy", "skill"));
    const drained = playCardInstance(data, state, drainOne, "enemy:1");
    const after = drained.state.enemies[1]!;
    expect(after.moonPower).toBe(3);
    expect(after.plannedIntents.map((p) => p.intent.id)).toEqual(["idle", strike9Intent.id]);
    expect(after.moonReserve).toBe(1);
    expect(drained.events).toContainEqual({ type: "intentsCancelled", enemyId: "enemy:1", intentIds: ["second"] });
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "enemy", enemyId: "enemy:1", value: 1 });

    const drainAll = injectCard(drained.state, data, card("test_drain_9", [{ type: "drainMoonPower", amount: 9, to: "chosen" }], "enemy", "skill"));
    const emptied = playCardInstance(data, drained.state, drainAll, "enemy:1").state.enemies[1]!;
    expect(emptied.moonPower).toBe(0);
    expect(emptied.plannedIntents.map((p) => p.intent.id)).toEqual(["idle"]);
  });

  it("T152: Đoạt Nguyệt gives the player exactly what was drained", () => {
    const { data, state } = makeTestCombat();
    state.enemies[1]!.moonPower = 1;
    const power = p0(state).moonPower;
    const steal = injectCard(state, data, card("test_steal", [{ type: "drainMoonPower", amount: 2, to: "chosen", steal: true }], "enemy", "skill"));
    expect(p0(playCardInstance(data, state, steal, "enemy:1").state).moonPower).toBe(power + 1);
  });

  it("T153: Dưỡng Nguyệt adds moon power every later turn, stacks and exceeds the cap", () => {
    const { data, state } = makeTestCombat(idle);
    const curve = data.combatConfig.moonPower;
    const grow = card("test_grow", [{ type: "gainMoonPowerPerTurn", amount: 2 }], "none", "skill");
    const once = playCardInstance(data, state, injectCard(state, data, grow), undefined);
    expect(p0(once.state).moonPowerBonus).toBe(2);
    const twice = playCardInstance(data, once.state, injectCard(once.state, data, { ...grow, id: "test_grow_2" }), undefined);
    expect(p0(twice.state).moonPowerBonus).toBe(4);
    p0(twice.state).moonPower = 0;
    const next = endTestTurn(data, twice.state);
    expect(p0(next.state).moonPower).toBe(Math.min(curve.cap, curve.start + curve.perRound) + 4);
    let current = next.state;
    for (let i = 0; i < 8; i++) {
      p0(current).moonPower = 0;
      current = endTestTurn(data, current).state;
    }
    expect(p0(current).moonPower).toBe(curve.cap + 4);
  });

  it("T154: Phẫn Huyết deals damage from missing HP through the damage formula, cards and intents", () => {
    const { data, state } = makeTestCombat(idle);
    state.heroes[0]!.hp = state.heroes[0]!.maxHp - 20;
    const rage = card("test_rage", [{ type: "missingHpDamage", ratio: 0.5, to: "chosen" }]);
    const hp = state.enemies[0]!.hp;
    expect(playCardInstance(data, state, injectCard(state, data, rage), "enemy:0").state.enemies[0]!.hp).toBe(hp - 10);

    state.heroes[0]!.statuses.push({ id: "strength", value: 2 });
    const strong = playCardInstance(data, state, injectCard(state, data, { ...rage, id: "test_rage_2" }), "enemy:0");
    expect(strong.state.enemies[0]!.hp).toBe(hp - 12);

    const enemyRage = makeTestCombat();
    const foe = enemyRage.state.enemies[0]!;
    foe.hp = foe.maxHp - 10;
    setIntent(enemyRage.state, 0, {
      id: "test_enemy_rage", name: "rage", kind: "attack", targeting: "front",
      effects: [{ type: "missingHpDamage", ratio: 1, to: "chosen" }],
    }, "hero:m05");
    setIntent(enemyRage.state, 1, idleIntent, null);
    const m05 = enemyRage.state.heroes[0]!.hp;
    expect(endTestTurn(enemyRage.data, enemyRage.state).state.heroes[0]!.hp).toBe(m05 - 10);
  });

  it("T155: Dư Sinh turns overheal into armor, scaled by the Huyền Giáp decree multiplier", () => {
    const { data, state } = makeTestCombat({
      ...idle,
      decrees: "real",
      start: { moonIndex: 1, decrees: { lastQuarter: "huyen_giap" } },
    });
    state.moonIndex = 6; // Hạ Huyền + Huyền Giáp: armor ×1.5
    const hero = state.heroes[0]!;
    hero.hp = hero.maxHp - 2;
    const mend = card("test_mend", [{ type: "heal", amount: 5, to: "chosen", overflow: "armor" }], "ally", "skill");
    const result = playCardInstance(data, state, injectCard(state, data, mend), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(hero.maxHp);
    expect(result.state.heroes[0]!.armor).toBe(Math.floor(3 * 1.5));
  });

  it("T156: Tụ Dược heals regen × multiplier × Viên Nguyệt heal multiplier and removes regen", () => {
    const { data, state } = makeTestCombat({
      ...idle,
      decrees: "real",
      start: { moonIndex: 1, decrees: { full: "vien_nguyet" } },
    });
    state.moonIndex = 4; // Trăng Tròn + Viên Nguyệt: heal ×2
    const hero = state.heroes[0]!;
    hero.hp = 10;
    hero.statuses.push({ id: "regen", value: 4 });
    const burst = card("test_burst", [{ type: "burstRegen", multiplier: 2, to: "chosen" }], "ally", "skill");
    const result = playCardInstance(data, state, injectCard(state, data, burst), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(10 + 4 * 2 * 2);
    expect(result.state.heroes[0]!.statuses.some((s) => s.id === "regen")).toBe(false);

    const none = playCardInstance(data, result.state, injectCard(result.state, data, { ...burst, id: "test_burst_2" }), hero.id);
    expect(none.events.some((e) => e.type === "healed")).toBe(false);
  });
});

const REFLECT_STEAL_TEAM: [string, string, string] = ["m05", "f03", "f02"];

describe("stealBuff", () => {
  it("T67: steals the first buff in status order and counts it", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    injectCard(state, data, stealOneCard);
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 }, { id: "regen", value: 1 });

    const result = playCardById(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.statuses).toEqual([{ id: "regen", value: 1 }]);
    const f02 = heroByDefId(result.state, "f02");
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

  it("T169: Đoạt Nguyệt by F02 counts one theft toward buffsStolen; Tỏa Nguyệt and empty drains do not", () => {
    const drain = (id: string, steal: boolean): CardDef => ({
      id, name: id, ownerId: "f02", cost: 0, copies: 1, type: "skill", tags: [], target: "enemy",
      effects: [{ type: "drainMoonPower", amount: 2, to: "chosen", ...(steal ? { steal: true } : {}) }], text: "",
    });
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    injectCard(state, data, drain("test_doat", true));
    injectCard(state, data, drain("test_toa", false));
    injectCard(state, data, drain("test_doat_empty", true));
    state.enemies[0]!.moonPower = 5;
    state.enemies[1]!.moonPower = 0;

    const first = playCardById(data, state, "test_doat", "enemy:0");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(heroByDefId(first.state, "f02").levelUpCounter).toBe(1);

    const second = playCardById(data, first.state, "test_toa", "enemy:0");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(heroByDefId(second.state, "f02").levelUpCounter).toBe(1);

    const third = playCardById(data, second.state, "test_doat_empty", "enemy:1");
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(heroByDefId(third.state, "f02").levelUpCounter).toBe(1);
  });

  it("T68: a stolen buff merges with the same buff on the thief", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    injectCard(state, data, stealOneCard);
    heroByDefId(state, "f02").statuses.push({ id: "strength", value: 1 });
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = playCardById(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f02").statuses).toEqual([{ id: "strength", value: 3 }]);
  });

  it("T95: Ảnh Tập steals first, so a stolen strength boosts its own hit", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      setup: (s) => setHand(s, ["f02_anh_tap"]),
    });
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = playCardById(data, state, "f02_anh_tap", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f02").statuses).toEqual([{ id: "strength", value: 2 }]);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", sourceId: "hero:f02", targetId: "enemy:0", amount: 8 }),
    );
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 8);
  });

  it("T70: nothing happens when the target has no buff", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    injectCard(state, data, stealOneCard);
    state.enemies[0]!.statuses.push({ id: "weak", value: 1 });

    const result = playCardById(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.events.filter((e) => e.type === "statusRemoved" || e.type === "statusApplied"),
    ).toEqual([]);
    expect(result.state.enemies[0]?.statuses).toEqual([{ id: "weak", value: 1 }]);
    expect(heroByDefId(result.state, "f02").levelUpCounter).toBe(0);
  });
});
