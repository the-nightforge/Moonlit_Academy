import { flushMicrotasks } from "./helpers/async";
import { describe, expect, it, vi } from "vitest";
import type { CombatState } from "rules";
import { CombatPlayback, type PlaybackBatch, type PlaybackHooks } from "../src/ui/combat-playback";
import { deferred, fixture } from "./helpers/combat-fixture";


function batchOf(before: CombatState, round: number): PlaybackBatch {
  return { before, after: { ...before, round }, events: [] };
}

function hooksOf(overrides: Partial<PlaybackHooks> = {}) {
  return {
    play: vi.fn<PlaybackHooks["play"]>(overrides.play ?? (async () => {})),
    commit: vi.fn<PlaybackHooks["commit"]>(overrides.commit),
    busy: vi.fn<PlaybackHooks["busy"]>(overrides.busy),
    failed: vi.fn<PlaybackHooks["failed"]>(overrides.failed),
  };
}

describe("CombatPlayback", () => {
  it("plays queued batches in order and commits each after its play resolves", async () => {
    const { state } = fixture();
    const a = deferred<void>();
    const b = deferred<void>();
    const committed: number[] = [];
    const hooks = hooksOf({
      play: vi.fn().mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise),
      commit: (batch: PlaybackBatch) => committed.push(batch.after.round),
    });
    const queue = new CombatPlayback(hooks);

    queue.enqueue(batchOf(state, 1));
    queue.enqueue(batchOf(state, 2));

    expect(hooks.play.mock.calls.map(([batch]) => batch.after.round)).toEqual([1]);
    a.resolve();
    await flushMicrotasks();
    expect(hooks.play.mock.calls.map(([batch]) => batch.after.round)).toEqual([1, 2]);
    expect(committed).toEqual([1]);
    expect(queue.busy).toBe(true);
    b.resolve();
    await flushMicrotasks();
    expect(committed).toEqual([1, 2]);
    expect(queue.busy).toBe(false);
  });

  it("reset rejects the in-flight play and skips the stale commit", async () => {
    const { state } = fixture();
    const hooks = hooksOf({
      play: vi.fn().mockImplementation(
        (_batch: PlaybackBatch, signal: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    });
    const queue = new CombatPlayback(hooks);
    queue.enqueue(batchOf(state, 1));
    expect(queue.busy).toBe(true);

    queue.reset();
    await flushMicrotasks();

    expect(hooks.commit).not.toHaveBeenCalled();
    expect(hooks.failed).not.toHaveBeenCalled();
    expect(queue.busy).toBe(false);

    // The queue is usable after a reset: the next batch plays fresh.
    const next = deferred<void>();
    hooks.play.mockImplementationOnce(() => next.promise);
    queue.enqueue(batchOf(state, 2));
    await flushMicrotasks();
    expect(hooks.play.mock.calls).toHaveLength(2);
    next.resolve();
    await flushMicrotasks();
    expect(hooks.commit).toHaveBeenCalledTimes(1);
  });

  it("a rejected batch reports the error and resyncs to the latest snapshot", async () => {
    const { state } = fixture();
    const error = new Error("boom");
    const hooks = hooksOf({
      play: vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined),
    });
    const queue = new CombatPlayback(hooks);
    const first = batchOf(state, 1);
    queue.enqueue(first);
    queue.enqueue(batchOf(state, 2));
    await flushMicrotasks();

    expect(hooks.failed).toHaveBeenCalledWith(error, first.after);
    expect(hooks.commit).toHaveBeenCalledTimes(1);
    expect(hooks.commit.mock.calls[0]![0].after.round).toBe(2);
    expect(queue.busy).toBe(false);
  });

  it("defers a resize/redraw request until the queue drains", async () => {
    const { state } = fixture();
    const pending = deferred<void>();
    const hooks = hooksOf({ play: vi.fn().mockImplementation(() => pending.promise) });
    const queue = new CombatPlayback(hooks);
    queue.enqueue(batchOf(state, 1));

    const redraw = vi.fn();
    queue.whenIdle(redraw);
    expect(redraw).not.toHaveBeenCalled();

    pending.resolve();
    await flushMicrotasks();
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(queue.busy).toBe(false);
  });

  it("whenIdle runs immediately on an idle queue and busy(value) tracks the drain", async () => {
    const { state } = fixture();
    const hooks = hooksOf();
    const queue = new CombatPlayback(hooks);

    const redraw = vi.fn();
    queue.whenIdle(redraw);
    expect(redraw).toHaveBeenCalledTimes(1);

    queue.enqueue(batchOf(state, 1));
    await flushMicrotasks();
    expect(hooks.busy.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("a batch enqueued while a reset pump unwinds is not orphaned", async () => {
    const { state } = fixture();
    const a = deferred<void>();
    const b = deferred<void>();
    const committed: number[] = [];
    const hooks = hooksOf({
      play: vi.fn().mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise),
      commit: (batch: PlaybackBatch) => committed.push(batch.after.round),
    });
    const queue = new CombatPlayback(hooks);

    queue.enqueue(batchOf(state, 1)); // pump starts, play #1 awaits `a`
    queue.reset(); // epoch bump — pump will exit without draining
    queue.enqueue(batchOf(state, 2)); // enqueue sees running === true: no new pump
    a.resolve(); // play #1 settles → pump exits on the stale epoch
    await flushMicrotasks();

    // The post-reset batch is fresh work: it must play and commit, not wedge busy.
    expect(hooks.play.mock.calls.map(([batch]) => batch.after.round)).toEqual([1, 2]);
    b.resolve();
    await flushMicrotasks();
    expect(committed).toEqual([2]);
    expect(queue.busy).toBe(false);
  });

  it("dispose aborts the in-flight play and ignores later enqueues", async () => {
    const { state } = fixture();
    const signals: AbortSignal[] = [];
    const hooks = hooksOf({
      play: vi.fn().mockImplementation(
        (_batch: PlaybackBatch, signal: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            signals.push(signal);
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    });
    const queue = new CombatPlayback(hooks);
    queue.enqueue(batchOf(state, 1));
    queue.dispose();
    expect(signals[0]!.aborted).toBe(true);

    queue.enqueue(batchOf(state, 2));
    await flushMicrotasks();
    expect(hooks.play).toHaveBeenCalledTimes(1);
    expect(queue.busy).toBe(false);
  });
});
