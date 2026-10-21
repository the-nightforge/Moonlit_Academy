import type Phaser from "phaser";
import type { AttackKind, AttackLook } from "./attack-style";
import type { AnimationRuntime } from "./animation-runtime";
import { playCombatIllustration } from "./combat-illustration";
import type { CombatPoint as Point } from "./combat-illustration";
import { impactAnimation } from "./impact-animation";
import { ownUnitPose } from "./impact-reaction";
import type { IllustrationMode } from "./illustrated-flow";

/** These small authored textures also dress the persistent combat scene. */
export const GLOW = "vfx:combat_glow";
export const STAR = "vfx:combat_star";
export const VIGNETTE = "vfx:combat_vignette";
/** Assets are supplied by the normal combat manifest; never draw substitute artwork. */
export function ensureTextures(_scene: Phaser.Scene): void {}

interface AttackMotion {
  duration: number; impactAt: number; anticipation: number; arc: number; sway: number;
  turn: number; reach: number; size: number; local?: boolean;
}
/** Timing, trajectory, silhouette and recovery all belong to the weapon's authored sheet. */
export const ATTACK_MOTION: Record<AttackKind, AttackMotion> = {
  slash:    { duration: 410, impactAt: 95, anticipation: 28, arc: -14, sway: 0, turn: -.34, reach: 27, size: 245, local: true },
  spear:    { duration: 480, impactAt: 155, anticipation: 55, arc: 0, sway: 0, turn: 0, reach: 34, size: 260 },
  darts:    { duration: 590, impactAt: 270, anticipation: 50, arc: -12, sway: 9, turn: .14, reach: 5, size: 200 },
  bow:      { duration: 640, impactAt: 310, anticipation: 70, arc: 0, sway: 0, turn: 0, reach: -5, size: 237 },
  herb:     { duration: 750, impactAt: 360, anticipation: 100, arc: 28, sway: 14, turn: -.25, reach: 3, size: 240 },
  fan:      { duration: 680, impactAt: 295, anticipation: 85, arc: -24, sway: -10, turn: .45, reach: 9, size: 265 },
  ink:      { duration: 720, impactAt: 330, anticipation: 110, arc: -18, sway: 18, turn: -.18, reach: 7, size: 250 },
  music:    { duration: 790, impactAt: 375, anticipation: 90, arc: 0, sway: 19, turn: .1, reach: 2, size: 275 },
  ribbon:   { duration: 830, impactAt: 340, anticipation: 75, arc: 42, sway: -24, turn: -.42, reach: 12, size: 290 },
  fire:     { duration: 700, impactAt: 290, anticipation: 105, arc: -8, sway: 5, turn: .2, reach: 15, size: 275 },
  star:     { duration: 860, impactAt: 410, anticipation: 150, arc: -65, sway: 22, turn: .55, reach: 0, size: 280 },
  moon:     { duration: 800, impactAt: 365, anticipation: 130, arc: -48, sway: -8, turn: -.35, reach: 4, size: 275 },
  talisman: { duration: 760, impactAt: 350, anticipation: 140, arc: 18, sway: 26, turn: .28, reach: 6, size: 245 },
  blood:    { duration: 740, impactAt: 315, anticipation: 80, arc: -30, sway: -18, turn: -.2, reach: 11, size: 270 },
  spell:    { duration: 810, impactAt: 390, anticipation: 160, arc: 14, sway: 12, turn: .38, reach: 1, size: 285 },
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export interface AttackOptions {
  blocked: boolean;
  attackerView?: Phaser.GameObjects.Container;
  runtime: AnimationRuntime;
  onImpact?: () => void;
  illustrationMode?: IllustrationMode;
}

/** The attack, gameplay milestone and card pose use one clock; promise includes the tail. */
export async function playAttack(look: AttackLook, from: Point, to: Point, opts: AttackOptions): Promise<void> {
  const rt = opts.runtime;
  rt.assertActive();
  const profile = ATTACK_MOTION[look.kind], angle = Math.atan2(to.y - from.y, to.x - from.x);
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const dx = (to.x - from.x) / distance, dy = (to.y - from.y) / distance;
  const view = opts.attackerView, owner = view ? ownUnitPose(view) : undefined;
  let impactTail = Promise.resolve();
  try {
    await playCombatIllustration(rt, `attack_${look.kind}`, {
      from, to, duration: profile.duration, impactAt: profile.impactAt, width: profile.size, height: profile.size,
      rotation: angle,
      illustrationMode: opts.illustrationMode,
      motion: elapsed => {
        const flight = smooth((elapsed - profile.anticipation) / (profile.impactAt - profile.anticipation));
        const tail = smooth((elapsed - profile.impactAt) / (profile.duration - profile.impactAt));
        const start = profile.local ? { x: to.x - dx * 45, y: to.y - dy * 45 } : from;
        const bend = Math.sin(flight * Math.PI) * profile.arc + Math.sin(flight * Math.PI * 2) * profile.sway;
        return { x: start.x + (to.x - start.x) * flight - dy * bend + dx * tail * 8,
          y: start.y + (to.y - start.y) * flight + dx * bend + dy * tail * 8,
          rotation: angle + profile.turn * (1 - flight), scale: look.kind === "bow" ? 1 : .82 + .18 * flight - .04 * tail };
      },
      onUpdate: elapsed => {
        if (!view || !owner?.current() || rt.reducedMotion) return;
        const windup = smooth(elapsed / profile.anticipation);
        const strike = smooth((elapsed - profile.anticipation) / (profile.impactAt - profile.anticipation));
        const recover = smooth((elapsed - profile.impactAt) / Math.min(190, profile.duration - profile.impactAt));
        const step = (-4 * windup + (profile.reach + 4) * strike) * (1 - recover);
        view.x = owner.base.x + dx * step; view.y = owner.base.y + dy * step;
      },
      onImpact: () => {
        // A callback failure rejects the illustration through AnimationRuntime.tween.
        opts.onImpact?.();
        impactTail = impactAnimation(rt, to, look.color, opts.blocked, 1, opts.illustrationMode);
        void impactTail.catch(() => {});
        if (!rt.reducedMotion) rt.shake(45, opts.blocked ? .0008 : .0015);
      },
    });
    await impactTail;
  } finally { owner?.restore(); }
}

export type SupportEffect = "hit" | "guard" | "heal" | "armor" | "armor_break" | "status_apply" | "status_remove" | "death" | "blood_moon" | "cast" | "moon_shift" | "reflect";
export function playSupportEffect(rt: AnimationRuntime, kind: SupportEffect, at: Point, duration = 500, illustrationMode?: IllustrationMode): Promise<void> {
  return playCombatIllustration(rt, `effect_${kind}`, { to: at, duration, impactAt: Math.min(150, duration * 3 / 7), width: 250, height: 280, illustrationMode,
    motion: elapsed => ({ x: at.x, y: at.y - Math.sin(elapsed / duration * Math.PI) * (kind === "heal" ? 14 : 4), scale: .94 + .06 * Math.sin(elapsed / duration * Math.PI) }) });
}
export function healBloom(rt: AnimationRuntime, at: Point, illustrationMode?: IllustrationMode): Promise<void> { return playSupportEffect(rt, "heal", at, 560, illustrationMode); }
export function armorWard(rt: AnimationRuntime, at: Point, removed = false, illustrationMode?: IllustrationMode): Promise<void> { return playSupportEffect(rt, removed ? "armor_break" : "armor", at, removed ? 450 : 520, illustrationMode); }

/** The clone is owned for the whole finite cast, including cancellation. */
export async function castCard(rt: AnimationRuntime, view: Phaser.GameObjects.Container, stage: Point, _color: number, target?: Point, illustrationMode?: IllustrationMode): Promise<void> {
  rt.assertActive(); rt.track(view);
  const from = { x: view.x, y: view.y }, alpha = view.alpha;
  view.parentContainer?.bringToTop(view);
  try {
    await playCombatIllustration(rt, "effect_cast", { from: stage, to: target ?? stage, duration: 570, impactAt: 250, width: 250, height: 280, illustrationMode,
      motion: elapsed => { const p = smooth((elapsed - 220) / 200); return { x: stage.x + ((target?.x ?? stage.x) - stage.x) * p, y: stage.y + ((target?.y ?? stage.y) - stage.y) * p }; },
      onUpdate: elapsed => {
        if (view.active === false) return;
        if (!rt.reducedMotion) { const p = smooth(elapsed / 220); view.x = from.x + (stage.x - from.x) * p; view.y = from.y + (stage.y - from.y) * p; }
        view.alpha = alpha * (1 - smooth((elapsed - 240) / 170));
      },
    });
  } finally { view.destroy(); }
}

/** The selected real moon icon settles into its badge; no synthetic wheel ornaments. */
export async function moonWheel(rt: AnimationRuntime, stage: Point, badge: Point, phaseIds: readonly string[], _from: number, to: number, _color = 0xf4d35e, ms = 550, illustrationMode?: IllustrationMode): Promise<void> {
  rt.assertActive();
  const key = `ui:moon_${phaseIds[to]}`, icon = rt.scene.textures.exists(key) ? rt.track(rt.scene.add.image(stage.x, stage.y, key).setDepth(99).setAlpha(0)) : undefined;
  if (icon) { const source = icon.texture?.getSourceImage?.() as { width?: number; height?: number } | undefined; icon.setScale(Math.min(42 / (source?.width || 42), 42 / (source?.height || 42))); }
  try {
    await playCombatIllustration(rt, "effect_moon_shift", { to: badge, duration: ms, impactAt: ms * .58, width: 280, height: 300, illustrationMode,
      motion: elapsed => { const p = smooth((elapsed / ms - .3) / .7); return { x: stage.x + (badge.x - stage.x) * p, y: stage.y + (badge.y - stage.y) * p }; },
      onUpdate: elapsed => {
        if (!icon) return;
        const p = rt.reducedMotion ? 1 : smooth((elapsed / ms - .3) / .7);
        icon.setPosition(stage.x + (badge.x - stage.x) * p, stage.y + (badge.y - stage.y) * p)
          .setAlpha(Math.min(1, elapsed / 90, (ms - elapsed) / 90));
      },
    });
  } finally { icon?.destroy(); }
}

export async function statusPop(rt: AnimationRuntime, at: Point, iconKey: string, _color: number, removed = false, illustrationMode?: IllustrationMode): Promise<void> {
  rt.assertActive();
  const pos = { x: at.x, y: at.y - 30 }, icon = rt.scene.textures.exists(iconKey) ? rt.track(rt.scene.add.image(pos.x, pos.y, iconKey).setDepth(99).setAlpha(0)) : undefined;
  if (icon) { const source = icon.texture?.getSourceImage?.() as { width?: number; height?: number } | undefined; icon.setScale(Math.min(34 / (source?.width || 34), 34 / (source?.height || 34))); }
  try {
    await playCombatIllustration(rt, removed ? "effect_status_remove" : "effect_status_apply", { to: pos, duration: 420, impactAt: 150, width: 170, height: 190, illustrationMode,
      onUpdate: elapsed => { icon?.setAlpha(Math.min(1, elapsed / 70, (420 - elapsed) / 160)); },
    });
  } finally { icon?.destroy(); }
}

export async function deathBurn(rt: AnimationRuntime, view: Phaser.GameObjects.Container | undefined, at: Point, boss = false, illustrationMode?: IllustrationMode): Promise<void> {
  rt.assertActive();
  const owner = view ? ownUnitPose(view) : undefined, duration = boss ? 820 : 650;
  try {
    await playCombatIllustration(rt, "effect_death", { to: at, duration, impactAt: duration * .4, width: boss ? 320 : 250, height: boss ? 350 : 300, illustrationMode,
      onUpdate: elapsed => { if (!view || !owner?.current()) return; const p = Math.sin(elapsed / duration * Math.PI); view.alpha = owner.base.alpha * (1 - .35 * p); if (!rt.reducedMotion) view.y = owner.base.y - p * 9; },
    });
  } finally { owner?.restore(); }
}
export function bloodMoonSurge(rt: AnimationRuntime, at: Point, illustrationMode?: IllustrationMode): Promise<void> {
  return playCombatIllustration(rt, "effect_blood_moon", { to: at, duration: 760, impactAt: 250, width: 300, height: 320, illustrationMode,
    onImpact: () => { if (!rt.reducedMotion) rt.shake(60, .0015); },
    motion: elapsed => ({ x: at.x, y: at.y, scale: .9 + .1 * Math.sin(elapsed / 760 * Math.PI) }),
  });
}
export function reflectStrike(rt: AnimationRuntime, from: Point, to: Point, illustrationMode?: IllustrationMode): Promise<void> {
  const duration = 590, impactAt = 290, angle = Math.atan2(to.y - from.y, to.x - from.x);
  return playCombatIllustration(rt, "effect_reflect", { from, to, duration, impactAt, width: 245, height: 260, rotation: angle, illustrationMode,
    motion: elapsed => { const p = smooth((elapsed - 85) / (impactAt - 85)); return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p }; },
  });
}
