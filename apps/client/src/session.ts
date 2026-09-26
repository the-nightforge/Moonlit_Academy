import { loadGameData } from "data";
import { createCombat, createRun, starterDeck } from "rules";
import type { CombatEvent, CombatState, GameData, MasteryGain, Profile, RunState, SavedDeck } from "rules";
import { loadProfile } from "./profile-store";

export type Team = [string, string, string];

export const DEFAULT_TEAM: Team = ["m05", "f04", "m06"];

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
  seed: number;
  encounterId: string;
  heroIds: Team;
  deckCardIds: string[];
  run: RunState | null;
  profile: Profile;
  editingDeck: SavedDeck | null;
  lastGains: MasteryGain[] | null;
  runRewarded: boolean;
}

export function newCombatSession(
  seed = 42,
  encounterId = "enc_01",
  heroIds: Team = DEFAULT_TEAM,
  deckCardIds?: string[],
): CombatSession {
  const data = loadGameData();
  const deck = deckCardIds ?? starterDeck(data, heroIds);
  const { state, events } = createCombat(data, { heroIds, encounterId, seed, deckCardIds: deck });
  return {
    data, state, events, seed, encounterId, heroIds, deckCardIds: deck, run: null,
    profile: loadProfile(data), editingDeck: null, lastGains: null, runRewarded: false,
  };
}

export const session: CombatSession = newCombatSession();

export function restartSession(
  seed = session.seed,
  encounterId = session.encounterId,
  heroIds: Team = session.heroIds,
  deckCardIds = session.deckCardIds,
): void {
  const fresh = newCombatSession(seed, encounterId, heroIds, deckCardIds);
  session.seed = fresh.seed;
  session.encounterId = fresh.encounterId;
  session.heroIds = fresh.heroIds;
  session.deckCardIds = fresh.deckCardIds;
  session.state = fresh.state;
  session.run = null;
  session.events.push(...fresh.events);
}

/** Starts a roguelike run with the chosen deck; combat state comes from the run. */
export function startRun(heroIds: Team, deckCardIds: string[], seed = session.seed): void {
  session.heroIds = heroIds;
  session.seed = seed;
  session.deckCardIds = deckCardIds;
  session.runRewarded = false;
  session.lastGains = null;
  session.run = createRun(session.data, { heroIds, seed, deckCardIds }).run;
}

export function cycleEncounter(direction = 1): string {
  const ids = Object.keys(session.data.encounters);
  const index = ids.indexOf(session.encounterId);
  const next = ids[(index + direction + ids.length) % ids.length]!;
  restartSession(session.seed, next);
  return next;
}
