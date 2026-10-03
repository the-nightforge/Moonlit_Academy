/**
 * Local combat presentation preferences — speed, motion and volume. These are
 * client-only: the server never sees them, and a running batch keeps the
 * settings it was created with (`16` §8.3). Persisted JSON holds only the
 * three preference fields — never gameplay state, seeds or pending actions.
 */
export interface CombatSettings {
  /** Event pacing: 2 halves every runtime duration; event order never changes. */
  speed: 1 | 2;
  /** Tint/short-fade variants replace lunges and all camera shakes. */
  reducedMotion: boolean;
  /** Master volume 0..1; 0 mutes every cue. */
  volume: number;
}

export const DEFAULT_COMBAT_SETTINGS: CombatSettings = {
  speed: 1,
  reducedMotion: false,
  volume: 0.5,
};

const STORAGE_KEY = "vongnguyet.combatSettings.v1";

const clampVolume = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_COMBAT_SETTINGS.volume;

/**
 * Reads the stored preferences. Corrupt or missing data falls back to the
 * defaults, with `prefersReducedMotion` (the OS media flag) filling the
 * reduced-motion default — an explicitly saved boolean always wins.
 */
export function loadCombatSettings(
  storage: Pick<Storage, "getItem">,
  prefersReducedMotion: boolean,
): CombatSettings {
  let raw: unknown;
  try {
    const text = storage.getItem(STORAGE_KEY);
    raw = text === null ? undefined : JSON.parse(text);
  } catch {
    raw = undefined;
  }
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    speed: record.speed === 2 ? 2 : 1,
    reducedMotion: typeof record.reducedMotion === "boolean" ? record.reducedMotion : prefersReducedMotion,
    volume: clampVolume(record.volume),
  };
}

export function saveCombatSettings(storage: Pick<Storage, "setItem">, settings: CombatSettings): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Per-action camera-shake budget: at most two shakes totaling ≤120 ms at
 * ≤0.0025 amplitude — enough to feel impacts without tiring the eye.
 * Reduced motion rejects every shake outright.
 */
export class ShakeBudget {
  private spent = 0;
  private count = 0;

  constructor(private readonly reducedMotion: boolean) {}

  allow(durationMs: number): boolean {
    if (this.reducedMotion) return false;
    if (this.count >= 2 || this.spent + durationMs > 120) return false;
    this.count += 1;
    this.spent += durationMs;
    return true;
  }
}
