import { describe, expect, it } from "vitest";
import type { GameData, Profile, RunState } from "../src/index";
import {
  applyRunAction, applyRunResult, createProfile, createRun, masteryLevel, parseProfile,
  pendingUnlocks, starterDeck, summarizeRun, unlockCard,
} from "../src/index";
import { testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

function withXp(data: GameData, heroId: string, xp: number): Profile {
  const profile = createProfile(data);
  profile.heroes[heroId]!.xp = xp;
  return profile;
}

describe("profile and mastery", () => {
  it("T159: a new profile owns the starter heroes at 0 XP; mastery levels follow the thresholds", () => {
    const data = testData();
    const profile = createProfile(data);
    expect(Object.keys(profile.heroes).sort()).toEqual([...data.economyConfig.starterHeroIds].sort());
    expect(profile).toMatchObject({ version: 2, decks: [] });
    const levels = data.metaConfig.masteryLevels;
    expect(masteryLevel(data, 0)).toBe(0);
    levels.forEach((threshold, index) => {
      expect(masteryLevel(data, threshold - 1)).toBe(index);
      expect(masteryLevel(data, threshold)).toBe(index + 1);
    });
    expect(pendingUnlocks(data, withXp(data, "m05", levels[1]!), "m05")).toBe(2);
  });

  it("T160: applyRunResult grants floor, win and level-up XP without mutating the input", () => {
    const data = testData();
    const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
    const profile = createProfile(data);
    const snapshot = JSON.stringify(profile);
    const { profile: next, gains } = applyRunResult(data, profile, {
      heroIds: TEAM, floorReached: 5, won: true, heroLevelUps: { m05: 2 },
    });
    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(next.heroes["m05"]!.xp).toBe(perFloor * 5 + win + heroLevelUp * 2);
    expect(next.heroes["f04"]!.xp).toBe(perFloor * 5 + win);
    expect(next.heroes["f03"]).toBeUndefined(); // not owned: no XP, no entry
    const m05 = gains.find((gain) => gain.heroId === "m05")!;
    expect(m05).toEqual({
      heroId: "m05", xp: perFloor * 5 + win + heroLevelUp * 2,
      levelBefore: 0, levelAfter: masteryLevel(data, perFloor * 5 + win + heroLevelUp * 2),
    });
  });

  it("T161: unlockCard needs a locked card of that hero, not yet unlocked, and a pending unlock", () => {
    const data = testData();
    const card = data.heroes["m05"]!.lockedCardIds[0]!;
    expect(unlockCard(data, createProfile(data), "m05", card)).toEqual({ ok: false, error: "no pending unlock" });
    const ready = withXp(data, "m05", data.metaConfig.masteryLevels[0]!);
    expect(unlockCard(data, ready, "m05", data.heroes["m05"]!.cardIds[0]!)).toEqual({ ok: false, error: "not a locked card" });
    const done = unlockCard(data, ready, "m05", card);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.profile.heroes["m05"]!.unlockedCardIds).toEqual([card]);
    expect(ready.heroes["m05"]!.unlockedCardIds).toEqual([]);
    expect(unlockCard(data, done.profile, "m05", card)).toEqual({ ok: false, error: "already unlocked" });
  });

  it("T162: parseProfile resets broken data, drops unknown ids and keeps invalid decks", () => {
    const data = testData();
    expect(parseProfile(data, "garbage")).toEqual({ profile: createProfile(data), reset: true });
    expect(parseProfile(data, { version: 3, heroes: {}, decks: [] }).reset).toBe(true);

    const locked = data.heroes["m05"]!.lockedCardIds[0]!;
    const deck = { id: "d1", name: "Thử", heroIds: TEAM, cardIds: ["f03_suong_giap"] };
    const { profile, reset } = parseProfile(data, {
      version: 1,
      heroes: { m05: { xp: 40, unlockedCardIds: [locked, "f03_suong_giap"] }, ghost: { xp: 5, unlockedCardIds: [] } },
      decks: [deck, { id: 3 }],
    });
    expect(reset).toBe(false);
    expect(profile.heroes["ghost"]).toBeUndefined();
    expect(profile.heroes["m05"]).toMatchObject({ xp: 40, unlockedCardIds: [locked] });
    expect(profile.heroes["f04"]).toEqual({ xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" });
    expect(profile.decks).toEqual([deck]);
  });

  it("T163: summarizeRun reports floor, result and hero level-ups counted across combats", () => {
    const data = testData();
    let run = createRun(data, { heroIds: TEAM, seed: 42, deckCardIds: starterDeck(data, TEAM) }).run;
    run = step(data, run, { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id });
    run = step(data, run, { type: "combat", action: { type: "mulligan", instanceIds: [] } });
    const m05 = run.combat!.heroes[0]!;
    m05.levelUpCounter = data.heroes["m05"]!.levelUp.threshold; // levels up at next check
    for (const hero of run.combat!.heroes) hero.statuses.push({ id: "burn", value: 999 });
    run = step(data, run, { type: "combat", action: { type: "endTurn" } });
    expect(run.status).toBe("lost");
    expect(run.heroLevelUps).toEqual({ m05: 1 });
    expect(summarizeRun(data, run)).toEqual({ heroIds: TEAM, floorReached: 1, won: false, heroLevelUps: { m05: 1 } });
  });
});

function step(data: GameData, run: RunState, action: Parameters<typeof applyRunAction>[2]): RunState {
  const result = applyRunAction(data, run, action);
  if (!result.ok) throw new Error(result.error);
  return result.run;
}
