import { describe, expect, it } from "vitest";
import type { Profile, SavedDeck } from "rules";
import { starterDeck } from "rules";
import { call, register, testServer, type TestServer } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

async function signedIn() {
  const server = testServer();
  const { token } = await register(server);
  return { server, token };
}

function setXp(server: TestServer, heroId: string, xp: number) {
  const row = server.db.prepare("SELECT profile_json FROM profiles").get() as { profile_json: string };
  const profile = JSON.parse(row.profile_json) as Profile;
  profile.heroes[heroId]!.xp = xp;
  server.db.prepare("UPDATE profiles SET profile_json = ?").run(JSON.stringify(profile));
}

describe("profile routes", () => {
  it("reads the profile; saves, renames and deletes decks; unlocks cards through the rules", async () => {
    const { server, token } = await signedIn();
    const read = await call(server, "GET", "/api/profile", { token });
    expect(read.status).toBe(200);
    expect(read.body.rev).toBe(1);
    expect((await call(server, "GET", "/api/profile")).status).toBe(401);

    const draft: SavedDeck = { id: "", name: " Liệt Hỏa ", heroIds: TEAM, cardIds: starterDeck(server.data, TEAM) };
    const saved = await call(server, "PUT", "/api/profile/decks", { token, rev: 1, body: { draft } });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ rev: 2, deckId: "d1" });
    expect(saved.body.profile.decks).toEqual([{ ...draft, id: "d1", name: "Liệt Hỏa" }]);

    const renamed = await call(server, "PUT", "/api/profile/decks", { token, rev: 2, body: { draft: { ...draft, id: "d1", name: "Mới" } } });
    expect(renamed.body.profile.decks[0].name).toBe("Mới");
    expect((await call(server, "PUT", "/api/profile/decks", { token, rev: 3, body: { draft: { ...draft, name: "  " } } })).body)
      .toEqual({ error: "invalid name" });
    expect((await call(server, "PUT", "/api/profile/decks", { token, rev: 3, body: { draft: { ...draft, heroIds: ["m05"] } } })).status)
      .toBe(400);

    const locked = server.data.heroes["m05"]!.lockedCardIds[0]!;
    expect((await call(server, "POST", "/api/profile/unlock", { token, rev: 3, body: { heroId: "m05", cardId: locked } })).body)
      .toEqual({ error: "no pending unlock" });
    setXp(server, "m05", server.data.metaConfig.masteryLevels[0]!);
    const unlocked = await call(server, "POST", "/api/profile/unlock", { token, rev: 3, body: { heroId: "m05", cardId: locked } });
    expect(unlocked.body.rev).toBe(4);
    expect(unlocked.body.profile.heroes.m05.unlockedCardIds).toEqual([locked]);

    expect((await call(server, "DELETE", "/api/profile/decks/d9", { token, rev: 4 })).body).toEqual({ error: "unknown deck" });
    const deleted = await call(server, "DELETE", "/api/profile/decks/d1", { token, rev: 4 });
    expect(deleted.body).toMatchObject({ rev: 5, profile: { decks: [] } });
    expect((await call(server, "GET", "/api/profile", { token })).body.rev).toBe(5);
  });

  it("T176: /profile/import merges a phase 4b profile once; broken JSON does not use up the import", async () => {
    const { server, token } = await signedIn();
    const levels = server.data.metaConfig.masteryLevels;
    const locked = server.data.heroes["m05"]!.lockedCardIds;
    const local = {
      version: 1,
      heroes: { m05: { xp: levels[0], unlockedCardIds: [locked[0], locked[1]] }, f03: { xp: 999, unlockedCardIds: [] } },
      decks: [{ id: "d1", name: "Máy cũ", heroIds: TEAM, cardIds: [] }],
    };
    expect((await call(server, "POST", "/api/profile/import", { token, rev: 1, body: { local: "rác" } })).body)
      .toEqual({ error: "invalid profile" });
    const merged = await call(server, "POST", "/api/profile/import", { token, rev: 1, body: { local } });
    expect(merged.status).toBe(200);
    expect(merged.body.profile.heroes.m05).toMatchObject({ xp: levels[0], unlockedCardIds: [locked[0]] }); // mastery 1 → one unlock
    expect(merged.body.profile.heroes.f03).toBeUndefined();
    expect(merged.body.profile.decks).toEqual([{ ...local.decks[0], id: "d1" }]);
    expect(merged.body.profile.flags.localImportDone).toBe(true);
    expect((await call(server, "POST", "/api/profile/import", { token, rev: 2, body: { local } })).body)
      .toEqual({ error: "already imported" });
  });

  it("T180: a change with a stale or missing If-Match is refused and leaves the profile unchanged", async () => {
    const { server, token } = await signedIn();
    const draft: SavedDeck = { id: "", name: "Một", heroIds: TEAM, cardIds: [] };
    await call(server, "PUT", "/api/profile/decks", { token, rev: 1, body: { draft } });
    const stale = await call(server, "PUT", "/api/profile/decks", { token, rev: 1, body: { draft: { ...draft, name: "Hai" } } });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: "stale profile", rev: 2 });
    expect(stale.body.profile.decks.map((deck: SavedDeck) => deck.name)).toEqual(["Một"]);
    expect((await call(server, "PUT", "/api/profile/decks", { token, body: { draft } })).body).toEqual({ error: "if-match required" });
    expect((await call(server, "GET", "/api/profile", { token })).body.rev).toBe(2);
  });

  it("T181: a hero not owned cannot be unlocked through the API", async () => {
    const { server, token } = await signedIn();
    const card = server.data.heroes["f03"]!.lockedCardIds[0]!;
    const refused = await call(server, "POST", "/api/profile/unlock", { token, rev: 1, body: { heroId: "f03", cardId: card } });
    expect(refused).toEqual({ status: 400, body: { error: "hero not owned" } });
    expect((await call(server, "GET", "/api/profile", { token })).body.rev).toBe(1);
  });
});
