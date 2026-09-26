import type Phaser from "phaser";
import type { CardTag, Faction, IntentKind, MoonModifier, MoonPhaseId, NodeType, StatusId } from "rules";

export const FONT = '"Segoe UI", "Noto Sans", Arial, sans-serif';

/** Layout is authored in design pixels (1280×720). */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/**
 * Canvas pixels per design pixel. Sized from the screen's physical pixels so the
 * FIT-scaled canvas is downsampled (sharp), never upsampled (blurry).
 * Floor 2: screen size can read wrong at startup (hidden/embedded views).
 * ponytail: fixed at startup, not on resize; cap 3 bounds GPU memory.
 */
export const RENDER_SCALE = Math.min(
  3,
  Math.max(
    2,
    Math.ceil(
      window.devicePixelRatio *
        Math.min(window.screen.width / DESIGN_WIDTH, window.screen.height / DESIGN_HEIGHT),
    ),
  ),
);

/** Base style for every Text object: rasterized at RENDER_SCALE so it stays crisp. */
export const TEXT_BASE = { fontFamily: FONT, resolution: RENDER_SCALE } as const;

/** Lets a scene keep using design-pixel coordinates on the high-resolution canvas. */
export function useDesignCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RENDER_SCALE).centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}

export const COLORS = {
  background: 0x0b1026,
  panelHero: 0x16203c,
  panelEnemy: 0x241a33,
  panelBorder: 0x3a4a75,
  text: "#e8e0c8",
  dimText: "#8b93b8",
  hpTrack: 0x1a1020,
  hpFillHero: 0x58b368,
  hpFillEnemy: 0xc05050,
  armor: "#9fd4ff",
  gold: "#f4d35e",
  goldFill: 0xf4d35e,
  dead: 0x555566,
  costCheap: "#7fe07f",
  button: 0x2c3e6e,
  buttonText: "#e8e0c8",
} as const;

export const OWNER_COLORS: Record<string, number> = {
  m05: 0xd05454,
  f04: 0x6fbf73,
  m06: 0x9a8fb8,
  f03: 0x7fc8e8,
  f02: 0xb04a8a,
};

export const STATUS_LABELS: Record<StatusId, string> = {
  stealth: "Ẩn",
  taunt: "Khiêu",
  weak: "Yếu",
  vulnerable: "Vỡ",
  mark: "Dấu",
  burn: "Đốt",
  regen: "Hồi",
  strength: "Mạnh",
  empower: "Cường",
  freeze: "Băng",
  reflect: "Phản",
};

export const FACTION_LABELS: Record<Faction, string> = {
  thanhLoan: "Thanh Loan Viện",
  huyenVu: "Huyền Vũ Viện",
  bachLo: "Bạch Lộ Viện",
  xichDien: "Xích Diên Viện",
  neutral: "Trung lập",
};

/** Blood moon overrides the phase background. */
export const BLOOD_MOON_BG = 0x2a0710;
export const BLOOD_MOON_TEXT = "#ff5a5a";

export const PHASE_BG: Record<MoonPhaseId, number> = {
  new: 0x070a18,
  waxingCrescent: 0x0b1026,
  firstQuarter: 0x0d1430,
  waxingGibbous: 0x101838,
  full: 0x1c2650,
  waningGibbous: 0x141a3c,
  lastQuarter: 0x0e1330,
  waningCrescent: 0x090d20,
};

export const INTENT_ICONS: Record<IntentKind, string> = {
  attack: "⚔",
  defend: "🛡",
  attackDefend: "⚔🛡",
  debuff: "✦",
  buff: "⬆",
  special: "★",
};

export const NODE_ICONS: Record<NodeType, string> = {
  combat: "⚔",
  elite: "☠",
  rest: "🏮",
  treasure: "🎁",
  boss: "🌕",
};

const TAG_LABELS: Record<CardTag, string> = {
  attack: "tấn công",
  control: "khống chế",
  assassin: "ám sát",
  heal: "hồi phục",
  moon: "nguyệt",
  forbidden: "cấm",
  scheme: "mưu lược",
  ward: "hộ thể",
  harmony: "điều hòa",
};

export function describeModifier(modifier: MoonModifier): string {
  switch (modifier.type) {
    case "damageMultiplierForTag":
      return `lá ${TAG_LABELS[modifier.tag]} ×${modifier.multiplier}`;
    case "stealthDurationBonus":
      return `Ẩn Thân +${modifier.amount} thời hạn`;
    case "costModifierForTag":
      return `lá ${TAG_LABELS[modifier.tag]} ${modifier.amount > 0 ? "+" : ""}${modifier.amount} chi phí`;
    case "healMultiplier":
      return `hồi ×${modifier.multiplier}`;
    case "armorMultiplier":
      return `giáp ×${modifier.multiplier}`;
  }
}
