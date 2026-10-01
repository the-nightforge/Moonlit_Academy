import type Phaser from "phaser";
import { RENDER_SCALE } from "./theme";

/**
 * Combat HUD pieces drawn once on canvases (gold rims, gradient cores — the
 * same look as the `ui/` icons): HP gems, armor shield, cost coin, card back,
 * count lozenge, end-turn medallion and hourglass. Drawn at RENDER_SCALE so
 * they stay sharp under the zoomed camera; `hudImage` shows them at design size.
 */

export const HUD = {
  heart: "hud_heart",
  shield: "hud_shield",
  cost: "hud_cost",
  cardBack: "hud_card_back",
  count: "hud_count",
  medallion: "hud_medallion",
  hourglass: "hud_hourglass",
  cardFace: "hud_card_face",
  bannerAttack: "hud_banner_attack",
  bannerSkill: "hud_banner_skill",
} as const;

const SIZE: Record<string, [number, number]> = {
  [HUD.heart]: [40, 38],
  [HUD.shield]: [30, 34],
  [HUD.cost]: [30, 30],
  [HUD.cardBack]: [80, 116],
  [HUD.count]: [38, 22],
  [HUD.medallion]: [108, 108],
  [HUD.hourglass]: [22, 30],
  [HUD.cardFace]: [110, 160],
  [HUD.bannerAttack]: [80, 22],
  [HUD.bannerSkill]: [80, 22],
};

const GOLD: [number, string][] = [
  [0, "#fff4c2"],
  [0.5, "#e8c45a"],
  [1, "#8a5e16"],
];

