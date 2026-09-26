import { describe, expect, it } from "vitest";
import {
  applyRunResult, applyRunRewards, createProfile, grantStarterGift, starterDeck, summarizeRun, type RunSetup, type SavedDeck,
} from "rules";
import { TICKET_TTL_MS } from "../src/routes/runs";
import { call, playRun, register, testServer } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

async function signedIn() {
  const server = testServer();
  const { token } = await register(server);
  return { server, token };
}

function runStatus(server: ReturnType<typeof testServer>, runId: string) {
  return (server.db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string }).status;
}

describe("run tickets", () => {
  it("T178: one open ticket per account; a ticket expires after 7 days; another data version is refused", async () => {
    const { server, token } = await signedIn();
    const first = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    expect(first.status).toBe(201);
    const setup = first.body.setup as RunSetup;
    expect(setup.heroIds).toEqual(TEAM);
    expect(Number.isInteger(setup.seed) && setup.seed >= 0 && setup.seed < 2 ** 32).toBe(true);

    const second = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    expect(second.body.setup.seed).not.toBe(setup.seed);
    expect(runStatus(server, first.body.runId)).toBe("abandoned");
    expect((await call(server, "POST", `/api/runs/${first.body.runId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toEqual({ error: "run closed" });

    server.now.value += TICKET_TTL_MS + 1;
    expect((await call(server, "POST", `/api/runs/${second.body.runId}/finish`, { token, rev: 1, body: { actions: [] } })).status)
      .toBe(410);

    // A ticket issued for other game data (server updated since) cannot take a result.
    const third = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    server.db.prepare("UPDATE runs SET data_version = 'old' WHERE id = ?").run(third.body.runId);
    expect((await call(server, "POST", `/api/runs/${third.body.runId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toMatchObject({ error: "outdated client" });

    expect((await call(server, "POST", "/api/runs", { token, body: { deckId: "d7" } })).body).toEqual({ error: "unknown deck" });
    const other = await register(server, "nguoi_khac");
    expect((await call(server, "POST", `/api/runs/${third.body.runId}/abandon`, { token: other.token })).status).toBe(404);
    expect((await call(server, "POST", `/api/runs/${third.body.runId}/abandon`, { token })).status).toBe(204);
  });

  it("T179: a verified run grants XP once; a tampered one is rejected and grants nothing", async () => {
    const { server, token } = await signedIn();
    const draft: SavedDeck = { id: "", name: "Bộ đầu", heroIds: TEAM, cardIds: starterDeck(server.data, TEAM) };
    const saved = await call(server, "PUT", "/api/profile/decks", { token, rev: 1, body: { draft } });
    const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: saved.body.deckId } });
    const { run, actions } = playRun(server.data, ticket.body.setup);

    const unfinished = await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 2, body: { actions: actions.slice(0, 5) } });
    expect(unfinished.body).toEqual({ error: "run not finished" });
    expect(runStatus(server, ticket.body.runId)).toBe("open");

    const finished = await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 2, body: { actions } });
    expect(finished.status).toBe(200);
    const start = { ...grantStarterGift(server.data, createProfile(server.data)).profile, decks: saved.body.profile.decks };
    const summary = summarizeRun(server.data, run);
    const mastery = applyRunResult(server.data, start, summary);
    const paid = applyRunRewards(server.data, mastery.profile, summary, { now: server.now.value, starterDeck: false });
    const expected = { profile: paid.profile };
    expect(finished.body).toEqual({ profile: paid.profile, rev: 3, gains: mastery.gains, rewards: paid.rewards });
    expect(paid.rewards.moonJade).toBeGreaterThan(0);
    expect(runStatus(server, ticket.body.runId)).toBe("finished");
    expect((await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 3, body: { actions } })).body)
      .toEqual({ error: "run closed" });

    const cheat = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    const replayed = playRun(server.data, cheat.body.setup).actions;
    const tampered = [...replayed];
    tampered[2] = { type: "combat", action: { type: "playCard", instanceId: "not-in-hand" } };
    const refused = await call(server, "POST", `/api/runs/${cheat.body.runId}/finish`, { token, rev: 3, body: { actions: tampered } });
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({ error: "replay failed", step: 2 });
    expect(runStatus(server, cheat.body.runId)).toBe("rejected");
    expect((await call(server, "GET", "/api/profile", { token })).body).toEqual({ profile: expected.profile, rev: 3 });
    expect((await call(server, "POST", `/api/runs/${cheat.body.runId}/finish`, { token, rev: 3, body: { actions: [{ type: "fly" }] } })).status)
      .toBe(409);
  });

  it("refuses a ticket for an invalid deck and actions of the wrong shape", async () => {
    const { server, token } = await signedIn();
    const refused = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: ["m05", "f04", "f03"] } });
    expect(refused).toEqual({ status: 400, body: { error: "invalid deck", errors: [{ code: "unownedHero", heroId: "f03" }] } });

    const ticket = await call(server, "POST", "/api/runs", { token, body: { deckId: "starter", heroIds: TEAM } });
    const malformed = await call(server, "POST", `/api/runs/${ticket.body.runId}/finish`, { token, rev: 1, body: { actions: [{ type: "fly" }] } });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe("bad request");
    expect(runStatus(server, ticket.body.runId)).toBe("open");
  });
});
