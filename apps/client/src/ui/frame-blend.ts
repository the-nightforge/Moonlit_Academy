import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";

const blendModes = new WeakMap<object, number>();

/** Phaser's built-in WebGL ADD uses DST_ALPHA, which is not linear RGBA addition. */
function offscreenBlend(scene: Phaser.Scene): number | string {
  const renderer = scene.game?.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
  if (!renderer?.gl) return "ADD"; // Canvas ADD is the standard premultiplied 'lighter'.
  let mode = blendModes.get(renderer);
  if (mode === undefined || !renderer.blendModes[mode]) {
    const gl = renderer.gl;
    // Use the actual appended slot: Phaser 4.2.1 addBlendMode returns the preceding index.
    mode = renderer.blendModes.length;
    renderer.addBlendMode([gl.ONE, gl.ONE], gl.FUNC_ADD);
    blendModes.set(renderer, mode);
  }
  return mode;
}

export interface FrameBlend {
  readonly view: Phaser.GameObjects.Image | Phaser.GameObjects.RenderTexture;
  setFrames(from: number, to: number, mix: number): void;
  destroy(): void;
}

/**
 * Interpolate premultiplied artwork RGBA against transparent offscreen pixels,
 * then source-over the result once onto the field. Dark ink remains dark.
 * No artwork is generated here: only two existing authored cells are composited.
 */
export function createFrameBlend(rt: AnimationRuntime, key: string, width: number, height: number, prefix: string): FrameBlend {
  const owned: Phaser.GameObjects.GameObject[] = [];
  const own = <T extends Phaser.GameObjects.GameObject>(node: T): T => { owned.push(node); return rt.track(node); };
  try {
    if (typeof rt.scene.add.renderTexture !== "function") {
      const view = own(rt.scene.add.image(0, 0, key, `${prefix}-0`).setBlendMode("NORMAL"));
      return { view, setFrames: (from, to, mix) => { view.setFrame(`${prefix}-${mix < .5 ? from : to}`); },
        destroy: () => owned.forEach(node => node.destroy()) };
    }
    const view = own(rt.scene.add.renderTexture(0, 0, width, height).setOrigin(.5).setBlendMode("NORMAL"));
    const mode = offscreenBlend(rt.scene);
    const cells = [0, 1].map(() => own(rt.scene.add.image(width / 2, height / 2, key, `${prefix}-0`)
      .setBlendMode(mode).removeFromDisplayList()));
    return { view,
      setFrames: (from, to, value) => {
        const mix = Math.max(0, Math.min(1, value));
        cells[0]!.setFrame(`${prefix}-${from}`).setAlpha(1 - mix);
        cells[1]!.setFrame(`${prefix}-${to}`).setAlpha(mix);
        // Phaser 4 records draw commands; commit before the next frame changes the cells.
        view.clear().draw(cells).render();
      },
      destroy: () => owned.forEach(node => node.destroy()),
    };
  } catch (error) { owned.forEach(node => node.destroy()); throw error; }
}
