import { nextRandom } from "../rng";
import type { BannerDef, EconomyConfig, FeaturedRotationEntry, GameData, Profile, Rarity } from "../types/index";
import { checkAchievements, recordProgress } from "./economy";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Rarities from highest to lowest (`14` §9 step 4). */
const RARITIES: readonly Rarity[] = ["legendary", "epic", "rare", "common"];
/** The epic/rare/common tiers a featured rotation pool can hold. */
const LOWER_RARITIES: readonly Rarity[] = ["epic", "rare", "common"];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Rotation weeks roll over Monday 00:00 ICT (UTC+7). */
const ROTATION_ANCHOR = Date.UTC(1970, 0, 4, 17); // Monday 1970-01-05 00:00 ICT

/** The rotation entry active at `now` on a featured banner (undefined elsewhere). */
export function featuredEntry(banner: BannerDef, now: number): FeaturedRotationEntry | undefined {
  const rotation = banner.featured?.rotation;
  if (!rotation || rotation.length === 0) return undefined;
  const week = Math.floor((now - ROTATION_ANCHOR) / WEEK_MS);
  return rotation[((week % rotation.length) + rotation.length) % rotation.length];
}

/** Timestamp (ms) when a featured banner's rotation rolls to the next week. */
export function featuredRotationEnd(banner: BannerDef, now: number): number | undefined {
  const rotation = banner.featured?.rotation;
  if (!rotation || rotation.length === 0) return undefined;
  const week = Math.floor((now - ROTATION_ANCHOR) / WEEK_MS);
  return ROTATION_ANCHOR + (week + 1) * WEEK_MS;
}

