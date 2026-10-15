import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { AnimationAbortedError, createAnimationRuntime } from "../src/ui/animation-runtime";

function fixture(speed: 1 | 2 = 1) {
  const controller = new AbortController();
  const emitter = new EventEmitter();
  const play = vi.fn();
  const stop = vi.fn(() => emitter.emit("animationstop"));
  const sprite = Object.assign(emitter, { play, anims: { stop, chain: vi.fn() } }) as unknown as Phaser.GameObjects.Sprite;
  const scene = { anims: { get: (key: string) => key === "missing" ? undefined : { repeat: key === "infinite" ? -1 : 0 } } } as unknown as Phaser.Scene;
  const runtime = createAnimationRuntime(scene, controller.signal, { speed, reducedMotion: false, volume: 0 });
  return { controller, emitter, play, stop, sprite, runtime };
}

describe("finite sprite animation runtime", () => {
  it("waits for the named animation completion and drains with it", async () => {
    const { runtime, sprite, emitter, play } = fixture();
    let done = false;
    const animation = runtime.play(sprite, "impact").then(() => { done = true; });
    const drained = runtime.drain();
    emitter.emit("animationcomplete-other");
    await Promise.resolve();
    expect(done).toBe(false);
    expect(play).toHaveBeenCalledWith({ key: "impact", timeScale: 1 });
    emitter.emit("animationcomplete-impact");
    await animation;
    await drained;
    expect(done).toBe(true);
    expect(emitter.eventNames()).toEqual([]);
    runtime.dispose();
  });

  it("sets speed per sprite without changing the global definition", async () => {
    const { runtime, sprite, emitter, play } = fixture(2);
    const animation = runtime.play(sprite, "impact");
    expect(play).toHaveBeenCalledWith({ key: "impact", timeScale: 2 });
    emitter.emit("animationcomplete-impact");
    await animation;
    runtime.dispose();
  });

  it("abort stops playback, rejects pending work and removes listeners", async () => {
    const { runtime, sprite, emitter, controller, stop } = fixture();
    const result = runtime.play(sprite, "impact").catch(error => error);
    controller.abort();
    expect(await result).toBeInstanceOf(AnimationAbortedError);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(emitter.eventNames()).toEqual([]);
    await runtime.drain();
  });

  it.each(["animationstop", "destroy"])("an unexpected %s settles the queue", async event => {
    const { runtime, sprite, emitter } = fixture();
    const result = runtime.play(sprite, "impact").catch(error => error);
    emitter.emit(event);
    expect(await result).toBeInstanceOf(AnimationAbortedError);
    expect(emitter.eventNames()).toEqual([]);
    await runtime.drain();
    runtime.dispose();
  });

  it("completion before abort does not stop an already completed sprite", async () => {
    const { runtime, sprite, emitter, controller, stop } = fixture();
    const animation = runtime.play(sprite, "impact");
    emitter.emit("animationcomplete-impact");
    await animation;
    controller.abort();
    expect(stop).not.toHaveBeenCalled();
  });

  it("refuses missing or infinitely repeating definitions instead of hanging drain", () => {
    const { runtime, sprite, play } = fixture();
    expect(() => runtime.play(sprite, "missing")).toThrow(/finite/i);
    expect(() => runtime.play(sprite, "infinite")).toThrow(/finite/i);
    expect(play).not.toHaveBeenCalled();
    runtime.dispose();
  });
});
