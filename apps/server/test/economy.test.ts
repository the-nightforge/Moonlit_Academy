import { describe, expect, it } from "vitest";
import type { Profile } from "rules";
import { call, playRun, register, testServer } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

describe("economy routes", () => {
  it("gives the starter gift at registration, and at sign-in to accounts made before it existed", async () => {
    const server = testServer();
    const gift = server.data.economyConfig.starterGift.moonJade;
    const created = await register(server);
    expect((created.profile as Profile).currencies.moonJade).toBe(gift);

    // An account from phase 4c: no gift yet.
    const row = server.db.prepare("SELECT profile_json FROM profiles").get() as { profile_json: string };
    const old = JSON.parse(row.profile_json) as Profile;
    old.currencies.moonJade = 0;
    old.flags.starterGiftClaimed = false;
    server.db.prepare("UPDATE profiles SET profile_json = ?").run(JSON.stringify(old));
    const login = await call(server, "POST", "/api/auth/login", { body: { username: "linh_lung", password: "trang-sang-8" } });
    expect(login.body.profile.currencies.moonJade).toBe(gift);
    expect(login.body.rev).toBe(2);
    const second = await call(server, "POST", "/api/auth/login", { body: { username: "linh_lung", password: "trang-sang-8" } });
    expect(second.body).toMatchObject({ rev: 2, profile: { currencies: { moonJade: gift } } });
  });

  it("a finished run pays moon jade and counts toward missions; a mission is claimed through the API", async () => {
    const server = testServer();
    const { token } = await register(server);
    const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    const { actions } = playRun(server.data, ticket.body.setup);
    const finished = await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 1, body: { actions } });
    expect(finished.status).toBe(200);
    expect(finished.body.profile.missions.daily.runsFinished).toBe(1);
    expect(finished.body.profile.stats.starterBestFloor).toBeGreaterThan(0);
    const before = finished.body.profile.currencies.moonJade as number;

    const claimed = await call(server, "POST", "/api/missions/m_daily_run/claim", { token, rev: 2 });
    expect(claimed.status).toBe(200);
    expect(claimed.body.profile.currencies.moonJade).toBe(before + server.data.missions["m_daily_run"]!.reward.moonJade);
    expect((await call(server, "POST", "/api/missions/m_daily_run/claim", { token, rev: 3 })).body).toEqual({ error: "already claimed" });
    expect((await call(server, "POST", "/api/missions/m_weekly_wins/claim", { token, rev: 3 })).body).toEqual({ error: "not complete" });
  });

  it("unlocking a card counts toward missions", async () => {
    const server = testServer();
    const { token } = await register(server);
    const row = server.db.prepare("SELECT profile_json FROM profiles").get() as { profile_json: string };
    const profile = JSON.parse(row.profile_json) as Profile;
    profile.heroes["m05"]!.xp = server.data.metaConfig.masteryLevels[0]!;
    server.db.prepare("UPDATE profiles SET profile_json = ?").run(JSON.stringify(profile));
    const card = server.data.heroes["m05"]!.lockedCardIds[0]!;
    const unlocked = await call(server, "POST", "/api/profile/unlock", { token, rev: 1, body: { heroId: "m05", cardId: card } });
    expect(unlocked.body.profile.missions.daily.cardsUnlocked).toBe(1);
  });
});
