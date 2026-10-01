import type { FastifyInstance } from "fastify";
import type { Action, Loadout, StorySetup } from "rules";
import { applyStoryResult, buildLoadout, replayStoryCombat, storyStageUnlocked, unlockedStageIds, validateDeck } from "rules";
import { z } from "zod";
import { HttpError, type AppContext } from "../context";
import { combatActionSchema, resolveDeck, startBody, TICKET_TTL_MS } from "./runs";

export const MAX_STORY_ACTIONS = 2000;
const finishBody = z.object({ actions: z.array(combatActionSchema).max(MAX_STORY_ACTIONS) });

interface StoryTicketRow {
  id: string;
  account_id: number;
  stage_id: string;
  status: "open" | "finished" | "abandoned" | "rejected";
  setup_json: string;
  loadout_json: string;
  data_version: string;
  created_at: number;
}

/** Story mode: progress, tickets and verified results (`18` §4.3, `16` §9). */
export function registerStoryRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock, random } = ctx;
  const abandonOpen = db.prepare("UPDATE story_tickets SET status = 'abandoned', finished_at = ? WHERE account_id = ? AND status = 'open'");
  const insert = db.prepare(
    "INSERT INTO story_tickets (id, account_id, stage_id, status, setup_json, loadout_json, data_version, created_at) VALUES (?, ?, ?, 'open', ?, ?, ?, ?)",
  );
  const find = db.prepare<[string, number], StoryTicketRow>("SELECT * FROM story_tickets WHERE id = ? AND account_id = ?");
  const close = db.prepare("UPDATE story_tickets SET status = ?, finished_at = ?, result_json = ? WHERE id = ?");

  async function openTicket(id: string, accountId: number): Promise<StoryTicketRow> {
    const row = await find.get(id, accountId);
    if (!row) throw new HttpError(404, "unknown ticket");
    if (row.status !== "open") throw new HttpError(409, "ticket closed");
    if (clock() - row.created_at > TICKET_TTL_MS) throw new HttpError(410, "ticket expired");
    if (row.data_version !== ctx.dataVersion) throw new HttpError(409, "outdated client", { dataVersion: ctx.dataVersion });
    return row;
  }

  app.get("/api/story", async (request) => {
    const { profile } = await ctx.readProfile(await ctx.requireAccount(request));
    return { cleared: profile.story.cleared, unlocked: unlockedStageIds(data, profile) };
  });

  app.post<{ Params: { stageId: string } }>("/api/story/:stageId/tickets", async (request, reply) => {
    const accountId = await ctx.requireAccount(request);
    const { stageId } = request.params;
    if (!data.storyStages[stageId]) throw new HttpError(404, "unknown stage");
    const body = ctx.parseBody(startBody, request.body);
    const { profile } = await ctx.readProfile(accountId);
    if (!storyStageUnlocked(data, profile, stageId)) throw new HttpError(403, "stage locked");
    const deck = resolveDeck(data, profile, body);
    const errors = validateDeck(data, profile, deck);
    if (errors.length > 0) throw new HttpError(400, "invalid deck", { errors });
    const built = buildLoadout(data, profile, deck);
    if (!built.ok) throw new HttpError(400, built.error);
    const setup: StorySetup = { stageId, seed: random(4).readUInt32BE(0), heroIds: deck.heroIds, deckCardIds: [...deck.cardIds] };
    const ticketId = random(16).toString("base64url");
    await db.transaction(async () => {
      const now = clock();
      await abandonOpen.run(now, accountId);
      await insert.run(ticketId, accountId, stageId, JSON.stringify(setup), JSON.stringify(built.loadout), ctx.dataVersion, now);
    });
    return reply.code(201).send({ ticketId, setup, loadout: built.loadout });
  });

  app.post<{ Params: { id: string } }>("/api/story/tickets/:id/finish", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const row = await openTicket(request.params.id, accountId);
    const { actions } = ctx.parseBody(finishBody, request.body);
    const setup = JSON.parse(row.setup_json) as StorySetup;
    const loadout = JSON.parse(row.loadout_json) as Loadout;
    const replay = replayStoryCombat(data, setup, actions as Action[], loadout);
    if (!replay.ok) {
      await close.run("rejected", clock(), JSON.stringify({ step: replay.step, reason: replay.reason }), row.id);
      throw new HttpError(422, "replay failed", { step: replay.step, reason: replay.reason });
    }
    if (replay.state.status !== "won" && replay.state.status !== "lost") throw new HttpError(422, "combat not finished");
    const won = replay.state.status === "won";
    return db.transaction(async () => {
      const outcome = await ctx.mutateProfile(accountId, request, (profile) => applyStoryResult(data, profile, setup, won));
      await close.run("finished", clock(), JSON.stringify({ won }), row.id);
      return { ...outcome, won };
    });
  });

  app.post<{ Params: { id: string } }>("/api/story/tickets/:id/abandon", async (request, reply) => {
    const accountId = await ctx.requireAccount(request);
    const row = await find.get(request.params.id, accountId);
    if (!row) throw new HttpError(404, "unknown ticket");
    if (row.status !== "open") throw new HttpError(409, "ticket closed");
    await close.run("abandoned", clock(), null, row.id);
    return reply.code(204).send();
  });
}
