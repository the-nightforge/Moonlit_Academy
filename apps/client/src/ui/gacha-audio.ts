import type { CombatSettings } from "./combat-settings";

/** The gacha sound cues — one oscillator recipe each, no audio assets. */
export type GachaCue = "cast" | "impact" | "flip" | "rare" | "epic" | "legendary" | "click";

interface CueSpec {
  type: OscillatorType;
  from: number;
  to: number;
  ms: number;
  gain: number;
}

const CUES: Record<GachaCue, CueSpec> = {
  cast: { type: "sawtooth", from: 340, to: 80, ms: 430, gain: 0.07 },
  impact: { type: "triangle", from: 250, to: 80, ms: 150, gain: 0.12 },
  flip: { type: "sine", from: 470, to: 720, ms: 70, gain: 0.06 },
  rare: { type: "sine", from: 620, to: 880, ms: 170, gain: 0.09 },
  epic: { type: "triangle", from: 523, to: 1175, ms: 300, gain: 0.11 },
  legendary: { type: "triangle", from: 523, to: 1568, ms: 650, gain: 0.13 },
  click: { type: "sine", from: 330, to: 440, ms: 70, gain: 0.05 },
};

const clamp = (volume: number): number => Math.min(1, Math.max(0, volume));

/**
 * Procedural gacha audio — same approach as CombatAudio: the `AudioContext`
 * is created lazily inside `unlock()` (a user gesture) so autoplay policy
 * never blocks page load, and every failure is a silent no-op.
 */
export class GachaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private disposed = false;

  constructor(
    private settings: CombatSettings,
    private readonly makeContext?: () => AudioContext,
  ) {}

  /** Called from a pointer/key gesture; resolves even when the browser refuses. */
  async unlock(): Promise<void> {
    if (this.disposed) return;
    if (this.ctx !== null) {
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = this.makeContext !== undefined ? this.makeContext() : new AudioContext();
      const master = ctx.createGain();
      master.gain.value = clamp(this.settings.volume);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  /** Fires a cue; a no-op before unlock, under mute, or after dispose. */
  play(cue: GachaCue): void {
    const ctx = this.ctx;
    const master = this.master;
    if (this.disposed || ctx === null || master === null || this.settings.volume <= 0) return;
    try {
      const spec = CUES[cue];
      const at = ctx.currentTime;
      const end = at + spec.ms / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.from, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.to), end);
      gain.gain.setValueAtTime(spec.gain, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(end + 0.02);
    } catch {
      // A cue must never throw into the animation queue.
    }
  }

  /** Closes the context once; further calls and cues are no-ops. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx !== null) void ctx.close().catch(() => {});
  }
}
