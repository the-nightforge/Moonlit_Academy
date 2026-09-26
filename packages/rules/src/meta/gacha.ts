import { nextRandom } from "../rng";
import type { EconomyConfig, GameData, Profile, Rarity } from "../types/index";
import { checkAchievements, recordProgress } from "./economy";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Rarities from highest to lowest (`14` §9 step 4). */
const RARITIES: readonly Rarity[] = ["legendary", "epic", "rare", "common"];

export interface PullResult {
  itemId: string;
  rarity: Rarity;
  outcome: "newHero" | "constellation" | "moonStar" | "newWeapon" | "refinement" | "newRelic" | "resonance" | "maxed";
  /** Constellation after a duplicate raised it. */
  constellation?: number;
  /** Refinement / resonance after a duplicate raised it (`14` §13.1). */
  refinement?: number;
  resonance?: number;
  /** Moon stars from a duplicate at the top level (constellation 6, or gear level 5). */
  moonStar?: number;
  /** Materials from a gear duplicate at level 5. */
  darkIron?: number;
  moonDust?: number;
}

const MAX_GEAR_LEVEL = 5;

/** Chance of a legendary on the `sinceLegendary`-th pull since the last one (`14` §9 step 2). */
export function legendaryRate(gacha: EconomyConfig["gacha"], sinceLegendary: number): number {
  if (sinceLegendary >= gacha.legendaryPity) return 1;
  if (sinceLegendary >= gacha.legendarySoftPityStart) {
    return Math.min(1, gacha.rates.legendary + gacha.legendarySoftPityStep * (sinceLegendary - gacha.legendarySoftPityStart + 1));
  }
  return gacha.rates.legendary;
}

/** The rarity to use when `rolled` has nothing in the pool: step down, then up (`14` §9 step 4). */
function availableRarity(pool: Record<Rarity, string[]>, rolled: Rarity): Rarity {
  const start = RARITIES.indexOf(rolled);
  const down = RARITIES.slice(start).find((rarity) => pool[rarity].length > 0);
  if (down) return down;
  return [...RARITIES.slice(0, start)].reverse().find((rarity) => pool[rarity].length > 0)!;
}

/**
 * Gives a hero: new → owned; duplicate → constellation +1 (1 and 3 add an unlock);
 * at constellation 6 → moon stars (`14` §10). Mutates `profile`.
 */
