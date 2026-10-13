import type { GameData, Profile, SavedDeck, DeckError } from "rules";
import { validateDeck } from "rules";
import type { ServerMessage } from "../net/protocol";
import { summarizeDeck } from "./deck-presentation";

export type CoopPhase = "idle" | "joining-queue" | "queued" | "creating-room" | "joining-room" | "room" | "starting-practice" | "match";
export type CoopAction = "queue" | "create-room" | "join-room" | "practice";
export interface CoopRoom { code: string; players: { username: string; ready: boolean }[] }
export interface CoopRewards { clearsToday: number; rewardClaimsLeft: number }
export interface CoopDeck { deck: SavedDeck; errors: DeckError[]; copies: number; slots: number }
export interface CoopGate { online: boolean; connected: boolean; assets: "idle" | "loading" | "ready" | "error"; phase: CoopPhase; rewards: CoopRewards | null }
export function coopLobbyError(code: string): string {
  const messages: Record<string, string> = {
    "unknown room": "Mã phòng không tồn tại hoặc đã hết hạn. Kiểm tra lại mã.",
    "room mode mismatch": "Mã này không phải phòng Liên Thủ. Hãy dùng mã phòng Liên Thủ.",
    "room full": "Phòng đã đủ hai người. Hãy tạo phòng khác.",
    "invalid deck": "Bộ bài chưa hợp lệ. Kiểm tra lại bộ bài đã lưu.",
    "already in room": "Bạn đang ở một phòng khác. Rời phòng trước khi thử lại.",
    "already in queue": "Bạn đang tìm đồng đội.",
    "already in match": "Bạn đang trong một trận. Kết nối lại để tiếp tục trận.",
    "rate limited": "Thao tác quá nhanh. Chờ một chút rồi thử lại.",
  };
  return messages[code] ?? "Không thể thực hiện yêu cầu. Hãy thử lại.";
}
export function coopLobbyModel(data: GameData, profile: Profile, selectedId: string | null, gate: CoopGate): {
  decks: CoopDeck[]; selected: CoopDeck | null; canStart: boolean; canEdit: boolean; blockedReason: string; claimsLeft: number | null;
} {
  const decks = profile.decks.map(deck => {
    const summary = summarizeDeck(data, deck, { profile });
    return { deck, errors: validateDeck(data, profile, deck), copies: summary.copies, slots: summary.slots };
  });
  const selected = decks.find(row => row.deck.id === selectedId) ?? null;
  const canEdit = gate.phase === "idle";
  const blockedReason = !canEdit ? gate.phase === "queued" || gate.phase === "joining-queue" ? "Đang tìm đồng đội"
    : gate.phase === "room" ? "Bạn đang trong phòng riêng" : "Đang gửi yêu cầu…"
    : !selected ? "Chọn một bộ bài đã lưu để xuất trận"
    : selected.errors.length ? "Bộ bài chưa hợp lệ — kiểm tra đội hình"
    : !gate.online ? "Đăng nhập để vào Liên Thủ"
    : !gate.connected ? "Đang kết nối với Liên Thủ…"
    : gate.assets === "error" ? "Chưa tải đủ hình trận — hãy thử lại"
    : gate.assets !== "ready" ? "Đang tải hình trận…" : "";
  const claimsLeft = gate.rewards === null ? null
    : Math.max(0, Math.min(data.coopConfig.rewardedMatchesPerDay, gate.rewards.rewardClaimsLeft));
  return { decks, selected, canStart: !blockedReason, canEdit, blockedReason, claimsLeft };
}
export function normalizeCoopRoomCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}
export function coopWaitTime(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return Math.floor(whole / 60) + ":" + (whole % 60).toString().padStart(2, "0");
}
export class CoopLobbyFlow {
  phase: CoopPhase = "idle";
  room: CoopRoom | null = null;
  waitingSeconds = 0;
  begin(action: CoopAction, canStart: boolean): boolean {
    if (!canStart || this.phase !== "idle") return false;
    this.phase = { queue: "joining-queue", "create-room": "creating-room", "join-room": "joining-room", practice: "starting-practice" }[action] as CoopPhase;
    this.waitingSeconds = 0;
    return true;
  }
  handle(message: ServerMessage): boolean {
    if (message.type === "queue.status") {
      if (message.mode !== "coop" || (this.phase !== "joining-queue" && this.phase !== "queued")) return false;
      this.phase = "queued";
      this.waitingSeconds = Number.isFinite(message.waitingSeconds) ? Math.max(0, message.waitingSeconds) : 0;
      return true;
    }
    if (message.type === "room.created" || message.type === "room.updated") {
      if (message.mode !== "coop" || !["creating-room", "joining-room", "room"].includes(this.phase)) return false;
      this.room = { code: message.code, players: message.players.map(player => ({ ...player })) };
      this.phase = "room";
      return true;
    }
    if (message.type === "room.closed") {
      if (this.room?.code !== message.code) return false;
      this.disconnected();
      return true;
    }
    if (message.type === "error") {
      if (message.error === "already in queue" && (this.phase === "joining-queue" || this.phase === "queued")) this.phase = "queued";
      else if (this.phase !== "room") this.disconnected();
      return true;
    }
    return false;
  }
  leave(): "queue.leave" | "room.leave" | null {
    const type = this.phase === "joining-queue" || this.phase === "queued" ? "queue.leave"
      : ["creating-room", "joining-room", "room"].includes(this.phase) ? "room.leave" : null;
    if (type) this.disconnected();
    return type;
  }
  disconnected() { this.phase = "idle"; this.room = null; this.waitingSeconds = 0; }
  matchStarted() { this.phase = "match"; this.room = null; this.waitingSeconds = 0; }
}
