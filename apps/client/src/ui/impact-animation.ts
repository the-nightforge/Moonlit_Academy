import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import { playCombatIllustration } from "./combat-illustration";

/** Kept for callers that initialized the old procedural animation registry. */
export function ensureImpactAnimations(_scene: Phaser.Scene): void {}
export const IMPACT_ANIMATIONS = { hit: "vfx:combat_effect_hit", guard: "vfx:combat_effect_guard" } as const;

/** Dedicated authored guard/hit artwork, including a stationary reduced-motion peak. */
export function impactAnimation(rt: AnimationRuntime, at: { x: number; y: number }, _color: number, guarded: boolean, power: number): Promise<void> {
  return playCombatIllustration(rt, guarded ? "effect_guard" : "effect_hit", {
    to: at, duration: 270, impactAt: 45, depth: 98, width: 170 * Math.min(1.6, power), height: 200 * Math.min(1.6, power),
  });
}
