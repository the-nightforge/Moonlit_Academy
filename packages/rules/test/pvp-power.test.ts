import { describe, expect, it } from "vitest";
import { measurePvpPower, starterDeck, type PvpSide } from "../src/index";
import { testData } from "./helpers";

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
});
