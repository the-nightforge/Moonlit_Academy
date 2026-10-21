import { describe, expect, it } from "vitest";
import { measurePvpPower, starterDeck, type DamageScale, type PvpSide } from "../src/index";
import { testData } from "./helpers";

/** A side whose deck is one card, so `measurePvpPower`'s deck term is that card alone. */
const soloDeck = (cardId: string): PvpSide => ({
  heroIds: ["f04", "m05", "m06"],
  deckCardIds: [cardId],
  loadout: { heroes: {}, relics: [] },
});

/** Adds a copy of `cardId` whose `scaledDamage` reads `per` instead. */
function withPer(data: ReturnType<typeof testData>, cardId: string, per: DamageScale, suffix: string): string {
  const clone = structuredClone(data.cards[cardId]!);
  const id = `clone_${cardId}_${suffix}`;
  clone.id = id;
  clone.effects = clone.effects.map((e) => (e.type === "scaledDamage" ? { ...e, per } : e));
  data.cards[id] = clone;
  return id;
}

describe("arena power", () => {
  it("uses selected heroes, cards, constellation milestones and actual gear levels deterministically", () => {
    const data = testData();
    const heroIds: PvpSide["heroIds"] = ["m05", "f04", "m06"];
    const side: PvpSide = { heroIds, deckCardIds: starterDeck(data, heroIds), loadout: { heroes: {}, relics: [] } };
    const base = measurePvpPower(data, side);
    expect(base).toBeGreaterThan(0);
    expect(measurePvpPower(data, structuredClone(side))).toBe(base);
    const upgraded = structuredClone(side);
    upgraded.loadout.heroes.m05 = { constellation: 6, levelUpForm: "alt", weaponId: Object.keys(data.weapons)[0]!, refinement: 1 };
    upgraded.loadout.relics = [{ id: Object.keys(data.relics)[0]!, resonance: 1 }];
    const equipped = measurePvpPower(data, upgraded);
    expect(equipped).toBeGreaterThan(base);
    upgraded.loadout.heroes.m05!.refinement = 5;
    upgraded.loadout.relics[0]!.resonance = 5;
    expect(measurePvpPower(data, upgraded)).toBeGreaterThan(equipped);
    const changed = structuredClone(side);
    data.cards[changed.deckCardIds![0]!]!.effects = [{ type: "damage", amount: 999, to: "chosen" }];
    expect(measurePvpPower(data, changed)).toBeGreaterThan(base);
    expect(measurePvpPower(data, side)).toBe(measurePvpPower(data, { ...side, loadout: { ...side.loadout, heroes: { unused: { constellation: 6, levelUpForm: "alt" } } } }));
  });

  it("values Tụ Dược by its multiplier and team width, not a flat 5", () => {
    const data = testData();
    // Bách Hoa Tụ Dược: ×3 to allAllies. Linh Chi Hộ Thể: ×2 to chosen plus 4 armor.
    const wide = measurePvpPower(data, soloDeck("f04_bach_hoa_tu_duoc"));
    const narrow = measurePvpPower(data, soloDeck("f04_linh_chi_ho_the"));
    expect(wide).toBeGreaterThan(narrow);
  });

  it("scores scaledDamage per alliesRegen against a regen pool, not the shared stand-in", () => {
    const data = testData();
    const flat = withPer(data, "f04_hoi_xuan_tan", "selfArmor", "flat");
    expect(measurePvpPower(data, soloDeck("f04_hoi_xuan_tan"))).toBeGreaterThan(
      measurePvpPower(data, soloDeck(flat)),
    );
  });

  it("leaves the other five scaledDamage stats on the shared stand-in (scope: alliesRegen only)", () => {
    const data = testData();
    const base = measurePvpPower(data, soloDeck("m03_kim_tien"));
    const unfitted: DamageScale[] = ["selfArmor", "targetDebuffs", "cardsPlayedThisTurn", "moonPower", "alliesArmor", "alliesAtFullHp"];
    for (const per of unfitted) {
      expect(measurePvpPower(data, soloDeck(withPer(data, "m03_kim_tien", per, per)))).toBe(base);
    }
  });
});
