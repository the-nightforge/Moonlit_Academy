import type { Archetype, Faction, GameData, LevelUpCounter, Profile, Rarity } from "rules";
import { matchesDeckText } from "./deck-presentation";

type Hero = GameData["heroes"][string];
export interface HeroFilters {
  query: string;
  ownership: "all" | "owned" | "locked";
  faction: "all" | Faction;
  sort: "owned" | "rarity" | "constellation" | "name";
}

const rarityOrder: Record<Rarity, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
export const HERO_RARITY_LABELS: Record<Rarity, string> = { common: "Thường", rare: "Hiếm", epic: "Sử thi", legendary: "Truyền thuyết" };
export const HERO_ROLE_LABELS: Record<Archetype, string> = { vanguard: "Tiên phong", striker: "Tấn công", controller: "Khống chế", support: "Hỗ trợ", specialist: "Chuyên biệt" };

/** Labels follow the actual counter event; thresholds always come from hero data. */
const counterText: Record<LevelUpCounter, (n: number) => string> = {
  damageTaken: n => `Mất tổng ${n} HP trong trận`,
  turnsWithAllyRegen: n => `Có đồng đội Hồi Phục trong ${n} lượt`,
  enemiesKilled: n => `Hạ ${n} kẻ địch`,
  freezesApplied: n => `Áp dụng Đóng Băng ${n} lần`,
  buffsStolen: n => `Cướp hiệu ứng có lợi ${n} lần`,
  hitsIntercepted: n => `Chịu đòn thay đồng đội ${n} lần`,
  schemeCardsPlayed: n => `Đội dùng ${n} lá Mưu Lược`,
  cardsChosen: n => `Đội dùng Chiêm Bài ${n} lần`,
  hpHealed: n => `Hồi tổng ${n} HP bằng lá của Hero`,
  turnsSurvived: n => `Sống qua ${n} lượt`,
  moonShifts: n => `Chuyển pha trăng bằng lá ${n} lần`,
  studyPoints: n => `Đạt ${n} điểm: +1 đầu lượt, +1 mỗi lá Mưu Lược của Hero (trừ Song Hành)`,
  fullMoonsSeen: n => `Trải qua ${n} lượt Trăng Tròn`,
  forbiddenHpLost: n => `Mất tổng ${n} HP qua Cấm Thuật`,
  summonsMade: n => `Triệu hồi Linh Thú ${n} lần`,
  charmsApplied: n => `Áp dụng Mê Hoặc ${n} lần`,
  debuffsApplied: n => `Áp dụng hiệu ứng bất lợi ${n} lần`,
  intentsSealed: n => `Phong Ấn ý định ${n} lần`,
  alliesFallen: n => `Có ${n} đồng đội ngã xuống`,
  backRowHits: n => `Đánh trúng hàng sau ${n} lần`,
};
export function heroLevelUpCondition(hero: Hero, constellation: number): string {
  return counterText[hero.levelUp.counter](constellation >= 2 ? hero.levelUp.constellationThreshold : hero.levelUp.threshold);
}

/** Presentation only: ownership is presence, including heroes at Tinh Hồn zero. */
export function filterHeroes(heroes: readonly Hero[], owned: Profile["heroes"], filters: HeroFilters): Hero[] {
  return heroes.filter(hero =>
    matchesDeckText(filters.query, hero.name)
    && (filters.faction === "all" || hero.faction === filters.faction)
    && (filters.ownership === "all" || (filters.ownership === "owned") === (owned[hero.id] !== undefined)),
  ).sort((a, b) => {
    switch (filters.sort) {
      case "owned": return Number(owned[b.id] !== undefined) - Number(owned[a.id] !== undefined);
      case "rarity": return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      case "constellation": return (owned[b.id]?.constellation ?? -1) - (owned[a.id]?.constellation ?? -1);
      case "name": return a.name.localeCompare(b.name, "vi");
    }
  });
}

export function rosterPage(total: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Math.max(0, Math.min(pages - 1, requested));
  return { page, pages, start: page * 12, end: Math.min(total, (page + 1) * 12) };
}

export function initialHeroId(heroes: readonly Hero[], owned: Profile["heroes"], previous = ""): string {
  return heroes.find(hero => hero.id === previous)?.id
    ?? heroes.find(hero => owned[hero.id] !== undefined)?.id
    ?? heroes[0]?.id ?? "";
}
