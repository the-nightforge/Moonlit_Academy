import { describe, expect, it } from "vitest";
import { call, testServer } from "./helpers";

const ORIGIN = "https://vong-nguyet.example.com";

function prodServer() {
  return testServer({
    production: true,
    trustProxy: true,
    allowedOrigins: [ORIGIN],
  });
}

describe("T245 rate limits and Origin checks", () => {
  it("register is limited to 5/hour per IP via X-Forwarded-For", async () => {
    const server = prodServer();
    const ip = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 5; i++) {
      const res = await call(server, "POST", "/api/auth/register", {
        body: { username: `rate_t${i}`, password: "trang-sang-8" },
        headers: ip,
      });
      expect(res.status).toBe(201);
    }
    const sixth = await call(server, "POST", "/api/auth/register", {
      body: { username: "rate_t6", password: "trang-sang-8" },
      headers: ip,
    });
    expect(sixth.status).toBe(429);
    expect(sixth.body).toMatchObject({ error: "rate limited" });
    // A different IP is a different bucket.
    const other = await call(server, "POST", "/api/auth/register", {
      body: { username: "rate_t7", password: "trang-sang-8" },
      headers: { "x-forwarded-for": "203.0.113.8" },
    });
    expect(other.status).toBe(201);
    // The window slides: an hour later the first IP can register again.
    server.now.value += 60 * 60 * 1000;
    const later = await call(server, "POST", "/api/auth/register", {
      body: { username: "rate_t8", password: "trang-sang-8" },
      headers: ip,
    });
    expect(later.status).toBe(201);
  });

  it("login is limited to 20/minute per IP", async () => {
    const server = prodServer();
    const ip = { "x-forwarded-for": "203.0.113.9" };
    // Unknown usernames still consume attempts — the limit precedes auth.
    for (let i = 0; i < 20; i++) {
      const res = await call(server, "POST", "/api/auth/login", {
        body: { username: "nobody", password: "x" },
        headers: ip,
      });
      expect(res.status).toBe(401);
    }
    const over = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
      headers: ip,
    });
    expect(over.status).toBe(429);
    server.now.value += 60 * 1000;
    const after = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
      headers: ip,
    });
    expect(after.status).toBe(401);
  });

  it("websocket upgrade is limited to 3 connections per IP per 10s", async () => {
    const server = prodServer();
    await server.app.ready();
    // injectWS upgrades a fake request without a socket — pass `remoteAddress`
    // so trustProxy can read `X-Forwarded-For` like Caddy sets it.
    const ctx = (ip: string) =>
      ({ headers: { "x-forwarded-for": ip }, socket: { remoteAddress: "10.0.0.1" } }) as never;
    for (let i = 0; i < 3; i++) {
      const socket = await server.app.injectWS("/api/ws", ctx("203.0.113.11"));
      socket.close();
    }
    await expect(server.app.injectWS("/api/ws", ctx("203.0.113.11"))).rejects.toThrow("429");
    // Other IPs still connect.
    const socket = await server.app.injectWS("/api/ws", ctx("203.0.113.12"));
    socket.close();
  });

  it("a foreign Origin cannot mutate profiles or open a socket", async () => {
    const server = prodServer();
    const evil = { origin: "https://evil.example.net" };
    const login = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
      headers: evil,
    });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ error: "forbidden origin" });
    // The allowed origin and no origin both pass (401 = past the Origin gate).
    const allowed = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
      headers: { origin: ORIGIN },
    });
    expect(allowed.status).toBe(401);
    const none = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
    });
    expect(none.status).toBe(401);
    await server.app.ready();
    const socket0 = { remoteAddress: "10.0.0.1" };
    await expect(
      server.app.injectWS("/api/ws", { headers: evil, socket: socket0 } as never),
    ).rejects.toThrow("403");
    const socket = await server.app.injectWS("/api/ws", {
      headers: { origin: ORIGIN },
      socket: socket0,
    } as never);
    socket.close();
  });

  it("dev config does not rate-limit or check Origin", async () => {
    const server = testServer();
    // IP rate limits and the Origin gate are production-only (`16` §7.2/§7.3).
    for (let i = 0; i < 6; i++) {
      const res = await call(server, "POST", "/api/auth/register", {
        body: { username: `dev_t${i}`, password: "trang-sang-8" },
      });
      expect(res.status).toBe(201);
    }
    const res = await call(server, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "x" },
      headers: { origin: "https://evil.example.net" },
    });
    expect(res.status).toBe(401);
  });
});
