import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, Effect, GameData, IntentDef } from "../src/index";
import { applyAction, drawCards } from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
import { idleEnemies, injectCard, makeEnemiesIdle, makeTestCombat, setIntent } from "./helpers";

function card(id: string, effects: Effect[], target: CardDef["target"] = "enemy", type: CardDef["type"] = "attack"): CardDef {
  return { id, name: id, ownerId: "m05", cost: 0, copies: 1, type, tags: [], target, effects, text: "" };
}

function play(data: GameData, state: CombatState, instanceId: string, targetId?: string) {
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
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
    expect(play(fresh.data, fresh.state, now, "enemy:0").state.enemies[0]!.hp).toBe(hp - 1);

    const held = makeTestCombat(idle);
    const later = injectCard(held.state, held.data, heldCard);
    const next = end(held.data, held.state);
    expect(next.state.cards[later]!.heldTurns).toBe(1);
    const before = next.state.enemies[0]!.hp;
    expect(play(held.data, next.state, later, "enemy:0").state.enemies[0]!.hp).toBe(before - 10);

    const top = next.state.drawPile[0]!;
    next.state.cards[top]!.heldTurns = 5;
    drawCards(next.state, 1, []);
    expect(next.state.cards[top]!.heldTurns).toBe(0);
  });

  it("T150: Liên Hoàn counts cards already played this turn, excluding the current one", () => {
    const { data, state } = makeTestCombat(idle);
    const first = injectCard(state, data, comboCard);
    const hp = state.enemies[0]!.hp;
    const afterFirst = play(data, state, first, "enemy:0");
    expect(afterFirst.state.enemies[0]!.hp).toBe(hp - 1);
    expect(afterFirst.state.cardsPlayedThisTurn).toBe(1);
    const second = injectCard(afterFirst.state, data, { ...comboCard, id: "test_combo_2" });
    const afterSecond = play(data, afterFirst.state, second, "enemy:0");
    expect(afterSecond.state.enemies[0]!.hp).toBe(hp - 1 - 10);
    expect(end(data, afterSecond.state).state.cardsPlayedThisTurn).toBe(0);
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
    const drained = play(data, state, drainOne, "enemy:1");
    const after = drained.state.enemies[1]!;
    expect(after.moonPower).toBe(3);
    expect(after.plannedIntents.map((p) => p.intent.id)).toEqual(["idle", strike9Intent.id]);
    expect(after.moonReserve).toBe(1);
    expect(drained.events).toContainEqual({ type: "intentsCancelled", enemyId: "enemy:1", intentIds: ["second"] });
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "enemy", enemyId: "enemy:1", value: 1 });

    const drainAll = injectCard(drained.state, data, card("test_drain_9", [{ type: "drainMoonPower", amount: 9, to: "chosen" }], "enemy", "skill"));
    const emptied = play(data, drained.state, drainAll, "enemy:1").state.enemies[1]!;
    expect(emptied.moonPower).toBe(0);
    expect(emptied.plannedIntents.map((p) => p.intent.id)).toEqual(["idle"]);
  });

  it("T152: Đoạt Nguyệt gives the player exactly what was drained", () => {
    const { data, state } = makeTestCombat();
    state.enemies[1]!.moonPower = 1;
    const power = state.moonPower;
    const steal = injectCard(state, data, card("test_steal", [{ type: "drainMoonPower", amount: 2, to: "chosen", steal: true }], "enemy", "skill"));
    expect(play(data, state, steal, "enemy:1").state.moonPower).toBe(power + 1);
  });

  it("T153: Dưỡng Nguyệt adds moon power every later turn, stacks and exceeds the cap", () => {
    const { data, state } = makeTestCombat(idle);
    const curve = data.combatConfig.moonPower;
    const grow = card("test_grow", [{ type: "gainMoonPowerPerTurn", amount: 2 }], "none", "skill");
    const once = play(data, state, injectCard(state, data, grow), undefined);
    expect(once.state.moonPowerBonus).toBe(2);
    const twice = play(data, once.state, injectCard(once.state, data, { ...grow, id: "test_grow_2" }), undefined);
    expect(twice.state.moonPowerBonus).toBe(4);
    twice.state.moonPower = 0;
    const next = end(data, twice.state);
    expect(next.state.moonPower).toBe(Math.min(curve.cap, curve.start + curve.perRound) + 4);
    let current = next.state;
    for (let i = 0; i < 8; i++) {
      current.moonPower = 0;
      current = end(data, current).state;
    }
    expect(current.moonPower).toBe(curve.cap + 4);
  });

  it("T154: Phẫn Huyết deals damage from missing HP through the damage formula, cards and intents", () => {
    const { data, state } = makeTestCombat(idle);
    state.heroes[0]!.hp = state.heroes[0]!.maxHp - 20;
    const rage = card("test_rage", [{ type: "missingHpDamage", ratio: 0.5, to: "chosen" }]);
    const hp = state.enemies[0]!.hp;
    expect(play(data, state, injectCard(state, data, rage), "enemy:0").state.enemies[0]!.hp).toBe(hp - 10);

    state.heroes[0]!.statuses.push({ id: "strength", value: 2 });
    const strong = play(data, state, injectCard(state, data, { ...rage, id: "test_rage_2" }), "enemy:0");
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
    expect(end(enemyRage.data, enemyRage.state).state.heroes[0]!.hp).toBe(m05 - 10);
  });

  it("T155: Dư Sinh turns overheal into armor, scaled by the moon armor multiplier", () => {
    const { data, state } = makeTestCombat(idle);
    state.moonIndex = 6; // Hạ Huyền: armor ×1.5
    const hero = state.heroes[0]!;
    hero.hp = hero.maxHp - 2;
    const mend = card("test_mend", [{ type: "heal", amount: 5, to: "chosen", overflow: "armor" }], "ally", "skill");
    const result = play(data, state, injectCard(state, data, mend), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(hero.maxHp);
    expect(result.state.heroes[0]!.armor).toBe(Math.floor(3 * 1.5));
  });

  it("T156: Tụ Dược heals regen × multiplier × moon heal multiplier and removes regen", () => {
    const { data, state } = makeTestCombat(idle);
    state.moonIndex = 4; // Trăng Tròn: heal ×2
    const hero = state.heroes[0]!;
    hero.hp = 10;
    hero.statuses.push({ id: "regen", value: 4 });
    const burst = card("test_burst", [{ type: "burstRegen", multiplier: 2, to: "chosen" }], "ally", "skill");
    const result = play(data, state, injectCard(state, data, burst), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(10 + 4 * 2 * 2);
    expect(result.state.heroes[0]!.statuses.some((s) => s.id === "regen")).toBe(false);

    const none = play(data, result.state, injectCard(result.state, data, { ...burst, id: "test_burst_2" }), hero.id);
    expect(none.events.some((e) => e.type === "healed")).toBe(false);
  });
});
