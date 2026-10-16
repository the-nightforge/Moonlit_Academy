import type { GameData, HeroProgress } from "rules";

export function arenaHeroLines(data: GameData, heroId: string, profile?: { heroes: Record<string, Pick<HeroProgress, "constellation" | "levelUpForm">> }): string[] {
  const hero = data.heroes[heroId];
  if (!hero) return ["Không có thông tin Hero"];
  const progress = profile?.heroes[heroId];
  const constellation = progress?.constellation ?? 0;
  const form = constellation >= 5 && progress?.levelUpForm === "alt" ? hero.altLevelUp : hero.levelUp;
  return [hero.name, `Máu Đấu Trường: ${data.pvpConfig.heroStats[heroId]?.maxHp ?? hero.maxHp}`, progress ? `Tinh Hồn ${constellation}` : data.pvpConfig.trialHeroIds.includes(heroId) ? "Hero dùng thử · Tinh Hồn 0" : "Chưa sở hữu",
    `Ngưỡng Thức Tỉnh: ${constellation >= 2 ? hero.levelUp.constellationThreshold : hero.levelUp.threshold}`,
    `Dạng đã chọn: ${form.name}`,
    `${hero.levelUp.name} — dạng cơ bản`, hero.levelUp.description,
    `${hero.altLevelUp.name} — dạng thứ hai`, hero.altLevelUp.description,
    "Giữ nguyên Tinh Hồn và hiệu ứng trang bị đang sở hữu."];
}

export function formatArenaDate(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp), today = new Date(now);
  if (!Number.isFinite(date.getTime())) return "—";
  const pad = (value: number) => String(value).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.toDateString() === today.toDateString()) return `Hôm nay · ${time}`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}${date.getFullYear() !== today.getFullYear() ? `/${date.getFullYear()}` : ""} · ${time}`;
}

export interface ArenaTier { id: string; name: string; minRating: number }
export interface ArenaGate { connected: boolean; savedDeck: boolean; validDeck: boolean; assets: "idle" | "loading" | "ready" | "error"; queued: boolean; room: boolean; pending: boolean }
export function rankProgress(rating: number, tiers: ArenaTier[]) {
  const ordered = [...tiers].sort((a, b) => a.minRating - b.minRating);
  const next = ordered.find((tier) => tier.minRating > rating) ?? null;
  const current = ordered.filter((tier) => tier.minRating <= rating).at(-1)?.minRating ?? 0;
  return { next, remaining: next ? Math.max(0, next.minRating - rating) : 0,
    fraction: next ? Math.max(0, Math.min(1, (rating - current) / (next.minRating - current))) : 1 };
}
export function formatQueueTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function arenaActionReason(gate: ArenaGate): string {
  if (!gate.connected) return "Cần kết nối để vào trận";
  if (gate.queued) return "Hãy rời hàng chờ trước";
  if (gate.room) return "Hãy rời phòng trước";
  if (gate.pending) return "Đang gửi yêu cầu…";
  if (!gate.savedDeck) return "Chọn bộ bài đã lưu để xuất trận";
  if (!gate.validDeck) return "Bộ bài chưa hợp lệ — hãy chỉnh sửa";
  if (gate.assets === "error") return "Lỗi tải hình — nhấn Thử lại";
  if (gate.assets !== "ready") return "Đang tải hình trận…";
  return "";
}
/** Increment on requests, close and shutdown, rejecting out-of-order callbacks. */
export class RequestIdentity {
  private identity = 0;
  next() { return ++this.identity; }
  current(id: number) { return this.identity === id; }
}
