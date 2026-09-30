import { describe, expect, it } from "vitest";
import type { StorySetup } from "rules";
import { TICKET_TTL_MS } from "../src/routes/runs";
import { call, playStory, register, testServer, withServerStory } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const start = { deckId: "starter", heroIds: TEAM };

async function signedIn() {
  const server = await testServer();
  withServerStory(server);
  const { token } = await register(server);
  return { server, token };
}

describe("story tickets", () => {
  it("T305: locked stage 403; verified win pays once; tampered replay 422 rejected; unfinished 422", async () => {
    const { server, token } = await signedIn();
    expect((await call(server, "POST", "/api/story/t_a1s2/tickets", { token, body: start })).status).toBe(403);

    const ticket = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    expect(ticket.status).toBe(201);
    const setup = ticket.body.setup as StorySetup;
    const { state, actions } = playStory(server.data, setup, ticket.body.loadout);

    const unfinished = await call(server, "POST", `/api/story/tickets/${ticket.body.ticketId}/finish`, { token, rev: 1, body: { actions: actions.slice(0, 3) } });
    expect(unfinished.body).toEqual({ error: "combat not finished" });

    const finished = await call(server, "POST", `/api/story/tickets/${ticket.body.ticketId}/finish`, { token, rev: 1, body: { actions } });
    expect(finished.status).toBe(200);
    expect(finished.body.rewards.firstClear).toBe(state.status === "won");
    if (state.status === "won") expect(finished.body.profile.story.cleared).toEqual(["t_a1s1"]);

    const again = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    const tampered = [...actions];
    tampered[0] = { type: "playCard", instanceId: "c99" };
    const rejected = await call(server, "POST", `/api/story/tickets/${again.body.ticketId}/finish`, { token, rev: 2, body: { actions: tampered } });
    expect(rejected.status).toBe(422);
    expect(rejected.body.error).toBe("replay failed");
    const row = await server.db.prepare("SELECT status FROM story_tickets WHERE id = ?").get(again.body.ticketId);
    expect(row).toEqual({ status: "rejected" });
  });

  it("T306: one open ticket per account; expiry 410; outdated data 409; GET /api/story", async () => {
    const { server, token } = await signedIn();
    expect((await call(server, "GET", "/api/story", { token })).body).toEqual({ cleared: [], unlocked: ["t_a1s1"] });
    const first = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    const second = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    expect((await call(server, "POST", `/api/story/tickets/${first.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toEqual({ error: "ticket closed" });
    server.now.value += TICKET_TTL_MS + 1;
    expect((await call(server, "POST", `/api/story/tickets/${second.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).status).toBe(410);
    const third = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    await server.db.prepare("UPDATE story_tickets SET data_version = 'old' WHERE id = ?").run(third.body.ticketId);
    expect((await call(server, "POST", `/api/story/tickets/${third.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toMatchObject({ error: "outdated client" });
    expect((await call(server, "POST", `/api/story/tickets/${third.body.ticketId}/abandon`, { token })).status).toBe(204);
    expect((await call(server, "POST", "/api/story/nope/tickets", { token, body: start })).status).toBe(404);
  });
});
