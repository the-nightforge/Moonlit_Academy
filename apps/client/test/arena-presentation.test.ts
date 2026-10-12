import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { arenaActionReason, arenaHeroLines, formatArenaDate, formatQueueTime, rankProgress, RequestIdentity } from "../src/ui/arena-presentation";

describe("arena presentation behavior", () => {
  it("previews PvP health and both awakening effects with the base threshold", () => {
    const data = loadGameData(), hero = data.heroes.m05!;
    const lines = arenaHeroLines(data, hero.id);
    expect(lines).toContain(`Máu PvP: ${data.pvpConfig.heroStats.m05!.maxHp}`);
    expect(lines.join("\n")).toContain(hero.levelUp.description);
    expect(lines.join("\n")).toContain(hero.altLevelUp.description);
    expect(lines.join("\n")).toContain(`Ngưỡng cơ bản: ${hero.levelUp.threshold}`);
    expect(arenaHeroLines(data, "missing")).toEqual(["Không có thông tin Hero"]);
  });
  it("formats local history dates and preserves years for old matches", () => {
    const now = new Date(2026, 9, 12, 12).getTime();
    expect(formatArenaDate(new Date(2026, 9, 12, 9, 5).getTime(), now)).toBe("Hôm nay · 09:05");
    expect(formatArenaDate(new Date(2026, 9, 11, 9, 5).getTime(), now)).toBe("11/10 · 09:05");
    expect(formatArenaDate(new Date(2025, 9, 11, 9, 5).getTime(), now)).toBe("11/10/2025 · 09:05");
    expect(formatArenaDate(NaN, now)).toBe("—");
  });
  it("uses the supplied tier thresholds and names the next goal", () => {
    const tiers = [{ id: "dong", name: "Đồng Sinh", minRating: 0 }, { id: "tu", name: "Tú Tài", minRating: 1100 }];
    expect(rankProgress(1000, tiers)).toEqual({ next: tiers[1], remaining: 100, fraction: 1000 / 1100 });
    expect(rankProgress(1200, tiers)).toEqual({ next: null, remaining: 0, fraction: 1 });
    expect(rankProgress(1000, []).next).toBeNull();
  });
  it("formats server wait seconds without inventing elapsed time", () => {
    expect(formatQueueTime(84)).toBe("01:24");
    expect(formatQueueTime(3605.9)).toBe("60:05");
    expect(formatQueueTime(-10)).toBe("00:00");
  });
  it("blocks contradictory starts and disconnected sends", () => {
    const ready = { connected: true, savedDeck: true, validDeck: true, assets: "ready" as const, queued: false, room: false, pending: false };
    expect(arenaActionReason(ready)).toBe("");
    expect(arenaActionReason({ ...ready, connected: false })).toContain("kết nối");
    expect(arenaActionReason({ ...ready, queued: true })).toContain("hàng chờ");
    expect(arenaActionReason({ ...ready, room: true })).toContain("phòng");
    expect(arenaActionReason({ ...ready, pending: true })).toContain("yêu cầu");
    expect(arenaActionReason({ ...ready, savedDeck: false })).toContain("đã lưu");
    expect(arenaActionReason({ ...ready, validDeck: false })).toContain("hợp lệ");
    expect(arenaActionReason({ ...ready, assets: "error" })).toContain("Thử lại");
  });
  it("rejects an older request after another request or modal close", () => {
    const requests = new RequestIdentity();
    const older = requests.next();
    const latest = requests.next();
    expect(requests.current(older)).toBe(false);
    expect(requests.current(latest)).toBe(true);
    requests.next();
    expect(requests.current(latest)).toBe(false);
  });
});
