import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import { createFrameBlend } from "./frame-blend";
import type { FrameBlend } from "./frame-blend";

export interface CombatPoint { x: number; y: number }
export interface CombatPose extends CombatPoint { rotation?: number; scale?: number }
export interface CombatIllustrationOptions {
  to: CombatPoint;
  from?: CombatPoint;
  duration: number;
  impactAt?: number;
  onImpact?: () => void;
  width?: number;
  height?: number;
  rotation?: number;
  depth?: number;
  /** Authored art is moved as a whole, never stretched or drawn by code. */
  motion?: (elapsed: number) => CombatPose;
  /** Shares the illustration clock with the persistent unit's anticipation/recovery. */
  onUpdate?: (elapsed: number) => void;
}

/** Only authored four-by-two effect atlases are partitioned; portraits remain whole. */
export function registerCombatFrames(scene: Phaser.Scene, key: string): { width: number; height: number } | null {
  if (!/^vfx:combat_(attack|effect)_/.test(key) || !scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as { width: number; height: number };
  if (!source.width || !source.height || source.width % 4 || source.height % 2
    || source.width * 2 !== source.height * 3 || typeof texture.has !== "function" || typeof texture.add !== "function") return null;
  const width = source.width / 4, height = source.height / 2;
  for (let i = 0; i < 8; i++) {
    const name = `combat-${i}`;
    if (!texture.has(name)) texture.add(name, 0, i % 4 * width, Math.floor(i / 4) * height, width, height);
  }
  return { width, height };
}

/** Peak cell three and the gameplay milestone share one elapsed-time clock. */
export async function playCombatIllustration(rt: AnimationRuntime, id: string, options: CombatIllustrationOptions): Promise<void> {
  rt.assertActive();
  const duration = Math.max(1, options.duration);
  const impactAt = Math.max(0, Math.min(duration, options.impactAt ?? duration * 3 / 7));
  const key = `vfx:combat_${id}`, frame = registerCombatFrames(rt.scene, key);
  const rotation = options.rotation ?? (options.from ? Math.atan2(options.to.y - options.from.y, options.to.x - options.from.x) : 0);
  let art: FrameBlend | undefined;
  let impacted = false;
  const clock = { elapsed: 0 };
  try {
    if (frame) {
      art = createFrameBlend(rt, key, frame.width, frame.height, "combat");
      art.view.setDepth(options.depth ?? 97).setAlpha(0);
    }
    const scale = frame ? Math.min((options.width ?? 220) / frame.width, (options.height ?? 260) / frame.height) : 1;
    const update = () => {
      rt.assertActive();
      const elapsed = Math.max(0, Math.min(duration, clock.elapsed));
      const position = rt.reducedMotion ? 3 : elapsed <= impactAt
        ? (impactAt === 0 ? 3 : elapsed / impactAt * 3)
        : 3 + (elapsed - impactAt) / Math.max(1, duration - impactAt) * 4;
      const cell = Math.min(7, Math.floor(position)), mix = position - cell;
      const fade = Math.min(1, elapsed / Math.min(65, duration / 4), (duration - elapsed) / Math.min(130, duration / 3));
      const travel = Math.min(1, elapsed / Math.max(1, impactAt));
      const defaultPose = options.from ? { x: options.from.x + (options.to.x - options.from.x) * travel,
        y: options.from.y + (options.to.y - options.from.y) * travel } : options.to;
      const pose: CombatPose = rt.reducedMotion ? options.to : options.motion ? options.motion(elapsed) : defaultPose;
      if (art) {
        art.setFrames(cell, Math.min(7, cell + 1), mix);
        art.view
          .setPosition(pose.x, pose.y).setRotation(rt.reducedMotion ? rotation : (pose.rotation ?? rotation))
          .setScale(scale * (rt.reducedMotion ? 1 : (pose.scale ?? 1)))
          .setAlpha(Math.max(0, fade));
      }
      options.onUpdate?.(elapsed);
      if (!impacted && elapsed >= impactAt) {
        impacted = true;
        options.onImpact?.();
      }
    };
    update();
    await rt.tween({ targets: clock, elapsed: duration, duration, ease: "Linear", onUpdate: update });
    clock.elapsed = duration;
    update();
  } finally {
    art?.destroy();
  }
}
