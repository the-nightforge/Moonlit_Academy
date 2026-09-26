import { loadGameData } from "data";
import { createCombat, createProfile, starterDeck } from "rules";
import type { CombatEvent, CombatState, GameData, MasteryGain, Profile, RunState, SavedDeck } from "rules";
import type { RunTicket } from "./run-session";

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
  /** Local copy of the server profile (`16` §2); a blank one while offline. */
  profile: Profile;
  /** Profile revision the copy came from (`If-Match`). */
  rev: number;
  /** Signed in and reachable; offline allows single combats only. */
  online: boolean;
  /** Server ticket of the run in progress. */
  ticket: RunTicket | null;
  editingDeck: SavedDeck | null;
  lastGains: MasteryGain[] | null;
  /** The finished run's result was accepted by the server. */
  runSubmitted: boolean;
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
    profile: createProfile(data), rev: 0, online: false, ticket: null, editingDeck: null, lastGains: null,
    runSubmitted: false,
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

export function cycleEncounter(direction = 1): string {
  const ids = Object.keys(session.data.encounters);
  const index = ids.indexOf(session.encounterId);
  const next = ids[(index + direction + ids.length) % ids.length]!;
  restartSession(session.seed, next);
  return next;
}
