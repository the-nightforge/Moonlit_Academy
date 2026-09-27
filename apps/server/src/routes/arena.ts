import type { FastifyInstance } from "fastify";
import { buyHonorItem, dayKey, HONOR_PER_DAY, tierFor } from "rules";
import { z } from "zod";
import type { AppContext } from "../context";

const HISTORY_PAGE_SIZE = 20;
const LEADERBOARD_SIZE = 50;
/** Leaderboard needs at least this many ranked games (`17` §5.7). */
const LEADERBOARD_MIN_GAMES = 5;

const historyQuery = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});
const honorBuyBody = z.object({
  heroId: z.string().max(64).optional(),
  relicId: z.string().max(64).optional(),
});

interface LeaderboardRow {
  account_id: number;
  username: string;
  rating: number;
  ranked_games: number;
  wins: number;
  losses: number;
}

function entry(row: LeaderboardRow, data: AppContext["data"], rank: number | null) {
  return {
    rank,
    username: row.username,
    rating: row.rating,
    tier: tierFor(data, row.rating),
    wins: row.wins,
    losses: row.losses,
    rankedGames: row.ranked_games,
  };
}

/** Arena routes (`16` §8.8): rating summary, match history, leaderboard, honor shop. */
export function registerArenaRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock } = ctx;

  const history = db.prepare<[number, number, number], {
    match_id: string; mode: string; result: string | null; rating_before: number | null;
    rating_after: number | null; created_at: number; opponent: string | null;
  }>(
    `SELECT m.id AS match_id, m.mode, mine.result, mine.rating_before, mine.rating_after,
            m.created_at, opp_acc.username AS opponent
     FROM match_players mine
     JOIN matches m ON m.id = mine.match_id
     LEFT JOIN match_players opp ON opp.match_id = mine.match_id AND opp.slot <> mine.slot
     LEFT JOIN accounts opp_acc ON opp_acc.id = opp.account_id
     WHERE mine.account_id = ?
     ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
  );

  const leaderboardRows = db.prepare<[number], LeaderboardRow>(
    `SELECT a.id AS account_id, a.username,
            (p.profile_json::jsonb -> 'arena' ->> 'rating')::bigint AS rating,
            (p.profile_json::jsonb -> 'arena' ->> 'rankedGames')::bigint AS ranked_games,
            (p.profile_json::jsonb -> 'arena' ->> 'wins')::bigint AS wins,
            (p.profile_json::jsonb -> 'arena' ->> 'losses')::bigint AS losses
     FROM profiles p JOIN accounts a ON a.id = p.account_id
     WHERE (p.profile_json::jsonb -> 'arena' ->> 'rankedGames')::bigint >= ?
     ORDER BY rating DESC, a.id ASC LIMIT ${LEADERBOARD_SIZE}`,
  );
  const leaderboardRow = db.prepare<[number], LeaderboardRow>(
    `SELECT a.id AS account_id, a.username,
            (p.profile_json::jsonb -> 'arena' ->> 'rating')::bigint AS rating,
            (p.profile_json::jsonb -> 'arena' ->> 'rankedGames')::bigint AS ranked_games,
            (p.profile_json::jsonb -> 'arena' ->> 'wins')::bigint AS wins,
            (p.profile_json::jsonb -> 'arena' ->> 'losses')::bigint AS losses
     FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE a.id = ?`,
  );
  const rankOf = db.prepare<[number], { rank: number }>(
    `SELECT COUNT(*) + 1 AS rank FROM profiles
     WHERE (profile_json::jsonb -> 'arena' ->> 'rankedGames')::bigint >= ${LEADERBOARD_MIN_GAMES}
       AND (profile_json::jsonb -> 'arena' ->> 'rating')::bigint > ?`,
  );

  app.get("/api/arena/me", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const { profile } = await ctx.readProfile(accountId);
    const today = dayKey(data, clock());
    return {
      arena: profile.arena,
      tier: tierFor(data, profile.arena.rating),
      honorToday: {
        gained: profile.arena.honorDay.dayKey === today ? profile.arena.honorDay.gained : 0,
        cap: HONOR_PER_DAY,
      },
      honorShop: data.pvpConfig.honorShop ?? [],
      tiers: data.pvpConfig.tiers ?? [],
    };
  });

  app.get("/api/arena/history", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const { page } = ctx.parseBody(historyQuery, request.query);
    return {
      entries: (await history.all(accountId, HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)).map((row) => ({
        matchId: row.match_id,
        mode: row.mode,
        opponent: row.opponent, // null for a bot seat (practice)
        result: row.result,
        ratingDelta: row.rating_before === null || row.rating_after === null ? null : row.rating_after - row.rating_before,
        createdAt: row.created_at,
      })),
    };
  });

  app.get("/api/arena/leaderboard", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const rows = await leaderboardRows.all(LEADERBOARD_MIN_GAMES);
    const mine = await leaderboardRow.get(accountId);
    const me =
      mine === undefined
        ? null
        : entry(
            mine,
            data,
            mine.ranked_games >= LEADERBOARD_MIN_GAMES ? (await rankOf.get(mine.rating))!.rank : null,
          );
    return { entries: rows.map((row, index) => entry(row, data, index + 1)), me };
  });

  app.post<{ Params: { itemId: string } }>("/api/shop/honor/:itemId/buy", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const pick = ctx.parseBody(honorBuyBody, request.body ?? {});
    return ctx.mutateProfile(accountId, request, (profile) =>
      buyHonorItem(data, profile, request.params.itemId, clock(), pick),
    );
  });
}
