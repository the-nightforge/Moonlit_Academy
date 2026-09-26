import { describe, expect, it } from "vitest";
import { parseProfile } from "rules";
import { call, register, testServer } from "./helpers";

describe("moon star shop route", () => {
  it("T196: buying spends moon stars and counts toward the weekly limit; refusals change nothing", async () => {
    const server = testServer();
    const { token } = await register(server);
    const row = server.db.prepare("SELECT profile_json FROM profiles").get() as { profile_json: string };
    const profile = parseProfile(server.data, JSON.parse(row.profile_json)).profile;
    profile.currencies.moonStar = 1000;
    server.db.prepare("UPDATE profiles SET profile_json = ?").run(JSON.stringify(profile));
    const pullItem = server.data.economyConfig.moonStarShop.find((item) => item.id === "shop_pull")!;

    expect((await call(server, "POST", "/api/shop/shop_pull/buy", { token, body: {} })).status).toBe(428);
    const bought = await call(server, "POST", "/api/shop/shop_pull/buy", { token, rev: 1, body: {} });
    expect(bought.status).toBe(200);
    expect(bought.body.rev).toBe(2);
    expect(bought.body.profile.currencies.moonStar).toBe(1000 - pullItem.price);
    expect(bought.body.profile.shop.bought).toEqual({ shop_pull: 1 });

    const hero = await call(server, "POST", "/api/shop/shop_epic_hero/buy", { token, rev: 2, body: { heroId: "f03" } });
    expect(hero.status).toBe(200);
    expect(hero.body.profile.heroes["f03"]).toMatchObject({ constellation: 0 });

    expect((await call(server, "POST", "/api/shop/shop_epic_hero/buy", { token, rev: 3, body: { heroId: "f02" } })).body)
      .toEqual({ error: "weekly limit" });
    expect((await call(server, "POST", "/api/shop/shop_nope/buy", { token, rev: 3, body: {} })).body).toEqual({ error: "unknown item" });
    expect((await call(server, "GET", "/api/profile", { token })).body.rev).toBe(3);
  });
});
