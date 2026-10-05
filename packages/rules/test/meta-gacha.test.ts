import { describe, expect, it } from "vitest";
import type { GameData, Profile, Rarity } from "../src/index";
import { createProfile, featuredEntry, legendaryRate, parseProfile, pullMany } from "../src/index";
import { testData } from "./helpers";

const NOW = Date.UTC(2026, 8, 28, 12);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BANNER = "banner_heroes";
const FEATURED = "banner_nguyet_tuong";

function withJade(data: GameData, moonJade: number, profile: Profile = createProfile(data)): Profile {
  return { ...profile, currencies: { ...profile.currencies, moonJade } };
}

/** Data whose hero banner rolls with fixed rates (0 or 1 make outcomes certain). */
function rigged(rates: { legendary: number; epic: number }, pool?: Partial<Record<Rarity, string[]>>): GameData {
  const data = testData();
  data.economyConfig.gacha.rates = rates;
  if (pool) data.banners[BANNER]!.pool = { common: [], rare: [], epic: [], legendary: [], ...pool };
  return data;
}

function pull(data: GameData, profile: Profile, count: 1 | 10, seed = 7) {
  const result = pullMany(data, profile, BANNER, count, seed, NOW);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("gacha", () => {
  it("T186: the same profile and seed give the same pulls; ten pulls cost ten times and count as ten", () => {
    const data = testData();
    const profile = withJade(data, 5000);
    const first = pull(data, profile, 10, 12345);
    expect(pull(data, profile, 10, 12345)).toEqual(first);
    expect(first.results).toHaveLength(10);
    expect(first.profile.currencies.moonJade).toBe(5000 - 10 * data.economyConfig.pullCost);
    expect(first.profile.missions.weekly.gachaPulls).toBe(10);
    expect(first.profile.stats.gachaPulls).toBe(10);
    expect(profile.currencies.moonJade).toBe(5000); // input untouched
    // Different seeds do change outcomes (single seeds may coincide: most pulls are f04).
    const outcomes = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(pull(data, profile, 10, seed).results)));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("T187: the epicPity-th pull without an epic is an epic; a legendary resets both counters", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    const { epicPity } = data.economyConfig.gacha;
    const result = pull(data, withJade(data, 5000), 10);
    const rarities = result.results.map((entry) => entry.rarity);
    expect(rarities.slice(0, epicPity - 1).every((rarity) => rarity !== "epic")).toBe(true);
    expect(rarities[epicPity - 1]).toBe("epic");
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 10 - epicPity, sinceLegendary: 10 });

    const lucky = rigged({ legendary: 1, epic: 0 });
    const profile = withJade(lucky, 1000);
    profile.pity[BANNER] = { sinceEpic: 7, sinceLegendary: 30 };
    const legendary = pull(lucky, profile, 1);
    expect(legendary.results[0]!.rarity).toBe("legendary");
    expect(legendary.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
  });

  it("T188: the legendaryPity-th pull is a legendary; soft pity raises the rate from its start", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    const gacha = data.economyConfig.gacha;
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart)).toBe(0);
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart + 1)).toBeCloseTo(gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart + 3)).toBeCloseTo(3 * gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, gacha.legendaryPity)).toBe(1);

    // With soft pity switched off, only the hard pity can give a legendary.
    gacha.legendarySoftPityStep = 0;
    const profile = withJade(data, 100_000);
    profile.pity[BANNER] = { sinceEpic: 0, sinceLegendary: gacha.legendaryPity - 5 };
    const result = pull(data, profile, 10);
    expect(result.results.map((entry) => entry.rarity).indexOf("legendary")).toBe(4);
    expect(result.results.filter((entry) => entry.rarity === "legendary")).toHaveLength(1);
  });

  it("T189: an empty rarity steps down, then up; new-player protection picks epic heroes not owned", () => {
    const down = rigged({ legendary: 1, epic: 0 }, { epic: ["f03"], rare: ["f04"] });
    expect(pull(down, withJade(down, 1000), 1).results[0]).toMatchObject({ itemId: "f03", rarity: "epic" });
    const up = rigged({ legendary: 0, epic: 0 }, { legendary: ["m05"] });
    expect(pull(up, withJade(up, 1000), 1).results[0]).toMatchObject({ itemId: "m05", rarity: "legendary" });

    const epic = rigged({ legendary: 0, epic: 1 });
    const owned = pull(epic, withJade(epic, 5000), 10).results.map((entry) => entry.itemId);
    // m06 is a starter; the first two epics must be two distinct epic heroes not owned.
    const epicPool = epic.banners[BANNER]!.pool.epic;
    expect(new Set(owned.slice(0, 2)).size).toBe(2);
    expect(owned.slice(0, 2).every((heroId) => epicPool.includes(heroId) && heroId !== "m06")).toBe(true);
  });

  it("T190: not enough moon jade is an error and changes nothing", () => {
    const data = testData();
    const profile = withJade(data, data.economyConfig.pullCost * 10 - 1);
    expect(pullMany(data, profile, BANNER, 10, 1, NOW)).toEqual({ ok: false, error: "not enough moonJade" });
    expect(pullMany(data, profile, "banner_nope", 1, 1, NOW)).toEqual({ ok: false, error: "unknown banner" });
    expect(profile.pity).toEqual({});
  });

  it("T191: a new hero is owned; a duplicate raises constellation (1 and 3 add an unlock); at 6 it pays moon stars", () => {
    const data = rigged({ legendary: 0, epic: 0 }, { rare: ["f04"], epic: ["f03"] });
    data.economyConfig.gacha.epicPity = 1000;
    const start = withJade(data, 5000);
    delete start.heroes["f04"];
    const results = pull(data, start, 10).results;
    expect(results[0]).toEqual({ itemId: "f04", rarity: "rare", outcome: "newHero" });
    expect(results.slice(1, 7).map((entry) => entry.constellation)).toEqual([1, 2, 3, 4, 5, 6]);
    const moonStar = data.economyConfig.dupeMoonStar.rare;
    expect(results[7]).toEqual({ itemId: "f04", rarity: "rare", outcome: "moonStar", moonStar });
    const profile = pull(data, start, 10).profile;
    expect(profile.heroes["f04"]).toMatchObject({ constellation: 6, bonusUnlocks: 2 });
    expect(profile.currencies.moonStar).toBe(3 * moonStar);
  });

  it("T331: the featured banner gives the week's hero on ~half of legendary rolls", () => {
    const data = rigged({ legendary: 1, epic: 0 });
    const entry = featuredEntry(data.banners[FEATURED]!, NOW)!;
    const hits = { featured: 0, fallback: 0 };
    for (let seed = 1; seed <= 200; seed++) {
      const result = pullMany(data, withJade(data, 1000), FEATURED, 1, seed, NOW);
      if (!result.ok) throw new Error(result.error);
      const pull = result.results[0]!;
      expect(pull.rarity).toBe("legendary");
      if (pull.featuredHit) {
        expect(pull.itemId).toBe(entry.heroId);
        hits.featured += 1;
      } else {
        expect(data.banners[FEATURED]!.pool.legendary).toContain(pull.itemId);
        hits.fallback += 1;
      }
    }
    // 50% rate-up over 200 seeds: a 40–60% window is generous yet proves the split.
    expect(hits.featured).toBeGreaterThan(60);
    expect(hits.fallback).toBeGreaterThan(60);
  });

  it("T332: the two hero banners share one pity counter, migrating the old key", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    // parseProfile folds a stored `pity.banner_heroes` into the group key.
    const stored = JSON.parse(JSON.stringify(withJade(data, 0)));
    stored.pity = { [BANNER]: { sinceEpic: 9, sinceLegendary: 30 } };
    const parsed = parseProfile(data, stored).profile;
    expect(parsed.pity.heroes).toEqual({ sinceEpic: 9, sinceLegendary: 30 });
    expect(parsed.pity[BANNER]).toBeUndefined();

    const profile = withJade(data, 5000);
    profile.pity[BANNER] = { sinceEpic: 9, sinceLegendary: 30 };
    // One pull on the featured banner pushes the shared counter to epicPity.
    const result = pullMany(data, profile, FEATURED, 1, 7, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.results[0]!.rarity).toBe("epic");
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 31 });
    expect(result.profile.pity[BANNER]).toBeUndefined();
    expect(result.profile.pity[FEATURED]).toBeUndefined();
    // A legendary on the featured banner resets the shared counter for both.
    const lucky = rigged({ legendary: 1, epic: 0 });
    const second = pullMany(lucky, result.profile, FEATURED, 1, 7, NOW);
    if (!second.ok) throw new Error(second.error);
    expect(second.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
    const third = pullMany(lucky, second.profile, BANNER, 1, 7, NOW);
    if (!third.ok) throw new Error(third.error);
    expect(third.results[0]!.rarity).toBe("legendary"); // counter resumed, not re-seeded
    expect(third.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
  });

  it("T333: featured rotation rolls over weekly and non-legendary pulls use the week's pool", () => {
    const data = testData();
    const banner = data.banners[FEATURED]!;
    const first = featuredEntry(banner, NOW)!;
    const next = featuredEntry(banner, NOW + WEEK_MS)!;
    expect(next.heroId).not.toBe(first.heroId);
    expect(featuredEntry(banner, NOW + WEEK_MS * banner.featured!.rotation.length)!.heroId).toBe(first.heroId);
    // Legendary rate 0, epic rate 1: every pull lands in the week's epic pool.
    data.economyConfig.gacha.rates = { legendary: 0, epic: 1 };
    const epicPull = pullMany(data, withJade(data, 1000), FEATURED, 1, 5, NOW);
    if (!epicPull.ok) throw new Error(epicPull.error);
    expect(first.pool.epic).toContain(epicPull.results[0]!.itemId);
  });

  it("T334: legendary pity is 80 with soft pity from pull 50 at +1.5% per pull", () => {
    const data = testData();
    const gacha = data.economyConfig.gacha;
    expect(gacha.legendaryPity).toBe(80);
    expect(gacha.legendarySoftPityStart).toBe(50);
    expect(legendaryRate(gacha, 50)).toBe(gacha.rates.legendary);
    expect(legendaryRate(gacha, 51)).toBeCloseTo(gacha.rates.legendary + gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, 79)).toBeCloseTo(gacha.rates.legendary + 29 * gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, 80)).toBe(1);
    // Hard pity fires inside a pull run on real data.
    data.economyConfig.gacha.rates = { legendary: 0, epic: 0 };
    gacha.legendarySoftPityStep = 0;
    const profile = withJade(data, 100_000);
    profile.pity[BANNER] = { sinceEpic: 0, sinceLegendary: 75 };
    const result = pullMany(data, profile, BANNER, 10, 3, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.results.map((entry) => entry.rarity).indexOf("legendary")).toBe(4);
    // The legendary resets both counters; the five pulls after it count again.
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 5, sinceLegendary: 5 });
    expect(result.profile.pity[BANNER]).toBeUndefined(); // migrated to the group key
  });
});
