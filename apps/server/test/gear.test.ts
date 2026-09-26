import { describe, expect, it } from "vitest";
import { parseProfile, starterDeck, type Loadout, type Profile, type SavedDeck } from "rules";
import { call, playRun, register, testServer } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

function editProfile(server: ReturnType<typeof testServer>, change: (profile: Profile) => void) {
  const row = server.db.prepare("SELECT profile_json FROM profiles").get() as { profile_json: string };
  const profile = parseProfile(server.data, JSON.parse(row.profile_json)).profile;
  change(profile);
  server.db.prepare("UPDATE profiles SET profile_json = ?").run(JSON.stringify(profile));
}

describe("gear routes", () => {
  it("T205: a deck keeps its gear; the ticket snapshots gear levels; later upgrades do not change the replay", async () => {
    const server = testServer();
    const { token } = await register(server);
    editProfile(server, (profile) => {
      profile.weapons = { w_thiet_thuan: { refinement: 2 } };
      profile.relics = { r_huyen_vu_giap_phu: { resonance: 3 } };
    });
    const draft: SavedDeck = {
      id: "", name: "Có giáp", heroIds: TEAM, cardIds: starterDeck(server.data, TEAM).slice(0, 17),
      weapons: { m05: "w_thiet_thuan" }, relicIds: ["r_huyen_vu_giap_phu"],
    };
    const saved = await call(server, "PUT", "/api/profile/decks", { token, rev: 1, body: { draft } });
    expect(saved.status).toBe(200);
    expect(saved.body.profile.decks[0]).toMatchObject({ weapons: { m05: "w_thiet_thuan" }, relicIds: ["r_huyen_vu_giap_phu"] });

    const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: saved.body.deckId } });
    expect(ticket.status).toBe(201);
    const loadout = ticket.body.loadout as Loadout;
    expect(loadout.heroes["m05"]).toMatchObject({ weaponId: "w_thiet_thuan", refinement: 2 });
    expect(loadout.relics).toEqual([{ id: "r_huyen_vu_giap_phu", resonance: 3 }]);

    editProfile(server, (profile) => {
      profile.weapons = { w_thiet_thuan: { refinement: 5 } };
    });
    const { actions } = playRun(server.data, ticket.body.setup, loadout);
    const finished = await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 2, body: { actions } });
    expect(finished.status).toBe(200);

    // Gear not owned any more: the deck is refused before a ticket is issued.
    editProfile(server, (profile) => {
      profile.weapons = {};
    });
    const refused = await call(server, "POST", "/api/runs", { token, body: { deckId: saved.body.deckId } });
    expect(refused.body).toMatchObject({ error: "invalid deck", errors: [{ code: "unownedWeapon", weaponId: "w_thiet_thuan" }] });
  });

  it("T206: PUT level-up-form needs Tinh Hồn 5 for the second form", async () => {
    const server = testServer();
    const { token } = await register(server);
    const url = "/api/profile/heroes/m05/level-up-form";
    expect((await call(server, "PUT", url, { token, rev: 1, body: { form: "alt" } })).body).toEqual({ error: "constellation too low" });
    expect((await call(server, "PUT", "/api/profile/heroes/f03/level-up-form", { token, rev: 1, body: { form: "alt" } })).body).toEqual({ error: "hero not owned" });
    expect((await call(server, "PUT", url, { token, rev: 1, body: { form: "fancy" } })).status).toBe(400);
    editProfile(server, (profile) => {
      profile.heroes["m05"]!.constellation = 5;
    });
    const chosen = await call(server, "PUT", url, { token, rev: 1, body: { form: "alt" } });
    expect(chosen.status).toBe(200);
    expect(chosen.body.profile.heroes["m05"].levelUpForm).toBe("alt");
    const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    expect(ticket.body.loadout.heroes["m05"].levelUpForm).toBe("alt");
  });

  it("T204: the weapon and relic banners are listed and pull gear into the profile", async () => {
    const server = testServer();
    const { token } = await register(server);
    const banners = await call(server, "GET", "/api/gacha/banners", { token });
    expect(banners.body.banners.map((banner: { id: string }) => banner.id)).toEqual(["banner_heroes", "banner_weapons", "banner_relics"]);
    const pulled = await call(server, "POST", "/api/gacha/banner_weapons/pull", { token, rev: 1, body: { count: 10 } });
    expect(pulled.status).toBe(200);
    const owned = Object.keys(pulled.body.profile.weapons);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every((id) => server.data.weapons[id])).toBe(true);
    expect(pulled.body.profile.pity).toHaveProperty("banner_weapons");
  });
});
