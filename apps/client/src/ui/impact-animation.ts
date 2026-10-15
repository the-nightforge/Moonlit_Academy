import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";

const SIZE = 192;
const FRAMES = 12;
const FPS = 40;
const TEXTURE = "combat-impact-frames";
export const IMPACT_ANIMATIONS = { hit: "combat-impact-hit", guard: "combat-impact-guard" } as const;

/** Finite, padded frames: every ray and shield contour stays inside its frame. */
export function ensureImpactAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE)) {
    const texture = scene.textures.createCanvas(TEXTURE, SIZE * FRAMES, SIZE * 2);
    if (!texture) return;
    const ctx = texture.getContext();
    for (let row = 0; row < 2; row++) {
      for (let frame = 0; frame < FRAMES; frame++) {
        const t = frame / (FRAMES - 1);
        const radius = 12 + 56 * (1 - Math.pow(1 - t, 3));
        ctx.save();
        ctx.translate(frame * SIZE + SIZE / 2, row * SIZE + SIZE / 2);
        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        ctx.globalAlpha = Math.pow(1 - t, 1.5);
        ctx.lineWidth = 1.5 + 4 * (1 - t);
        if (row === 1) {
          // A shield that opens into a hexagonal ward; never a rotating/cropped portrait.
          ctx.beginPath();
          ctx.moveTo(0, -radius);
          ctx.lineTo(radius * 0.8, -radius * 0.55);
          ctx.lineTo(radius * 0.66, radius * 0.4);
          ctx.quadraticCurveTo(radius * 0.4, radius * 0.78, 0, radius);
          ctx.quadraticCurveTo(-radius * 0.4, radius * 0.78, -radius * 0.66, radius * 0.4);
          ctx.lineTo(-radius * 0.8, -radius * 0.55);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          for (let ray = 0; ray < 8; ray++) {
            const angle = ray * Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * radius * 0.48, Math.sin(angle) * radius * 0.48);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.stroke();
          }
        }
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 * (1 - t) + 1);
        glow.addColorStop(0, "#fff");
        glow.addColorStop(1, "#fff0");
        ctx.fillStyle = glow;
        ctx.fillRect(-32, -32, 64, 64);
        ctx.restore();
        texture.add(row * FRAMES + frame, 0, frame * SIZE, row * SIZE, SIZE, SIZE);
      }
    }
    texture.refresh();
  }
  for (const [row, key] of Object.values(IMPACT_ANIMATIONS).entries()) {
    if (!scene.anims.exists(key)) scene.anims.create({
      key, frames: scene.anims.generateFrameNumbers(TEXTURE, { start: row * FRAMES, end: (row + 1) * FRAMES - 1 }),
      frameRate: FPS, repeat: 0, hideOnComplete: true,
    });
  }
}

/** Uses the runtime's speed and lifecycle. Reduced motion keeps the existing soft fade. */
export function impactAnimation(rt: AnimationRuntime, at: { x: number; y: number }, color: number, guarded: boolean, power: number): void {
  if (rt.reducedMotion) return;
  ensureImpactAnimations(rt.scene);
  if (!rt.scene.textures.exists(TEXTURE)) return;
  const sprite = rt.track(rt.scene.add.sprite(at.x, at.y, TEXTURE)
    .setDepth(98).setBlendMode("ADD").setTint(color).setScale(0.7 * Math.min(1.6, power)));
  void rt.play(sprite, IMPACT_ANIMATIONS[guarded ? "guard" : "hit"]).then(() => sprite.destroy(), () => sprite.destroy());
}
