import type { NetMatch } from "./match";
import type { MatchSettlement, MatchSnapshot, ServerMessage } from "./protocol";

/**
 * Retained network matches (`16` §8.4): a match lives here independently of the
 * combat scene, so pushes and settlement still land while the player is in the
 * lobby or a different screen. Settled matchIds stay tombstoned until logout —
 * late duplicate frames are absorbed instead of reaching a scene handler.
 */
export class MatchRegistry {
  /** Live matches by id — usually zero or one, but a stale match can linger. */
  private readonly matches = new Map<string, NetMatch>();
  /** Settled matchIds absorbed until `dispose` — duplicate frames never leak. */
  private readonly tombstones = new Set<string>();
  /** `rejoin` consumed this once already; the scene reads it via `consumeLostPending`. */
  private readonly lostPending = new Map<string, boolean>();

  constructor(
    private readonly onSettled: (matchId: string, settlement: MatchSettlement) => Promise<void>,
    /** Pushes a player-facing notice line (session.notices). */
    private readonly notify: (text: string) => void = () => {},
  ) {}

  /** Tracks a match the account is (or was) seated in. Tombstoned ids never come back. */
  retain(match: NetMatch): void {
    if (this.tombstones.has(match.matchId)) return;
    this.matches.set(match.matchId, match);
  }

  /**
   * Routes a match-scoped frame (`16` §8.4): retained matches receive it
   * (including `match.snapshot` answers), tombstoned and unknown match traffic
   * is absorbed, and `match.start`/`match.snapshot` for unknown matches passes
   * through to the scene handler. Returns true when the frame was consumed.
   */
  handle(message: ServerMessage): boolean {
    if (!("matchId" in message)) return false;
    const matchId = message.matchId;
    if (this.tombstones.has(matchId)) return true;
    const match = this.matches.get(matchId);
    if (match === undefined) {
      return message.type !== "match.start" && message.type !== "match.snapshot";
    }
    if (message.type === "match.start") return false; // lobby navigation owns it
    match.handle(message);
    if (match.ended !== null) void this.settle(match);
    return true;
  }

  /**
   * `welcome` reconciliation, before the scene's `onRecovery`: the retained
   * match named by `activeMatch` rejoins exactly once (the scene only renders
   * the reconciled view); every other pending retained id gets a `match.sync`.
   */
  recover(snapshot: MatchSnapshot | null): void {
    const match = snapshot === null || this.tombstones.has(snapshot.matchId) ? undefined : this.matches.get(snapshot.matchId);
    if (snapshot !== null && match !== undefined) {
      this.lostPending.set(match.matchId, match.rejoin(snapshot));
      if (match.ended !== null) void this.settle(match);
    }
    for (const retained of this.matches.values()) {
      if (retained.matchId !== snapshot?.matchId) retained.requestSync();
    }
  }

  /**
   * Whether the last `recover` dropped an unconfirmed action for `matchId`.
   * Read once — the flag is consumed so the notice cannot repeat.
   */
  consumeLostPending(matchId: string): boolean {
    const lost = this.lostPending.get(matchId) ?? false;
    this.lostPending.delete(matchId);
    return lost;
  }

  /** Terminal-processed: tombstone the id so no later frame reaches a scene. */
  release(matchId: string): void {
    this.matches.delete(matchId);
    this.lostPending.delete(matchId);
    this.tombstones.add(matchId);
  }

  /** Logout — no entry of the old account may leak into the next session. */
  dispose(): void {
    this.matches.clear();
    this.tombstones.clear();
    this.lostPending.clear();
  }

  /**
   * Settles a finished match exactly once: `complete` goes through `onSettled`
   * (profile refresh + notice); `failed` only notifies — the result stands,
   * the rewards did not.
   */
  private async settle(match: NetMatch): Promise<void> {
    if (this.tombstones.has(match.matchId)) return;
    this.release(match.matchId);
    if (match.settlement.status === "failed") {
      this.notify("Không nhận được thông tin thưởng; hồ sơ sẽ được cập nhật lại.");
      return;
    }
    try {
      await this.onSettled(match.matchId, match.ended!);
    } catch (error) {
      console.error("settle failed:", error);
      this.notify("Không nhận được thông tin thưởng; hồ sơ sẽ được cập nhật lại.");
    }
  }
}
