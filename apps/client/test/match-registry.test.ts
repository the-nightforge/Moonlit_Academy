import { describe, expect, it, vi } from "vitest";
import type { CombatEvent } from "rules";
import type { MatchSnapshot, ServerMessage } from "../src/net/protocol";
import { fixture, snapshot } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
});
const { MatchRegistry } = await import("../src/net/match-registry");
const { NetMatch } = await import("../src/net/match");

/** A fake transport: captures match frames; can refuse them when "offline". */
function makeNet() {
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    sendMatch: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      return true;
    }),
  };
}

function makeMatch(matchId: string, net = makeNet()) {
  const { state } = fixture("pvp");
  const start = snapshot(state, 0, { matchId });
  const match = new NetMatch(net as never, start);
  return { match, net, start, state };
}

/** What the combat scene's shutdown does: visual hooks become no-ops. */
function unbindCombatCallbacks(match: InstanceType<typeof NetMatch>): void {
  match.onPush = () => {};
  match.onEnd = () => {};
  match.onRejected = () => {};
  match.onEmote = () => {};
  match.onRejoin = () => {};
}

function endFrame(matchId: string): ServerMessage {
  return { type: "match.end", matchId, result: "won", reason: "combat", rewards: { honor: 20 }, profileRev: 7 };
}

function eventsFrame(matchId: string, view: MatchSnapshot["view"], eventSeq = 1): ServerMessage {
  return { type: "match.events", matchId, eventSeq, nextActionSeq: 1, events: [] as CombatEvent[], view, deadline: null };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("MatchRegistry", () => {
  it("settles a sceneless retained match exactly once — late and duplicate frames", async () => {
    const notices: string[] = [];
    const refresh = vi.fn(async () => {});
    const registry = new MatchRegistry(
      async () => {
        await refresh();
        notices.push("Trận trước: Thắng — +20 Vinh Dự");
      },
      (text) => notices.push(text),
    );
    const { match, start } = makeMatch("m_old");
    registry.retain(match);
    unbindCombatCallbacks(match); // the combat scene is gone

    const frame = endFrame(start.matchId);
    expect(registry.handle(frame)).toBe(true);
    expect(registry.handle(frame)).toBe(true); // duplicate absorbed by the tombstone
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(notices).toHaveLength(1);
  });

  it("a late end of an old match never touches the live one", async () => {
    const registry = new MatchRegistry(async () => {});
    const { match: oldMatch } = makeMatch("m_old");
    const { match: live } = makeMatch("m_live");
    registry.retain(oldMatch);
    registry.retain(live);
    const viewBefore = live.view;

    registry.handle(endFrame("m_old"));
    registry.handle(eventsFrame("m_old", live.view));
    expect(live.view).toBe(viewBefore);
    expect(live.ended).toBeNull();
    expect(oldMatch.ended).not.toBeNull();
  });

  it("recover rejoins the retained active match once and syncs every other pending id", () => {
    const registry = new MatchRegistry(async () => {});
    const { match: active, net: activeNet } = makeMatch("m_live");
    const { match: other, net: otherNet } = makeMatch("m_other");
    registry.retain(active);
    registry.retain(other);

    active.sendAction({ type: "endTurn" }); // pending seq 1 — unconfirmed
    const snap = snapshot(active.view, 0, { matchId: "m_live", nextActionSeq: 1 });
    registry.recover(snap);

    // The active match was rejoined by the registry — the lost pending is consumed once.
    expect(registry.consumeLostPending("m_live")).toBe(true);
    expect(registry.consumeLostPending("m_live")).toBe(false);
    expect(activeNet.sent.filter((m) => m.type === "match.sync")).toHaveLength(0);
    // The other pending retained id got a sync request.
    expect(otherNet.sent.filter((m) => m.type === "match.sync")).toHaveLength(1);
  });

  it("recover(null) requests a sync for every retained pending match", () => {
    const registry = new MatchRegistry(async () => {});
    const { match: a, net: netA } = makeMatch("m_a");
    const { match: b, net: netB } = makeMatch("m_b");
    registry.retain(a);
    registry.retain(b);
    registry.recover(null);
    expect(netA.sent.filter((m) => m.type === "match.sync")).toHaveLength(1);
    expect(netB.sent.filter((m) => m.type === "match.sync")).toHaveLength(1);
  });

  it("released tombstones absorb every later frame for that match", () => {
    const registry = new MatchRegistry(async () => {});
    const { match, start } = makeMatch("m_done");
    registry.retain(match);
    registry.handle(endFrame(start.matchId));
    registry.release(start.matchId);
    expect(registry.handle(eventsFrame(start.matchId, match.view))).toBe(true);
    expect(registry.handle({ type: "match.snapshot", ...snapshot(match.view, 0, { matchId: "m_done" }) })).toBe(true);
    expect(registry.handle(endFrame(start.matchId))).toBe(true);
  });

  it("unknown matches: scene frames pass through, match traffic is absorbed", () => {
    const registry = new MatchRegistry(async () => {});
    const { state } = fixture("pvp");
    expect(registry.handle(eventsFrame("m_unknown", state))).toBe(true);
    expect(registry.handle(endFrame("m_unknown"))).toBe(true);
    expect(registry.handle({ type: "match.start", ...snapshot(state, 0, { matchId: "m_unknown" }) })).toBe(false);
    expect(registry.handle({ type: "match.snapshot", ...snapshot(state, 0, { matchId: "m_unknown" }) })).toBe(false);
    expect(registry.handle({ type: "queue.status", mode: "ranked", waitingSeconds: 0 })).toBe(false);
  });

  it("a settlement failure notifies once and never double-reports", async () => {
    const notices: string[] = [];
    const settled = vi.fn(async () => {});
    const registry = new MatchRegistry(settled, (text) => notices.push(text));
    const { match, start } = makeMatch("m_fail");
    registry.retain(match);
    const frame: ServerMessage = {
      type: "match.end",
      matchId: start.matchId,
      result: "lost",
      reason: "resign",
      settlementError: "db down",
    };
    registry.handle(frame);
    registry.handle(frame);
    await flush();
    expect(settled).not.toHaveBeenCalled();
    expect(notices.filter((t) => t.includes("Không nhận được thông tin thưởng"))).toHaveLength(1);
  });
});
