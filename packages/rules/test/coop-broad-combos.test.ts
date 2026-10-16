import { describe, expect, it } from "vitest";
import { applyAction, comboHintFor, createCoopCombat, type CardDef, type CombatState, type GameData } from "../src/index";
import { cardMatchesPart } from "../src/coop/combos";
import { testData } from "./helpers";

const IDS = ["combo_dong_tam_ho_tran", "combo_pha_tran_hop_luc", "combo_tu_nguyet_dong_hanh"];
function setup() {
  const data = testData();
  for (const phase of data.moonPhases) for (const decree of phase.decrees) decree.modifiers = [];
  const side = { heroIds: ["m05", "f04", "m06"] as [string, string, string], loadout: { heroes: {} } };
  let state = createCoopCombat(data, { seed: 42, encounterId: "enc_coop_01", players: [side, side] }).state;
  for (const player of [0, 1]) {
    const result = applyAction(data, state, { type: "mulligan", player, instanceIds: [] });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    state.players[player]!.moonPower = 50;
  }
  return { data, state };
}
function card(id: string, effects: CardDef["effects"], attack = false): CardDef {
  return { id, ownerId: "m05", name: id, cost: 0, copies: 1, type: attack ? "attack" : "skill", tags: attack ? ["attack"] : [],
    target: effects.some(e => e.type === "damage" || e.type === "applyStatus") ? "enemy" : "none", effects, text: "" };
}
function inject(data: GameData, state: CombatState, definition: CardDef, player: number, suffix = "") {
  data.cards[definition.id] = definition;
  const instanceId = `broad_${definition.id}_${player}_${suffix}`;
  state.cards[instanceId] = { instanceId, cardId: definition.id, ownerIds: [definition.ownerId!], player, heldTurns: 0 };
  state.players[player]!.hand.push(instanceId);
  return instanceId;
}
function play(data: GameData, state: CombatState, instanceId: string, player: number) {
  const result = applyAction(data, state, { type: "playCard", instanceId, player,
    ...(data.cards[state.cards[instanceId]!.cardId]!.target === "enemy" ? { targetId: state.enemies[0]!.id } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}
const pairs = [
  [card("broad_armor", [{ type: "gainArmor", amount: 1, to: "self" }]), card("broad_heal", [{ type: "heal", amount: 1, to: "self" }])],
  [card("broad_attack", [{ type: "damage", amount: 1, to: "chosen" }], true), card("broad_vulnerable", [{ type: "applyStatus", status: "vulnerable", amount: 1, to: "chosen" }])],
  [card("broad_draw", [{ type: "drawCards", amount: 1 }]), card("broad_moon", [{ type: "shiftMoon", amount: 1 }])],
] as const;

describe("hero-independent co-op combinations", () => {
  it.each([0, 1, 2])("hints and resolves generic combination %i across different seats, consuming its cards", index => {
    const { data, state: initial } = setup();
    for (const hero of initial.heroes) hero.hp = hero.maxHp - 10;
    const pair = pairs[index]!;
    const a = inject(data, initial, pair[0], 0), b = inject(data, initial, pair[1], 1);
    const first = play(data, initial, a, 0);
    expect(first.events.some(event => event.type === "coopComboTriggered")).toBe(false);
    expect(comboHintFor(data, first.state, 1).get(b)).toBe(IDS[index]);
    const second = play(data, first.state, b, 1);
    expect(second.events).toContainEqual({ type: "coopComboTriggered", comboId: IDS[index], cardIds: [b, a], player: 1 });
    expect(second.state.playedThisTurn!.filter(entry => [a, b].includes(entry.instanceId)).every(entry => entry.comboId === IDS[index])).toBe(true);
    if (index === 0) expect(second.state.heroes.every(hero => hero.armor >= 4)).toBe(true);
    if (index === 1) expect(second.events.some(event => event.type === "damageDealt" && event.amount >= 8)).toBe(true);
    if (index === 2) expect(second.state.heroes.every(hero => hero.hp >= hero.maxHp - 7)).toBe(true);
    const repeated = second.state;
    repeated.round++;
    repeated.playedThisTurn = [];
    const c = inject(data, repeated, pair[0], 0, "again"), d = inject(data, repeated, pair[1], 1, "again");
    const third = play(data, repeated, c, 0);
    const fourth = play(data, third.state, d, 1);
    expect(fourth.events.some(event => event.type === "coopComboTriggered" && event.comboId === IDS[index])).toBe(false);
    expect(fourth.state.comboUsed![IDS[index]!]!.total).toBe(1);
  });

  it.each([0, 1, 2])("does not resolve generic combination %i from one seat", index => {
    const { data, state } = setup();
    const pair = pairs[index]!;
    const a = inject(data, state, pair[0], 0), b = inject(data, state, pair[1], 0);
    const first = play(data, state, a, 0);
    expect(comboHintFor(data, first.state, 0).has(b)).toBe(false);
    const second = play(data, first.state, b, 0);
    expect(second.events.some(event => event.type === "coopComboTriggered")).toBe(false);
  });

  it("lets a broad roster contribute without an owner restriction", () => {
    const data = testData();
    const combos = IDS.map(id => data.coopCombos[id]!);
    expect(combos.every(combo => combo?.parts.every(part => part.ownerId === undefined))).toBe(true);
    const participating = Object.values(data.heroes).filter(hero => [...hero.cardIds, ...hero.lockedCardIds].some(id =>
      combos.some(combo => combo.parts.some(part => cardMatchesPart(data, data.cards[id], part, 0)))));
    expect(participating.length).toBeGreaterThanOrEqual(18);
  });
});
