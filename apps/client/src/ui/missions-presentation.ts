import { claimMission, masteryLevel, missionProgress } from "rules";
import type { GameData, Profile } from "rules";

export type MissionTab = "daily" | "weekly" | "achievements";
export type MissionStatus = "ready" | "progress" | "claimed";
export interface Progress { value: number; goal: number }
export interface MissionRow {
  id: string; name: string; text: string; reward: number; icon: string;
  status: MissionStatus; progress: Progress;
  destination: "deck-select" | "heroes" | "gacha";
  destinationName: string;
}
export interface AchievementRow extends Omit<MissionRow, "progress" | "destination" | "destinationName"> { progress: Progress | null }
const statusOrder: Record<MissionStatus, number> = { ready: 0, progress: 1, claimed: 2 };

/** Presentation follows the same rollover and eligibility rules as the server. */
export function missionRows(data: GameData, profile: Profile, period: "daily" | "weekly", now: number): MissionRow[] {
  return Object.values(data.missions).filter(m => m.period === period).map(m => {
    const result = claimMission(data, profile, m.id, now);
    const status: MissionStatus = result.ok ? "ready" : result.error === "already claimed" ? "claimed" : "progress";
    const hero = m.goal.type === "distinctHeroesUsed", pulls = m.goal.type === "gachaPulls";
    return {
      id: m.id, name: m.name, text: m.text, reward: m.reward.moonJade, status,
      progress: { value: Math.min(m.goal.count, missionProgress(data, profile, m.id, now)), goal: m.goal.count },
      icon: pulls ? "nav_banners" : hero ? "nav_heroes" : m.goal.type === "bossKills" ? "node_boss" : m.goal.type === "cardsUnlocked" ? "nav_mastery" : "mode_run",
      destination: pulls ? "gacha" as const : hero || m.goal.type === "cardsUnlocked" ? "heroes" as const : "deck-select" as const,
      destinationName: pulls ? "Đến Triệu Hồi" : hero ? "Đến danh sách Hero" : m.goal.type === "cardsUnlocked" ? "Đến danh sách Hero để mở lá khóa" : "Đến chọn đội hình cho lượt chơi",
    };
  }).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

export function achievementRows(data: GameData, profile: Profile): AchievementRow[] {
  return Object.values(data.achievements).map(a => {
    let progress: Progress | null = null, icon = "mode_run", text = a.text;
    const goal = a.goal;
    switch (goal.type) {
      case "runsWon": progress = { value: profile.stats.runsWon ?? 0, goal: goal.count }; break;
      case "bossKillWithBond": icon = "node_boss"; break;
      case "masteryLevel":
        icon = "nav_mastery";
        progress = { value: Math.max(0, ...Object.entries(profile.heroes).filter(([id]) => data.heroes[id]).map(([,h]) => masteryLevel(data, h.xp))), goal: goal.level }; break;
      case "ownAllHeroes": {
        icon = "nav_heroes";
        const ids = Object.keys(data.heroes);
        progress = { value: ids.filter(id => profile.heroes[id] !== undefined).length, goal: ids.length };
        text = `Sở hữu toàn bộ ${ids.length} Hero.`; break;
      }
      case "starterFloor": progress = { value: profile.stats.starterBestFloor ?? 0, goal: goal.floor }; break;
      case "allLockedUnlocked": {
        icon = "seal";
        const owned = Object.entries(profile.heroes).filter(([id]) => data.heroes[id]);
        progress = {
          value: owned.reduce((n, [id, h]) => n + data.heroes[id]!.lockedCardIds.filter(card => h.unlockedCardIds.includes(card)).length, 0),
          goal: owned.reduce((n, [id]) => n + data.heroes[id]!.lockedCardIds.length, 0),
        }; break;
      }
    }
    if (progress) progress.value = Math.min(progress.goal, Math.max(0, progress.value));
    return { id: a.id, name: a.name, text, icon, reward: a.reward.moonJade, status: profile.achievements.includes(a.id) ? "claimed" : "progress", progress };
  });
}

/** One revision-changing request at a time; recheck the live profile before each. */
export async function claimReadyMissions(data: GameData, ids: readonly string[], context: {
  profile: () => Profile; now: () => number; valid: () => boolean; submit: (id: string) => Promise<unknown>;
}): Promise<{ received: number; error?: unknown; cancelled: boolean }> {
  let received = 0;
  for (const id of new Set(ids)) {
    if (!context.valid()) return { received, cancelled: true };
    const mission = data.missions[id];
    if (!mission || !claimMission(data, context.profile(), id, context.now()).ok) continue;
    try { await context.submit(id); received += mission.reward.moonJade; }
    catch (error) { return { received, error, cancelled: !context.valid() }; }
  }
  return { received, cancelled: !context.valid() };
}
