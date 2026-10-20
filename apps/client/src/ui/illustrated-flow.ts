import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import type { FrameBlend } from "./frame-blend";

export type IllustrationMode = "improved" | "legacy";
/** Stretch the shared artwork clock, including its gameplay milestones and secondary layers. */
export const FLOW_PLAYBACK_STRETCH = 1.6;
export const ATTACK_FLOWS = {
  bow: { count: 20, columns: 5, rows: 4, offsetX: -20, offsetY: 0, peak: 9, layers: ["combat_layer_bow_air", "combat_layer_bow_leaves"] },
  ribbon: { count: 24, columns: 4, rows: 6, offsetX: 10, offsetY: 32, peak: 10, layers: ["combat_layer_ribbon_silk", "combat_layer_ribbon_petals"] },
} as const;
export const F06_FLOW = { count: 16, columns: 4, rows: 4, peak: 7 } as const;
export function attackFlow(id: string) { return ATTACK_FLOWS[id.replace(/^attack_/, "") as keyof typeof ATTACK_FLOWS]; }

/** Shift authored framing, then retain clipped padding in one uniform virtual cell. */
export function registerFlowFrames(scene: Phaser.Scene, key: string, prefix: string,
  grid: { count: number; columns: number; rows: number; offsetX?: number; offsetY?: number }): { width: number; height: number } | null {
  if (!scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key), source = texture.getSourceImage() as { width: number; height: number };
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < grid.columns || source.height < grid.rows
    || ![2 / 3, 3 / 2].includes(source.width / source.height)
    || typeof texture.has !== "function" || typeof texture.add !== "function") return null;
  const width = Math.ceil(source.width / grid.columns), height = Math.ceil(source.height / grid.rows);
  const clampX = (value: number) => Math.max(0, Math.min(source.width, value));
  const clampY = (value: number) => Math.max(0, Math.min(source.height, value));
  for (let index = 0; index < grid.count; index++) {
    const col = index % grid.columns, row = Math.floor(index / grid.columns);
    const nominalLeft = Math.round(col * source.width / grid.columns) + (grid.offsetX ?? 0);
    const nominalTop = Math.round(row * source.height / grid.rows) + (grid.offsetY ?? 0);
    const left = clampX(nominalLeft), top = clampY(nominalTop);
    const right = clampX(Math.round((col + 1) * source.width / grid.columns) + (grid.offsetX ?? 0));
    const bottom = clampY(Math.round((row + 1) * source.height / grid.rows) + (grid.offsetY ?? 0));
    if (!texture.has(`${prefix}-${index}`)) {
      const frame = texture.add(`${prefix}-${index}`, 0, left, top, right - left, bottom - top);
      // Native Frame keeps source pixels at their unclipped offset and Image uses
      // realWidth/realHeight for its origin, so edge cells cannot recenter or stretch.
      frame?.setTrim?.(width, height, left - nominalLeft, top - nominalTop, right - left, bottom - top);
    }
  }
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