export interface PullResult {
  itemId: string;
  rarity: Rarity;
  outcome: "newHero" | "constellation" | "moonStar" | "newWeapon" | "refinement" | "newRelic" | "resonance" | "maxed";
  /** True when a featured banner's rate-up gave the week's hero. */
  featuredHit?: boolean;
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

/** Chance of a legendary on the `sinceLegendary`-th pull since the last one (`14` §9 step 2).
 *  Soft pity: `base + step × (pulls past legendarySoftPityStart)`. */
export function legendaryRate(gacha: EconomyConfig["gacha"], sinceLegendary: number): number {
  if (sinceLegendary >= gacha.legendaryPity) return 1;
  if (sinceLegendary > gacha.legendarySoftPityStart) {
    return Math.min(1, gacha.rates.legendary + gacha.legendarySoftPityStep * (sinceLegendary - gacha.legendarySoftPityStart));
  }
  return gacha.rates.legendary;
}

/** The rarity to use when `rolled` has nothing in the pool: step down, then up
 *  (`14` §9 step 4). `allowed` bounds the search — featured banners never let a
 *  lower roll step up to legendary. */
function availableRarity(pool: Partial<Record<Rarity, string[]>>, rolled: Rarity, allowed: readonly Rarity[]): Rarity {
  const start = allowed.indexOf(rolled);
  const down = allowed.slice(start).find((rarity) => (pool[rarity] ?? []).length > 0);
  if (down) return down;
  return [...allowed.slice(0, start)].reverse().find((rarity) => (pool[rarity] ?? []).length > 0)!;
}

/** The pity counter key for a banner: its group, or its own id (`14` §9). */
function pityKey(banner: BannerDef): string {
  return banner.pityGroup ?? banner.id;
}

/** Lazily adopts per-banner pity counters left over from before `pityGroup`. */
function migratePity(data: GameData, profile: Profile, banner: BannerDef): void {
  const key = pityKey(banner);
  if (key === banner.id || profile.pity[key]) return;
  for (const member of Object.values(data.banners)) {
    if (member.pityGroup !== key) continue;
    const legacy = profile.pity[member.id];
    if (legacy && (!profile.pity[key] || legacy.sinceLegendary > profile.pity[key]!.sinceLegendary)) {
      profile.pity[key] = legacy;
    }
    if (member.id !== key) delete profile.pity[member.id];
  }
}

/** Folds all pre-`pityGroup` per-banner counters into their group keys. Mutates `profile`. */
export function normalizePity(data: GameData, profile: Profile): void {
  for (const banner of Object.values(data.banners)) migratePity(data, profile, banner);
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

/** Owns a weapon or relic as if pulled (honor shop choice, `14` §14.4). Mutates `profile`. */
export function grantGearItem(data: GameData, profile: Profile, kind: "weapon" | "relic", itemId: string): PullResult {
  const rarity = kind === "weapon" ? data.weapons[itemId]!.rarity : data.relics[itemId]!.rarity;
  return grantGear(data, profile, kind, itemId, rarity);
}

/** One pull on `bannerId` (`14` §9 steps 1–7). Mutates `profile`; returns the next RNG state. */
function pullOnce(data: GameData, profile: Profile, bannerId: string, rngState: number, now: number): { result: PullResult; rngState: number } {
  const banner = data.banners[bannerId]!;
  const gacha = data.economyConfig.gacha;
  migratePity(data, profile, banner);
  const pity = (profile.pity[pityKey(banner)] ??= { sinceEpic: 0, sinceLegendary: 0 });
  pity.sinceEpic += 1;
  pity.sinceLegendary += 1;

  let rng = rngState;
  const draw = () => {
    const next = nextRandom(rng);
    rng = next.rngState;
    return next.value;
  };

  // A featured banner's epic/rare/common pools come from the week's rotation
  // entry; its legendary resolves the rate-up against `pool.legendary`.
  const entry = featuredEntry(banner, now);
  const lowerPool: Partial<Record<Rarity, string[]>> = entry ? entry.pool : banner.pool;

  const pLegendary = legendaryRate(gacha, pity.sinceLegendary);
  const u1 = draw();
  let rolled: Rarity;
  if (u1 < pLegendary) rolled = "legendary";
  else if (pity.sinceEpic >= gacha.epicPity || u1 < pLegendary + gacha.rates.epic) rolled = "epic";
  else if ((lowerPool.common ?? []).length > 0 && (lowerPool.rare ?? []).length > 0) rolled = draw() < 0.5 ? "common" : "rare";
  else rolled = (lowerPool.common ?? []).length > 0 ? "common" : "rare";

  const allowed = rolled === "legendary" ? RARITIES : entry ? LOWER_RARITIES : RARITIES;
  const rarityPool = rolled === "legendary" && entry
    ? { ...banner.pool, legendary: [entry.heroId, ...banner.pool.legendary] }
    : rolled === "legendary"
      ? banner.pool
      : lowerPool;
  const rarity = availableRarity(rarityPool, rolled, allowed);
  if (rarity === "legendary") {
    pity.sinceLegendary = 0;
    pity.sinceEpic = 0;
  } else if (rarity === "epic") {
    pity.sinceEpic = 0;
  }

  let itemId: string;
  let featuredHit = false;
  if (rarity === "legendary" && entry) {
    const fallback = banner.pool.legendary;
    if (fallback.length === 0 || draw() < banner.featured!.rateUp) {
      itemId = entry.heroId;
      featuredHit = true;
    } else {
      itemId = fallback[Math.floor(draw() * fallback.length)]!;
    }
  } else {
    let candidates = (rarity === "legendary" ? banner.pool : lowerPool)[rarity]!;
    if (gacha.newPlayerEpicHero && banner.kind === "hero" && rarity === "epic") {
      const unowned = candidates.filter((heroId) => !profile.heroes[heroId]);
      if (unowned.length > 0) candidates = unowned;
    }
    itemId = candidates[Math.floor(draw() * candidates.length)]!;
  }
  const result = banner.kind === "hero"
    ? grantHero(data, profile, itemId, rarity)
    : grantGear(data, profile, banner.kind, itemId, rarity);
  return { result: featuredHit ? { ...result, featuredHit: true } : result, rngState: rng };
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
    const pulled = pullOnce(data, next, bannerId, rng, now);
    results.push(pulled.result);
    rng = pulled.rngState;
  }
  next = recordProgress(data, next, now, { gachaPulls: count }).profile;
  next.stats.gachaPulls = (next.stats.gachaPulls ?? 0) + count;
  const checked = checkAchievements(data, next);
  return { ok: true, profile: checked.profile, results, achievements: checked.achievements };
}
