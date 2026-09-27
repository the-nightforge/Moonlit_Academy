import type { FastifyInstance } from "fastify";
import { dayKey } from "rules";
import type { AppContext } from "../context";

/** Co-op routes (`16` §8.9): the account's per-day raid counters. */
export function registerCoopRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { data, clock } = ctx;

  app.get("/api/coop/me", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const { profile } = await ctx.readProfile(accountId);
    const today = dayKey(data, clock());
    const coop = profile.coop.dayKey === today ? profile.coop : { clears: 0, rewarded: 0 };
    return {
      clearsToday: coop.clears,
      rewardClaimsLeft: Math.max(0, data.coopConfig.rewardedMatchesPerDay - coop.rewarded),
    };
  });
}
