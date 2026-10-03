import type { CombatSettings } from "./combat-settings";

/** The combat sound cues — one oscillator recipe each, no audio assets. */
export type CombatCue =
  | "cast"
  | "hit"
  | "block"
  | "heal"
  | "death"
  | "moon"
  | "levelUp"
  | "victory"
  | "defeat"
  | "draw";

interface CueSpec {
  type: OscillatorType;
  from: number;
  to: number;
  ms: number;
  gain: number;
}

const CUES: Record<CombatCue, CueSpec> = {
  cast: { type: "sine", from: 440, to: 880, ms: 180, gain: 0.12 },
  hit: { type: "square", from: 200, to: 70, ms: 110, gain: 0.14 },
  block: { type: "triangle", from: 320, to: 240, ms: 100, gain: 0.1 },
  heal: { type: "sine", from: 520, to: 780, ms: 220, gain: 0.1 },
  death: { type: "sawtooth", from: 220, to: 55, ms: 500, gain: 0.12 },
  moon: { type: "sine", from: 660, to: 990, ms: 320, gain: 0.08 },
  levelUp: { type: "triangle", from: 523, to: 1046, ms: 350, gain: 0.12 },
  victory: { type: "triangle", from: 523, to: 1568, ms: 700, gain: 0.14 },
  defeat: { type: "sawtooth", from: 196, to: 65, ms: 800, gain: 0.12 },
  draw: { type: "sine", from: 330, to: 440, ms: 90, gain: 0.06 },
};

const TERMINAL: ReadonlySet<CombatCue> = new Set<CombatCue>(["victory", "defeat", "draw"]);

const clamp = (volume: number): number => Math.min(1, Math.max(0, volume));

/**
 * Procedural combat audio: tiny oscillator envelopes through one master gain.
 * The `AudioContext` is created lazily inside `unlock()` — i.e. only inside a
 * user gesture — so autoplay policy never blocks page load. Every failure is
 * a silent no-op; the game must never crash because a cue couldn't play.
 *
 * A terminal cue (`victory`/`defeat`/`draw`) plays at most once per instance:
 * a `combatEnded` beat and a later terminal recovery frame share the same
 * instance, so the sting never repeats when `match.end` arrives (`16` §8.2).
 */
export class CombatAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: CombatSettings;
  private terminalPlayed = false;
  private disposed = false;

  constructor(
    settings: CombatSettings,
    private readonly makeContext?: () => AudioContext,
  ) {
    this.settings = settings;
  }

  /**
   * Called from a pointer/key gesture. Creates the context once and resumes
   * it; resolves even when the browser refuses (graceful silence).
   */
  async unlock(): Promise<void> {
    if (this.disposed) return;
    // A context that refused its first resume stays suspended — a later gesture
    // retries it instead of never unlocking.
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
      // Autoplay refusal or a dead context — drop it and stay silent.
      this.ctx = null;
      this.master = null;
    }
  }

  /** New preferences take effect immediately for later cues. */
  configure(settings: CombatSettings): void {
    this.settings = settings;
    if (this.master !== null) this.master.gain.value = clamp(settings.volume);
  }

  /** Fires a cue; a no-op before unlock, under mute, or after dispose. */
  play(cue: CombatCue): void {
    const ctx = this.ctx;
    const master = this.master;
    if (this.disposed || ctx === null || master === null || this.settings.volume <= 0) return;
    if (TERMINAL.has(cue)) {
      if (this.terminalPlayed) return;
      this.terminalPlayed = true;
    }
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
