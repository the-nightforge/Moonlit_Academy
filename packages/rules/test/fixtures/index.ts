import type { CardDef, IntentDef } from "../../src/index";

export const idleIntent: IntentDef = {
  id: "idle",
  name: "Nghỉ",
  kind: "special",
  effects: [],
};

export const chooseThreeCard: CardDef = {
  id: "test_choose_three",
  name: "Test Choose Three",
  ownerId: "f04",
  cost: 0,
  copies: 1,
  type: "skill",
  tags: [],
  target: "none",
  effects: [{ type: "chooseCard", look: 3 }],
  text: "Chiêm Bài 3 (test).",
};

export const rewindMoonCard: CardDef = {
  id: "test_rewind_moon",
  name: "Test Rewind Moon",
  ownerId: "f04",
  cost: 0,
  copies: 1,
  type: "skill",
  tags: ["moon"],
  target: "none",
  effects: [{ type: "shiftMoon", amount: -1 }],
  text: "Đổi Vận: trăng lùi 1 pha (test).",
};

export const killThenArmorCard: CardDef = {
  id: "test_kill_then_armor",
  name: "Test Kill Then Armor",
  ownerId: "m05",
  cost: 0,
  copies: 1,
  type: "skill",
  tags: [],
  target: "enemy",
  effects: [
    { type: "damage", amount: 99, to: "chosen" },
    { type: "gainArmor", amount: 5, to: "self" },
  ],
  text: "Gây 99 damage rồi nhận 5 giáp (test).",
};

const fixtureCard = (id: string, ownerId: string, type: CardDef["type"], target: CardDef["target"], effects: CardDef["effects"], tags: CardDef["tags"] = []): CardDef =>
  ({ id, name: id, ownerId, cost: 0, copies: 1, type, tags, target, effects, text: "" });

/** Stand-ins for pre-4b card behaviour used as plain mechanics examples in rule tests. */
export const healFiveCard = fixtureCard("test_heal_5", "f04", "skill", "ally", [{ type: "heal", amount: 5, to: "chosen" }], ["heal", "harmony"]);
export const armorSixCard = fixtureCard("test_armor_6", "f04", "skill", "ally", [{ type: "gainArmor", amount: 6, to: "chosen" }]);
export const regenThreeCard = fixtureCard("test_regen_3", "f04", "skill", "ally", [{ type: "applyStatus", status: "regen", amount: 3, to: "chosen" }], ["heal", "harmony"]);
export const cleanseHealCard = fixtureCard("test_cleanse_heal", "f04", "skill", "ally", [{ type: "cleanse", to: "chosen" }, { type: "heal", amount: 2, to: "chosen" }], ["heal", "harmony"]);
export const stealthOneCard = fixtureCard("test_stealth_1", "m06", "skill", "none", [{ type: "applyStatus", status: "stealth", amount: 1, to: "self" }], ["assassin"]);
export const aoeFiveCard = fixtureCard("test_aoe_5", "m06", "attack", "none", [{ type: "damage", amount: 5, to: "allEnemies" }], ["attack", "assassin"]);
export const armorReflectCard = fixtureCard("test_armor_reflect", "f03", "skill", "none", [{ type: "gainArmor", amount: 6, to: "self" }, { type: "applyStatus", status: "reflect", amount: 2, to: "self" }], ["ward"]);
export const twoHitCard = fixtureCard("test_two_hit", "f03", "attack", "enemy", [{ type: "damage", amount: 4, hits: 2, to: "chosen" }], ["attack"]);
export const stealOneCard = fixtureCard("test_steal_1", "f02", "skill", "enemy", [{ type: "stealBuff", count: 1 }]);
export const armorBreakCard = fixtureCard("test_armor_break", "m05", "attack", "enemy", [{ type: "removeArmor", to: "chosen" }, { type: "damage", amount: 5, to: "chosen" }], ["attack"]);
export const healSixCard = fixtureCard("test_heal_6", "m05", "skill", "none", [{ type: "heal", amount: 6, to: "self" }], ["heal"]);

/** Fixed 9-damage single-target attack, so rule tests do not track enemy balance. */
export const strike9Intent: IntentDef = {
  id: "test_strike_9",
  name: "Test Strike 9",
  kind: "attack",
  targeting: "random",
  effects: [{ type: "damage", amount: 9, to: "chosen" }],
};
