import { loadGameData } from "data";
import { createCombat, createProfile, starterDeck } from "rules";
import type { CombatEvent, CombatState, GameData, Loadout, MasteryGain, Profile, RunRewards, RunState, SavedDeck, StoryRewards } from "rules";
import type { NetMatch } from "./net/match";
import type { MatchRegistry } from "./net/match-registry";
import type { NetSocket } from "./net/socket";
import type { RunTicket } from "./run-session";
import { abandonStory, type StoryTicket } from "./story-session";

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
  /** Server ticket of the story stage combat in progress (`18` §4.4). */
  story: StoryTicket | null;
  /** Stage whose before-dialogue / deck select is in progress (story mode). */
  pendingStageId: string | null;
  /** Verified result of the last story stage (drives the rewards toast). */
  lastStory: { won: boolean; rewards: StoryRewards } | null;
  editingDeck: SavedDeck | null;
  lastGains: MasteryGain[] | null;
  /** Moon jade and achievements from the last accepted run. */
  lastRewards: RunRewards | null;
  /** Messages for the next menu screen (starter gift, achievements). */
  notices: string[];
  /** The finished run's result was accepted by the server. */
  runSubmitted: boolean;
  /** Tinh Hồn and gear of the single combat's team (built from the profile). */
  loadout: Loadout | undefined;
  /** The realtime socket (`16` §8); created on entering the arena. */
  net: NetSocket | null;
  /** Retained network matches surviving scene changes (`16` §8.4); account-lifetime, disposed on logout. */
  registry: MatchRegistry | null;
  /** The live network match the combat scene is bound to, if any. */
  match: NetMatch | null;
  /** Code of the private room the player is hosting/waiting in (arena). */
  roomCode: string | null;
  /** Mutes incoming match emotes (`pvp-config.emotes`). */
  emotesMuted: boolean;
}

export function newCombatSession(
  seed = 42,
  encounterId = "enc_01",
  heroIds: Team = DEFAULT_TEAM,
  deckCardIds?: string[],
  loadout?: Loadout,
): CombatSession {
  const data = loadGameData();
  const deck = deckCardIds ?? starterDeck(data, heroIds);
  const { state, events } = createCombat(data, { heroIds, encounterId, seed, deckCardIds: deck }, loadout);
  return {
    data, state, events, seed, encounterId, heroIds, deckCardIds: deck, run: null,
    profile: createProfile(data), rev: 0, online: false, ticket: null, story: null, pendingStageId: null,
    lastStory: null, editingDeck: null, lastGains: null,
    lastRewards: null, notices: [], runSubmitted: false, loadout,
    net: null, registry: null, match: null, roomCode: null, emotesMuted: false,
  };
}

export const session: CombatSession = newCombatSession();

/**
 * A `welcome` carried no `activeMatch` for this live match: the room is gone
 * (settled and cleaned up, or the server restarted). Aborts playback, drops the
 * match, refreshes the settled profile, and routes to the right lobby (`16` §8.4).
 */
export function recoverMatchGone(
  match: NetMatch,
  deps: {
    abortPlayback(): void;
    startScene(key: "arena" | "coop-lobby"): void;
    refreshProfile(): Promise<unknown>;
  },
): void {
  deps.abortPlayback();
  session.match = null;
  session.registry?.release(match.matchId);
  session.notices.push("Trận đã kết thúc.");
  void deps.refreshProfile().catch(() => {});
  deps.startScene(match.mode.startsWith("coop") ? "coop-lobby" : "arena");
}

export function restartSession(
  seed = session.seed,
  encounterId = session.encounterId,
  heroIds: Team = session.heroIds,
  deckCardIds = session.deckCardIds,
  loadout = session.loadout,
): void {
  const fresh = newCombatSession(seed, encounterId, heroIds, deckCardIds, loadout);
  session.loadout = loadout;
  session.seed = fresh.seed;
  session.encounterId = fresh.encounterId;
  session.heroIds = fresh.heroIds;
  session.deckCardIds = fresh.deckCardIds;
  session.state = fresh.state;
  session.run = null;
  // A rebuilt single combat drops any story ticket; close it on the server (fire-and-forget).
  void abandonStory();
  session.events.push(...fresh.events);
}

export function cycleEncounter(direction = 1): string {
  const ids = Object.keys(session.data.encounters);
  const index = ids.indexOf(session.encounterId);
  const next = ids[(index + direction + ids.length) % ids.length]!;
  restartSession(session.seed, next);
  return next;
}
