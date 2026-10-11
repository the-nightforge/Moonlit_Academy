import { describe, expect, it } from "vitest";
import { arenaActionReason, formatQueueTime, rankProgress, RequestIdentity } from "../src/ui/arena-presentation";

describe("arena presentation behavior", () => {
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
