import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";

interface Point { x: number; y: number }
interface Response { x: number; y: number; alpha: number }
const responses = new WeakMap<Phaser.GameObjects.Container, Response>();

/** A newer hit, attack or death takes ownership; an older tail can no longer write. */
export function ownUnitPose(view: Phaser.GameObjects.Container) {
  finishImpactReaction(view);
  const base = { x: view.x, y: view.y, alpha: view.alpha };
  responses.set(view, base);
  return { base, current: () => responses.get(view) === base && view.active !== false,
    restore: () => { if (responses.get(view) === base) finishImpactReaction(view); } };
}

/** Hand the persistent pose back before lunge, death, reserve or revive owns it. */
export function finishImpactReaction(view: Phaser.GameObjects.Container | undefined): void {
  if (!view) return;
  const base = responses.get(view);
  if (!base) return;
  responses.delete(view);
  if (view.active !== false) { view.x = base.x; view.y = base.y; view.alpha = base.alpha; }
}

/** Full guards hold firm; damage grows in weight without moving cards out of their lane. */
export function impactResponse(hpLost: number): { distance: number; duration: number } {
  return { distance: hpLost > 0 ? Math.min(10, 3 + Math.sqrt(hpLost) * 1.5) : 0, duration: hpLost > 0 ? 105 : 75 };
}

/** Animate a proxy so overlapping hits cannot race persistent view tweens or accumulate drift. */
export async function reactToImpact(
  rt: AnimationRuntime, view: Phaser.GameObjects.Container, from: Point, to: Point, hpLost: number,
): Promise<void> {
  rt.assertActive();
  const owner = ownUnitPose(view), { base } = owner;
  const pose = { progress: 0 }, look = impactResponse(hpLost), distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  try {
    await rt.tween({ targets: pose, progress: 1, duration: look.duration, yoyo: true, ease: "Cubic.easeOut",
      onUpdate: () => {
        if (!owner.current()) return;
        view.alpha = base.alpha * (1 - pose.progress * (hpLost > 0 ? 0.22 : 0.1));
        if (!rt.reducedMotion) {
          view.x = base.x + (to.x - from.x) / distance * look.distance * pose.progress;
          view.y = base.y + (to.y - from.y) / distance * look.distance * pose.progress;
        }
      },
    });
  } finally {
    owner.restore();
  }
}
