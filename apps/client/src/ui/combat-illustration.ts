import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import { createFrameBlend } from "./frame-blend";
import type { FrameBlend } from "./frame-blend";
import { attackFlow, createFrameSequence, FLOW_PLAYBACK_STRETCH, flowPosition, registerFlowFrames } from "./illustrated-flow";
import type { IllustrationMode } from "./illustrated-flow";

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
  illustrationMode?: IllustrationMode;
}

/** Partition only recognized authored effect atlases; portraits remain whole. */
export function registerCombatFrames(scene: Phaser.Scene, key: string): { width: number; height: number } | null {
  if (!/^vfx:combat_(attack|effect)_/.test(key) || !scene.textures.exists(key)) return null;
  if (key.endsWith("_flow")) {
    const flow = attackFlow(key.replace("vfx:combat_", "").replace(/_flow$/, ""));
    return flow ? registerFlowFrames(scene, key, "combat", flow) : null;
  }
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

/** The authored peak cell and gameplay milestone share one elapsed-time clock. */
export async function playCombatIllustration(rt: AnimationRuntime, id: string, options: CombatIllustrationOptions): Promise<void> {
  rt.assertActive();
  const duration = Math.max(1, options.duration);
  const impactAt = Math.max(0, Math.min(duration, options.impactAt ?? duration * 3 / 7));
  const candidate = options.illustrationMode !== "legacy" ? attackFlow(id) : undefined;
  const flowKey = `vfx:combat_${id}_flow`, flowBounds = candidate ? registerCombatFrames(rt.scene, flowKey) : null;
  const flow = flowBounds ? candidate : undefined;
  const interpolate = flow && "interpolate" in flow && flow.interpolate && !rt.reducedMotion;
  const key = flow ? flowKey : `vfx:combat_${id}`, frame = flowBounds ?? registerCombatFrames(rt.scene, key);
  const rotation = options.rotation ?? (options.from ? Math.atan2(options.to.y - options.from.y, options.to.x - options.from.x) : 0);
  let art: FrameBlend | undefined;
  const layers: Phaser.GameObjects.Image[] = [];
  let impacted = false;
  const clock = { elapsed: 0 };
  try {
    if (frame) {
      art = flow && !interpolate ? createFrameSequence(rt, key, "combat") : createFrameBlend(rt, key, frame.width, frame.height, "combat");
      if (flow && "anchor" in flow) art.view.setOrigin(flow.anchor.x / frame.width, flow.anchor.y / frame.height);
      art.view.setDepth(options.depth ?? 97).setAlpha(0);
      if (flow && !rt.reducedMotion) for (const stem of flow.layers) {
        const layerKey = `vfx:${stem}`;
        if (!rt.scene.textures.exists(layerKey)) continue;
        const image = rt.track(rt.scene.add.image(0, 0, layerKey).setDepth((options.depth ?? 97) + .1).setAlpha(0));
        const source = rt.scene.textures.get(layerKey).getSourceImage() as { width: number; height: number };
        image.setScale(Math.min((options.width ?? 220) / source.width, (options.height ?? 260) / source.height));
        layers.push(image);
      }
    }
    const scale = frame ? Math.min((options.width ?? 220) / frame.width, (options.height ?? 260) / frame.height) : 1;
    const update = () => {
      rt.assertActive();
      const elapsed = Math.max(0, Math.min(duration, clock.elapsed));
      const position = rt.reducedMotion ? 3 : elapsed <= impactAt
        ? (impactAt === 0 ? 3 : elapsed / impactAt * 3)
        : 3 + (elapsed - impactAt) / Math.max(1, duration - impactAt) * 4;
      const fade = Math.min(1, elapsed / Math.min(65, duration / 4), (duration - elapsed) / Math.min(130, duration / 3));
      const travel = Math.min(1, elapsed / Math.max(1, impactAt));
      const defaultPose = options.from ? { x: options.from.x + (options.to.x - options.from.x) * travel,
        y: options.from.y + (options.to.y - options.from.y) * travel } : options.to;
      const pose: CombatPose = rt.reducedMotion ? options.to : options.motion ? options.motion(elapsed) : defaultPose;
      if (art) {
        const coherent = flow ? rt.reducedMotion ? flow.peak : flowPosition(elapsed, duration, impactAt, flow.count, flow.peak) : position;
        const fromFrame = Math.floor(coherent), nextFrame = Math.min((flow?.count ?? 8) - 1, fromFrame + 1);
        // Bow's rigid pixels are identical in all Aseprite cels: only the feathers/wake dissolve.
        art.setFrames(fromFrame, flow && !interpolate ? fromFrame : nextFrame, flow && !interpolate ? 0 : coherent - fromFrame);
        art.view
          .setPosition(pose.x, pose.y).setRotation(rt.reducedMotion ? rotation : (pose.rotation ?? rotation))
          .setScale(scale * (rt.reducedMotion ? 1 : (pose.scale ?? 1)))
          .setAlpha(Math.max(0, fade));
      }
      layers.forEach((layer, index) => {
        const delay = index === 0 ? 24 : 76, local = Math.max(0, elapsed - delay);
        const lag = options.motion ? options.motion(local) : options.from ? {
          x: options.from.x + (options.to.x - options.from.x) * Math.min(1, local / Math.max(1, impactAt)),
          y: options.from.y + (options.to.y - options.from.y) * Math.min(1, local / Math.max(1, impactAt)),
        } : options.to;
        const tail = Math.max(0, (elapsed - impactAt) / Math.max(1, duration - impactAt));
        const side = id === "attack_bow" ? 0 : Math.sin(local / duration * Math.PI * (index + 1)) * (index ? 20 : 9);
        const drift = tail * (index ? 25 : 10);
        layer.setPosition(lag.x - Math.sin(rotation) * side + Math.cos(rotation) * drift,
          lag.y + Math.cos(rotation) * side + Math.sin(rotation) * drift)
          .setRotation(rotation + (id === "attack_bow" ? 0 : (index ? -.16 : .08) * Math.sin(local / duration * Math.PI * 2)))
          .setAlpha(Math.max(0, Math.min(1, local / 90, (duration - elapsed) / (index ? 180 : 140))) * (index ? .72 : .58));
      });
      options.onUpdate?.(elapsed);
      if (!impacted && elapsed >= impactAt) {
        impacted = true;
        options.onImpact?.();
      }
    };
    update();
    // Keep authored phase coordinates intact; slow their one shared clock instead.
    const playbackDuration = duration * (flow && !rt.reducedMotion ? FLOW_PLAYBACK_STRETCH : 1);
    await rt.tween({ targets: clock, elapsed: duration, duration: playbackDuration, ease: "Linear", onUpdate: update });
    clock.elapsed = duration;
    update();
  } finally {
    art?.destroy();
    layers.forEach(layer => layer.destroy());
  }
}
