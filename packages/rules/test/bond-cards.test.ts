import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, createCombat, getEffectiveCost, isCardPlayable } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand, testData } from "./helpers";

function play(data: GameData, state: CombatState, cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((h) => h.defId === defId)!;
}

function deckIds(state: CombatState): string[] {
  return Object.keys(state.cards).sort();
}

describe("bond deck construction", () => {
  it("T78: a team with one bond pair gets that bond card as bond01", () => {
    const data = testData();
    const { state } = createCombat(data, { heroIds: ["m05", "f03", "m06"], encounterId: "enc_01", seed: 42 });
    expect(Object.keys(state.cards)).toHaveLength(16);
    expect(state.cards["bond01"]).toEqual({
      instanceId: "bond01",
      cardId: "bond_bang_hoa_tranh_phong",
      ownerIds: ["m05", "f03"],
    });
    expect(state.drawPile.length + state.hand.length).toBe(16);
  });

  it("T79: the default team has no bond card", () => {
    const data = testData();
    const { state } = createCombat(data, { heroIds: ["m05", "f04", "m06"], encounterId: "enc_01", seed: 42 });
    expect(deckIds(state)).toHaveLength(15);
    expect(deckIds(state).some((id) => id.startsWith("bond"))).toBe(false);
  });

  it("T80: several bond cards follow cards.json order", () => {
    const data = testData();
    const { state } = createCombat(data, { heroIds: ["m05", "f03", "f04"], encounterId: "enc_01", seed: 42 });
    expect(state.cards["bond01"]?.cardId).toBe("bond_bang_hoa_tranh_phong");
    expect(state.cards["bond02"]?.cardId).toBe("bond_tuyet_trung_tong_than");
    expect(state.cards["bond02"]?.ownerIds).toEqual(["f03", "f04"]);
  });
});

describe("bond playability", () => {
  it("T81: a bond card is broken when either owner has fallen", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "m06"],
      setup: (s) => setHand(s, ["bond_bang_hoa_tranh_phong"]),
    });
    const f03 = hero(state, "f03");
    f03.hp = 0;
    f03.alive = false;

    expect(play(data, state, "bond_bang_hoa_tranh_phong", "enemy:0")).toEqual({
      ok: false,
      error: "card is broken (owner is dead)",
    });
    expect(isCardPlayable(data, state, "bond01")).toBe(false);
  });

  it("T82: a bond card cannot be played while either owner is frozen", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "m06"],
      setup: (s) => setHand(s, ["bond_bang_hoa_tranh_phong"]),
    });
    hero(state, "m05").statuses.push({ id: "freeze", value: 1 });

    expect(play(data, state, "bond_bang_hoa_tranh_phong", "enemy:0")).toEqual({
      ok: false,
      error: "owner is frozen",
    });
    expect(isCardPlayable(data, state, "bond01")).toBe(false);
  });
});

describe("bond resolution", () => {
  it("T83: each effect uses its actor; only damage actors are cleaned up", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "f02"],
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["bond_bang_hoa_tranh_phong"]);
      },
    });
    hero(state, "m05").statuses.push({ id: "empower", value: 2 });
    hero(state, "f03").statuses.push({ id: "empower", value: 2 });

    const result = play(data, state, "bond_bang_hoa_tranh_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", sourceId: "hero:m05", targetId: "enemy:0", amount: 10 }),
    );
    expect(result.state.enemies[0]?.statuses).toContainEqual({ id: "freeze", value: 1 });
    expect(hero(result.state, "f03").levelUpCounter).toBe(1);
    expect(hero(result.state, "m05").statuses).toEqual([]);
    expect(hero(result.state, "f03").statuses).toEqual([{ id: "empower", value: 2 }]);
    expect(result.state.moonPower).toBe(7);
  });

  it("T84: a frozen target takes 14 damage and is not frozen again", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "f02"],
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["bond_bang_hoa_tranh_phong"]);
      },
    });
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });

    const result = play(data, state, "bond_bang_hoa_tranh_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(28);
    expect(result.events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(hero(result.state, "f03").levelUpCounter).toBe(0);
  });

  it("T85: level-up passives do not apply to bond cards (M05 +3)", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "f02"],
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["bond_bang_hoa_tranh_phong"]);
      },
    });
    hero(state, "m05").leveledUp = true;

    const result = play(data, state, "bond_bang_hoa_tranh_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(34);
  });

  it("T86: Ảnh Đấu gives the stolen buff to F02 and keeps M06 stealthed", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "m06", "f02"],
      setup: (s) => setHand(s, ["bond_anh_dau"]),
    });
    state.enemies[0]!.statuses.push({ id: "strength", value: 1 });

    const result = play(data, state, "bond_anh_dau", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f02").statuses).toEqual([{ id: "strength", value: 1 }]);
    expect(hero(result.state, "f02").levelUpCounter).toBe(1);
    expect(hero(result.state, "m06").statuses).toEqual([{ id: "stealth", value: 1 }]);
  });

  it("T87: M06's first-card discount does not apply to a bond card", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "m06", "f02"],
      setup: (s) => setHand(s, ["bond_anh_dau", "m06_anh_bo"]),
    });
    const m06 = hero(state, "m06");
    m06.leveledUp = true;
    m06.firstCardDiscountActive = true;

    expect(getEffectiveCost(data, state, instanceIdOf(state, "bond_anh_dau"))).toBe(2);
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_anh_bo"))).toBe(0);
  });

  it("F04's regen spread does not apply to a bond card", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f03", "f04"],
      setup: (s) => setHand(s, ["bond_tuyet_trung_tong_than"]),
    });
    hero(state, "f04").leveledUp = true;

    const result = play(data, state, "bond_tuyet_trung_tong_than", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "f04").statuses).toEqual([{ id: "regen", value: 2 }]);
    expect(hero(result.state, "m05").statuses).toEqual([]);
    expect(hero(result.state, "f03").statuses).toEqual([]);
    expect(hero(result.state, "f03").levelUpCounter).toBe(1);
  });
});
