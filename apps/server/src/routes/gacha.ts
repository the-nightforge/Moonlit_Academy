import type { FastifyInstance } from "fastify";
import { pullMany } from "rules";
import { z } from "zod";
import type { AppContext } from "../context";

export const HISTORY_PAGE_SIZE = 20;

const pullBody = z.object({ count: z.union([z.literal(1), z.literal(10)]) });
const historyQuery = z.object({
  banner: z.string().max(64).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** Gacha routes (`16` §4.1): the server picks the seed and logs every pull. */
export function registerGachaRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock, random } = ctx;
  const insertPull = db.prepare(
    "INSERT INTO pulls (account_id, banner_id, count, seed, results_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const history = db.prepare<[number, string | null, string | null, number, number], {
    banner_id: string; results_json: string; created_at: number;
  }>(
    `SELECT banner_id, results_json, created_at FROM pulls
     WHERE account_id = ? AND (? IS NULL OR banner_id = ?)
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  );

  app.get("/api/gacha/banners", async (request) => {
    const { profile } = ctx.readProfile(ctx.requireAccount(request));
    return {
      banners: Object.values(data.banners),
      gacha: data.economyConfig.gacha,
      pullCost: data.economyConfig.pullCost,
      pity: profile.pity,
    };
  });

  app.post<{ Params: { bannerId: string } }>("/api/gacha/:bannerId/pull", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { count } = ctx.parseBody(pullBody, request.body);
    const seed = random(4).readUInt32BE(0);
    const { bannerId } = request.params;
    // The profile change and its log entry commit together (T190).
    return db.transaction(() => {
      const outcome = ctx.mutateProfile(accountId, request, (profile) => pullMany(data, profile, bannerId, count, seed, clock()));
      insertPull.run(accountId, bannerId, count, seed, JSON.stringify(outcome.results), clock());
      return outcome;
    })();
  });

  app.get("/api/gacha/history", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { banner, page } = ctx.parseBody(historyQuery, request.query);
    const bannerId = banner ?? null;
    const rows = history.all(accountId, bannerId, bannerId, HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
    return {
      entries: rows.map((row) => ({ bannerId: row.banner_id, results: JSON.parse(row.results_json), createdAt: row.created_at })),
    };
  });
}
