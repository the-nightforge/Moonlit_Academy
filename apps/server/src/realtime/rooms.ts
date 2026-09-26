import type { PvpSide } from "rules";
import { buildPvpLoadout, validateDeck } from "rules";
import type { AppContext } from "../context";
import type { ClientMessage } from "./protocol";
import type { MatchSeat } from "./match-room";

/** Phòng riêng code alphabet: 32 chars, no easily-confused I/O/0/1 (`17` §6.2). */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_TTL_MS = 10 * 60 * 1000;
export const ROOM_CAPACITY = 2;

interface RoomMember {
  accountId: number;
  username: string;
  deckId: string;
  side: PvpSide;
  socket?: unknown;
}

export interface WaitingRoom {
  code: string;
  mode: "pvp" | "coop";
  hostId: number;
  members: RoomMember[];
  expiresAt: number;
  expiryHandle: unknown;
}

export type DeckResolution = { ok: true; side: PvpSide } | { ok: false; errors: { code: string }[] };

/**
 * Resolves `deckId` inside the account's profile into a normalized PvP side
 * (`17` §6.2): the deck must be a saved deck and pass `validateDeck` in pvp mode.
 */
export function resolvePvpSide(ctx: AppContext, accountId: number, deckId: string): DeckResolution {
  const { profile } = ctx.readProfile(accountId);
  const deck = profile.decks.find((d) => d.id === deckId);
  if (!deck) return { ok: false, errors: [{ code: "invalid deck" }] };
  const errors = validateDeck(ctx.data, profile, deck, { mode: "pvp" });
  if (errors.length > 0) return { ok: false, errors };
  const loadout = buildPvpLoadout(ctx.data, profile, deck);
  if (!loadout.ok) return { ok: false, errors: [{ code: loadout.error }] };
  return { ok: true, side: { heroIds: deck.heroIds, deckCardIds: deck.cardIds, loadout: loadout.loadout } };
}

/**
 * Private rooms (`17` §6.2): a host opens a 6-letter code, a guest joins with a
 * valid PvP deck, the room starts a `private` match when full. No Elo or rewards.
 */
export class RoomManager {
  readonly rooms = new Map<string, WaitingRoom>();
  private readonly byAccount = new Map<number, string>();

  constructor(
    private readonly ctx: AppContext,
    private readonly sendTo: (accountId: number, message: unknown) => void,
    private readonly startMatch: (room: WaitingRoom) => void,
  ) {}

  usernameOf(accountId: number): string {
    const row = this.ctx.db.prepare<[number], { username: string }>("SELECT username FROM accounts WHERE id = ?").get(accountId);
    return row?.username ?? "?";
  }

  roomOf(accountId: number): WaitingRoom | undefined {
    const code = this.byAccount.get(accountId);
    return code === undefined ? undefined : this.rooms.get(code);
  }

  create(accountId: number, mode: "pvp" | "coop", deckId: string): void {
    if (mode !== "pvp") {
      this.sendTo(accountId, { type: "error", error: "coop not implemented" });
      return;
    }
    if (this.roomOf(accountId)) {
      this.sendTo(accountId, { type: "error", error: "already in room" });
      return;
    }
    const side = resolvePvpSide(this.ctx, accountId, deckId);
    if (!side.ok) {
      this.sendTo(accountId, { type: "error", error: "invalid deck", errors: side.errors });
      return;
    }
    const code = this.newCode();
    const expiryHandle = this.ctx.scheduler.setTimeout(() => this.expire(code), ROOM_TTL_MS);
    const room: WaitingRoom = {
      code, mode, hostId: accountId,
      members: [{ accountId, username: this.usernameOf(accountId), deckId, side: side.side }],
      expiresAt: this.ctx.clock() + ROOM_TTL_MS,
      expiryHandle,
    };
    this.rooms.set(code, room);
    this.byAccount.set(accountId, code);
    this.sendTo(accountId, { type: "room.created", code, mode, players: this.publicMembers(room) });
  }

  join(accountId: number, code: string, deckId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || this.ctx.clock() >= room.expiresAt) {
      this.sendTo(accountId, { type: "error", error: "unknown room" });
      return;
    }
    if (room.members.some((m) => m.accountId === accountId) || this.roomOf(accountId)) {
      this.sendTo(accountId, { type: "error", error: "already in room" });
      return;
    }
    if (room.members.length >= ROOM_CAPACITY) {
      this.sendTo(accountId, { type: "error", error: "room full" });
      return;
    }
    const side = resolvePvpSide(this.ctx, accountId, deckId);
    if (!side.ok) {
      this.sendTo(accountId, { type: "error", error: "invalid deck", errors: side.errors });
      return;
    }
    room.members.push({ accountId, username: this.usernameOf(accountId), deckId, side: side.side });
    this.byAccount.set(accountId, room.code);
    if (room.members.length >= ROOM_CAPACITY) this.begin(room);
    else this.broadcast(room, { type: "room.updated", code: room.code, mode: room.mode, players: this.publicMembers(room) });
  }

  /** Host leaving destroys the room; a guest leaving shrinks it (`17` §6.2). */
  leave(accountId: number): void {
    const room = this.roomOf(accountId);
    if (!room) return;
    if (accountId === room.hostId) {
      for (const member of room.members) {
        this.byAccount.delete(member.accountId);
        if (member.accountId !== accountId) this.sendTo(member.accountId, { type: "room.closed", code: room.code });
      }
      this.destroy(room);
      return;
    }
    room.members = room.members.filter((m) => m.accountId !== accountId);
    this.byAccount.delete(accountId);
    this.broadcast(room, { type: "room.updated", code: room.code, mode: room.mode, players: this.publicMembers(room) });
  }

  /** Disconnect frees the seat; an empty waiting room is destroyed. */
  disconnect(accountId: number): void {
    this.leave(accountId);
  }

  private begin(room: WaitingRoom): void {
    this.broadcast(room, { type: "room.updated", code: room.code, mode: room.mode, players: this.publicMembers(room) });
    this.destroy(room);
    this.startMatch(room);
  }

  private expire(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const member of room.members) {
      this.byAccount.delete(member.accountId);
      this.sendTo(member.accountId, { type: "room.closed", code });
    }
    this.destroy(room);
  }

  private destroy(room: WaitingRoom): void {
    this.ctx.scheduler.clearTimeout(room.expiryHandle);
    this.rooms.delete(room.code);
  }

  private broadcast(room: WaitingRoom, message: unknown): void {
    for (const member of room.members) this.sendTo(member.accountId, message);
  }

  private publicMembers(room: WaitingRoom): { username: string; ready: boolean }[] {
    return room.members.map((m) => ({ username: m.username, ready: true }));
  }

  private newCode(): string {
    const bytes = this.ctx.random(ROOM_CODE_LENGTH);
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
    return this.rooms.has(code) ? this.newCode() : code;
  }
}

export type { ClientMessage, MatchSeat };
