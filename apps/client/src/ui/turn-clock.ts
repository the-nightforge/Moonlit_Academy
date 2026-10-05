/**
 * Offline player-turn clock (`combatConfig.turnSeconds`). Online modes keep the
 * server deadline instead — this class only exists for combat without a netMatch.
 * The clock pauses while input is locked or a modal is open, resets whenever the
 * status leaves `playerTurn`, and expires into an automatic `endTurn`.
 */
export class OfflineTurnClock {
  private leftMs: number | null = null;

  constructor(private readonly limitSeconds: number) {}

  /**
   * Advance one frame. `active` = the local player may act (status `playerTurn`);
   * `frozen` = input locked / modal open. Returns remaining ms while active,
   * `null` while inactive.
   */
  tick(active: boolean, frozen: boolean, deltaMs: number): number | null {
    if (!active) {
      this.leftMs = null;
      return null;
    }
    if (this.leftMs === null) this.leftMs = this.limitSeconds * 1000;
    else if (!frozen) this.leftMs = Math.max(0, this.leftMs - deltaMs);
    return this.leftMs;
  }

  /** Discard any in-progress countdown (combat restart / sync). */
  clear(): void {
    this.leftMs = null;
  }
}
