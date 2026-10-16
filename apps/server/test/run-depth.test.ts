import { expect, it } from "vitest";
import { parseProfile, type RunSetup } from "rules";
import { runActionSchema } from "../src/routes/runs";
import { accountIdOf, call, signedIn } from "./helpers";

it("snapshots only selected heroes' unlocked cards and ignores a forged client card pool", async () => {
  const { server, token } = await signedIn();
  const accountId = await accountIdOf(server, token);
  const row = await server.db.prepare<[number], { profile_json: string }>("SELECT profile_json FROM profiles WHERE account_id = ?").get(accountId);
  const { profile } = parseProfile(server.data, JSON.parse(row!.profile_json));
  const unlocked = server.data.heroes.m05!.lockedCardIds[0]!;
  profile.heroes.m05!.unlockedCardIds = [unlocked];
  await server.db.prepare("UPDATE profiles SET profile_json = ? WHERE account_id = ?").run(JSON.stringify(profile), accountId);
  const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: ["m05", "f04", "m06"], availableCardIds: Object.keys(server.data.cards) } });
  expect(ticket.status).toBe(201);
  const setup = ticket.body.setup as RunSetup;
  expect(setup.availableCardIds).toContain(unlocked);
  expect(setup.availableCardIds).not.toContain(server.data.heroes.m05!.lockedCardIds[1]);
  expect(setup.availableCardIds).not.toContain(server.data.heroes.f01!.cardIds[0]);
  expect(setup.deckCardIds).not.toContain(unlocked);
  const after = await call(server, "GET", "/api/profile", { token });
  expect(after.body.profile.heroes.m05.unlockedCardIds).toEqual([unlocked]);
});

it("accepts recorded event and swap actions but does not accept arbitrary event choices", () => {
  expect(runActionSchema.safeParse({ type: "event", choice: "trade", cardId: "m05_bat_khuat" }).success).toBe(true);
  expect(runActionSchema.safeParse({ type: "event", choice: "claimEverything" }).success).toBe(false);
  expect(runActionSchema.safeParse({ type: "rest", choice: "swapCard", cardId: "old", replacementId: "new" }).success).toBe(true);
  expect(runActionSchema.safeParse({ type: "rest", choice: "swapCard", cardId: "old" }).success).toBe(false);
});
