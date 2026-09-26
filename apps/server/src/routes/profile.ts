import type { FastifyInstance } from "fastify";
import { deleteDeck, mergeImportedProfile, parseProfile, saveDeck, unlockCard } from "rules";
import { z } from "zod";
import { HttpError, type AppContext } from "../context";

const unlockBody = z.object({ heroId: z.string(), cardId: z.string() });
const deckBody = z.object({
  draft: z.object({
    id: z.string().max(16),
    name: z.string().max(64),
    heroIds: z.tuple([z.string(), z.string(), z.string()]),
    cardIds: z.array(z.string()).max(64),
  }),
});
const importBody = z.object({ local: z.unknown() });

/** Profile routes (`16` §4): each change calls one pure rule from `rules/src/meta/`. */
export function registerProfileRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { data } = ctx;

  app.get("/api/profile", async (request) => ctx.readProfile(ctx.requireAccount(request)));

  app.post("/api/profile/unlock", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { heroId, cardId } = ctx.parseBody(unlockBody, request.body);
    return ctx.mutateProfile(accountId, request, (profile) => unlockCard(data, profile, heroId, cardId));
  });

  app.put("/api/profile/decks", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { draft } = ctx.parseBody(deckBody, request.body);
    return ctx.mutateProfile(accountId, request, (profile) => saveDeck(data, profile, draft));
  });

  app.delete<{ Params: { id: string } }>("/api/profile/decks/:id", async (request) => {
    const accountId = ctx.requireAccount(request);
    return ctx.mutateProfile(accountId, request, (profile) => deleteDeck(profile, request.params.id));
  });

  app.post("/api/profile/import", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { local } = ctx.parseBody(importBody, request.body);
    // Broken JSON would import an empty profile and use up the one-time import.
    const parsed = parseProfile(data, local);
    if (parsed.reset) throw new HttpError(400, "invalid profile");
    const imported = parsed.profile;
    return ctx.mutateProfile(accountId, request, (profile) => mergeImportedProfile(data, profile, imported));
  });
}
