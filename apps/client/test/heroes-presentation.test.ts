import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile } from "rules";
import { filterHeroes, heroLevelUpCondition, initialHeroId, rosterPage, type HeroFilters } from "../src/ui/heroes-presentation";

const data = loadGameData();
const heroes = Object.values(data.heroes);
const profile = createProfile(data);
const defaults: HeroFilters = { query: "", ownership: "all", faction: "all", sort: "owned" };

describe("hero roster presentation", () => {
  it("explains the level-up trigger using the selected hero and constellation threshold", () => {
    expect(heroLevelUpCondition(data.heroes.m05!, 0)).toBe("Mất tổng 15 HP trong trận");
    expect(heroLevelUpCondition(data.heroes.m05!, 2)).toBe("Mất tổng 11 HP trong trận");
    expect(heroLevelUpCondition(data.heroes.m06!, 0)).toContain(String(data.heroes.m06!.levelUp.threshold));
    expect(heroLevelUpCondition(data.heroes.m10!, 0)).toContain("Mưu Lược");
  });
  it("finds Vietnamese names without accents and combines all filters", () => {
    expect(filterHeroes(heroes, profile.heroes, { ...defaults, query: "HOAC LIET", faction: "huyenVu", ownership: "owned" }).map(h => h.id)).toEqual(["m05"]);
    expect(filterHeroes(heroes, profile.heroes, { ...defaults, query: "hoac liet", ownership: "locked" })).toEqual([]);
    expect(filterHeroes(heroes, profile.heroes, { ...defaults, query: "Ôn Như Ý", faction: "huyenVu" })).toEqual([]);
  });
  it("counts owned heroes at zero constellation and never mutates the source order", () => {
    const original = heroes.map(h => h.id);
    expect(filterHeroes(heroes, profile.heroes, { ...defaults, ownership: "owned" }).map(h => h.id)).toEqual(["m05", "f04", "m06"]);
    const sorted = filterHeroes(heroes, profile.heroes, { ...defaults, sort: "rarity" });
    expect(sorted[0]!.rarity).toBe("legendary");
    expect(sorted.at(-1)!.rarity).toBe("common");
    expect(heroes.map(h => h.id)).toEqual(original);
  });
  it("sorts progression from six to zero before unowned heroes", () => {
    const owned = { ...profile.heroes, m05: { ...profile.heroes.m05!, constellation: 6 }, f04: { ...profile.heroes.f04!, constellation: 2 } };
    const ids = filterHeroes(heroes, owned, { ...defaults, sort: "constellation" }).map(h => h.id);
    expect(ids.slice(0, 3)).toEqual(["m05", "f04", "m06"]);
    expect(ids).toHaveLength(23);
  });
  it("clamps the last page when the collection shrinks and handles zero results", () => {
    expect(rosterPage(20, 1)).toEqual({ page: 1, pages: 2, start: 12, end: 20 });
    expect(rosterPage(3, 1)).toEqual({ page: 0, pages: 1, start: 0, end: 3 });
    expect(rosterPage(0, 99)).toEqual({ page: 0, pages: 1, start: 0, end: 0 });
    expect(rosterPage(20, -1).page).toBe(0);
  });
  it("keeps a valid selection or prefers the first owned hero instead of the first definition", () => {
    expect(initialHeroId(heroes, profile.heroes, "f03")).toBe("f03");
    expect(initialHeroId([...heroes].reverse(), profile.heroes, "missing")).toBe("m06");
    expect(initialHeroId(heroes, {})).toBe("m05");
    expect(initialHeroId([], {})).toBe("");
  });
});
