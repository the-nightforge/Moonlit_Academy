/**
 * Offline player-turn clock (`combatConfig.turnSeconds`). Online modes keep the
 * server deadline instead — this class only exists for combat without a netMatch.
 * The clock pauses while input is locked or a modal is open, resets whenever the
 * observed turn key changes (a committed snapshot never exposes `enemyTurn` — the
 * whole enemy turn resolves inside one `applyAction`), and expires into an
 * automatic `endTurn`.
 */
export class OfflineTurnClock {
  private leftMs: number | null = null;
  private turnKey: string | null = null;

  constructor(private readonly limitSeconds: number) {}

  /**
   * Advance one frame. `turnKey` identifies the current decision window — null
   * while the player may not act (mulligan aside, the caller passes
   * `round:activePlayer` for `playerTurn`/`choosing`, so a Chiêm Bài pause keeps
   * the same clock like the server deadline does). Returns remaining ms while
   * active, `null` while inactive.
   */
  tick(turnKey: string | null, frozen: boolean, deltaMs: number): number | null {
    if (turnKey === null) {
      this.leftMs = null;
      this.turnKey = null;
      return null;
    }
    if (this.turnKey !== turnKey) {
      this.turnKey = turnKey;
      this.leftMs = this.limitSeconds * 1000;
    } else if (!frozen) {
      this.leftMs = Math.max(0, (this.leftMs ?? this.limitSeconds * 1000) - deltaMs);
    }
    return this.leftMs;
  }

  /** Discard any in-progress countdown (combat restart / sync). */
  clear(): void {
    this.leftMs = null;
    this.turnKey = null;
  }
}
