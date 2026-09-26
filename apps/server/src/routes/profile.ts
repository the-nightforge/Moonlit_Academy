import type { FastifyInstance } from "fastify";
import {
  checkAchievements, claimMission, deleteDeck, mergeImportedProfile, parseProfile, recordProgress, saveDeck, setLevelUpForm,
  unlockCard,
} from "rules";
import { z } from "zod";
import { HttpError, type AppContext } from "../context";

const unlockBody = z.object({ heroId: z.string(), cardId: z.string() });
const deckBody = z.object({
  draft: z.object({
    id: z.string().max(16),
    name: z.string().max(64),
    heroIds: z.tuple([z.string(), z.string(), z.string()]),
    cardIds: z.array(z.string()).max(64),
    weapons: z.record(z.string().max(64), z.string().max(64).nullable()).optional(),
    relicIds: z.array(z.string().max(64)).max(8).optional(),
  }),
});
const levelUpFormBody = z.object({ form: z.enum(["base", "alt"]) });
const importBody = z.object({ local: z.unknown() });

/** Profile routes (`16` §4): each change calls one pure rule from `rules/src/meta/`. */
export function registerProfileRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { data } = ctx;

  app.get("/api/profile", async (request) => ctx.readProfile(ctx.requireAccount(request)));

  app.post("/api/profile/unlock", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { heroId, cardId } = ctx.parseBody(unlockBody, request.body);
    return ctx.mutateProfile(accountId, request, (profile) => {
      const unlocked = unlockCard(data, profile, heroId, cardId);
      if (!unlocked.ok) return unlocked;
      const counted = recordProgress(data, unlocked.profile, ctx.clock(), { cardsUnlocked: 1 }).profile;
      return checkAchievements(data, counted);
    });
  });

  app.put("/api/profile/decks", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { draft } = ctx.parseBody(deckBody, request.body);
    return ctx.mutateProfile(accountId, request, (profile) => saveDeck(data, profile, draft));
  });

  app.put<{ Params: { id: string } }>("/api/profile/heroes/:id/level-up-form", async (request) => {
    const accountId = ctx.requireAccount(request);
    const { form } = ctx.parseBody(levelUpFormBody, request.body);
    return ctx.mutateProfile(accountId, request, (profile) => setLevelUpForm(data, profile, request.params.id, form));
  });

  app.delete<{ Params: { id: string } }>("/api/profile/decks/:id", async (request) => {
    const accountId = ctx.requireAccount(request);
    return ctx.mutateProfile(accountId, request, (profile) => deleteDeck(profile, request.params.id));
  });

  app.post<{ Params: { id: string } }>("/api/missions/:id/claim", async (request) => {
    const accountId = ctx.requireAccount(request);
    return ctx.mutateProfile(accountId, request, (profile) => claimMission(data, profile, request.params.id, ctx.clock()));
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
