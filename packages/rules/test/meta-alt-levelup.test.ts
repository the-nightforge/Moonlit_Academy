import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, Loadout } from "../src/index";
import { applyAction, getEffectiveCost } from "../src/index";
import { idleEnemies, injectCard, makeTestCombat } from "./helpers";

type Team = [string, string, string];

/** Every hero at constellation 5 with the chosen form. */
function forms(team: Team, form: "base" | "alt"): Loadout {
  return { heroes: Object.fromEntries(team.map((id) => [id, { constellation: 5, levelUpForm: form }])) };
}

function combat(team: Team, form: "base" | "alt", leveled: string[] = []) {
  const made = makeTestCombat({ heroIds: team, encounterId: "enc_06", loadout: forms(team, form) });
  idleEnemies(made.state);
  for (const id of leveled) hero(made.state, id).leveledUp = true;
  return made;
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((unit) => unit.defId === defId)!;
}

function card(id: string, ownerId: string, effects: CardDef["effects"], extra: Partial<CardDef> = {}): CardDef {
  return { id, name: id, ownerId, cost: 0, copies: 1, type: "skill", tags: [], target: "none", effects, text: "", ...extra };
}

function play(data: GameData, state: CombatState, instanceId: string, targetId?: string): CombatState {
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function endTurn(data: GameData, state: CombatState): CombatState {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const STRIKE = (ownerId: string) =>
  card(`test_strike_${ownerId}`, ownerId, [{ type: "damage", amount: 4, to: "chosen" }], { type: "attack", tags: ["attack"], target: "enemy" });

describe("second level-up forms (Tinh Hồn 5)", () => {
  it("T206: the second form keeps counter and threshold but replaces the base passive", () => {
    const hit = (form: "base" | "alt") => {
      const { data, state } = combat(["m05", "f04", "m06"], form, ["m05"]);
      const target = state.enemies[0]!;
      const before = target.hp;
      const after = play(data, state, injectCard(state, data, STRIKE("m05")), target.id);
      return before - after.enemies[0]!.hp;
    };
    // Base Liệt Hỏa adds 3 to attack cards; Bất Diệt does not.
    expect(hit("base") - hit("alt")).toBe(3);

    // Same counter and threshold as the base form (constellation ≥ 2 threshold here).
    const levelsAt = (form: "base" | "alt", amount: number) => {
      const { data, state } = combat(["m05", "f04", "m06"], form);
      const selfHit = card("test_self_hit", "m05", [{ type: "loseHp", amount, to: "self" }]);
      return hero(play(data, state, injectCard(state, data, selfHit)), "m05").leveledUp;
    };
    const threshold = makeTestCombat().data.heroes["m05"]!.levelUp.constellationThreshold;
    for (const form of ["base", "alt"] as const) {
      expect(levelsAt(form, threshold - 1)).toBe(false);
      expect(levelsAt(form, threshold)).toBe(true);
    }
  });

  it("T207: Bất Diệt gives 12 armor and 2 rounds of taunt on level-up, and +3 armor on M05's armor cards", () => {
    const { data, state } = combat(["m05", "f04", "m06"], "alt");
    const threshold = data.heroes["m05"]!.levelUp.constellationThreshold;
    const selfHit = card("test_self_hit", "m05", [{ type: "loseHp", amount: threshold, to: "self" }]);
    const armorBefore = hero(state, "m05").armor;
    const leveled = play(data, state, injectCard(state, data, selfHit));
    const m05 = hero(leveled, "m05");
    expect(m05.leveledUp).toBe(true);
    expect(m05.armor).toBe(armorBefore + 12);
    expect(m05.statuses).toContainEqual(expect.objectContaining({ id: "taunt", value: 2 }));

    const guard = card("test_guard", "m05", [{ type: "gainArmor", amount: 5, to: "self" }]);
    const guarded = play(data, leveled, injectCard(leveled, data, guard));
    expect(hero(guarded, "m05").armor).toBe(m05.armor + 8);
    // A card of another hero giving M05 armor is not M05's card.
    const ally = card("test_ally_guard", "f04", [{ type: "gainArmor", amount: 5, to: "chosen" }], { target: "ally" });
    const helped = play(data, guarded, injectCard(guarded, data, ally), m05.id);
    expect(hero(helped, "m05").armor).toBe(hero(guarded, "m05").armor + 5);
  });

  it("T208: Tĩnh Tâm cleanses heroes healed or given regen by F04's cards", () => {
    const heal = card("test_heal", "f04", [{ type: "heal", amount: 3, to: "chosen" }], { target: "ally", tags: ["heal"] });
    const regen = card("test_regen", "f04", [{ type: "applyStatus", status: "regen", amount: 2, to: "chosen" }], { target: "ally", tags: ["heal"] });
    for (const form of ["base", "alt"] as const) {
      const { data, state } = combat(["m05", "f04", "m06"], form, ["f04"]);
      const m05 = hero(state, "m05");
      m05.statuses.push({ id: "weak", value: 2 });
      m05.hp -= 10;
      const healed = play(data, state, injectCard(state, data, heal), m05.id);
      expect(hero(healed, "m05").statuses.some((status) => status.id === "weak")).toBe(form === "base");
      hero(healed, "m06").statuses.push({ id: "vulnerable", value: 2 });
      const regened = play(data, healed, injectCard(healed, data, regen), hero(healed, "m06").id);
      expect(hero(regened, "m06").statuses.some((status) => status.id === "vulnerable")).toBe(form === "base");
    }
  });

  it("T209: Tàn Ảnh counts one more card for M06's first Liên Hoàn card each turn only", () => {
    const combo = (id: string, count: number) =>
      card(id, "m06", [{ type: "conditional", condition: { type: "cardsPlayedThisTurnAtLeast", count }, then: [{ type: "gainArmor", amount: 10, to: "self" }], else: [{ type: "gainArmor", amount: 1, to: "self" }] }], { keywords: ["lien_hoan"] });
    const filler = card("test_filler", "m05", [{ type: "gainArmor", amount: 1, to: "self" }]);
    const armorAfter = (form: "base" | "alt") => {
      const { data, state } = combat(["m05", "f04", "m06"], form, ["m06"]);
      let next = play(data, state, injectCard(state, data, filler));
      const start = hero(next, "m06").armor;
      next = play(data, next, injectCard(next, data, combo("test_combo_a", 2))); // 1 played (+1 with Tàn Ảnh)
      const first = hero(next, "m06").armor - start;
      const mid = hero(next, "m06").armor;
      next = play(data, next, injectCard(next, data, combo("test_combo_b", 3))); // 2 played, no bonus left
      return { first, second: hero(next, "m06").armor - mid, state: next, data };
    };
    expect(armorAfter("base")).toMatchObject({ first: 1, second: 1 });
    const alt = armorAfter("alt");
    expect(alt).toMatchObject({ first: 10, second: 1 });
    expect(hero(alt.state, "m06").comboBonusUsedThisTurn).toBe(true);
    expect(hero(endTurn(alt.data, alt.state), "m06").comboBonusUsedThisTurn).toBe(false);
  });

  it("T210: Hàn Kiếm makes the first hit each turn from F03's cards leave the enemy vulnerable", () => {
    const twoHits = card("test_two_hits", "f03", [{ type: "damage", amount: 4, hits: 2, to: "chosen" }], { type: "attack", tags: ["attack"], target: "enemy" });
    const { data, state } = combat(["f03", "f02", "f04"], "alt", ["f03"]);
    const target = state.enemies[0]!;
    target.hp = 99;
    target.maxHp = 99;
    const after = play(data, state, injectCard(state, data, twoHits), target.id);
    // First hit 4, then vulnerable: second hit 4 × 1.5 = 6.
    expect(99 - after.enemies[0]!.hp).toBe(10);
    expect(after.enemies[0]!.statuses).toContainEqual(expect.objectContaining({ id: "vulnerable" }));

    after.enemies[1]!.hp = 99;
    const again = play(data, after, injectCard(after, data, STRIKE("f03")), after.enemies[1]!.id);
    expect(again.enemies[1]!.statuses.some((status) => status.id === "vulnerable")).toBe(false);
    expect(hero(endTurn(data, again), "f03").firstHitUsedThisTurn).toBe(false);
  });

  it("T211: Huyết Diện lowers F02's card costs by 1 during blood moon only", () => {
    const pricey = card("test_pricey", "f02", [{ type: "gainArmor", amount: 1, to: "self" }], { cost: 3 });
    for (const form of ["base", "alt"] as const) {
      const { data, state } = combat(["f03", "f02", "f04"], form, ["f02"]);
      const id = injectCard(state, data, pricey);
      expect(getEffectiveCost(data, state, id)).toBe(3);
      state.bloodMoonRounds = 2;
      expect(getEffectiveCost(data, state, id)).toBe(form === "alt" ? 2 : 3);
    }
  });
});
