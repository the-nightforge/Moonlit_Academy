import type { CardTag, IntentKind, MoonModifier, StatusId } from "rules";

export const FONT = '"Segoe UI", "Noto Sans", Arial, sans-serif';

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
  empower: "Tích",
  freeze: "Băng",
};

export const INTENT_ICONS: Record<IntentKind, string> = {
  attack: "⚔",
  defend: "🛡",
  attackDefend: "⚔🛡",
  debuff: "✦",
  buff: "⬆",
  special: "★",
};

const TAG_LABELS: Record<CardTag, string> = {
  attack: "tấn công",
  control: "khống chế",
  assassin: "ám sát",
  heal: "hồi phục",
  moon: "nguyệt",
  forbidden: "cấm",
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
