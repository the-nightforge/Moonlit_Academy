import { describe, expect, it } from "vitest";
import { createProfile } from "rules";
import { LOCK_MS, MAX_FAILED_LOGINS } from "../src/routes/auth";
import type { FastifyRequest } from "fastify";
import { createContext, SESSION_TTL_MS } from "../src/context";
import { call, register, testServer } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("accounts and sessions", () => {
  it("T173: register, login, logout; duplicate names; lockout after repeated wrong passwords; only hashes stored", async () => {
    const server = testServer();
    const created = await call(server, "POST", "/api/auth/register", { body: { username: "  Linh_Lung ", password: "trang-sang-8" } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rev: 1, profile: createProfile(server.data) });
    const token = created.body.token as string;

    expect((await call(server, "POST", "/api/auth/register", { body: { username: "linh_lung", password: "khac-nua-9" } })).body)
      .toEqual({ error: "username taken" });
    expect((await call(server, "POST", "/api/auth/register", { body: { username: "ab", password: "trang-sang-8" } })).body)
      .toEqual({ error: "invalid username" });
    expect((await call(server, "POST", "/api/auth/register", { body: { username: "an_nhien", password: "ngan" } })).body)
      .toEqual({ error: "invalid password" });
    expect((await call(server, "POST", "/api/auth/register", { body: { username: 5 } })).status).toBe(400);

    // Only hashes reach the database.
    const account = server.db.prepare("SELECT password_hash FROM accounts").get() as { password_hash: string };
    expect(account.password_hash).not.toContain("trang-sang-8");
    expect(account.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    const sessions = server.db.prepare("SELECT token_hash FROM sessions").all() as { token_hash: string }[];
    expect(sessions.map((row) => row.token_hash)).not.toContain(token);

    const login = await call(server, "POST", "/api/auth/login", { body: { username: "LINH_LUNG", password: "trang-sang-8" } });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ rev: 1, profile: createProfile(server.data) });
    expect(login.body.token).not.toBe(token);

    const wrong = { body: { username: "linh_lung", password: "sai-mat-khau" } };
    expect((await call(server, "POST", "/api/auth/login", { body: { username: "ai_do", password: "trang-sang-8" } })).body)
      .toEqual({ error: "invalid credentials" });
    for (let attempt = 1; attempt < MAX_FAILED_LOGINS; attempt++) {
      expect((await call(server, "POST", "/api/auth/login", wrong)).body).toEqual({ error: "invalid credentials" });
    }
    // A correct password resets the count.
    expect((await call(server, "POST", "/api/auth/login", { body: { username: "linh_lung", password: "trang-sang-8" } })).status).toBe(200);
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS; attempt++) await call(server, "POST", "/api/auth/login", wrong);
    const locked = await call(server, "POST", "/api/auth/login", { body: { username: "linh_lung", password: "trang-sang-8" } });
    expect(locked).toEqual({ status: 429, body: { error: "too many attempts", retryAfterMs: LOCK_MS } });
    server.now.value += LOCK_MS;
    expect((await call(server, "POST", "/api/auth/login", { body: { username: "linh_lung", password: "trang-sang-8" } })).status).toBe(200);

    expect((await call(server, "POST", "/api/auth/logout", { token })).status).toBe(204);
    expect((await call(server, "POST", "/api/auth/logout", { token })).body).toEqual({ error: "unauthorized" });
    expect((await call(server, "POST", "/api/auth/logout")).status).toBe(401);
  });

  it("T174: a session expires 30 days after its last use; each use extends it", async () => {
    const server = testServer();
    const { token } = await register(server);
    const ctx = createContext(server.deps, server.version);
    const request = { headers: { authorization: `Bearer ${token}` } } as unknown as FastifyRequest;
    const lastUsed = () => (server.db.prepare("SELECT last_used_at FROM sessions").get() as { last_used_at: number }).last_used_at;

    server.now.value += SESSION_TTL_MS - DAY;
    expect(ctx.requireAccount(request)).toBe(1);
    expect(lastUsed()).toBe(server.now.value);
    server.now.value += SESSION_TTL_MS - DAY; // 58 days after login, 29 after last use
    expect(ctx.requireAccount(request)).toBe(1);

    server.now.value += SESSION_TTL_MS + 1; // unused for more than 30 days
    expect(() => ctx.requireAccount(request)).toThrow("unauthorized");
    expect(server.db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    const bad = { headers: { authorization: "Bearer khong-phai-token" } } as unknown as FastifyRequest;
    expect(() => ctx.requireAccount(bad)).toThrow("unauthorized");
  });

  it("rejects requests for other game data, except the health check", async () => {
    const server = testServer();
    expect((await call(server, "POST", "/api/auth/login", { body: {}, version: "0000000000000000" })).body)
      .toEqual({ error: "outdated client", dataVersion: server.version });
    const health = await server.app.inject({ method: "GET", url: "/api/health" });
    expect(health.json()).toEqual({ ok: true, dataVersion: server.version });
  });
});
