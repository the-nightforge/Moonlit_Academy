import { describe, expect, it } from "vitest";
import { createProfile, grantStarterGift, pullMany } from "rules";
import { call, register, testServer } from "./helpers";

describe("gacha routes", () => {
  it("T190: a pull commits the profile and its log together; a refused pull changes and logs nothing", async () => {
    const server = testServer();
    const { token } = await register(server);
    const banners = await call(server, "GET", "/api/gacha/banners", { token });
    expect(banners.body.banners.map((banner: { id: string }) => banner.id)).toEqual(["banner_heroes"]);
    expect(banners.body).toMatchObject({ pullCost: server.data.economyConfig.pullCost, pity: {} });

    const pulled = await call(server, "POST", "/api/gacha/banner_heroes/pull", { token, rev: 1, body: { count: 10 } });
    expect(pulled.status).toBe(200);
    expect(pulled.body.rev).toBe(2);
    expect(pulled.body.results).toHaveLength(10);
    // The starter gift is exactly 10 pulls; achievements reached by the pull pay on top.
    const achievementJade = (pulled.body.achievements as string[])
      .reduce((sum, id) => sum + server.data.achievements[id]!.reward.moonJade, 0);
    expect(pulled.body.profile.currencies.moonJade).toBe(achievementJade);

    // The log keeps the seed: the same pull can be reproduced from it.
    const logged = server.db.prepare("SELECT seed, results_json, count FROM pulls").get() as { seed: number; results_json: string; count: number };
    const start = grantStarterGift(server.data, createProfile(server.data)).profile;
    const replay = pullMany(server.data, start, "banner_heroes", 10, logged.seed, server.now.value);
    expect(replay.ok && replay.results).toEqual(JSON.parse(logged.results_json));
    expect(logged.count).toBe(10);

    const broke = await call(server, "POST", "/api/gacha/banner_heroes/pull", { token, rev: 2, body: { count: 10 } });
    expect(broke).toEqual({ status: 400, body: { error: "not enough moonJade" } });
    expect(server.db.prepare("SELECT COUNT(*) AS n FROM pulls").get()).toEqual({ n: 1 });
    expect((await call(server, "GET", "/api/profile", { token })).body.rev).toBe(2);
    expect((await call(server, "POST", "/api/gacha/banner_nope/pull", { token, rev: 2, body: { count: 1 } })).body)
      .toEqual({ error: "unknown banner" });
    expect((await call(server, "POST", "/api/gacha/banner_heroes/pull", { token, rev: 2, body: { count: 3 } })).status).toBe(400);
  });

  it("lists pull history newest first, without seeds, 20 per page", async () => {
    const server = testServer();
    const { token } = await register(server);
    for (let rev = 1; rev <= 3; rev++) {
      server.now.value += 1000;
      await call(server, "POST", "/api/gacha/banner_heroes/pull", { token, rev, body: { count: 1 } });
    }
    const history = await call(server, "GET", "/api/gacha/history", { token });
    expect(history.body.entries).toHaveLength(3);
    expect(history.body.entries[0].createdAt).toBeGreaterThan(history.body.entries[2].createdAt);
    expect(JSON.stringify(history.body)).not.toContain("seed");
    expect((await call(server, "GET", "/api/gacha/history?page=1", { token })).body.entries).toEqual([]);
    expect((await call(server, "GET", "/api/gacha/history?banner=other", { token })).body.entries).toEqual([]);
  });
});
