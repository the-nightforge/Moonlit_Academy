import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData } from "rules";
import { attackLookOf } from "../src/ui/attack-style";

const data = {
  heroes: {
    f05: { archetype: "striker", attackStyle: "bow" },
    f04: { archetype: "support" },
    m08: { archetype: "controller" },
    m09: { archetype: "controller", attackStyle: "music" },
  },
  weapons: { w_xich_diem_thuong: { attackStyle: "spear" }, w_tinh_ban: {} },
  enemies: { vo_nguyet_am_sat: { attackStyle: "darts" }, shadow_fox: {} },
} as unknown as GameData;

function stateWith(weapons: { heroId: string; weaponId: string }[] = []): CombatState {
  return {
    heroes: [
      { id: "hero:f05", defId: "f05", player: 0 },
      { id: "hero:f04", defId: "f04", player: 0 },
      { id: "hero:m08", defId: "m08", player: 0 },
      { id: "hero:m09", defId: "m09", player: 0 },
    ],
    enemies: [
      { id: "enemy:0", defId: "vo_nguyet_am_sat" },
      { id: "enemy:1", defId: "shadow_fox" },
    ],
    players: [{ weapons }],
  } as unknown as CombatState;
}

const card = (type: "attack" | "skill", tags: string[]) => ({ type, tags }) as unknown as CardDef;

describe("attackLookOf", () => {
  it("uses the hero's lore weapon", () => {
    expect(attackLookOf(data, stateWith(), "hero:f05").kind).toBe("bow");
  });

  it("an equipped weapon's style wins over the lore weapon", () => {
    const state = stateWith([{ heroId: "f05", weaponId: "w_xich_diem_thuong" }]);
    expect(attackLookOf(data, state, "hero:f05", card("attack", ["attack"])).kind).toBe("spear");
  });

  it("a weapon without a style keeps the lore weapon", () => {
    expect(attackLookOf(data, stateWith([{ heroId: "f05", weaponId: "w_tinh_ban" }]), "hero:f05").kind).toBe("bow");
  });

  it("falls back to the archetype", () => {
    expect(attackLookOf(data, stateWith(), "hero:f04").kind).toBe("herb");
    expect(attackLookOf(data, stateWith(), "hero:m08").kind).toBe("spell");
  });

  it("a skill card does not swing a physical weapon: spell colored by tag", () => {
    expect(attackLookOf(data, stateWith(), "hero:f05", card("skill", ["heal", "moon"]))).toEqual({ kind: "spell", color: 0xf4d35e });
  });

  it("a casting style colors skills too, and an equipped weapon only changes attacks", () => {
    const state = stateWith([{ heroId: "m09", weaponId: "w_xich_diem_thuong" }]);
    expect(attackLookOf(data, state, "hero:m09", card("skill", ["harmony"])).kind).toBe("music");
    expect(attackLookOf(data, state, "hero:m09", card("attack", ["harmony"])).kind).toBe("spear");
  });

  it("enemies use their style, tinted red; default slash", () => {
    expect(attackLookOf(data, stateWith(), "enemy:0")).toEqual({ kind: "darts", color: 0xff5a40 });
    expect(attackLookOf(data, stateWith(), "enemy:1").kind).toBe("slash");
  });

  it("Linh Thú hits use their kind's style — Thỏ Ngọc is a moon hit", () => {
    const state = {
      ...stateWith(),
      summons: [
        { id: "summon:0", summonId: "tho_ngoc" },
        { id: "summon:1", summonId: "tho_ngoc_thuc_tinh" },
      ],
    } as unknown as CombatState;
    expect(attackLookOf(data, state, "summon:0")).toEqual({ kind: "moon", color: 0xf4d35e });
    expect(attackLookOf(data, state, "summon:1")).toEqual({ kind: "moon", color: 0xf4d35e });
  });
});
