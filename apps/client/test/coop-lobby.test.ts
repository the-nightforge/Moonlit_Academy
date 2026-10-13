import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile, starterDeck } from "rules";
import { CoopLobbyFlow, coopLobbyError, coopLobbyModel, coopWaitTime, normalizeCoopRoomCode, type CoopGate } from "../src/ui/coop-lobby-presentation";

const data = loadGameData();
function profile() {
  const p = createProfile(data);
  const heroes = Object.keys(p.heroes).slice(0, 3) as [string, string, string];
  p.decks = [{ id: "d1", name: "Liên Thủ", heroIds: heroes, cardIds: starterDeck(data, heroes) }];
  return p;
}
const ready: CoopGate = { online: true, connected: true, assets: "ready", phase: "idle", rewards: { clearsToday: 0, rewardClaimsLeft: 3 } };

describe("coop lobby presentation", () => {
  it("explains room failures without displaying raw server codes", () => {
    expect(coopLobbyError("unknown room")).toMatch(/Mã phòng/);
    expect(coopLobbyError("room mode mismatch")).toMatch(/Liên Thủ/);
    expect(coopLobbyError("invalid deck")).toMatch(/Bộ bài/);
    expect(coopLobbyError("unexpected internal detail")).toBe("Không thể thực hiện yêu cầu. Hãy thử lại.");
  });
  it("requires an explicit saved deck and uses the real PvE deck validation", () => {
    const p = profile();
    expect(coopLobbyModel(data, p, null, ready).canStart).toBe(false);
    const model = coopLobbyModel(data, p, "d1", ready);
    expect(model.selected?.deck.id).toBe("d1");
    expect(model.selected?.errors).toEqual([]);
    expect(model.canStart).toBe(true);
    p.decks[0]!.cardIds.pop();
    const invalid = coopLobbyModel(data, p, "d1", ready);
    expect(invalid.canStart).toBe(false);
    expect(invalid.selected?.errors.some(e => e.code === "wrongSize")).toBe(true);
  });

  it("blocks sends for connection/assets/pending states while leaving deck selection available offline", () => {
    const p = profile();
    for (const gate of [{ ...ready, online: false }, { ...ready, connected: false }, { ...ready, assets: "loading" as const }, { ...ready, assets: "error" as const }]) {
      const model = coopLobbyModel(data, p, "d1", gate);
      expect(model.canStart).toBe(false);
      expect(model.canEdit).toBe(true);
      expect(model.blockedReason.length).toBeGreaterThan(0);
    }
    expect(coopLobbyModel(data, p, "d1", { ...ready, phase: "queued" }).canEdit).toBe(false);
  });

  it("allows playing after the daily rewards are exhausted and never invents unloaded counts", () => {
    const p = profile();
    const exhausted = coopLobbyModel(data, p, "d1", { ...ready, rewards: { clearsToday: 4, rewardClaimsLeft: 0 } });
    expect(exhausted.canStart).toBe(true);
    expect(exhausted.claimsLeft).toBe(0);
    expect(coopLobbyModel(data, p, "d1", { ...ready, rewards: null }).claimsLeft).toBeNull();
  });

  it("normalizes only valid six-character room codes and clamps the queue clock", () => {
    expect(normalizeCoopRoomCode(" k7q2mx ")).toBe("K7Q2MX");
    for (const input of ["", "K7Q2M", "K7Q2MXX", "K7-QMX", "K7 QMX"]) expect(normalizeCoopRoomCode(input)).toBeNull();
    expect(coopWaitTime(65.9)).toBe("1:05");
    expect(coopWaitTime(-5)).toBe("0:00");
  });
});

describe("coop lobby requests", () => {
  it("deduplicates requests and ignores other-mode or late queue acknowledgements after cancel", () => {
    const flow = new CoopLobbyFlow();
    expect(flow.begin("queue", true)).toBe(true);
    expect(flow.begin("practice", true)).toBe(false);
    expect(flow.handle({ type: "queue.status", mode: "pvp", waitingSeconds: 9 })).toBe(false);
    expect(flow.handle({ type: "queue.status", mode: "coop", waitingSeconds: 8 })).toBe(true);
    expect(flow.phase).toBe("queued");
    expect(flow.waitingSeconds).toBe(8);
    expect(flow.leave()).toBe("queue.leave");
    expect(flow.handle({ type: "queue.status", mode: "coop", waitingSeconds: 10 })).toBe(false);
    expect(flow.phase).toBe("idle");
  });

  it("keeps actual room participants and leaves a room once before allowing a different action", () => {
    const flow = new CoopLobbyFlow();
    expect(flow.begin("create-room", false)).toBe(false);
    expect(flow.begin("create-room", true)).toBe(true);
    const players = [{ username: "ban_1", ready: true }];
    expect(flow.handle({ type: "room.created", mode: "coop", code: "K7Q2MX", players })).toBe(true);
    expect(flow.room).toEqual({ code: "K7Q2MX", players });
    expect(flow.begin("queue", true)).toBe(false);
    expect(flow.leave()).toBe("room.leave");
    expect(flow.leave()).toBeNull();
    expect(flow.begin("practice", true)).toBe(true);
  });

  it("clears waiting state on disconnect and server errors without keeping a phantom queue", () => {
    const flow = new CoopLobbyFlow();
    flow.begin("queue", true);
    flow.handle({ type: "queue.status", mode: "coop", waitingSeconds: 4 });
    flow.disconnected();
    expect(flow.phase).toBe("idle");
    expect(flow.waitingSeconds).toBe(0);
    flow.begin("join-room", true);
    expect(flow.handle({ type: "error", error: "room not found" })).toBe(true);
    expect(flow.phase).toBe("idle");
    expect(flow.room).toBeNull();
  });
});