function linear(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function shieldPath(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  const l = inset;
  const r = w - inset;
  const t = inset;
  const b = h - inset;
  ctx.beginPath();
  ctx.moveTo(w / 2, t);
  ctx.lineTo(r, t + (b - t) * 0.14);
  ctx.lineTo(r, t + (b - t) * 0.45);
  ctx.quadraticCurveTo(r, t + (b - t) * 0.85, w / 2, b);
  ctx.quadraticCurveTo(l, t + (b - t) * 0.85, l, t + (b - t) * 0.45);
  ctx.lineTo(l, t + (b - t) * 0.14);
  ctx.closePath();
}

function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const DRAW: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  [HUD.heart]: (ctx, w, h) => {
    heartPath(ctx, w, h, 0.5);
    ctx.fillStyle = linear(ctx, 0, h, GOLD);
    ctx.fill();
    heartPath(ctx, w, h, 3);
    ctx.fillStyle = radial(ctx, w / 2, h * 0.45, w * 0.48, [[0, "#ffb8ae"], [0.5, "#d8303c"], [1, "#4e0810"]]);
    ctx.fill();
    highlight(ctx, w * 0.3, h * 0.28, 5, 2.6);
  },
  [HUD.shield]: (ctx, w, h) => {
    shieldPath(ctx, w, h, 1);
    ctx.fillStyle = linear(ctx, 0, h, GOLD);
    ctx.fill();
    shieldPath(ctx, w, h, 3.5);
    ctx.fillStyle = linear(ctx, 0, h, [[0, "#eaf6ff"], [0.45, "#6fa8d8"], [1, "#16304f"]]);
    ctx.fill();
    highlight(ctx, w * 0.36, h * 0.3, w * 0.16, h * 0.1);
  },
  [HUD.cost]: (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = linear(ctx, 0, w, GOLD);
    ctx.beginPath();
    ctx.arc(c, c, c - 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = radial(ctx, c, c, c - 3, [[0, "#4a5aa0"], [0.6, "#1c2654"], [1, "#0a0f26"]]);
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fill();
    // A faint crescent behind the number.
    ctx.fillStyle = "rgba(244,211,94,0.28)";
    ctx.beginPath();
    ctx.arc(c, c, c - 6, 0, Math.PI * 2);
    ctx.arc(c + 4, c - 2, c - 7, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  },
  [HUD.cardBack]: (ctx, w, h) => {
    const r = 6;
    const round = (x: number, y: number, rw: number, rh: number, rr: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, rr);
    };
    round(0.5, 0.5, w - 1, h - 1, r);
    ctx.fillStyle = linear(ctx, 0, h, GOLD);
    ctx.fill();
    round(2.5, 2.5, w - 5, h - 5, r - 1);
    ctx.fillStyle = linear(ctx, 0, h, [[0, "#2c3a72"], [0.55, "#18224a"], [1, "#0c1230"]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(244,211,94,0.55)";
    ctx.lineWidth = 1;
    round(7, 7, w - 14, h - 14, 3);
    ctx.stroke();
    // Corner diamonds.
    ctx.fillStyle = "rgba(244,211,94,0.8)";
    for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x - 3, y);
      ctx.fill();
    }
    // Emblem: a crescent cradling a four-point star, in a thin ring.
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = "rgba(244,211,94,0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = linear(ctx, cy - 16, cy + 16, GOLD);
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 4, 13, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rr = i % 2 ? 1.6 : 6;
      ctx[i ? "lineTo" : "moveTo"](cx + 5 + rr * Math.cos(a), cy - 3 + rr * Math.sin(a));
    }
    ctx.fill();
  },
  [HUD.count]: (ctx, w, h) => {
    const lozenge = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(inset + 5, inset);
      ctx.lineTo(w - inset - 5, inset);
      ctx.lineTo(w - inset, h / 2);
      ctx.lineTo(w - inset - 5, h - inset);
      ctx.lineTo(inset + 5, h - inset);
      ctx.lineTo(inset, h / 2);
      ctx.closePath();
    };
    lozenge(0.5);
    ctx.fillStyle = linear(ctx, 0, h, GOLD);
    ctx.fill();
    lozenge(2.5);
    ctx.fillStyle = linear(ctx, 0, h, [[0, "#22305e"], [1, "#0a0f26"]]);
    ctx.fill();
  },
  [HUD.medallion]: (ctx, w) => {
    const c = w / 2;
    // Outer gold ring with eight phase notches.
    ctx.fillStyle = linear(ctx, 0, w, GOLD);
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = radial(ctx, c, c, c - 7, [[0, "#34488e"], [0.65, "#16204a"], [1, "#080c22"]]);
    ctx.beginPath();
    ctx.arc(c, c, c - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a08";
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(c + (c - 4) * Math.cos(a), c + (c - 4) * Math.sin(a), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(244,211,94,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, c - 12, 0, Math.PI * 2);
    ctx.stroke();
    highlight(ctx, c - 18, c - 22, 16, 7);
  },
  // Hand card frame (110×160): indigo lacquer, a double gold line with cloud
  // curls in the corners, the round moon gate (center 55,63), the type
  // plaque (55,99) and the parchment text panel (y 107–153). The name banner,
  // emblem and owner jewel are added by the scene.
  [HUD.cardFace]: (ctx, w, h) => {
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 9);
    ctx.fillStyle = linear(ctx, 0, h, [[0, "#26306a"], [0.45, "#161d46"], [1, "#0a0e2a"]]);
    ctx.fill();
    // Faint lattice of the lacquer.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(160,180,255,0.05)";
    ctx.lineWidth = 1;
    for (let d = -h; d < w + h; d += 9) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + h, h);
      ctx.stroke();
    }
    ctx.restore();
    // Double gold line.
    ctx.strokeStyle = linear(ctx, 0, h, GOLD);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(3.5, 3.5, w - 7, h - 7, 7);
    ctx.stroke();
    ctx.strokeStyle = "rgba(232,196,90,0.55)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(6.5, 6.5, w - 13, h - 13, 5);
    ctx.stroke();
    // Cloud curls in the corners.
    ctx.strokeStyle = "rgba(244,211,94,0.9)";
    ctx.lineWidth = 1;
    for (const [cx, cy, sx, sy] of [[9, 9, 1, 1], [w - 9, 9, -1, 1], [9, h - 9, 1, -1], [w - 9, h - 9, -1, -1]] as const) {
      ctx.beginPath();
      ctx.arc(cx + sx * 3, cy + sy * 3, 3, 0, Math.PI * 2);
      ctx.moveTo(cx + sx * 6, cy + sy * 3);
      ctx.quadraticCurveTo(cx + sx * 12, cy + sy * 1, cx + sx * 16, cy + sy * 4);
      ctx.moveTo(cx + sx * 3, cy + sy * 6);
      ctx.quadraticCurveTo(cx + sx * 1, cy + sy * 12, cx + sx * 4, cy + sy * 16);
      ctx.stroke();
    }
    // Moon gate: night sky disc, gold ring, inner hairline, four studs.
    const gx = w / 2;
    const gy = 63;
    ctx.fillStyle = radial(ctx, gx, gy, 28, [[0, "#2a3878"], [0.7, "#0e1438"], [1, "#060920"]]);
    ctx.beginPath();
    ctx.arc(gx, gy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = linear(ctx, gy - 28, gy + 28, GOLD);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = "rgba(244,211,94,0.45)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(gx, gy, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f4d35e";
    for (let k = 0; k < 4; k++) {
      const a = (Math.PI / 2) * k - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(gx + 28 * Math.cos(a), gy + 28 * Math.sin(a), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Type plaque.
    ctx.beginPath();
    ctx.roundRect(gx - 31, 92.5, 62, 13, 6.5);
    ctx.fillStyle = "#0a0e26";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,196,90,0.9)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Parchment text panel.
    ctx.beginPath();
    ctx.roundRect(9, 108, w - 18, 44, 4);
    ctx.fillStyle = linear(ctx, 108, 152, [[0, "#f7ecd2"], [1, "#d9c391"]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(110,72,26,0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(110,72,26,0.25)";
    ctx.beginPath();
    ctx.moveTo(12, 110.5);
    ctx.lineTo(w - 12, 110.5);
    ctx.stroke();
  },
  [HUD.bannerAttack]: (ctx, w, h) => banner(ctx, w, h, ["#e05a5a", "#a8202c", "#5a0c16"]),
  [HUD.bannerSkill]: (ctx, w, h) => banner(ctx, w, h, ["#5a8ad8", "#1e4888", "#0c2048"]),
  [HUD.hourglass]: (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, h, GOLD);
    ctx.fillRect(1, 1, w - 2, 3);
    ctx.fillRect(1, h - 4, w - 2, 3);
    ctx.strokeStyle = "#e8c45a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.quadraticCurveTo(4, h / 2 - 2, w / 2 - 1.5, h / 2);
    ctx.quadraticCurveTo(4, h / 2 + 2, 4, h - 4);
    ctx.moveTo(w - 4, 4);
    ctx.quadraticCurveTo(w - 4, h / 2 - 2, w / 2 + 1.5, h / 2);
    ctx.quadraticCurveTo(w - 4, h / 2 + 2, w - 4, h - 4);
    ctx.stroke();
    // Sand: a little left on top, a heap below, a falling thread.
    ctx.fillStyle = "#ffcf6a";
    ctx.beginPath();
    ctx.moveTo(7, 9);
    ctx.lineTo(w - 7, 9);
    ctx.lineTo(w / 2, h / 2 - 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, h - 5);
    ctx.quadraticCurveTo(w / 2, h - 13, w - 6, h - 5);
    ctx.fill();
    ctx.fillRect(w / 2 - 0.5, h / 2, 1, h / 2 - 9);
  },
};

/** Name banner: a lacquered ribbon with swallowtail ends and gold edges. */
function banner(ctx: CanvasRenderingContext2D, w: number, h: number, lacquer: [string, string, string]) {
  const ribbon = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    ctx.lineTo(w - inset, inset);
    ctx.lineTo(w - 7 - inset * 0.5, h / 2);
    ctx.lineTo(w - inset, h - inset);
    ctx.lineTo(inset, h - inset);
    ctx.lineTo(7 + inset * 0.5, h / 2);
    ctx.closePath();
  };
  ribbon(0.6);
  ctx.fillStyle = linear(ctx, 0, h, GOLD);
  ctx.fill();
  ribbon(2);
  ctx.fillStyle = linear(ctx, 0, h, [[0, lacquer[0]], [0.5, lacquer[1]], [1, lacquer[2]]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(9, 4);
  ctx.lineTo(w - 9, 4);
  ctx.stroke();
}

/** A heart filling a w×h box, `inset` px in from its edge. */
function heartPath(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  const l = inset;
  const r = w - inset;
  const t = inset;
  const b = h - inset;
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, b);
  ctx.bezierCurveTo(cx - (cx - l) * 0.55, b - (b - t) * 0.2, l, t + (b - t) * 0.55, l, t + (b - t) * 0.32);
  ctx.bezierCurveTo(l, t + (b - t) * 0.05, cx - (cx - l) * 0.15, t - (b - t) * 0.04, cx, t + (b - t) * 0.22);
  ctx.bezierCurveTo(cx + (r - cx) * 0.15, t - (b - t) * 0.04, r, t + (b - t) * 0.05, r, t + (b - t) * 0.32);
  ctx.bezierCurveTo(r, t + (b - t) * 0.55, cx + (r - cx) * 0.55, b - (b - t) * 0.2, cx, b);
  ctx.closePath();
}

/** Draws every HUD texture once per game (textures are shared by scenes). */
export function ensureHudArt(scene: Phaser.Scene): void {
  for (const key of Object.values(HUD)) {
    if (scene.textures.exists(key)) continue;
    const [w, h] = SIZE[key]!;
    const texture = scene.textures.createCanvas(key, Math.ceil(w * RENDER_SCALE), Math.ceil(h * RENDER_SCALE));
    if (!texture) continue;
    const ctx = texture.getContext();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    DRAW[key]!(ctx, w, h);
    texture.refresh();
  }
}

/** A HUD piece at its design size (or `scale`× it). */
export function hudImage(scene: Phaser.Scene, key: string, x: number, y: number, scale = 1): Phaser.GameObjects.Image {
  ensureHudArt(scene);
  return scene.add.image(x, y, key).setScale(scale / RENDER_SCALE);
}
