import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import type { FrameBlend } from "./frame-blend";
import bowAtlas from "../../public/assets/vfx/combat_attack_bow_flow.json";
import ribbonAtlas from "../../public/assets/vfx/combat_attack_ribbon_flow.json";
import awakeningAtlas from "../../public/assets/vfx/awakening_f06_flow.json";

export type IllustrationMode = "improved" | "legacy";
/** Stretch the shared artwork clock, including its gameplay milestones and secondary layers. */
export const FLOW_PLAYBACK_STRETCH = 1.6;
export const ATTACK_FLOWS = {
  bow: { count: 20, columns: 5, rows: 4, atlas: bowAtlas, peak: 9, layers: ["combat_layer_bow_air", "combat_layer_bow_leaves"] },
  ribbon: { count: 24, columns: 4, rows: 6, atlas: ribbonAtlas, peak: 10, layers: ["combat_layer_ribbon_silk", "combat_layer_ribbon_petals"] },
} as const;
export const F06_FLOW = { count: 16, columns: 4, rows: 4, atlas: awakeningAtlas, peak: 7 } as const;
export function attackFlow(id: string) { return ATTACK_FLOWS[id.replace(/^attack_/, "") as keyof typeof ATTACK_FLOWS]; }

interface AsepriteAtlas {
  frames: readonly { frame: { x: number; y: number; w: number; h: number }; rotated: boolean; trimmed: boolean;
    sourceSize: { w: number; h: number }; spriteSourceSize: { x: number; y: number; w: number; h: number } }[];
  meta: { size: { w: number; h: number } };
}

/** Aseprite has already aligned and padded each cel; use its exact exported rectangles. */
export function registerFlowFrames(scene: Phaser.Scene, key: string, prefix: string,
  grid: { count: number; atlas: AsepriteAtlas }): { width: number; height: number } | null {
  if (!scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key), source = texture.getSourceImage() as { width: number; height: number };
  const { atlas } = grid, first = atlas.frames[0];
  if (!first || atlas.frames.length !== grid.count || source.width !== atlas.meta.size.w || source.height !== atlas.meta.size.h
    || typeof texture.has !== "function" || typeof texture.add !== "function") return null;
  const { w: width, h: height } = first.sourceSize;
  // Validate the whole atlas before adding anything, so a damaged export falls back cleanly.
  if (atlas.frames.some(({ frame: f, sourceSize: size, spriteSourceSize: local, rotated, trimmed }) =>
    rotated || trimmed || size.w !== width || size.h !== height || local.x !== 0 || local.y !== 0
    || local.w !== width || local.h !== height || f.w !== width || f.h !== height
    || ![f.x, f.y, f.w, f.h].every(Number.isInteger) || f.x < 0 || f.y < 0 || f.w <= 0 || f.h <= 0
    || f.x + f.w > source.width || f.y + f.h > source.height)) return null;
  atlas.frames.forEach(({ frame }, index) => {
    if (!texture.has(`${prefix}-${index}`)) texture.add(`${prefix}-${index}`, 0, frame.x, frame.y, frame.w, frame.h);
  });
  return { width, height };
}

/** Coherent authored frames: independent layers supply continuity without ghost silhouettes. */
export function createFrameSequence(rt: AnimationRuntime, key: string, prefix: string): FrameBlend {
  const view = rt.track(rt.scene.add.image(0, 0, key, `${prefix}-0`).setBlendMode("NORMAL"));
  return { view, setFrames: from => { view.setFrame(`${prefix}-${from}`); }, destroy: () => view.destroy() };
}

export function flowFrame(elapsed: number, duration: number, peakAt: number, count: number, peak: number): number {
  const time = Math.max(0, Math.min(duration, elapsed));
  return Math.min(count - 1, Math.floor(time <= peakAt ? time / Math.max(1, peakAt) * peak
    : peak + (time - peakAt) / Math.max(1, duration - peakAt) * (count - 1 - peak)));
}
