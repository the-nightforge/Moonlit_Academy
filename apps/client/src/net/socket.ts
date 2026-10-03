import { dataVersion } from "data";
import { API_BASE, auth } from "../api";
import { session } from "../session";
import type { MatchSnapshot, ServerMessage } from "./protocol";

const RECONNECT_MAX_MS = 15_000;

/**
 * The realtime socket (`16` §8): one `WebSocket` per account, `hello` auth on
 * open, exponential backoff reconnect (1, 2, 4, 8… ≤ 15 s) with an offline
 * outbox, and the server clock offset learned from `welcome.serverTime`.
 */
export class NetSocket {
  connected = false;
  /** `serverTime - clientNow`, measured at each `welcome`. */
  serverOffset = 0;
  /** Every server message except `ping` (answered internally). */
  onMessage: (message: ServerMessage) => void = () => {};
  /**
   * Fires on every `welcome`: the retained match snapshot, or null when the
   * room is gone. Null means "nothing to rejoin" — not "recovered old match".
   */
  onRecovery: (snapshot: MatchSnapshot | null) => void = () => {};
  onStatus: (connected: boolean) => void = () => {};

  private ws: WebSocket | null = null;
  private outbox: string[] = [];
  private retries = 0;
  private retryHandle: number | undefined;
  private manualClose = false;

  connect(): void {
    this.manualClose = false;
    if (this.ws !== null) return;
    // Same origin as the API (`VITE_API_BASE`); `wss://` under `https://` (`16` §7.6).
    const url = new URL(`${API_BASE}/api/ws`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: "hello", token: auth.token ?? "", dataVersion: dataVersion(session.data) }));
    };
    this.ws.onmessage = (event: MessageEvent<string>) => this.onRaw(event.data);
    this.ws.onclose = () => this.onClosed();
    this.ws.onerror = () => this.ws?.close();
  }

  send(message: unknown): void {
    const text = JSON.stringify(message);
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(text);
    else this.outbox.push(text);
  }

  /**
   * Match frames never queue offline: a stale `match.action` landing after a
   * reconnect could apply onto a new phase (`16` §8.3). Returns false when the
   * frame could not leave — the caller keeps its action `seq` unconsumed.
   */
  sendMatch(message: {
    type: "match.action" | "match.resign" | "match.emote" | "match.sync";
    [key: string]: unknown;
  }): boolean {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.manualClose = true;
    window.clearTimeout(this.retryHandle);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  /** Current server-clock time in ms UTC (server deadline arithmetic). */
  serverNow(): number {
    return Date.now() + this.serverOffset;
  }

  private onRaw(text: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(text) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === "ping") {
      this.ws?.send(JSON.stringify({ type: "pong" }));
      return;
    }
    if (message.type === "welcome") {
      this.serverOffset = message.serverTime - Date.now();
      this.retries = 0;
      this.connected = true;
      for (const queued of this.outbox.splice(0)) this.ws?.send(queued);
      this.onStatus(true);
      // Retained matches reconcile before the scene sees the snapshot (`16` §8.4).
      session.registry?.recover(message.activeMatch ?? null);
      this.onRecovery(message.activeMatch ?? null);
    }
    // Match frames route through the registry first; handled frames never
    // reach a scene handler, so no frame dispatches twice (`16` §8.4).
    if (session.registry?.handle(message) === true) return;
    this.onMessage(message);
  }

  private onClosed(): void {
    this.ws = null;
    if (this.connected) {
      this.connected = false;
      this.onStatus(false);
    }
    if (this.manualClose || auth.token === null) return;
    const delay = Math.min(2 ** this.retries * 1000, RECONNECT_MAX_MS);
    this.retries += 1;
    this.retryHandle = window.setTimeout(() => this.connect(), delay);
  }
}
