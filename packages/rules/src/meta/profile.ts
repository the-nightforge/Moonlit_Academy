import { findNode } from "../run/run";
import type {
  GameData, HeroProgress, MasteryGain, MissionState, PeriodCounters, Profile, RunResult, RunState, SavedDeck,
} from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newHero(): HeroProgress {
  return { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
}

export function emptyCounters(): PeriodCounters {
  return { runsFinished: 0, runsWon: 0, floorsReached: 0, bossKills: 0, gachaPulls: 0, cardsUnlocked: 0, heroesUsed: [] };
}

function emptyMissions(): MissionState {
  return { dayKey: "", weekKey: "", daily: emptyCounters(), weekly: emptyCounters(), claimed: [] };
}

/** A new account (`14` §2.2): owns the starter heroes only. */
export function createProfile(data: GameData): Profile {
  return {
    version: 2,
    heroes: Object.fromEntries(data.economyConfig.starterHeroIds.map((id) => [id, newHero()])),
    decks: [],
    currencies: { moonJade: 0, moonStar: 0, darkIron: 0, moonDust: 0 },
    weapons: {},
    relics: {},
    pity: {},
    missions: emptyMissions(),
    shop: { weekKey: "", bought: {} },
    achievements: [],
    stats: {},
    flags: { starterGiftClaimed: false, localImportDone: false },
  };
}

export function masteryLevel(data: GameData, xp: number): number {
  return data.metaConfig.masteryLevels.filter((threshold) => xp >= threshold).length;
}

/** Unlocks the hero has earned but not spent; 0 for heroes not owned. */
export function pendingUnlocks(data: GameData, profile: Profile, heroId: string): number {
  const hero = profile.heroes[heroId];
  const def = data.heroes[heroId];
  if (!hero || !def) return 0;
  const earned = Math.min(masteryLevel(data, hero.xp) + hero.bonusUnlocks, def.lockedCardIds.length);
  return Math.max(0, earned - hero.unlockedCardIds.length);
}

export function summarizeRun(data: GameData, run: RunState): RunResult {
  if (run.status !== "won" && run.status !== "lost") throw new Error("summarizeRun: run is not over");
  return {
    heroIds: run.heroes.map((hero) => hero.defId) as [string, string, string],
    floorReached: run.position ? (findNode(run, run.position)?.floor ?? 0) : 0,
    won: run.status === "won",
    heroLevelUps: { ...run.heroLevelUps },
  };
}

/** Grants mastery XP to the run's heroes; heroes not owned get nothing. */
export function applyRunResult(
  data: GameData,
  profile: Profile,
  result: RunResult,
): { profile: Profile; gains: MasteryGain[] } {
  const next = clone(profile);
  const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
  const gains = result.heroIds.flatMap((heroId) => {
    const hero = next.heroes[heroId];
    if (!hero) return [];
    const levelBefore = masteryLevel(data, hero.xp);
    const xp = perFloor * result.floorReached + (result.won ? win : 0) + heroLevelUp * (result.heroLevelUps[heroId] ?? 0);
    hero.xp += xp;
    return [{ heroId, xp, levelBefore, levelAfter: masteryLevel(data, hero.xp) }];
  });
  return { profile: next, gains };
}

export function unlockCard(
  data: GameData,
  profile: Profile,
  heroId: string,
  cardId: string,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (!profile.heroes[heroId]) return { ok: false, error: "hero not owned" };
  if (!data.heroes[heroId]?.lockedCardIds.includes(cardId)) return { ok: false, error: "not a locked card" };
  if (profile.heroes[heroId]!.unlockedCardIds.includes(cardId)) return { ok: false, error: "already unlocked" };
  if (pendingUnlocks(data, profile, heroId) <= 0) return { ok: false, error: "no pending unlock" };
  const next = clone(profile);
  next.heroes[heroId]!.unlockedCardIds.push(cardId);
  return { ok: true, profile: next };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeckShape(value: unknown): value is SavedDeck {
  if (!isRecord(value)) return false;
  const { id, name, heroIds, cardIds } = value;
  return (
    typeof id === "string" &&
    typeof name === "string" &&
    Array.isArray(heroIds) && heroIds.length === 3 && heroIds.every((h) => typeof h === "string") &&
    Array.isArray(cardIds) && cardIds.every((c) => typeof c === "string")
  );
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function counters(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, count(entry)]));
}

function parseCounters(value: unknown): PeriodCounters {
  const entry = isRecord(value) ? value : {};
  return {
    runsFinished: count(entry.runsFinished),
    runsWon: count(entry.runsWon),
    floorsReached: count(entry.floorsReached),
    bossKills: count(entry.bossKills),
    gachaPulls: count(entry.gachaPulls),
    cardsUnlocked: count(entry.cardsUnlocked),
    heroesUsed: strings(entry.heroesUsed),
  };
}

/** Hero progress from saved JSON; unlocked cards not locked for that hero are dropped. */
function parseHero(data: GameData, heroId: string, entry: Record<string, unknown>): HeroProgress {
  const locked = data.heroes[heroId]!.lockedCardIds;
  return {
    xp: count(entry.xp),
    unlockedCardIds: strings(entry.unlockedCardIds).filter((id) => locked.includes(id)),
    constellation: Math.min(6, count(entry.constellation)),
    bonusUnlocks: count(entry.bonusUnlocks),
    levelUpForm: entry.levelUpForm === "alt" ? "alt" : "base",
  };
}