function grantHero(data: GameData, profile: Profile, heroId: string, rarity: Rarity): PullResult {
  const hero = profile.heroes[heroId];
  if (!hero) {
    profile.heroes[heroId] = { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
    return { itemId: heroId, rarity, outcome: "newHero" };
  }
  if (hero.constellation < 6) {
    hero.constellation += 1;
    if (hero.constellation === 1 || hero.constellation === 3) hero.bonusUnlocks += 1;
    return { itemId: heroId, rarity, outcome: "constellation", constellation: hero.constellation };
  }
  const moonStar = data.economyConfig.dupeMoonStar[rarity];
  profile.currencies.moonStar += moonStar;
  return { itemId: heroId, rarity, outcome: "moonStar", moonStar };
}

/**
 * Gives a weapon or moon relic: new → level 1; duplicate → +1; at level 5 → one
 * dark iron / moon dust and moon stars (`14` §13.1). Mutates `profile`.
 */
function grantGear(data: GameData, profile: Profile, kind: "weapon" | "relic", id: string, rarity: Rarity): PullResult {
  if (kind === "weapon") {
    const weapon = profile.weapons[id];
    if (!weapon) {
      profile.weapons[id] = { refinement: 1 };
      return { itemId: id, rarity, outcome: "newWeapon" };
    }
    if (weapon.refinement < MAX_GEAR_LEVEL) {
      weapon.refinement += 1;
      return { itemId: id, rarity, outcome: "refinement", refinement: weapon.refinement };
    }
  } else {
    const relic = profile.relics[id];
    if (!relic) {
      profile.relics[id] = { resonance: 1 };
      return { itemId: id, rarity, outcome: "newRelic" };
    }
    if (relic.resonance < MAX_GEAR_LEVEL) {
      relic.resonance += 1;
      return { itemId: id, rarity, outcome: "resonance", resonance: relic.resonance };
    }
  }
  const moonStar = data.economyConfig.gearDupeMoonStar[rarity];
  profile.currencies.moonStar += moonStar;
  if (kind === "weapon") {
    profile.currencies.darkIron += 1;
    return { itemId: id, rarity, outcome: "maxed", moonStar, darkIron: 1 };
  }
  profile.currencies.moonDust += 1;
  return { itemId: id, rarity, outcome: "maxed", moonStar, moonDust: 1 };
}

/** Owns `heroId` as if pulled (shop hero choice, `14` §11). Mutates `profile`. */
export function grantHeroItem(data: GameData, profile: Profile, heroId: string): PullResult {
  return grantHero(data, profile, heroId, data.heroes[heroId]!.rarity);
}

/** One pull on `bannerId` (`14` §9 steps 1–7). Mutates `profile`; returns the next RNG state. */
function pullOnce(data: GameData, profile: Profile, bannerId: string, rngState: number): { result: PullResult; rngState: number } {
  const banner = data.banners[bannerId]!;
  const gacha = data.economyConfig.gacha;
  const pity = (profile.pity[bannerId] ??= { sinceEpic: 0, sinceLegendary: 0 });
  pity.sinceEpic += 1;
  pity.sinceLegendary += 1;

  let rng = rngState;
  const draw = () => {
    const next = nextRandom(rng);
    rng = next.rngState;
    return next.value;
  };

  const pLegendary = legendaryRate(gacha, pity.sinceLegendary);
  const u1 = draw();
  let rolled: Rarity;
  if (u1 < pLegendary) rolled = "legendary";
  else if (pity.sinceEpic >= gacha.epicPity || u1 < pLegendary + gacha.rates.epic) rolled = "epic";
  else if (banner.pool.common.length > 0 && banner.pool.rare.length > 0) rolled = draw() < 0.5 ? "common" : "rare";
  else rolled = banner.pool.common.length > 0 ? "common" : "rare";

  const rarity = availableRarity(banner.pool, rolled);
  if (rarity === "legendary") {
    pity.sinceLegendary = 0;
    pity.sinceEpic = 0;
  } else if (rarity === "epic") {
    pity.sinceEpic = 0;
  }

  let candidates = banner.pool[rarity];
  if (gacha.newPlayerEpicHero && banner.kind === "hero" && rarity === "epic") {
    const unowned = candidates.filter((heroId) => !profile.heroes[heroId]);
    if (unowned.length > 0) candidates = unowned;
  }
  const itemId = candidates[Math.floor(draw() * candidates.length)]!;
  const result = banner.kind === "hero"
    ? grantHero(data, profile, itemId, rarity)
    : grantGear(data, profile, banner.kind, itemId, rarity);
  return { result, rngState: rng };
}

/** Pays for and performs `count` pulls (1 or 10) with the server's seed (`14` §9). */
export function pullMany(
  data: GameData,
  profile: Profile,
  bannerId: string,
  count: 1 | 10,
  rngState: number,
  now: number,
): { ok: true; profile: Profile; results: PullResult[]; achievements: string[] } | { ok: false; error: string } {
  if (!data.banners[bannerId]) return { ok: false, error: "unknown banner" };
  const cost = data.economyConfig.pullCost * count;
  if (profile.currencies.moonJade < cost) return { ok: false, error: "not enough moonJade" };
  let next = clone(profile);
  next.currencies.moonJade -= cost;
  const results: PullResult[] = [];
  let rng = rngState;
  for (let index = 0; index < count; index++) {
    const pulled = pullOnce(data, next, bannerId, rng);
    results.push(pulled.result);
    rng = pulled.rngState;
  }
  next = recordProgress(data, next, now, { gachaPulls: count }).profile;
  next.stats.gachaPulls = (next.stats.gachaPulls ?? 0) + count;
  const checked = checkAchievements(data, next);
  return { ok: true, profile: checked.profile, results, achievements: checked.achievements };
}
