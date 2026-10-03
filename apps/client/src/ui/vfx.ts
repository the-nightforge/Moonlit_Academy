import type Phaser from "phaser";
import type { AttackLook } from "./attack-style";
import type { AnimationRuntime } from "./animation-runtime";

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

export const GLOW = "vfx_glow";
const RING = "vfx_ring";
const SPARK = "vfx_spark";
const SLASH = "vfx_slash";
const THRUST = "vfx_thrust";
const DART = "vfx_dart";
const ARROW = "vfx_arrow";
const BOW = "vfx_bow";
const LEAF = "vfx_leaf";
const RUNE = "vfx_rune";
const WAVE = "vfx_wave";
const BEAM = "vfx_beam";
export const STAR = "vfx_star";
const CRESCENT = "vfx_crescent";
const BRUSH = "vfx_brush";
const TALISMAN = "vfx_talisman";

function canvasTexture(
  sc: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (sc.textures.exists(key)) return;
  const texture = sc.textures.createCanvas(key, w * TEX, h * TEX);
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

export function ensureTextures(scene: Phaser.Scene): void {
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
  // Sound wave: an arc bulging toward +x.
  canvasTexture(scene, WAVE, 24, 64, (ctx) => {
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-26, 32, 42, -0.62, 0.62);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-31, 32, 42, -0.55, 0.55);
    ctx.stroke();
  });
  // Moonbeam pillar: bright core, soft sides, brightest near the top.
  canvasTexture(scene, BEAM, 32, 128, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 32, 0, [
      [0, "rgba(255,255,255,0)"],
      [0.38, "rgba(255,255,255,0.7)"],
      [0.5, "#fff"],
      [0.62, "rgba(255,255,255,0.7)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    ctx.fillRect(0, 0, 32, 128);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = linear(ctx, 0, 0, 0, 128, [[0, "rgba(255,255,255,0.4)"], [0.2, "#fff"], [1, "rgba(255,255,255,0.5)"]]);
    ctx.fillRect(0, 0, 32, 128);
  });
  canvasTexture(scene, STAR, 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(12, 1);
    ctx.lineTo(13.6, 10.4);
    ctx.lineTo(23, 12);
    ctx.lineTo(13.6, 13.6);
    ctx.lineTo(12, 23);
    ctx.lineTo(10.4, 13.6);
    ctx.lineTo(1, 12);
    ctx.lineTo(10.4, 10.4);
    ctx.closePath();
    ctx.fill();
  });
  canvasTexture(scene, CRESCENT, 48, 48, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, Math.PI * 2);
    ctx.arc(32, 18, 17, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  });
  // Calligraphy stroke: a heavy press on the left, dry bristles trailing right.
  canvasTexture(scene, BRUSH, 128, 24, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.quadraticCurveTo(6, 2, 22, 4);
    ctx.quadraticCurveTo(70, 7, 124, 11);
    ctx.quadraticCurveTo(72, 16, 22, 20);
    ctx.quadraticCurveTo(6, 22, 4, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.8;
    for (const [y, end] of [[6, 96], [9, 118], [15, 110], [18, 84]] as const) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(end, 11 + (y - 12) * 0.3);
      ctx.stroke();
    }
  });
  // Paper talisman (bùa): yellow paper, red frame and glyph — drawn in color, never tinted.
  canvasTexture(scene, TALISMAN, 14, 30, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 30, [[0, "#fffbe6"], [0.5, "#f2dc8a"], [1, "#c8a24a"]]);
    ctx.fillRect(0, 0, 14, 30);
    ctx.strokeStyle = "#c03040";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(1.5, 1.5, 11, 27);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(4.5, 6);
    ctx.lineTo(9.5, 6);
    ctx.moveTo(7, 4.5);
    ctx.lineTo(7, 11);
    ctx.moveTo(4.5, 9);
    ctx.lineTo(9.5, 9);
    ctx.moveTo(7, 13);
    ctx.lineTo(7, 21);
    ctx.moveTo(4.5, 16);
    ctx.lineTo(9.5, 16);
    ctx.moveTo(4.5, 21);
    ctx.lineTo(7, 19);
    ctx.lineTo(9.5, 21);
    ctx.stroke();
    ctx.fillStyle = "#d03a4a";
    ctx.fillRect(5, 24, 4, 3);
  });
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Reduced motion thins particle showers — fewer motes, same silhouette. */
const moteScale = (rt: AnimationRuntime): number => (rt.reducedMotion ? 0.4 : 1);
const moteCount = (rt: AnimationRuntime, n: number): number => Math.max(1, Math.round(n * moteScale(rt)));

/** Temporary FX sprite: the runtime destroys it when the batch aborts. */
function addFx(rt: AnimationRuntime, at: Point, key: string): Phaser.GameObjects.Image {
  return rt.track(rt.scene.add.image(at.x, at.y, key).setBlendMode("ADD").setDepth(DEPTH));
}

