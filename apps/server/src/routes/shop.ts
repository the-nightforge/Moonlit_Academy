import type { FastifyInstance } from "fastify";
import { buyShopItem } from "rules";
import { z } from "zod";
import type { AppContext } from "../context";

const buyBody = z.object({ heroId: z.string().max(64).optional() });

/** Moon star shop (`14` §11, `16` §4.1). */
export function registerShopRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { data, clock } = ctx;

  app.post<{ Params: { itemId: string } }>("/api/shop/:itemId/buy", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { heroId } = ctx.parseBody(buyBody, request.body ?? {});
    return ctx.mutateProfile(accountId, request, (profile) => buyShopItem(data, profile, request.params.itemId, clock(), heroId));
  });
}
