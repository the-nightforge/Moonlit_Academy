import type { CardDef, IntentDef } from "../../src/index";

export const idleIntent: IntentDef = {
  id: "idle",
  name: "Nghỉ",
  kind: "special",
  effects: [],
};

export const drawTwoCard: CardDef = {
  id: "test_draw_two",
  name: "Test Draw Two",
  ownerId: "f04",
  cost: 0,
  copies: 1,
  type: "skill",
  tags: [],
  target: "none",
  effects: [{ type: "draw", amount: 2 }],
  text: "Rút 2 lá (test).",
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

/** Fixed 9-damage single-target attack, so rule tests do not track enemy balance. */
export const strike9Intent: IntentDef = {
  id: "test_strike_9",
  name: "Test Strike 9",
  kind: "attack",
  targeting: "random",
  effects: [{ type: "damage", amount: 9, to: "chosen" }],
};