/** Fades `obj` out and destroys it; fire-and-forget (killed early on abort). */
function fadeOut(rt: AnimationRuntime, obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) {
  rt.track(obj);
  void rt.tween({ targets: obj, alpha: 0, ...config, onComplete: () => obj.destroy() });
}

/** Destroys `obj` after `ms` on the scene clock — or immediately if the scope is already dead. */
function destroyLater(rt: AnimationRuntime, obj: Phaser.GameObjects.GameObject, ms: number): void {
  try {
    void rt.wait(ms).then(
      () => obj.destroy(),
      () => obj.destroy(),
    );
  } catch {
    obj.destroy();
  }
}

/** A glowing trail behind a moving object; returns a stop function. */
function trail(rt: AnimationRuntime, follow: Phaser.GameObjects.Image, color: number, size = 0.1): () => void {
  const emitter = rt.track(
    rt.scene.add
      .particles(0, 0, GLOW, {
        follow,
        frequency: Math.round(14 / moteScale(rt)),
        lifespan: 180,
        scale: { start: size * S, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: color,
        blendMode: "ADD",
      })
      .setDepth(DEPTH - 1),
  );
  return () => {
    emitter.stop();
    destroyLater(rt, emitter, 220);
  };
}

/** Flash, shockwave ring, sparks thrown along `angle`, falling embers. */
function impact(rt: AnimationRuntime, at: Point, color: number, angle: number, power = 1): void {
  const flash = addFx(rt, at, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(rt, flash, { scale: 1.5 * power * S, duration: 260, ease: "Cubic.easeOut" });
  const core = addFx(rt, at, GLOW).setScale(0.2 * S);
  fadeOut(rt, core, { scale: 0.7 * power * S, duration: 150 });
  const ring = addFx(rt, at, RING).setTint(color).setScale(0.3 * S).setAlpha(0.9);
  fadeOut(rt, ring, { scale: 1.9 * power * S, duration: 340, ease: "Cubic.easeOut" });

  const count = moteCount(rt, Math.round(10 * power));
  for (let i = 0; i < count; i++) {
    const a = i < count * 0.6 ? angle + rand(-0.8, 0.8) : rand(0, Math.PI * 2);
    const dist = rand(36, 100) * power;
    const spark = addFx(rt, at, SPARK)
      .setTint(i % 3 ? color : 0xffffff)
      .setRotation(a)
      .setScale(rand(0.5, 0.9) * S, S);
    fadeOut(rt, spark, {
      x: at.x + Math.cos(a) * dist,
      y: at.y + Math.sin(a) * dist,
      scaleX: 0.1 * S,
      duration: rand(240, 400),
      ease: "Cubic.easeOut",
    });
  }

  const embers = rt.track(
    rt.scene.add
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
      .setDepth(DEPTH),
  );
  embers.explode(moteCount(rt, Math.round(8 * power)));
  destroyLater(rt, embers, 800);
  // 60 ms + 60 ms fits the batch's two-shake / 120 ms budget; reduced motion denies it.
  rt.shake(40 + 20 * power, 0.0025 * power);
}

/** The attacker's card steps toward the target and back. */
function lunge(rt: AnimationRuntime, view: Phaser.GameObjects.Container | undefined, from: Point, to: Point, reach: number, ms: number) {
  if (!view) return;
  void rt.tween({
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
  /** Per-batch animation scope — all timed/tweened FX run through it. */
  runtime: AnimationRuntime;
  /** Fires once at the decisive impact — damage feedback starts here, before cleanup. */
  onImpact?: () => void;
}

/** Guards a callback to fire at most once — an abort after impact can't double it. */
function once(cb: (() => void) | undefined): () => void {
  let fired = false;
  return () => {
    if (fired) return;
    fired = true;
    cb?.();
  };
}

/** Plays one hit from `from` to `to` in the given look; resolves when cleanup completes. */
export function playAttack(look: AttackLook, from: Point, to: Point, opts: AttackOptions): Promise<void> {
  const rt = opts.runtime;
  ensureTextures(rt.scene);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const hitColor = opts.blocked ? BLOCKED_COLOR : look.color;
  const hit = once(opts.onImpact);
  switch (look.kind) {
    case "slash":
      return slash(rt, from, to, look.color, hitColor, angle, hit, opts.attackerView);
    case "spear":
      return thrust(rt, from, to, look.color, hitColor, angle, hit, opts.attackerView);
    case "darts":
      return darts(rt, from, to, look.color, hitColor, angle, hit);
    case "bow":
      return bow(rt, from, to, look.color, hitColor, angle, hit);
    case "herb":
      return herb(rt, from, to, look.color, hitColor, angle, hit);
    case "spell":
      return spell(rt, from, to, look.color, hitColor, angle, hit);
    case "fan":
      return fan(rt, from, to, look.color, hitColor, angle, hit);
    case "ink":
      return ink(rt, from, to, look.color, hitColor, angle, hit);
    case "music":
      return music(rt, from, to, look.color, hitColor, angle, hit);
    case "ribbon":
      return ribbon(rt, from, to, look.color, hitColor, angle, hit);
    case "fire":
      return fire(rt, from, to, look.color, hitColor, angle, hit);
    case "star":
      return star(rt, from, to, look.color, hitColor, hit);
    case "moon":
      return moon(rt, from, to, look.color, hitColor, angle, hit);
    case "talisman":
      return talisman(rt, from, to, look.color, hitColor, angle, hit);
    case "blood":
      return blood(rt, from, to, look.color, hitColor, angle, hit);
    default: {
      const never: never = look.kind;
      return never;
    }
  }
}

async function slash(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void, view?: Phaser.GameObjects.Container) {
  lunge(rt, view, from, to, 0.16, 110);
  if (view) await rt.wait(90);
  impact(rt, to, hitColor, angle);
  hit();
  await blade(rt, to, color, rand(-0.85, -0.35));
}

/** One crescent cut across `at`: grows along its arc, then thins out. */
async function blade(rt: AnimationRuntime, at: Point, color: number, rot: number) {
  const layers = [
    addFx(rt, at, SLASH).setTint(color).setRotation(rot).setScale(0.2 * S, S),
    addFx(rt, at, SLASH).setRotation(rot).setScale(0.2 * S, 0.45 * S),
  ];
  await rt.tween({ targets: layers, scaleX: 1.1 * S, rotation: rot + 0.18, duration: 110, ease: "Cubic.easeOut" });
  await rt.tween({ targets: layers, alpha: 0, scaleY: 0.15 * S, duration: 220, ease: "Sine.easeIn" });
  layers.forEach((layer) => layer.destroy());
}

async function thrust(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void, view?: Phaser.GameObjects.Container) {
  lunge(rt, view, from, to, 0.24, 120);
  if (view) await rt.wait(70);
  const start = { x: from.x + Math.cos(angle) * 40, y: from.y + Math.sin(angle) * 40 };
  const length = Math.hypot(to.x - start.x, to.y - start.y) + 50;
  const shafts = [
    addFx(rt, start, THRUST).setOrigin(0, 0.5).setTint(color).setRotation(angle).setScale(0, 1.4 * S),
    addFx(rt, start, THRUST).setOrigin(0, 0.5).setRotation(angle).setScale(0, 0.55 * S),
  ];
  await rt.tween({ targets: shafts, scaleX: (length / 200) * S, duration: 110, ease: "Cubic.easeOut" });
  impact(rt, to, hitColor, angle, 1.25);
  hit();
  shafts.forEach((s) => fadeOut(rt, s, { scaleY: 0.1 * S, duration: 200 }));
  await rt.wait(160);
}

async function darts(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const perp = angle + Math.PI / 2;
  const throws = [-12, 0, 12].map(async (offset, i) => {
    await rt.wait(i * 70);
    const start = { x: from.x + Math.cos(perp) * offset, y: from.y + Math.sin(perp) * offset };
    const end = { x: to.x + Math.cos(perp) * offset * 0.5, y: to.y + Math.sin(perp) * offset * 0.5 };
    const dart = rt.track(rt.scene.add.image(start.x, start.y, DART).setRotation(angle).setScale(1.1 * S).setDepth(DEPTH));
    const stop = trail(rt, dart, color, 0.07);
    await rt.tween({ targets: dart, x: end.x, y: end.y, duration: 190 });
    stop();
    dart.destroy();
    impact(rt, end, hitColor, angle, i === 2 ? 0.9 : 0.5);
    // Three visual impacts, one decisive callback — the last dart.
    if (i === 2) hit();
  });
  await Promise.all(throws);
  await rt.wait(80);
}

async function bow(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const at = { x: from.x + dx * 34, y: from.y + dy * 34 };
  const bowImg = rt.track(rt.scene.add.image(at.x, at.y, BOW).setRotation(angle).setScale(0).setDepth(DEPTH));
  const arrow = rt.track(rt.scene.add.image(at.x, at.y, ARROW).setOrigin(0.8, 0.5).setRotation(angle).setScale(S).setAlpha(0).setDepth(DEPTH + 1));
  const glow = addFx(rt, at, GLOW).setTint(color).setScale(0.3 * S).setAlpha(0);
  await rt.tween({ targets: bowImg, scale: S, duration: 110, ease: "Back.easeOut" });
  // Draw: the arrow nocks and pulls back, the bow bends, light gathers.
  arrow.setAlpha(1);
  await Promise.all([
    rt.tween({ targets: arrow, x: at.x - dx * 14, y: at.y - dy * 14, duration: 180, ease: "Sine.easeOut" }),
    rt.tween({ targets: bowImg, scaleX: 0.82 * S, duration: 180, ease: "Sine.easeOut" }),
    rt.tween({ targets: glow, alpha: 0.9, scale: 0.7 * S, duration: 180 }),
  ]);
  // Release.
  void rt.tween({ targets: bowImg, scaleX: S, duration: 140, ease: "Back.easeOut" });
  fadeOut(rt, bowImg, { delay: 140, duration: 220 });
  fadeOut(rt, glow, { scale: 1.2 * S, duration: 200 });
  const stop = trail(rt, arrow, color, 0.12);
  const flight = Math.min(240, Math.max(160, Math.hypot(to.x - at.x, to.y - at.y) * 0.75));
  await rt.tween({ targets: arrow, x: to.x, y: to.y, duration: flight, ease: "Quad.easeIn" });
  stop();
  impact(rt, to, hitColor, angle, 1.1);
  hit();
  fadeOut(rt, arrow, { duration: 160 });
  await rt.wait(90);
}

async function herb(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const perp = angle + Math.PI / 2;
  const leaves = [0, 1, 2].map(() => rt.track(rt.scene.add.image(from.x, from.y, LEAF).setScale(S).setDepth(DEPTH)));
  const heart = addFx(rt, from, GLOW).setTint(color).setScale(0.45 * S);
  const stop = trail(rt, heart, color, 0.1);
  const path = { t: 0 };
  await rt.tween({
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
    void rt.tween({
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
  impact(rt, to, hitColor, angle, 0.9);
  hit();
  await rt.wait(100);
}

async function spell(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const cast = addFx(rt, from, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(rt, cast, { scale: 0.9 * S, duration: 300 });
  const sigil = addFx(rt, to, RUNE).setTint(color).setScale(0.4 * S).setAlpha(0);
  await rt.tween({ targets: sigil, alpha: 1, scale: 1.2 * S, rotation: 1.2, duration: 240, ease: "Cubic.easeOut" });
  impact(rt, to, hitColor, angle, 1.1);
  hit();
  fadeOut(rt, sigil, { scale: 1.6 * S, rotation: 1.8, duration: 220 });
  await rt.wait(120);
}

/** Point `t` (0..1) along from→to, pushed sideways by `off` px and up by `lift` px. */
function along(from: Point, to: Point, t: number, off = 0, lift = 0): Point {
  const side = Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2;
  return {
    x: from.x + (to.x - from.x) * t + Math.cos(side) * off,
    y: from.y + (to.y - from.y) * t + Math.sin(side) * off - lift,
  };
}

/** Three spinning wind blades fan out from the fan and close on the target. */
async function fan(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  await Promise.all(
    [-1, 0, 1].map(async (side, i) => {
      await rt.wait(i * 50);
      const wind = addFx(rt, from, SLASH).setTint(color).setScale(0.26 * S, 0.5 * S);
      const stop = trail(rt, wind, color, 0.06);
      const p = { t: 0 };
      await rt.tween({
        targets: p,
        t: 1,
        duration: 320,
        ease: "Sine.easeIn",
        onUpdate: () => {
          const at = along(from, to, p.t, Math.sin(p.t * Math.PI) * side * 64);
          wind.setPosition(at.x, at.y).setRotation(p.t * Math.PI * 6);
        },
      });
      stop();
      wind.destroy();
      impact(rt, to, hitColor, angle, side === 0 ? 0.9 : 0.45);
      if (side === 0) hit();
    }),
  );
  await rt.wait(80);
}

/** Ink drops lobbed in an arc, then a calligraphy stroke written across the target. */
async function ink(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  await Promise.all(
    [0, 1, 2].map(async (i) => {
      await rt.wait(i * 60);
      const end = { x: to.x + rand(-16, 16), y: to.y + rand(-12, 12) };
      const drop = addFx(rt, from, GLOW).setTint(color).setScale(0.2 * S);
      const stop = trail(rt, drop, color, 0.08);
      const p = { t: 0 };
      await rt.tween({
        targets: p,
        t: 1,
        duration: 260,
        onUpdate: () => {
          const at = along(from, end, p.t, 0, Math.sin(p.t * Math.PI) * 60);
          drop.setPosition(at.x, at.y);
        },
      });
      stop();
      drop.destroy();
    }),
  );
  const start = { x: to.x - 58, y: to.y + 18 };
  const strokes = [
    addFx(rt, start, BRUSH).setOrigin(0, 0.5).setTint(color).setRotation(-0.32).setScale(0, 1.1 * S),
    addFx(rt, start, BRUSH).setOrigin(0, 0.5).setRotation(-0.32).setScale(0, 0.5 * S).setAlpha(0.8),
  ];
  impact(rt, to, hitColor, angle, 1.1);
  hit();
  await rt.tween({ targets: strokes, scaleX: S, duration: 140, ease: "Cubic.easeOut" });
  strokes.forEach((stroke) => fadeOut(rt, stroke, { duration: 320, delay: 80 }));
  await rt.wait(120);
}

/** Sound waves from the zither swell as they travel; notes rise at the player. */
async function music(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const css = `#${color.toString(16).padStart(6, "0")}`;
  ["♪", "♫"].forEach((glyph, i) => {
    const note = rt.track(
      rt.scene.add
        .text(from.x + (i ? 18 : -18), from.y - 30, glyph, { fontSize: "20px", color: css })
        .setOrigin(0.5)
        .setDepth(DEPTH),
    );
    void rt.tween({
      targets: note,
      y: note.y - 40,
      alpha: 0,
      duration: 700,
      delay: i * 120,
      ease: "Sine.easeOut",
      onComplete: () => note.destroy(),
    });
  });
  await Promise.all(
    [0, 1, 2].map(async (i) => {
      await rt.wait(i * 90);
      const wave = addFx(rt, from, WAVE).setTint(color).setRotation(angle).setScale(0.5 * S).setAlpha(0.95);
      await rt.tween({ targets: wave, x: to.x, y: to.y, scale: 1.5 * S, duration: 320, ease: "Sine.easeIn" });
      fadeOut(rt, wave, { scale: 2.2 * S, duration: 180 });
      impact(rt, to, hitColor, angle, i === 2 ? 0.9 : 0.35);
      if (i === 2) hit();
    }),
  );
  await rt.wait(60);
}

/** A silk ribbon lashes out in a travelling wave, then whips back. */
async function ribbon(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const g = rt.track(rt.scene.add.graphics().setBlendMode("ADD").setDepth(DEPTH));
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const p = { head: 0, tail: 0, phase: 0 };
  const draw = () => {
    g.clear();
    const n = 30;
    let prev: Point | undefined;
    for (let k = 0; k <= n; k++) {
      const u = p.tail + ((p.head - p.tail) * k) / n;
      const at = along(from, to, u / length, Math.sin(u * 0.045 + p.phase) * 18 * (1 - (u / length) * 0.6));
      if (prev) {
        const w = 1 + 6 * Math.sin((Math.PI * k) / n);
        g.lineStyle(w, color, 0.8).lineBetween(prev.x, prev.y, at.x, at.y);
        g.lineStyle(w * 0.35, 0xffffff, 0.85).lineBetween(prev.x, prev.y, at.x, at.y);
      }
      prev = at;
    }
  };
  await rt.tween({ targets: p, head: length, phase: 4, duration: 260, ease: "Cubic.easeOut", onUpdate: draw });
  impact(rt, to, hitColor, angle, 0.9);
  hit();
  await rt.tween({ targets: p, tail: length, phase: 7, duration: 220, ease: "Cubic.easeIn", onUpdate: draw });
  g.destroy();
}

/** A fireball gathers in the hand, flies trailing flames and bursts. */
async function fire(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const ball = addFx(rt, from, GLOW).setTint(color).setScale(0.15 * S);
  const core = addFx(rt, from, GLOW).setScale(0.08 * S);
  const flames = rt.track(
    rt.scene.add
      .particles(0, 0, GLOW, {
        follow: ball,
        frequency: Math.round(10 / moteScale(rt)),
        lifespan: { min: 220, max: 380 },
        speed: { min: 10, max: 40 },
        scale: { start: 0.34 * S, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [color, 0xff80c0, 0xffffff],
        blendMode: "ADD",
      })
      .setDepth(DEPTH - 1),
  );
  await rt.tween({ targets: ball, scale: 0.6 * S, duration: 140, ease: "Back.easeOut" });
  core.setScale(0.28 * S);
  await rt.tween({ targets: [ball, core], x: to.x, y: to.y, duration: 300, ease: "Quad.easeIn" });
  flames.stop();
  destroyLater(rt, flames, 400);
  ball.destroy();
  core.destroy();
  impact(rt, to, hitColor, angle, 1.4);
  hit();
  await rt.wait(100);
}

/** Star shards fall from the sky onto the target. */
async function star(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, hit: () => void) {
  const cast = addFx(rt, from, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(rt, cast, { scale: 0.8 * S, duration: 300 });
  await Promise.all(
    [0, 1, 2, 3, 4].map(async (i) => {
      await rt.wait(i * 55);
      const sky = { x: to.x + rand(-130, 130), y: to.y - rand(180, 240) };
      const end = { x: to.x + rand(-18, 18), y: to.y + rand(-14, 14) };
      const shard = addFx(rt, sky, STAR).setTint(color).setScale(0.7 * S);
      const stop = trail(rt, shard, color, 0.09);
      await rt.tween({ targets: shard, x: end.x, y: end.y, rotation: 3, duration: 260, ease: "Quad.easeIn" });
      stop();
      shard.destroy();
      impact(rt, end, hitColor, Math.atan2(end.y - sky.y, end.x - sky.x), i === 4 ? 1 : 0.4);
      if (i === 4) hit();
    }),
  );
  await rt.wait(60);
}

/** A crescent rises over the target and drops a moonbeam on it. */
async function moon(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const cast = addFx(rt, from, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(rt, cast, { scale: 0.8 * S, duration: 300 });
  const top = { x: to.x, y: to.y - 96 };
  const crescent = addFx(rt, top, CRESCENT).setTint(color).setScale(0.3 * S).setAlpha(0);
  await rt.tween({ targets: crescent, alpha: 1, scale: 0.9 * S, duration: 200, ease: "Back.easeOut" });
  const beam = addFx(rt, top, BEAM).setOrigin(0.5, 0).setTint(color).setScale(0.9 * S, 0);
  await rt.tween({ targets: beam, scaleY: (120 / 128) * S, duration: 120, ease: "Quad.easeIn" });
  impact(rt, to, hitColor, angle, 1.2);
  hit();
  fadeOut(rt, beam, { scaleX: 0.2 * S, duration: 280 });
  fadeOut(rt, crescent, { y: top.y - 16, duration: 320 });
  await rt.wait(120);
}

/** Three paper talismans flutter onto the target, flare and burst. */
async function talisman(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const papers = await Promise.all(
    [-1, 0, 1].map(async (side, i) => {
      await rt.wait(i * 70);
      const paper = rt.track(rt.scene.add.image(from.x, from.y, TALISMAN).setScale(S).setDepth(DEPTH));
      const end = { x: to.x + side * 24, y: to.y + rand(-12, 8) };
      const p = { t: 0 };
      await rt.tween({
        targets: p,
        t: 1,
        duration: 300,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          const at = along(from, end, p.t, Math.sin(p.t * Math.PI * 3) * 8 * (side || 1), Math.sin(p.t * Math.PI) * 30);
          paper.setPosition(at.x, at.y).setRotation(Math.sin(p.t * Math.PI * 4) * 0.4 + side * 0.2);
        },
      });
      const flare = addFx(rt, end, GLOW).setTint(color).setScale(0.3 * S);
      fadeOut(rt, flare, { scale: 0.9 * S, duration: 220 });
      return paper;
    }),
  );
  await rt.wait(110);
  papers.forEach((paper) => fadeOut(rt, paper, { scale: 1.5 * S, duration: 180 }));
  impact(rt, to, hitColor, angle, 1.2);
  hit();
  await rt.wait(100);
}

/** Two blood-moon cuts cross in an X; blood drips from the wound. */
async function blood(rt: AnimationRuntime, from: Point, to: Point, color: number, hitColor: number, angle: number, hit: () => void) {
  const cast = addFx(rt, from, GLOW).setTint(color).setScale(0.2 * S);
  fadeOut(rt, cast, { scale: 0.9 * S, duration: 260 });
  const first = blade(rt, to, color, -0.7);
  // The blades run detached until Promise.all below; an abort rejects them early.
  void first.catch(() => {});
  impact(rt, to, hitColor, angle, 0.8);
  await rt.wait(90);
  const second = blade(rt, to, color, 0.7 + Math.PI);
  void second.catch(() => {});
  const drops = rt.track(
    rt.scene.add
      .particles(to.x, to.y, GLOW, {
        speed: { min: 20, max: 90 },
        angle: { min: 60, max: 120 },
        gravityY: 420,
        lifespan: { min: 500, max: 800 },
        scale: { start: 0.12 * S, end: 0.04 * S },
        tint: color,
        blendMode: "ADD",
        emitting: false,
      })
      .setDepth(DEPTH),
  );
  drops.explode(moteCount(rt, 14));
  destroyLater(rt, drops, 900);
  impact(rt, to, hitColor, angle, 1.1);
  hit();
  await Promise.all([first, second]);
}

/**
 * The played card leaves the hand: it rises to center stage, flares, then
 * dissolves into motes that stream to the target (or burst out when untargeted).
 */
export async function castCard(
  rt: AnimationRuntime,
  view: Phaser.GameObjects.Container,
  stage: Point,
  color: number,
  target?: Point,
): Promise<void> {
  ensureTextures(rt.scene);
  // `view` is a detached clone of the hand card — tracking it means an abort
  // destroys the clone while the interactive source stays untouched.
  rt.track(view);
  view.parentContainer?.bringToTop(view);
  await rt.tween({ targets: view, x: stage.x, y: stage.y, scale: 1.15, angle: 0, duration: 220, ease: "Cubic.easeOut" });
  const halo = addFx(rt, stage, GLOW).setTint(color).setScale(0.6 * S).setAlpha(0.9);
  fadeOut(rt, halo, { scale: 3 * S, duration: 380, ease: "Cubic.easeOut" });
  const ring = addFx(rt, stage, RING).setTint(color).setScale(0.8 * S);
  fadeOut(rt, ring, { scale: 3.2 * S, duration: 360, ease: "Cubic.easeOut" });
  await rt.wait(90);
  void rt.tween({ targets: view, alpha: 0, scale: 0.9, duration: 180, ease: "Sine.easeIn" });
  const motes = rt.track(
    rt.scene.add
      .particles(stage.x, stage.y, GLOW, {
      x: { min: -50, max: 50 },
      y: { min: -70, max: 70 },
      lifespan: 360,
      scale: { start: 0.14 * S, end: 0.04 * S },
      alpha: { start: 1, end: 0.2 },
      tint: [color, 0xffffff],
      blendMode: "ADD",
      emitting: false,
      // moveTo is in the emitter's local space.
      ...(target ? { moveToX: target.x - stage.x, moveToY: target.y - stage.y } : { speed: { min: 60, max: 180 } }),
      })
      .setDepth(DEPTH),
  );
  motes.explode(moteCount(rt, 18));
  destroyLater(rt, motes, 450);
  await rt.wait(target ? 260 : 160);
}

/**
 * The Nguyệt Luân turns: a wheel of the phase icons (`ui:moon_<id>`) opens at
 * center stage with the old phase on top, turns until the new phase reaches the
 * top, flares, then collapses into the moon badge.
 */
export async function moonWheel(
  rt: AnimationRuntime,
  stage: Point,
  badge: Point,
  phaseIds: readonly string[],
  from: number,
  to: number,
  color = 0xf4d35e,
  ms = 550,
): Promise<void> {
  ensureTextures(rt.scene);
  const n = phaseIds.length;
  const R = 78;
  const step = 360 / n;
  // Shortest signed turn: +2 turns two notches, a wrap from 7 to 0 turns one.
  const notches = ((((to - from) % n) + n + n / 2) % n) - n / 2;
  // The whole transition lands inside `ms` — the open/turn/settle/close beats scale together.
  const scale = ms / (960 + 130 * Math.abs(notches));
  const wheel = rt.track(rt.scene.add.container(stage.x, stage.y).setDepth(DEPTH - 3).setScale(0.6).setAlpha(0));
  // Every child is tracked too: an abort must not leave wheel parts orphaned.
  wheel.add(rt.track(rt.scene.add.image(0, 0, RING).setBlendMode("ADD").setTint(color).setScale((R / 27) * S)));
  wheel.add(rt.track(rt.scene.add.image(0, 0, RUNE).setBlendMode("ADD").setTint(color).setAlpha(0.7).setScale(((R * 0.62) / 29) * S)));
  const icons = phaseIds.map((id, i) => {
    const deg = ((i - from) * step - 90) * (Math.PI / 180);
    const key = `ui:moon_${id}`;
    const icon = rt.track(
      rt.scene.textures.exists(key)
        ? rt.scene.add.image(R * Math.cos(deg), R * Math.sin(deg), key).setDisplaySize(30, 30)
        : rt.scene.add.image(R * Math.cos(deg), R * Math.sin(deg), GLOW).setTint(color).setScale(0.3 * S),
    );
    wheel.add(icon);
    return icon;
  });
  await rt.tween({ targets: wheel, alpha: 1, scale: 1, duration: Math.round(200 * scale), ease: "Back.easeOut" });
  const top = { x: stage.x, y: stage.y - R };
  const marker = addFx(rt, top, GLOW).setTint(color).setScale(0.55 * S).setAlpha(0.8);
  const turn = { angle: 0 };
  await rt.tween({
    targets: turn,
    angle: -notches * step,
    duration: Math.round((260 + 130 * Math.abs(notches)) * scale),
    ease: "Cubic.easeInOut",
    onUpdate: () => {
      wheel.setAngle(turn.angle);
      icons.forEach((icon) => icon.setAngle(-turn.angle));
    },
  });
  const arrived = icons[to];
  if (arrived) void rt.tween({ targets: arrived, scale: arrived.scale * 1.45, duration: Math.round(160 * scale), yoyo: true, ease: "Sine.easeOut" });
  impact(rt, top, color, -Math.PI / 2, 0.8);
  await rt.wait(Math.round(220 * scale));
  fadeOut(rt, marker, { duration: Math.round(200 * scale) });
  await rt.tween({ targets: wheel, x: badge.x, y: badge.y, scale: 0.25, alpha: 0, duration: Math.round(280 * scale), ease: "Cubic.easeIn" });
  wheel.destroy();
  const flare = addFx(rt, badge, GLOW).setTint(color).setScale(0.5 * S);
  fadeOut(rt, flare, { scale: 1.6 * S, duration: 300 });
}

/**
 * A status icon bursts out above the unit. Applied: it pops, hangs, then drops
 * into the card. Removed: it swells and shatters. Resolves after the pop so a
 * chain of statuses does not stall the queue; the rest plays on.
 */
export async function statusPop(rt: AnimationRuntime, at: Point, iconKey: string, color: number, removed = false): Promise<void> {
  ensureTextures(rt.scene);
  const pos = { x: at.x, y: at.y - 46 };
  const flare = addFx(rt, pos, GLOW).setTint(color).setScale(0.3 * S);
  fadeOut(rt, flare, { scale: removed ? 0.9 * S : 1.4 * S, duration: 320 });
  if (!rt.scene.textures.exists(iconKey)) return rt.wait(120);
  const icon = rt.track(rt.scene.add.image(pos.x, pos.y, iconKey).setDepth(DEPTH).setDisplaySize(34, 34));
  const base = icon.scaleX;
  if (removed) {
    icon.setAlpha(0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
      const spark = addFx(rt, pos, SPARK).setTint(color).setRotation(a).setScale(0.5 * S, S);
      fadeOut(rt, spark, { x: pos.x + Math.cos(a) * 34, y: pos.y + Math.sin(a) * 34, scaleX: 0.1 * S, duration: 260, ease: "Cubic.easeOut" });
    }
    fadeOut(rt, icon, { scale: base * 1.6, duration: 220, ease: "Cubic.easeOut" });
    return rt.wait(120);
  }
  icon.setScale(0);
  await rt.tween({ targets: icon, scale: base * 1.3, duration: 170, ease: "Back.easeOut" });
  void rt.tween({
    targets: icon,
    scale: base,
    duration: 100,
    onComplete: () =>
      fadeOut(rt, icon, { x: at.x - 30, y: at.y + 52, scale: base * 0.5, delay: 220, duration: 240, ease: "Cubic.easeIn" }),
  });
}

/**
 * A fallen unit burns away: a hot flash, the card darkens and lifts as it
 * fades, ash and embers drift up from the whole card. A boss cracks first
 * (white shockwave, harder shake). The re-render then shows the fallen card.
 */
export async function deathBurn(
  rt: AnimationRuntime,
  view: Phaser.GameObjects.Container | undefined,
  at: Point,
  boss = false,
): Promise<void> {
  ensureTextures(rt.scene);
  const power = boss ? 1.6 : 1;
  const bounds = view?.getBounds();
  const size = bounds ? { w: bounds.width, h: bounds.height } : { w: 120, h: 170 };
  if (boss) {
    impact(rt, at, 0xffffff, -Math.PI / 2, 1.8);
    await rt.wait(180);
  }
  const heat = addFx(rt, at, GLOW).setTint(0xff6a30).setScale(0.6 * S * power);
  fadeOut(rt, heat, { scale: 2.4 * S * power, duration: 520, ease: "Cubic.easeOut" });
  const ash = rt.track(
    rt.scene.add
      .particles(at.x, at.y, GLOW, {
        x: { min: -size.w / 2, max: size.w / 2 },
        y: { min: -size.h / 2, max: size.h / 2 },
        speedY: { min: -90, max: -30 },
        speedX: { min: -20, max: 20 },
        lifespan: { min: 700, max: 1200 },
        scale: { start: 0.12 * S, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x8a8a9a, 0x5a5a66, 0xff8040, 0xffb060],
        blendMode: "ADD",
        frequency: Math.round(10 / moteScale(rt)),
        quantity: moteCount(rt, boss ? 3 : 2),
      })
      .setDepth(DEPTH),
  );
  if (view) {
    // Rounded like the cards (radius 9).
    const sw = size.w / view.scaleX;
    const sh = size.h / view.scaleY;
    const scorch = rt.track(rt.scene.add.graphics().fillStyle(0x2a0a04, 1).fillRoundedRect(-sw / 2, -sh / 2, sw, sh, 9).setAlpha(0));
    view.add(scorch);
    void rt.tween({ targets: scorch, alpha: 0.7, duration: 260 });
    // The card settles into its fallen look — dimmed and lifted, still recognizable.
    await rt.tween({ targets: view, alpha: 0.55, y: at.y - 14, scale: 0.94, duration: 560, delay: 120, ease: "Sine.easeIn" });
  } else {
    await rt.wait(560);
  }
  ash.stop();
  destroyLater(rt, ash, 1300);
}
