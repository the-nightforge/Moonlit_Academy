import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("never sends a stale lobby request after reconnect, including the close-event race", async () => {
  class FakeSocket {
    static OPEN = 1;
    static current: FakeSocket;
    readyState = 0;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_url: URL) { FakeSocket.current = this; }
    send(text: string) { this.sent.push(text); }
    close() { this.readyState = 3; this.onclose?.(); }
    welcome() {
      this.readyState = 1;
      this.onmessage?.({ data: JSON.stringify({ type: "welcome", account: { id: 1, username: "test" }, serverTime: Date.now() }) });
    }
  }
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("window", { devicePixelRatio: 1, screen: { width: 1280, height: 720 }, location: { href: "http://localhost:5310" }, setTimeout, clearTimeout });
  const { NetSocket } = await import("../src/net/socket");
  const net = new NetSocket();
  net.connect();
  const ws = FakeSocket.current;
  expect(net.sendLobby({ type: "queue.join", mode: "coop", deckId: "d1" })).toBe(false);
  ws.welcome();
  expect(ws.sent).toEqual([]);
  expect(net.sendLobby({ type: "queue.join", mode: "coop", deckId: "d1" })).toBe(true);
  expect(ws.sent.map(text => JSON.parse(text).type)).toEqual(["queue.join"]);
  ws.readyState = 3; // transport closed before the JavaScript close callback
  expect(net.connected).toBe(true);
  expect(net.sendLobby({ type: "practice.start", mode: "coop", deckId: "d1" })).toBe(false);
  ws.welcome();
  expect(ws.sent.map(text => JSON.parse(text).type)).toEqual(["queue.join"]);
  net.close();
});
