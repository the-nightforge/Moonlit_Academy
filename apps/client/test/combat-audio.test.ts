import { describe, expect, it } from "vitest";
import { CombatAudio } from "../src/ui/combat-audio";
import type { CombatSettings } from "../src/ui/combat-settings";

const ON: CombatSettings = { speed: 1, reducedMotion: false, volume: 0.5 };
const MUTED: CombatSettings = { speed: 1, reducedMotion: false, volume: 0 };

class FakeParam {
  value = 0;
  readonly calls: number[] = [];
  setValueAtTime(value: number) {
    this.calls.push(value);
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    this.calls.push(value);
    this.value = value;
  }
}

class FakeNode {
  readonly connected: unknown[] = [];
  connect(node: unknown) {
    this.connected.push(node);
    return node as this;
  }
}

class FakeOsc extends FakeNode {
  type = "";
  readonly frequency = new FakeParam();
  starts = 0;
  stops = 0;
  start() {
    this.starts++;
  }
  stop() {
    this.stops++;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeContext {
  readonly oscillators: FakeOsc[] = [];
  readonly gains: FakeGain[] = [];
  readonly destination = {};
  readonly sampleRate = 44100;
  state = "suspended";
  currentTime = 0;
  resumeCalls = 0;
  closeCalls = 0;
  constructor(private readonly failResume = false) {}
  createOscillator() {
    const node = new FakeOsc();
    this.oscillators.push(node);
    return node;
  }
  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.failResume) return Promise.reject(new Error("autoplay blocked"));
    this.state = "running";
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closeCalls++;
    this.state = "closed";
    return Promise.resolve();
  }
}

function harness(settings: CombatSettings = ON, failResume = false) {
  const context = new FakeContext(failResume);
  const audio = new CombatAudio(settings, () => context as unknown as AudioContext);
  return { audio, context };
}

describe("CombatAudio", () => {
  it("creates no context before the user gesture", async () => {
    let made = 0;
    const audio = new CombatAudio(ON, () => {
      made++;
      return new FakeContext() as unknown as AudioContext;
    });
    audio.play("hit");
    expect(made).toBe(0);
    await audio.unlock();
    expect(made).toBe(1);
    await audio.unlock();
    expect(made).toBe(1);
  });

  it("plays an oscillator per cue once unlocked", async () => {
    const { audio, context } = await (async () => {
      const pair = harness();
      await pair.audio.unlock();
      return pair;
    })();
    audio.play("hit");
    expect(context.oscillators.length).toBe(1);
    expect(context.oscillators[0]!.starts).toBe(1);
    audio.play("cast");
    expect(context.oscillators.length).toBe(2);
  });

  it("swallows an autoplay rejection without an unhandled rejection", async () => {
    const { audio, context } = harness(ON, true);
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect(context.resumeCalls).toBe(1);
    // The rejected context is dropped — cues stay silently no-ops.
    audio.play("hit");
    expect(context.oscillators.length).toBe(0);
  });

  it("mute creates no oscillators", async () => {
    const { audio, context } = harness(MUTED);
    await audio.unlock();
    audio.play("hit");
    audio.play("death");
    expect(context.oscillators.length).toBe(0);
  });

  it("clamps the volume to 0..1 on configure", async () => {
    const { audio, context } = harness();
    await audio.unlock();
    audio.configure({ ...ON, volume: 7 });
    expect(context.gains[0]!.gain.value).toBe(1);
    audio.configure({ ...ON, volume: -3 });
    expect(context.gains[0]!.gain.value).toBe(0);
  });

  it("re-configuring to mute stops new nodes", async () => {
    const { audio, context } = harness();
    await audio.unlock();
    audio.configure(MUTED);
    audio.play("hit");
    expect(context.oscillators.length).toBe(0);
  });

  it("a terminal cue plays once across repeated calls", async () => {
    const { audio, context } = harness();
    await audio.unlock();
    audio.play("victory");
    audio.play("victory");
    audio.play("defeat");
    expect(context.oscillators.length).toBe(1);
  });

  it("disposes exactly once and stays silent afterwards", async () => {
    const { audio, context } = harness();
    await audio.unlock();
    audio.dispose();
    audio.dispose();
    expect(context.closeCalls).toBe(1);
    audio.play("hit");
    expect(context.oscillators.length).toBe(0);
    // A disposed audio never re-creates a context on unlock.
    await audio.unlock();
    expect(context.state).toBe("closed");
    expect(context.closeCalls).toBe(1);
  });
});
