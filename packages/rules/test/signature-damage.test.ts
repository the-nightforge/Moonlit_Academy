import { describe, expect, it } from "vitest";
import type { CardDef, CombatEvent, CombatState, Effect, GameData } from "../src/index";

import { makeTestCombat, p0, playTestCard } from "./helpers";

// Skill cards owned by f04 (team m05 + f04 + m06, enc_01): no attack bonuses apply.
const card = (effects: Effect[], target: CardDef["target"] = "enemy"): CardDef => ({
  id: "test_sig", name: "Sig", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [], target, effects, text: "",
});

function play(data: GameData, state: CombatState, def: CardDef, targetId?: string): CombatEvent[] {
  return playTestCard(data, state, def, targetId).events;
}

function setup() {
  const { data, state } = makeTestCombat({
    setup: (s) => {
      for (const enemy of s.enemies) {
        enemy.hp = enemy.maxHp = 99;
        enemy.armor = 0;
      }
    },
  });
  return { data, state };
}

const hits = (events: CombatEvent[]) =>
  events.flatMap((e) => (e.type === "damageDealt" ? [[e.targetId, e.amount] as const] : []));

describe("scaledDamage và targetSealed (`01` §5.7)", () => {
  it("T298: scaledDamage reads each stat as base + floor(stat × amount / divisor), capped at max", () => {
    let { data, state } = setup();
    p0(state).cardsPlayedThisTurn = 3;
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "cardsPlayedThisTurn", amount: 2, base: 2, to: "chosen" }]), "enemy:0"))).toEqual([["enemy:0", 8]]);

    ({ data, state } = setup());
    state.heroes[1]!.armor = 7;
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "selfArmor", amount: 1, to: "chosen" }]), "enemy:0"))).toEqual([["enemy:0", 7]]);
    ({ data, state } = setup());
    state.heroes[1]!.armor = 7;
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "selfArmor", amount: 1, max: 5, to: "chosen" }]), "enemy:0"))).toEqual([["enemy:0", 5]]);

    ({ data, state } = setup());
    p0(state).moonPower = 4;
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "moonPower", amount: 2, to: "chosen" }]), "enemy:0"))).toEqual([["enemy:0", 8]]);

    ({ data, state } = setup());
    state.heroes[0]!.hp -= 1; // two of three heroes at full HP
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "alliesAtFullHp", amount: 2, to: "allEnemies" }], "none")))).toEqual([
      ["enemy:0", 4],
      ["enemy:1", 4],
    ]);

    ({ data, state } = setup());
    state.enemies[1]!.statuses.push({ id: "weak", value: 2 }, { id: "burn", value: 2 });
    const debuffCard = card([{ type: "scaledDamage", per: "targetDebuffs", amount: 3, base: 3, to: "chosen" }]);
    expect(hits(play(data, state, debuffCard, "enemy:1"))).toEqual([["enemy:1", 9]]);

    ({ data, state } = setup());
    state.heroes[0]!.armor = 3;
    state.heroes[1]!.armor = 4;
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "alliesArmor", amount: 1, divisor: 2, to: "allEnemies" }], "none")))).toEqual([
      ["enemy:0", 3],
      ["enemy:1", 3],
    ]);

    ({ data, state } = setup());
    state.heroes[0]!.statuses.push({ id: "regen", value: 3 });
    state.heroes[2]!.statuses.push({ id: "regen", value: 2 });
    expect(hits(play(data, state, card([{ type: "scaledDamage", per: "alliesRegen", amount: 1, to: "chosen" }]), "enemy:0"))).toEqual([["enemy:0", 5]]);
  });

  it("T299: targetSealed is true only while the chosen target carries a Phong Ấn mark", () => {
    const sealed = card([
      { type: "conditional", condition: { type: "targetSealed" }, then: [{ type: "damage", amount: 8, to: "chosen" }], else: [{ type: "damage", amount: 4, to: "chosen" }] },
    ]);
    let { data, state } = setup();
    expect(hits(play(data, state, sealed, "enemy:0"))).toEqual([["enemy:0", 4]]);
    ({ data, state } = setup());
    state.enemies[0]!.sealedBy = "hero:f04";
    expect(hits(play(data, state, sealed, "enemy:0"))).toEqual([["enemy:0", 8]]);
  });
});
