import { findNode } from "../run/run";
import type { GameData, MasteryGain, Profile, RunResult, RunState, SavedDeck } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createProfile(data: GameData): Profile {
  return {
    version: 1,
    heroes: Object.fromEntries(Object.keys(data.heroes).map((id) => [id, { xp: 0, unlockedCardIds: [] }])),
    decks: [],
  };
}

export function masteryLevel(data: GameData, xp: number): number {
  return data.metaConfig.masteryLevels.filter((threshold) => xp >= threshold).length;
}

export function pendingUnlocks(data: GameData, profile: Profile, heroId: string): number {
  const hero = profile.heroes[heroId];
  if (!hero) return 0;
  return Math.max(0, masteryLevel(data, hero.xp) - hero.unlockedCardIds.length);
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

export function applyRunResult(
  data: GameData,
  profile: Profile,
  result: RunResult,
): { profile: Profile; gains: MasteryGain[] } {
  const next = clone(profile);
  const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
  const gains = result.heroIds.map((heroId) => {
    const hero = (next.heroes[heroId] ??= { xp: 0, unlockedCardIds: [] });
    const levelBefore = masteryLevel(data, hero.xp);
    const xp = perFloor * result.floorReached + (result.won ? win : 0) + heroLevelUp * (result.heroLevelUps[heroId] ?? 0);
    hero.xp += xp;
    return { heroId, xp, levelBefore, levelAfter: masteryLevel(data, hero.xp) };
  });
  return { profile: next, gains };
}

export function unlockCard(
  data: GameData,
  profile: Profile,
  heroId: string,
  cardId: string,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (!data.heroes[heroId]?.lockedCardIds.includes(cardId)) return { ok: false, error: "not a locked card" };
  if (profile.heroes[heroId]?.unlockedCardIds.includes(cardId)) return { ok: false, error: "already unlocked" };
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

/** Reads untrusted saved JSON (`14` §4.4); never throws. */
export function parseProfile(data: GameData, raw: unknown): { profile: Profile; reset: boolean } {
  const profile = createProfile(data);
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.heroes) || !Array.isArray(raw.decks)) {
    return { profile, reset: true };
  }
  for (const heroId of Object.keys(profile.heroes)) {
    const entry = raw.heroes[heroId];
    if (!isRecord(entry)) continue;
    const xp = typeof entry.xp === "number" && Number.isFinite(entry.xp) && entry.xp > 0 ? Math.floor(entry.xp) : 0;
    const locked = data.heroes[heroId]!.lockedCardIds;
    const unlocked = Array.isArray(entry.unlockedCardIds)
      ? entry.unlockedCardIds.filter((id): id is string => typeof id === "string" && locked.includes(id))
      : [];
    profile.heroes[heroId] = { xp, unlockedCardIds: [...new Set(unlocked)] };
  }
  profile.decks = raw.decks.filter(isDeckShape).map((deck) => clone(deck));
  return { profile, reset: false };
}
