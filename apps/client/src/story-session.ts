import { createStoryCombat } from "rules";
import type { Action, Loadout, StoryRewards, StorySetup } from "rules";
import { mutate, type ProfileReply } from "./account";
import { ApiError, api, auth } from "./api";
import { assertCurrentRequest, type RequestGuard } from "./request-context";
import { session, type Team } from "./session";

/**
 * A story stage ticket the server issued, with every action applied so far
 * (`18` §4.4). Not persisted: reloading the page forfeits the ticket.
 */
export interface StoryTicket {
  ticketId: string;
  setup: StorySetup;
  loadout: Loadout;
  /** The deck the ticket was bought with — needed to retry after a loss. */
  deck: { id: string; heroIds: Team };
  actions: Action[];
}

/** Asks the server for a stage ticket, then builds the combat locally from its setup (`18` §4.4). */
export async function startStoryTicket(stageId: string, deck: { id: string; heroIds: Team }, options?: { guard?: RequestGuard }): Promise<void> {
  const generation = auth.generation;
  const body = deck.id.startsWith("starter:") ? { deckId: "starter", heroIds: deck.heroIds } : { deckId: deck.id };
  const reply = await api<{ ticketId: string; setup: StorySetup; loadout: Loadout }>("POST", `/story/${stageId}/tickets`, { body });
  // The ticket may exist server-side; a stale caller drops it here (server expiry handles the rest).
  assertCurrentRequest(generation, options?.guard);
  session.story = { ticketId: reply.ticketId, setup: reply.setup, loadout: reply.loadout, deck, actions: [] };
  session.run = null;
  session.heroIds = reply.setup.heroIds;
  session.deckCardIds = reply.setup.deckCardIds;
  session.seed = reply.setup.seed;
  session.encounterId = session.data.storyStages[stageId]?.encounterId ?? session.encounterId;
  const { state, events } = createStoryCombat(session.data, reply.setup, reply.loadout);
  session.state = state;
  session.events.push(...events);
}

export function recordStoryAction(action: Action): void {
  session.story?.actions.push(action);
}

/** Sends the finished combat; the server replays it and returns the profile + rewards. */
export async function submitStory(): Promise<{ won: boolean; rewards: StoryRewards }> {
  const ticket = session.story!;
  type FinishReply = ProfileReply & { won: boolean; rewards: StoryRewards };
  const send = () => mutate<FinishReply>("POST", `/story/tickets/${ticket.ticketId}/finish`, { actions: ticket.actions });
  let reply: FinishReply;
  try {
    try {
      reply = await send();
    } catch (error) {
      // The profile changed elsewhere: mutate() refreshed it, the ticket is still open.
      if (!(error instanceof ApiError && error.code === "stale profile")) throw error;
      reply = await send();
    }
  } catch (error) {
    // No retry UI exists past this point: a failed submit would leak an open ticket.
    await abandonStory();
    throw error;
  }
  session.story = null;
  session.lastStory = { won: reply.won, rewards: reply.rewards };
  return session.lastStory;
}

/** Drops the local ticket and closes it on the server; offline/no-token just drops it. */
export async function abandonStory(): Promise<void> {
  const ticket = session.story;
  session.story = null;
  if (ticket === null || !session.online || !auth.token) return;
  try {
    await api("POST", `/story/tickets/${ticket.ticketId}/abandon`);
  } catch {
    // Already closed or expired on the server.
  }
}
