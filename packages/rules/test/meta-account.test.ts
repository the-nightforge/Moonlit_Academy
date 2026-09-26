import { describe, expect, it } from "vitest";
import type { Action, CombatState, GameData, Profile, RunAction, RunSetup, RunState } from "../src/index";
import {
  applyRunAction, createProfile, createRun, getValidTargets, isCardPlayable, mergeImportedProfile,
  parseProfile, reachableNodeIds, replayRun, starterDeck, unlockCard, validateDeck,
} from "../src/index";
import { testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

/** Simplest legal policy: first reachable node, first playable card, first augment. */
function botAction(data: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return { type: "chooseNode", nodeId: reachableNodeIds(run)[0]! };
    case "combat":
      return { type: "combat", action: combatAction(data, run.combat!) };
    case "reward":
      return { type: "pickAugment", augmentId: run.pendingReward!.augmentChoices[0] ?? null };
    case "rest":
      return { type: "rest", choice: "heal" };
    case "treasure":
      return { type: "continue" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}

function combatAction(data: GameData, state: CombatState): Action {
  if (state.status === "mulligan") return { type: "mulligan", instanceIds: [] };
  if (state.status === "choosing") return { type: "chooseCard", instanceId: state.pendingChoice!.options[0]! };
  for (const instanceId of state.hand) {
    if (!isCardPlayable(data, state, instanceId)) continue;
    const card = data.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targetId = getValidTargets(data, state, instanceId)[0];
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

function playRun(data: GameData, setup: RunSetup): { run: RunState; actions: RunAction[] } {
  let run = createRun(data, setup).run;
  const actions: RunAction[] = [];
  for (let step = 0; step < 20000 && run.status !== "won" && run.status !== "lost"; step++) {
    const action = botAction(data, run);
    const result = applyRunAction(data, run, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    run = result.run;
  }
  return { run, actions };
}

function v1Profile(data: GameData) {
  const lockedM05 = data.heroes["m05"]!.lockedCardIds;
  return {
    version: 1,
    heroes: {
      m05: { xp: data.metaConfig.masteryLevels[1]!, unlockedCardIds: [lockedM05[0]!, lockedM05[1]!] },
      f03: { xp: 500, unlockedCardIds: [data.heroes["f03"]!.lockedCardIds[0]!] },
    },
    decks: [{ id: "d1", name: "Cũ", heroIds: ["m05", "f03", "f02"], cardIds: [] }],
  };
}

describe("accounts: profile v2, ownership, import, replay", () => {
  it("T175: parseProfile migrates v1 to v2 for starter heroes only; v2 falls back field by field", () => {
    const data = testData();
    const raw = v1Profile(data);
    const { profile, reset } = parseProfile(data, raw);
    expect(reset).toBe(false);
    expect(profile.version).toBe(2);
    expect(Object.keys(profile.heroes).sort()).toEqual([...data.economyConfig.starterHeroIds].sort());
    expect(profile.heroes["m05"]).toEqual({
      xp: raw.heroes.m05.xp, unlockedCardIds: raw.heroes.m05.unlockedCardIds,
      constellation: 0, bonusUnlocks: 0, levelUpForm: "base",
    });
    expect(profile.heroes["f03"]).toBeUndefined();
    expect(profile.decks).toEqual(raw.decks);
    expect(profile.currencies).toEqual({ moonJade: 0, moonStar: 0, darkIron: 0, moonDust: 0 });

    const v2 = parseProfile(data, {
      version: 2,
      heroes: { f03: { xp: 10, constellation: 9, levelUpForm: "alt" } },
      currencies: { moonJade: 320, moonStar: "x" },
      flags: { localImportDone: true },
      stats: { runsWon: 3, bad: -2 },
    });
    expect(v2.reset).toBe(false);
    expect(v2.profile.heroes["f03"]).toEqual({ xp: 10, unlockedCardIds: [], constellation: 6, bonusUnlocks: 0, levelUpForm: "alt" });
    expect(v2.profile.heroes["m05"]).toBeDefined(); // starter heroes are always owned
    expect(v2.profile.currencies).toEqual({ moonJade: 320, moonStar: 0, darkIron: 0, moonDust: 0 });
    expect(v2.profile.flags).toEqual({ starterGiftClaimed: false, localImportDone: true });
    expect(v2.profile.stats).toEqual({ runsWon: 3, bad: 0 });
    expect(v2.profile.decks).toEqual([]);
  });

  it("T176: mergeImportedProfile takes max XP, unions unlocks within mastery, appends decks, runs once", () => {
    const data = testData();
    const levels = data.metaConfig.masteryLevels;
    const locked = data.heroes["m05"]!.lockedCardIds;
    const server = createProfile(data);
    server.heroes["m05"] = { ...server.heroes["m05"]!, xp: levels[0]!, unlockedCardIds: [locked[2]!] };
    server.decks = [{ id: "d4", name: "Server", heroIds: TEAM, cardIds: [] }];
    const local = parseProfile(data, v1Profile(data)).profile;
    const snapshot = JSON.stringify(server);

    const merged = mergeImportedProfile(data, server, local);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(JSON.stringify(server)).toBe(snapshot);
    const m05 = merged.profile.heroes["m05"]!;
    expect(m05.xp).toBe(levels[1]);
    // Mastery level 2 allows two unlocks; the server's own unlock is kept first.
    expect(m05.unlockedCardIds).toEqual([locked[2]!, locked[0]!]);
    expect(merged.profile.heroes["f03"]).toBeUndefined();
    expect(merged.profile.decks.map((deck) => deck.id)).toEqual(["d4", "d5"]);
    expect(merged.profile.decks[1]!.name).toBe("Cũ");
    expect(merged.profile.flags.localImportDone).toBe(true);
    expect(mergeImportedProfile(data, merged.profile, local)).toEqual({ ok: false, error: "already imported" });
  });

  it("T177: replayRun rebuilds the same run; a rejected action or one after the end is reported", () => {
    const data = testData();
    const setup: RunSetup = { heroIds: TEAM, seed: 7, deckCardIds: starterDeck(data, TEAM) };
    const { run, actions } = playRun(data, setup);
    expect(["won", "lost"]).toContain(run.status);

    // reachableNodeIds hands out a copy: sorting it must not change the map.
    const fresh = createRun(data, setup).run;
    const first = applyRunAction(data, fresh, actions[0]!);
    if (!first.ok) throw new Error(first.error);
    const before = JSON.stringify(first.run.map);
    reachableNodeIds(first.run).reverse();
    expect(JSON.stringify(first.run.map)).toBe(before);

    const replay = replayRun(data, setup, actions);
    expect(replay).toEqual({ ok: true, run });
    expect(replayRun(data, setup, actions)).toEqual(replay);

    const broken = [...actions];
    broken[1] = { type: "chooseNode", nodeId: "nowhere" };
    const rejected = replayRun(data, setup, broken);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.step).toBe(1);

    expect(replayRun(data, setup, [...actions, { type: "continue" }])).toEqual({
      ok: false, step: actions.length, reason: "actions after end",
    });
  });

  it("T181: heroes not owned cannot be unlocked or put in a valid deck", () => {
    const data = testData();
    const profile: Profile = createProfile(data);
    const team: [string, string, string] = ["m05", "f04", "f03"];
    expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([
      { code: "unownedHero", heroId: "f03" },
    ]);
    const card = data.heroes["f03"]!.lockedCardIds[0]!;
    expect(unlockCard(data, profile, "f03", card)).toEqual({ ok: false, error: "hero not owned" });
  });
});
