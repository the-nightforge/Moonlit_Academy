import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});
vi.stubGlobal("WebSocket", { OPEN: 1 });

const { NetSocket } = await import("../src/net/socket");

interface SockInternals {
  connected: boolean;
  ws: { readyState: number; send: (text: string) => void } | null;
  outbox: string[];
}

function internals(sock: InstanceType<typeof NetSocket>): SockInternals {
  return sock as unknown as SockInternals;
}

describe("NetSocket.sendMatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false while offline and never queues match frames", () => {
    const sock = new NetSocket();
    expect(sock.sendMatch({ type: "match.action", matchId: "m1", seq: 1, action: { type: "endTurn" } })).toBe(false);
    expect(sock.sendMatch({ type: "match.sync", matchId: "m1" })).toBe(false);
    expect(internals(sock).outbox).toHaveLength(0);
  });

  it("sends the frame when connected and the socket is OPEN", () => {
    const sock = new NetSocket();
    const send = vi.fn();
    internals(sock).connected = true;
    internals(sock).ws = { readyState: 1, send };
    expect(sock.sendMatch({ type: "match.resign", matchId: "m1" })).toBe(true);
    expect(send).toHaveBeenCalledWith(JSON.stringify({ type: "match.resign", matchId: "m1" }));
  });

  it("returns false when the socket is not OPEN even if flagged connected", () => {
    const sock = new NetSocket();
    internals(sock).connected = true;
    internals(sock).ws = { readyState: 0, send: vi.fn() };
    expect(sock.sendMatch({ type: "match.emote", matchId: "m1", emoteId: "GG" })).toBe(false);
  });

  it("non-match frames keep the offline outbox behaviour", () => {
    const sock = new NetSocket();
    sock.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    expect(internals(sock).outbox).toHaveLength(1);
  });
});

describe("NetSocket.onRecovery", () => {
  it("fires on every welcome — with the activeMatch snapshot or null", () => {
    const sock = new NetSocket();
    const onRecovery = vi.fn();
    sock.onRecovery = onRecovery;
    const raw = (message: unknown) =>
      (sock as unknown as { onRaw(text: string): void }).onRaw(JSON.stringify(message));
    const activeMatch = { matchId: "m1", mode: "practice", you: 0 };
    raw({ type: "welcome", account: { id: 1, username: "x" }, serverTime: 123, activeMatch });
    expect(onRecovery).toHaveBeenLastCalledWith(activeMatch);
    raw({ type: "welcome", account: { id: 1, username: "x" }, serverTime: 456 });
    expect(onRecovery).toHaveBeenLastCalledWith(null);
    expect(onRecovery).toHaveBeenCalledTimes(2);
  });
});
