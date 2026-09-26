import { applyRunAction, createRun, replayRun } from "rules";
import type { Loadout, MasteryGain, RunAction, RunActionResult, RunSetup } from "rules";
import { mutate, type ProfileReply } from "./account";
import { ApiError, api } from "./api";
import { session, type Team } from "./session";

const CURRENT_RUN_KEY = "vong-nguyet.run";
const CLOSED_TICKET_ERRORS = new Set(["replay failed", "run closed", "ticket expired", "unknown run"]);

/** A run the server issued, with every action applied so far (`14` §4). */
export interface RunTicket {
  runId: string;
  setup: RunSetup;
  /** Constellations snapshotted by the server; absent on tickets saved before phase 4d. */
  loadout?: Loadout;
  actions: RunAction[];
}

function persist(ticket: RunTicket | null): void {
  try {
    if (ticket === null) localStorage.removeItem(CURRENT_RUN_KEY);
    else localStorage.setItem(CURRENT_RUN_KEY, JSON.stringify(ticket));
  } catch {
    // The run still works; it just cannot be resumed after a reload.
  }
}

/** Asks the server for a ticket, then builds the run locally from its setup. */
export async function startServerRun(deck: { id: string; heroIds: Team }): Promise<void> {
  const body = deck.id.startsWith("starter:") ? { deckId: "starter", heroIds: deck.heroIds } : { deckId: deck.id };
  const { runId, setup, loadout } = await api<{ runId: string; setup: RunSetup; loadout: Loadout }>("POST", "/runs", { body });
  const ticket: RunTicket = { runId, setup, loadout, actions: [] };
  session.ticket = ticket;
  persist(ticket);
  session.heroIds = setup.heroIds;
  session.seed = setup.seed;
  session.deckCardIds = setup.deckCardIds;
  session.lastGains = null;
  session.runSubmitted = false;
  session.run = createRun(session.data, setup, loadout).run;
}

/** Applies an action to the current run and records it for the server replay. */
export function applyRecordedRunAction(action: RunAction): RunActionResult {
  const result = applyRunAction(session.data, session.run!, action);
  if (result.ok && session.ticket) {
    session.ticket.actions.push(action);
    persist(session.ticket);
  }
  return result;
}

/** Sends the finished run; the server replays it and returns the new profile and XP gains. */
export async function submitRun(): Promise<MasteryGain[]> {
  const ticket = session.ticket!;
  const send = () => mutate<ProfileReply & { gains: MasteryGain[] }>("POST", `/runs/${ticket.runId}/finish`, { actions: ticket.actions });
  let reply: ProfileReply & { gains: MasteryGain[] };
  try {
    try {
      reply = await send();
    } catch (error) {
      // The profile changed elsewhere: mutate() refreshed it, the ticket is still open.
      if (!(error instanceof ApiError && error.code === "stale profile")) throw error;
      reply = await send();
    }
  } catch (error) {
    // The server closed this ticket for good; keeping it would only fail again.
    if (error instanceof ApiError && CLOSED_TICKET_ERRORS.has(error.code)) {
      session.ticket = null;
      persist(null);
    }
    throw error;
  }
  session.ticket = null;
  session.runSubmitted = true;
  session.lastGains = reply.gains;
  persist(null);
  return reply.gains;
}

/** A run left unfinished on this device, if any. */
export function savedRun(): RunTicket | null {
  try {
    const raw = localStorage.getItem(CURRENT_RUN_KEY);
    return raw ? (JSON.parse(raw) as RunTicket) : null;
  } catch {
    return null;
  }
}

/** Rebuilds a saved run locally; false if its actions no longer replay (data changed). */
export function resumeRun(ticket: RunTicket): boolean {
  const replay = replayRun(session.data, ticket.setup, ticket.actions, ticket.loadout);
  if (!replay.ok) return false;
  session.ticket = ticket;
  session.heroIds = ticket.setup.heroIds;
  session.seed = ticket.setup.seed;
  session.deckCardIds = ticket.setup.deckCardIds;
  session.lastGains = null;
  session.runSubmitted = false;
  session.run = replay.run;
  if (replay.run.combat) session.state = replay.run.combat;
  return true;
}

export async function abandonSavedRun(ticket: RunTicket): Promise<void> {
  persist(null);
  session.ticket = null;
  try {
    await api("POST", `/runs/${ticket.runId}/abandon`);
  } catch {
    // Already closed or expired on the server; nothing to undo.
  }
}

