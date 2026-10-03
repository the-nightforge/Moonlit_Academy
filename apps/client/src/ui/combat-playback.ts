import type { CombatEvent, CombatState } from "rules";
import type { PublicPlayedCard } from "../net/protocol";

/** One event batch to animate: the state it renders from and to, plus its events. */
export interface PlaybackBatch {
  before: CombatState;
  after: CombatState;
  events: CombatEvent[];
  eventSeq?: number;
  /** Cast-time card metadata from the server (`16` §8.2) — online batches only. */
  revealedCards?: Record<string, PublicPlayedCard>;
}

export interface PlaybackHooks {
  /** Animates the batch; resolves when the beat is done (abort → reject). */
  play(batch: PlaybackBatch, signal: AbortSignal): Promise<void>;
  /** Commits the batch's `after` state once its play finished. */
  commit(batch: PlaybackBatch): void;
  /** Queue busy state changed — the scene locks/unlocks input from it. */
  busy(value: boolean): void;
  /** A batch's play failed for real: report and resync to `latest`. */
  failed(error: unknown, latest: CombatState): void;
}

/**
 * Serializes playback: pushes and local actions enqueue a batch each, plays
 * them FIFO and commits `after` only when the play fully resolved — a slow
 * batch can no longer overwrite a newer one, and input opens only after the
 * queue drains. `reset`/`dispose` bump the epoch so a stale completion can
 * never commit into the new state.
 */
export class CombatPlayback {
  private queue: PlaybackBatch[] = [];
  private idleCallbacks: (() => void)[] = [];
  private epoch = 0;
  private controller: AbortController | null = null;
  private running = false;
  private wasBusy = false;
  private disposed = false;

  constructor(private readonly hooks: PlaybackHooks) {}

  get busy(): boolean {
    return this.running || this.queue.length > 0;
  }

  enqueue(batch: PlaybackBatch): void {
    if (this.disposed) return;
    this.queue.push(batch);
    void this.pump().catch((error) => console.error("combat playback pump:", error));
  }

  /** Runs `callback` once the queue drains — immediately when already idle (resize, redraw). */
  whenIdle(callback: () => void): void {
    if (!this.busy) {
      callback();
      return;
    }
    this.idleCallbacks.push(callback);
  }

  /** Drops queued batches and aborts the in-flight play (rejoin, restart, shutdown). */
  reset(): void {
    this.epoch += 1;
    this.queue.length = 0;
    this.controller?.abort();
    this.controller = null;
  }

  dispose(): void {
    this.disposed = true;
    this.idleCallbacks.length = 0;
    this.reset();
  }

  private setBusy(value: boolean): void {
    if (value === this.wasBusy) return;
    this.wasBusy = value;
    this.hooks.busy(value);
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.setBusy(true);
    const epoch = this.epoch;
    try {
      while (this.queue.length > 0 && epoch === this.epoch) {
        const batch = this.queue.shift()!;
        const controller = (this.controller = new AbortController());
        try {
          await this.hooks.play(batch, controller.signal);
          if (epoch === this.epoch) this.hooks.commit(batch);
        } catch (error) {
          if (epoch === this.epoch) this.hooks.failed(error, batch.after);
        }
      }
    } finally {
      this.controller = null;
      this.running = false;
      // A batch enqueued while this pump unwound (post-reset) must not orphan.
      if (this.queue.length > 0 && !this.disposed) {
        void this.pump().catch((error) => console.error("combat playback pump:", error));
        return;
      }
      this.setBusy(false);
      const callbacks = this.idleCallbacks.splice(0);
      for (const callback of callbacks) callback();
    }
  }
}
