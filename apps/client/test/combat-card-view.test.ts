import { describe, expect, it, vi } from "vitest";
import type { CombatState, GameData } from "rules";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { combatCardModel, COMPACT_BODY_FONTS, PREVIEW_BODY_FONTS } = await import("../src/ui/combat-card-view");
const { OWNER_COLORS } = await import("../src/ui/theme");
const { getEffectiveCost } = await import("rules");

const { data, state } = fixture("pve");

/** Pushes a synthetic card instance into `s`'s hand and returns its instanceId. */
function inject(s: CombatState, cardId: string, ownerIds: string[], player = 0): string {
  const instanceId = `t_${cardId}_${player}_${Object.keys(s.cards).length}`;
  s.cards[instanceId] = { instanceId, cardId, ownerIds, player, heldTurns: 0 };
  s.players[player]!.hand.push(instanceId);
  return instanceId;
}

describe("combatCardModel", () => {
  it("carries the authoritative title, costs and owners", () => {
    const instanceId = state.players[0]!.hand[0]!;
    const model = combatCardModel(data, state, instanceId, 0);
    const card = data.cards[state.cards[instanceId]!.cardId]!;
    expect(model.instanceId).toBe(instanceId);
    expect(model.title).toBe(card.name);
    expect(model.baseCost).toBe(card.cost);
    expect(model.effectiveCost).toBe(getEffectiveCost(data, state, instanceId, 0));
    expect(model.ownerNames).toHaveLength(1);
    expect(model.ownerColors).toHaveLength(1);
    expect(model.category).toBe("hero");
  });

  it("evaluates the partner's effective cost with their seat's modifiers", () => {
    const { data: coopData, state: coop } = fixture("coop");
    const partnerId = coop.players[1]!.hand[0]!;
    const model = combatCardModel(coopData, coop, partnerId, 1);
    const partnerEffectiveCost = getEffectiveCost(coopData, coop, partnerId, 1);
    expect(model.effectiveCost).toBe(partnerEffectiveCost);
    expect(model.ownerNames.length).toBeGreaterThan(0);
  });

  it("a bond card names both owners with two colors", () => {
    const instanceId = inject(state, "bond_tuyet_trung_tong_than", ["f03", "f04"]);
    const model = combatCardModel(data, state, instanceId, 0);
    expect(model.category).toBe("bond");
    expect(model.ownerNames).toHaveLength(2);
    expect(model.ownerColors).toHaveLength(2);
    expect(model.ownerNames).toEqual([data.heroes.f03!.name, data.heroes.f04!.name]);
  });

  it("dead owner beats every later reason in priority", () => {
    const { data: d, state: s } = fixture("pve");
    const instanceId = inject(s, "m05_thuong_pha", ["m05"]);
    const hero = s.heroes.find((h) => h.defId === "m05")!;
    hero.hp = 0;
    hero.alive = false;
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).toBe("Tàn Chiêu — chủ lá đã ngã");
  });

  it("frozen owner reads Chủ lá đang Đóng Băng", () => {
    const { data: d, state: s } = fixture("pve");
    const instanceId = inject(s, "m05_thuong_pha", ["m05"]);
    const hero = s.heroes.find((h) => h.defId === "m05")!;
    hero.statuses.push({ id: "freeze", value: 1 });
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).toBe("Chủ lá đang Đóng Băng");
  });

  it("blood-moon cards say so outside Huyết Nguyệt", () => {
    const { data: d, state: s } = fixture("pve");
    d.cards.t_blood_card = {
      id: "t_blood_card",
      name: "Blood test",
      ownerId: "m05",
      cost: 6,
      type: "attack",
      tags: ["forbidden"],
      target: "none",
      effects: [],
      text: "test",
      copies: 1,
      requiresBloodMoon: true,
    };
    const instanceId = inject(s, "t_blood_card", ["m05"]);
    s.bloodMoonRounds = 0;
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).toBe("Cần Huyết Nguyệt");
    s.bloodMoonRounds = 1;
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).not.toBe("Cần Huyết Nguyệt");
  });

  it("unaffordable cards report Nguyệt Lực, not the turn", () => {
    const { data: d, state: s } = fixture("pve");
    const instanceId = inject(s, "m05_liet_hoa_phan_thien", ["m05"]); // cost 8
    s.players[0]!.moonPower = 0;
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).toBe("Không đủ Nguyệt Lực");
  });

  it("a playable card reports no reason", () => {
    const { data: d, state: s } = fixture("pve");
    const kept = s.players[0]!;
    kept.moonPower = 99;
    kept.mulliganDone = true;
    s.status = "playerTurn";
    const instanceId = kept.hand.find((id) => d.cards[s.cards[id]!.cardId]?.target === "none");
    if (instanceId === undefined) return;
    const model = combatCardModel(d, s, instanceId, 0);
    expect(model.playable).toBe(true);
    expect(model.disabledReason).toBeNull();
  });

  it("a done co-op seat reads the done reason", () => {
    const { data: d, state: s } = fixture("coop");
    s.players[0]!.done = true;
    s.players[0]!.moonPower = 99; // power check must pass for the reason to reach "done"
    s.status = "playerTurn";
    const instanceId = s.players[0]!.hand[0]!;
    expect(combatCardModel(d, s, instanceId, 0).disabledReason).toBe("Bạn đã xong — chờ đồng đội");
  });

  it("a Chiêm Bài option reports no turn reason — it is pickable, not played", () => {
    const { data: d, state: s } = fixture("pve");
    const seat = s.players[0]!;
    const option = seat.drawPile[0]!;
    seat.pendingChoice = { kind: "chooseCard", options: [option] };
    s.status = "choosing";
    expect(combatCardModel(d, s, option, 0).disabledReason).toBeNull();
  });

  it("a dead owner's reason still shows on a Chiêm Bài option", () => {
    const { data: d, state: s } = fixture("pve");
    const seat = s.players[0]!;
    const option = seat.drawPile.find((id) => {
      const inst = s.cards[id]!;
      return inst.ownerIds.length === 1 && inst.ownerIds[0] !== undefined;
    })!;
    const owner = s.heroes.find((h) => h.defId === s.cards[option]!.ownerIds[0])!;
    owner.alive = false;
    seat.pendingChoice = { kind: "chooseCard", options: [option] };
    s.status = "choosing";
    expect(combatCardModel(d, s, option, 0).disabledReason).toBe("Tàn Chiêu — chủ lá đã ngã");
  });
});

describe("owner palette and fonts", () => {
  it("every hero id has an owner color", () => {
    expect(Object.keys(OWNER_COLORS).sort()).toEqual(Object.keys(data.heroes).sort());
  });

  it("compact body fits from 11px down to 9px; preview from 14px down", () => {
    expect(COMPACT_BODY_FONTS).toEqual([11, 10, 9]);
    expect(PREVIEW_BODY_FONTS).toEqual([14, 12, 11]);
  });
});
