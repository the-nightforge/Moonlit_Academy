import type { FastifyInstance } from "fastify";
import type { RunAction, RunSetup } from "rules";
import { applyRunResult, applyRunRewards, replayRun, starterDeck, summarizeRun, validateDeck } from "rules";
import { z } from "zod";
import { HttpError, type AppContext } from "../context";

/** A ticket accepts its result for this long after it is issued (`14` §4.1). */
export const TICKET_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_RUN_ACTIONS = 20000;

const id = z.string().max(64);

const combatActionSchema = z.union([
  z.object({ type: z.literal("playCard"), instanceId: id, targetId: id.optional() }),
  z.object({ type: z.literal("mulligan"), instanceIds: z.array(id).max(16) }),
  z.object({ type: z.literal("chooseCard"), instanceId: id }),
  z.object({ type: z.literal("endTurn") }),
]);

/** Shape of a `RunAction`; whether it is legal is decided by `replayRun`. */
export const runActionSchema: z.ZodType<RunAction> = z.union([
  z.object({ type: z.literal("chooseNode"), nodeId: id }),
  z.object({ type: z.literal("combat"), action: combatActionSchema }),
  z.object({ type: z.literal("pickAugment"), augmentId: id.nullable() }),
  z.object({ type: z.literal("rest"), choice: z.literal("heal") }),
  z.object({ type: z.literal("rest"), choice: z.literal("removeCard"), cardId: id }),
  z.object({ type: z.literal("continue") }),
]);

const startBody = z.union([
  z.object({ deckId: z.literal("starter"), heroIds: z.tuple([id, id, id]) }),
  z.object({ deckId: id }),
]);
const finishBody = z.object({ actions: z.array(runActionSchema).max(MAX_RUN_ACTIONS) });

interface RunRow {
  id: string;
  account_id: number;
  status: "open" | "finished" | "abandoned" | "rejected";
  setup_json: string;
  data_version: string;
  created_at: number;
  starter_deck: number;
}

/** Run tickets and verified results (`14` §4, `16` §4). */
export function registerRunRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock, random } = ctx;
  const abandonOpen = db.prepare("UPDATE runs SET status = 'abandoned', finished_at = ? WHERE account_id = ? AND status = 'open'");
  const insertRun = db.prepare(
    "INSERT INTO runs (id, account_id, status, setup_json, data_version, created_at, starter_deck) VALUES (?, ?, 'open', ?, ?, ?, ?)",
  );
  const findRun = db.prepare<[string, number], RunRow>("SELECT * FROM runs WHERE id = ? AND account_id = ?");
  const closeRun = db.prepare("UPDATE runs SET status = ?, finished_at = ?, result_json = ? WHERE id = ?");

  /** The account's open ticket `runId`, or the reason it cannot take a result. */
  function openRun(runId: string, accountId: number): RunRow {
    const run = findRun.get(runId, accountId);
    if (!run) throw new HttpError(404, "unknown run");
    if (run.status !== "open") throw new HttpError(409, "run closed");
    if (clock() - run.created_at > TICKET_TTL_MS) throw new HttpError(410, "ticket expired");
    if (run.data_version !== ctx.dataVersion) throw new HttpError(409, "outdated client", { dataVersion: ctx.dataVersion });
    return run;
  }

  app.post("/api/runs", async (request, reply) => {
    const accountId = ctx.requireAccount(request);
    const body = ctx.parseBody(startBody, request.body);
    const { profile } = ctx.readProfile(accountId);
    let deck: { heroIds: [string, string, string]; cardIds: string[] };
    if ("heroIds" in body) {
      deck = { heroIds: body.heroIds, cardIds: starterDeck(data, body.heroIds) };
    } else {
      const saved = profile.decks.find((candidate) => candidate.id === body.deckId);
      if (!saved) throw new HttpError(404, "unknown deck");
      deck = saved;
    }
    const errors = validateDeck(data, profile, deck);
    if (errors.length > 0) throw new HttpError(400, "invalid deck", { errors });

    const setup: RunSetup = { heroIds: deck.heroIds, seed: random(4).readUInt32BE(0), deckCardIds: [...deck.cardIds] };
    const runId = random(16).toString("base64url");
    db.transaction(() => {
      const now = clock();
      abandonOpen.run(now, accountId);
      insertRun.run(runId, accountId, JSON.stringify(setup), ctx.dataVersion, now, "heroIds" in body ? 1 : 0);
    })();
    return reply.code(201).send({ runId, setup });
  });

  app.post<{ Params: { id: string } }>("/api/runs/:id/finish", async (request) => {
    const accountId = ctx.requireAccount(request);
    const run = openRun(request.params.id, accountId);
    const { actions } = ctx.parseBody(finishBody, request.body);
    const setup = JSON.parse(run.setup_json) as RunSetup;

    const replay = replayRun(data, setup, actions);
    if (!replay.ok) {
      closeRun.run("rejected", clock(), JSON.stringify({ step: replay.step, reason: replay.reason }), run.id);
      throw new HttpError(422, "replay failed", { step: replay.step, reason: replay.reason });
    }
    if (replay.run.status !== "won" && replay.run.status !== "lost") throw new HttpError(422, "run not finished");

    const result = summarizeRun(data, replay.run);
    return db.transaction(() => {
      const outcome = ctx.mutateProfile(accountId, request, (profile) => {
        const mastery = applyRunResult(data, profile, result);
        const paid = applyRunRewards(data, mastery.profile, result, { now: clock(), starterDeck: run.starter_deck === 1 });
        return { ok: true, profile: paid.profile, gains: mastery.gains, rewards: paid.rewards };
      });
      closeRun.run("finished", clock(), JSON.stringify(result), run.id);
      return outcome;
    })();
  });

  app.post<{ Params: { id: string } }>("/api/runs/:id/abandon", async (request, reply) => {
    const accountId = ctx.requireAccount(request);
    const run = findRun.get(request.params.id, accountId);
    if (!run) throw new HttpError(404, "unknown run");
    if (run.status !== "open") throw new HttpError(409, "run closed");
    closeRun.run("abandoned", clock(), null, run.id);
    return reply.code(204).send();
  });
}
