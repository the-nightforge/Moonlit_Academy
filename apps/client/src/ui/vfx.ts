import type Phaser from "phaser";
import type { AttackLook } from "./attack-style";

/**
 * Attack VFX by weapon style. Textures are drawn on canvases at runtime (no
 * asset files); motion is tweens + particles. Each attack resolves once the
 * hit has landed; sparks and embers keep fading after that.
 */

interface Point {
  x: number;
  y: number;
}

const DEPTH = 97;
/** Textures are drawn at 2× and shown at half scale, so they stay sharp under the zoomed camera. */
const TEX = 2;
const S = 1 / TEX;
const BLOCKED_COLOR = 0x9fd4ff;

const GLOW = "vfx_glow";
const RING = "vfx_ring";
const SPARK = "vfx_spark";
const SLASH = "vfx_slash";
const THRUST = "vfx_thrust";
const DART = "vfx_dart";
const ARROW = "vfx_arrow";
const BOW = "vfx_bow";
const LEAF = "vfx_leaf";
const RUNE = "vfx_rune";

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, w * TEX, h * TEX);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.scale(TEX, TEX);
  draw(ctx);
  texture.refresh();
}

function linear(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function ensureTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, GLOW, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  canvasTexture(scene, RING, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.62, "rgba(255,255,255,0)");
    g.addColorStop(0.84, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  // Tapered streak, bright head on the right: rotate to the travel angle.
  canvasTexture(scene, SPARK, 40, 6, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 40, 0, [[0, "rgba(255,255,255,0)"], [0.75, "rgba(255,255,255,0.85)"], [1, "#fff"]]);
    ctx.beginPath();
    ctx.ellipse(20, 3, 20, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Crescent blade trail: thick in the middle, fading to points at both ends.
  canvasTexture(scene, SLASH, 256, 96, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 256, 0, [
      [0, "rgba(255,255,255,0)"],
      [0.3, "rgba(255,255,255,0.7)"],
      [0.62, "#fff"],
      [1, "rgba(255,255,255,0)"],
    ]);
    ctx.beginPath();
    ctx.moveTo(6, 72);
    ctx.quadraticCurveTo(128, -34, 250, 72);
    ctx.quadraticCurveTo(128, 12, 6, 72);
    ctx.closePath();
    ctx.fill();
  });
  // Spear thrust: a long spike, widest just behind the point.
  canvasTexture(scene, THRUST, 200, 16, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 200, 0, [[0, "rgba(255,255,255,0)"], [0.7, "rgba(255,255,255,0.85)"], [1, "#fff"]]);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(168, 2);
    ctx.lineTo(200, 8);
    ctx.lineTo(168, 14);
    ctx.closePath();
    ctx.fill();
  });
  // Kunai-like throwing dart, point on the right.
  canvasTexture(scene, DART, 24, 8, (ctx) => {
    ctx.strokeStyle = "#6a7290";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(2.4, 4, 1.8, 0, Math.PI * 2);
    ctx.moveTo(4.2, 4);
    ctx.lineTo(9, 4);
    ctx.stroke();
    ctx.fillStyle = linear(ctx, 0, 0, 0, 8, [[0, "#ffffff"], [0.5, "#c8d2ec"], [1, "#6a7290"]]);
    ctx.beginPath();
    ctx.moveTo(24, 4);
    ctx.lineTo(14, 0.6);
    ctx.lineTo(8.6, 4);
    ctx.lineTo(14, 7.4);
    ctx.closePath();
    ctx.fill();
  });
  canvasTexture(scene, ARROW, 60, 10, (ctx) => {
    ctx.fillStyle = "#c8945a";
    ctx.fillRect(8, 4.3, 42, 1.4);
    ctx.fillStyle = linear(ctx, 0, 0, 0, 10, [[0, "#ffffff"], [0.5, "#d6deef"], [1, "#7480a0"]]);
    ctx.beginPath();
    ctx.moveTo(60, 5);
    ctx.lineTo(49, 1.2);
    ctx.lineTo(51, 5);
    ctx.lineTo(49, 8.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e05050";
    ctx.beginPath();
    ctx.moveTo(0, 0.8);
    ctx.lineTo(11, 4.4);
    ctx.lineTo(5, 4.4);
    ctx.closePath();
    ctx.moveTo(0, 9.2);
    ctx.lineTo(11, 5.6);
    ctx.lineTo(5, 5.6);
    ctx.closePath();
    ctx.fill();
  });
  // Longbow facing right (toward the target), string on the left.
  canvasTexture(scene, BOW, 34, 76, (ctx) => {
    ctx.strokeStyle = "rgba(245,236,210,0.9)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(8, 72);
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2a1404";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.quadraticCurveTo(46, 38, 8, 72);
    ctx.stroke();
    ctx.strokeStyle = linear(ctx, 0, 0, 34, 0, [[0, "#8a4a1a"], [0.6, "#d89a58"], [1, "#f0c890"]]);
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(24, 33, 4, 10);
    for (const y of [4, 72]) {
      ctx.beginPath();
      ctx.arc(8, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  canvasTexture(scene, LEAF, 22, 12, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 12, [[0, "#e2ffd8"], [0.5, "#7fe07f"], [1, "#2c8a44"]]);
    ctx.beginPath();
    ctx.moveTo(1, 6);
    ctx.quadraticCurveTo(11, -2, 21, 6);
    ctx.quadraticCurveTo(11, 14, 1, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(16,58,28,0.6)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.lineTo(19, 6);
    ctx.stroke();
  });
  // Spell sigil: double ring, 12 ticks, 4 diamonds — white, tinted per spell.
  canvasTexture(scene, RUNE, 64, 64, (ctx) => {
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(32 + 22 * Math.cos(a), 32 + 22 * Math.sin(a));
      ctx.lineTo(32 + (i % 3 ? 26 : 29) * Math.cos(a), 32 + (i % 3 ? 26 : 29) * Math.sin(a));
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const x = 32 + 29 * Math.cos(a);
      const y = 32 + 29 * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 3, y);
      ctx.closePath();
      ctx.fill();
    }
  });
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((resolve) => scene.time.delayedCall(ms, resolve));

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

function addFx(scene: Phaser.Scene, at: Point, key: string): Phaser.GameObjects.Image {
  return scene.add.image(at.x, at.y, key).setBlendMode("ADD").setDepth(DEPTH);
}

/** Fades `obj` out and destroys it; fire-and-forget. */
function fadeOut(scene: Phaser.Scene, obj: Phaser.GameObjects.Image, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) {
  scene.tweens.add({ targets: obj, alpha: 0, ...config, onComplete: () => obj.destroy() });
}

/** A glowing trail behind a moving object; returns a stop function. */
function trail(scene: Phaser.Scene, follow: Phaser.GameObjects.Image, color: number, size = 0.1): () => void {
  const emitter = scene.add
    .particles(0, 0, GLOW, {
      follow,
      frequency: 14,
      lifespan: 180,
      scale: { start: size * S, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: color,
      blendMode: "ADD",
    })
    .setDepth(DEPTH - 1);
  return () => {
    emitter.stop();
    scene.time.delayedCall(220, () => emitter.destroy());
  };
}

/** Flash, shockwave ring, sparks thrown along `angle`, falling embers. */
function impact(scene: Phaser.Scene, at: Point, color: number, angle: number, power = 1): void {
  const flash = addFx(scene, at, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(scene, flash, { scale: 1.5 * power * S, duration: 260, ease: "Cubic.easeOut" });
  const core = addFx(scene, at, GLOW).setScale(0.2 * S);
  fadeOut(scene, core, { scale: 0.7 * power * S, duration: 150 });
  const ring = addFx(scene, at, RING).setTint(color).setScale(0.3 * S).setAlpha(0.9);
  fadeOut(scene, ring, { scale: 1.9 * power * S, duration: 340, ease: "Cubic.easeOut" });

  const count = Math.round(10 * power);
  for (let i = 0; i < count; i++) {
    const a = i < count * 0.6 ? angle + rand(-0.8, 0.8) : rand(0, Math.PI * 2);
    const dist = rand(36, 100) * power;
    const spark = addFx(scene, at, SPARK)
      .setTint(i % 3 ? color : 0xffffff)
      .setRotation(a)
      .setScale(rand(0.5, 0.9) * S, S);
    fadeOut(scene, spark, {
      x: at.x + Math.cos(a) * dist,
      y: at.y + Math.sin(a) * dist,
      scaleX: 0.1 * S,
      duration: rand(240, 400),
      ease: "Cubic.easeOut",
    });
  }

  const embers = scene.add
    .particles(at.x, at.y, GLOW, {
      speed: { min: 50, max: 140 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 450, max: 750 },
      scale: { start: 0.15 * S, end: 0 },
      gravityY: 280,
      tint: color,
      blendMode: "ADD",
      emitting: false,
    })
    .setDepth(DEPTH);
  embers.explode(Math.round(8 * power));
  scene.time.delayedCall(800, () => embers.destroy());
  scene.cameras.main.shake(80 + 40 * power, 0.0025 * power);
}

/** The attacker's card steps toward the target and back. */
function lunge(scene: Phaser.Scene, view: Phaser.GameObjects.Container | undefined, from: Point, to: Point, reach: number, ms: number) {
  if (!view) return;
  scene.tweens.add({
    targets: view,
    x: from.x + (to.x - from.x) * reach,
    y: from.y + (to.y - from.y) * reach,
    duration: ms,
    yoyo: true,
    ease: "Cubic.easeOut",
  });
}

export interface AttackOptions {
  /** Hit fully absorbed by armor: the impact turns shield-blue. */
  blocked: boolean;
  /** The attacker's card, stepped forward on melee hits (heroes only; enemies lunge on their intent). */
  attackerView?: Phaser.GameObjects.Container;
}

/** Plays one hit from `from` to `to` in the given look; resolves when it lands. */
export function playAttack(scene: Phaser.Scene, look: AttackLook, from: Point, to: Point, opts: AttackOptions): Promise<void> {
  ensureTextures(scene);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const hitColor = opts.blocked ? BLOCKED_COLOR : look.color;
  switch (look.kind) {
    case "slash":
      return slash(scene, from, to, look.color, hitColor, angle, opts.attackerView);
    case "spear":
      return thrust(scene, from, to, look.color, hitColor, angle, opts.attackerView);
    case "darts":
      return darts(scene, from, to, look.color, hitColor, angle);
    case "bow":
      return bow(scene, from, to, look.color, hitColor, angle);
    case "herb":
      return herb(scene, from, to, look.color, hitColor, angle);
    case "spell":
      return spell(scene, from, to, look.color, hitColor, angle);
    default: {
      const never: never = look.kind;
      return never;
    }
  }
}

async function slash(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number, view?: Phaser.GameObjects.Container) {
  lunge(scene, view, from, to, 0.16, 110);
  if (view) await wait(scene, 90);
  const rot = rand(-0.85, -0.35);
  const blade = [
    addFx(scene, to, SLASH).setTint(color).setRotation(rot).setScale(0.2 * S, S),
    addFx(scene, to, SLASH).setRotation(rot).setScale(0.2 * S, 0.45 * S),
  ];
  impact(scene, to, hitColor, angle);
  await tween(scene, { targets: blade, scaleX: 1.1 * S, rotation: rot + 0.18, duration: 110, ease: "Cubic.easeOut" });
  await tween(scene, { targets: blade, alpha: 0, scaleY: 0.15 * S, duration: 220, ease: "Sine.easeIn" });
  blade.forEach((b) => b.destroy());
}

async function thrust(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number, view?: Phaser.GameObjects.Container) {
  lunge(scene, view, from, to, 0.24, 120);
  if (view) await wait(scene, 70);
  const start = { x: from.x + Math.cos(angle) * 40, y: from.y + Math.sin(angle) * 40 };
  const length = Math.hypot(to.x - start.x, to.y - start.y) + 50;
  const shafts = [
    addFx(scene, start, THRUST).setOrigin(0, 0.5).setTint(color).setRotation(angle).setScale(0, 1.4 * S),
    addFx(scene, start, THRUST).setOrigin(0, 0.5).setRotation(angle).setScale(0, 0.55 * S),
  ];
  await tween(scene, { targets: shafts, scaleX: (length / 200) * S, duration: 110, ease: "Cubic.easeOut" });
  impact(scene, to, hitColor, angle, 1.25);
  shafts.forEach((s) => fadeOut(scene, s, { scaleY: 0.1 * S, duration: 200 }));
  await wait(scene, 160);
}

async function darts(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number) {
  const perp = angle + Math.PI / 2;
  const throws = [-12, 0, 12].map(async (offset, i) => {
    await wait(scene, i * 70);
    const start = { x: from.x + Math.cos(perp) * offset, y: from.y + Math.sin(perp) * offset };
    const end = { x: to.x + Math.cos(perp) * offset * 0.5, y: to.y + Math.sin(perp) * offset * 0.5 };
    const dart = scene.add.image(start.x, start.y, DART).setRotation(angle).setScale(1.1 * S).setDepth(DEPTH);
    const stop = trail(scene, dart, color, 0.07);
    await tween(scene, { targets: dart, x: end.x, y: end.y, duration: 190 });
    stop();
    dart.destroy();
    impact(scene, end, hitColor, angle, i === 2 ? 0.9 : 0.5);
  });
  await Promise.all(throws);
  await wait(scene, 80);
}

async function bow(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const at = { x: from.x + dx * 34, y: from.y + dy * 34 };
  const bowImg = scene.add.image(at.x, at.y, BOW).setRotation(angle).setScale(0).setDepth(DEPTH);
  const arrow = scene.add.image(at.x, at.y, ARROW).setOrigin(0.8, 0.5).setRotation(angle).setScale(S).setAlpha(0).setDepth(DEPTH + 1);
  const glow = addFx(scene, at, GLOW).setTint(color).setScale(0.3 * S).setAlpha(0);
  await tween(scene, { targets: bowImg, scale: S, duration: 110, ease: "Back.easeOut" });
  // Draw: the arrow nocks and pulls back, the bow bends, light gathers.
  arrow.setAlpha(1);
  await Promise.all([
    tween(scene, { targets: arrow, x: at.x - dx * 14, y: at.y - dy * 14, duration: 180, ease: "Sine.easeOut" }),
    tween(scene, { targets: bowImg, scaleX: 0.82 * S, duration: 180, ease: "Sine.easeOut" }),
    tween(scene, { targets: glow, alpha: 0.9, scale: 0.7 * S, duration: 180 }),
  ]);
  // Release.
  scene.tweens.add({ targets: bowImg, scaleX: S, duration: 140, ease: "Back.easeOut" });
  fadeOut(scene, bowImg, { delay: 140, duration: 220 });
  fadeOut(scene, glow, { scale: 1.2 * S, duration: 200 });
  const stop = trail(scene, arrow, color, 0.12);
  const flight = Math.max(160, Math.hypot(to.x - at.x, to.y - at.y) * 0.75);
  await tween(scene, { targets: arrow, x: to.x, y: to.y, duration: flight, ease: "Quad.easeIn" });
  stop();
  impact(scene, to, hitColor, angle, 1.1);
  fadeOut(scene, arrow, { duration: 160 });
  await wait(scene, 90);
}

async function herb(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number) {
  const perp = angle + Math.PI / 2;
  const leaves = [0, 1, 2].map(() => scene.add.image(from.x, from.y, LEAF).setScale(S).setDepth(DEPTH));
  const heart = addFx(scene, from, GLOW).setTint(color).setScale(0.45 * S);
  const stop = trail(scene, heart, color, 0.1);
  const path = { t: 0 };
  await tween(scene, {
    targets: path,
    t: 1,
    duration: 420,
    ease: "Sine.easeInOut",
    onUpdate: () => {
      const t = path.t;
      const cx = from.x + (to.x - from.x) * t;
      const cy = from.y + (to.y - from.y) * t;
      heart.setPosition(cx, cy);
      leaves.forEach((leaf, i) => {
        const swirl = t * Math.PI * 4 + (i * Math.PI * 2) / 3;
        const r = 18 * (1 - t * 0.7);
        leaf.setPosition(cx + Math.cos(perp) * Math.cos(swirl) * r + Math.cos(angle) * Math.sin(swirl) * r * 0.5,
          cy + Math.sin(perp) * Math.cos(swirl) * r + Math.sin(angle) * Math.sin(swirl) * r * 0.5);
        leaf.setRotation(swirl);
      });
    },
  });
  stop();
  heart.destroy();
  leaves.forEach((leaf, i) => {
    const a = angle + (i - 1) * 0.9;
    scene.tweens.add({
      targets: leaf,
      x: to.x + Math.cos(a) * 40,
      y: to.y + Math.sin(a) * 40 + 20,
      rotation: leaf.rotation + 3,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => leaf.destroy(),
    });
  });
  impact(scene, to, hitColor, angle, 0.9);
  await wait(scene, 100);
}

async function spell(scene: Phaser.Scene, from: Point, to: Point, color: number, hitColor: number, angle: number) {
  const cast = addFx(scene, from, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(scene, cast, { scale: 0.9 * S, duration: 300 });
  const sigil = addFx(scene, to, RUNE).setTint(color).setScale(0.4 * S).setAlpha(0);
  await tween(scene, { targets: sigil, alpha: 1, scale: 1.2 * S, rotation: 1.2, duration: 240, ease: "Cubic.easeOut" });
  impact(scene, to, hitColor, angle, 1.1);
  fadeOut(scene, sigil, { scale: 1.6 * S, rotation: 1.8, duration: 220 });
  await wait(scene, 120);
}