/**
 * Reads untrusted saved JSON (`14` §2.3); never throws. Version 1 (phase 4b)
 * keeps the starter heroes' progress; version 2 falls back field by field.
 */
export function parseProfile(data: GameData, raw: unknown): { profile: Profile; reset: boolean } {
  const profile = createProfile(data);
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2)) return { profile, reset: true };
  if (raw.version === 1 && (!isRecord(raw.heroes) || !Array.isArray(raw.decks))) return { profile, reset: true };

  const heroes = isRecord(raw.heroes) ? raw.heroes : {};
  for (const [heroId, entry] of Object.entries(heroes)) {
    if (!data.heroes[heroId] || !isRecord(entry)) continue;
    if (raw.version === 1 && !data.economyConfig.starterHeroIds.includes(heroId)) continue;
    profile.heroes[heroId] = parseHero(data, heroId, entry);
  }
  profile.decks = Array.isArray(raw.decks) ? raw.decks.filter(isDeckShape).map((deck) => clone(deck)) : [];
  if (raw.version === 1) return { profile, reset: false };

  const currencies = isRecord(raw.currencies) ? raw.currencies : {};
  profile.currencies = {
    moonJade: count(currencies.moonJade),
    moonStar: count(currencies.moonStar),
    darkIron: count(currencies.darkIron),
    moonDust: count(currencies.moonDust),
  };
  if (isRecord(raw.weapons)) {
    for (const [id, entry] of Object.entries(raw.weapons)) {
      if (isRecord(entry)) profile.weapons[id] = { refinement: Math.min(5, Math.max(1, count(entry.refinement))) };
    }
  }
  if (isRecord(raw.relics)) {
    for (const [id, entry] of Object.entries(raw.relics)) {
      if (isRecord(entry)) profile.relics[id] = { resonance: Math.min(5, Math.max(1, count(entry.resonance))) };
    }
  }
  if (isRecord(raw.pity)) {
    for (const [id, entry] of Object.entries(raw.pity)) {
      if (isRecord(entry)) profile.pity[id] = { sinceEpic: count(entry.sinceEpic), sinceLegendary: count(entry.sinceLegendary) };
    }
  }
  if (isRecord(raw.missions)) {
    const missions = raw.missions;
    profile.missions = {
      dayKey: typeof missions.dayKey === "string" ? missions.dayKey : "",
      weekKey: typeof missions.weekKey === "string" ? missions.weekKey : "",
      daily: parseCounters(missions.daily),
      weekly: parseCounters(missions.weekly),
      claimed: strings(missions.claimed),
    };
  }
  if (isRecord(raw.shop)) {
    profile.shop = {
      weekKey: typeof raw.shop.weekKey === "string" ? raw.shop.weekKey : "",
      bought: counters(raw.shop.bought),
    };
  }
  profile.achievements = strings(raw.achievements);
  profile.stats = counters(raw.stats);
  const flags = isRecord(raw.flags) ? raw.flags : {};
  profile.flags = {
    starterGiftClaimed: flags.starterGiftClaimed === true,
    localImportDone: flags.localImportDone === true,
  };
  return { profile, reset: false };
}

/**
 * One-time import of a phase 4b localStorage profile into an account (`14` §2.4).
 * `local` has already gone through `parseProfile`.
 */
export function mergeImportedProfile(
  data: GameData,
  profile: Profile,
  local: Profile,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (profile.flags.localImportDone) return { ok: false, error: "already imported" };
  const next = clone(profile);
  for (const [heroId, hero] of Object.entries(next.heroes)) {
    const imported = local.heroes[heroId];
    if (!imported) continue;
    hero.xp = Math.max(hero.xp, imported.xp);
    const locked = data.heroes[heroId]!.lockedCardIds;
    const union = [...new Set([...hero.unlockedCardIds, ...imported.unlockedCardIds])].filter((id) => locked.includes(id));
    const allowed = Math.min(masteryLevel(data, hero.xp) + hero.bonusUnlocks, locked.length);
    hero.unlockedCardIds = union.slice(0, Math.max(allowed, hero.unlockedCardIds.length));
  }
  let highest = Math.max(0, ...next.decks.map((deck) => Number(deck.id.slice(1)) || 0));
  for (const deck of local.decks) {
    if (next.decks.length >= data.metaConfig.maxDecks) break;
    highest += 1;
    next.decks.push({ ...clone(deck), id: `d${highest}` });
  }
  next.flags.localImportDone = true;
  return { ok: true, profile: next };
}

/** Chooses a hero's level-up form; the second form needs Tinh Hồn 5 (`14` §10.1). */
export function setLevelUpForm(
  data: GameData,
  profile: Profile,
  heroId: string,
  form: "base" | "alt",
): { ok: true; profile: Profile } | { ok: false; error: string } {
  const hero = profile.heroes[heroId];
  if (!hero || !data.heroes[heroId]) return { ok: false, error: "hero not owned" };
  if (form === "alt" && hero.constellation < 5) return { ok: false, error: "constellation too low" };
  const next = clone(profile);
  next.heroes[heroId]!.levelUpForm = form;
  return { ok: true, profile: next };
}
