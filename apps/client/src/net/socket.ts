import { dataVersion } from "data";
import { auth } from "../api";
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
  /** `welcome.activeMatch` on reconnect — the scene rejoins through this. */
  onRejoin: (snapshot: MatchSnapshot) => void = () => {};
  onStatus: (connected: boolean) => void = () => {};

  private ws: WebSocket | null = null;
  private outbox: string[] = [];
  private retries = 0;
  private retryHandle: number | undefined;
  private manualClose = false;

  connect(): void {
    this.manualClose = false;
    if (this.ws !== null) return;
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${scheme}//${window.location.host}/api/ws`);
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
      if (message.activeMatch) this.onRejoin(message.activeMatch);
    }
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
