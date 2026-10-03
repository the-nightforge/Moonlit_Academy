import { describe, expect, it, vi } from "vitest";
import type { CombatEvent } from "rules";
import { NetMatch } from "../src/net/match";
import type { MatchSnapshot, ServerMessage } from "../src/net/protocol";
import { fixture, snapshot } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
});
const { recoverMatchGone, session } = await import("../src/session");

/** A fake transport: captures match frames and can refuse them when "offline". */
function makeNet(opts: { online?: boolean } = {}) {
  const sent: Record<string, unknown>[] = [];
  const online = opts.online ?? true;
  return {
    sent,
    sendMatch: vi.fn((message: Record<string, unknown>) => {
      if (!online) return false;
      sent.push(message);
      return true;
    }),
  };
}

function makeMatch(opts: { online?: boolean; nextActionSeq?: number; mode?: "pvp" | "coop" } = {}) {
  const net = makeNet(opts);
  const { state } = fixture(opts.mode ?? "pvp");
  const start = snapshot(state, 0, { nextActionSeq: opts.nextActionSeq ?? 1 });
  const match = new NetMatch(net as never, start);
  return { match, net, start, state };
}

const events = (match: MatchSnapshot, seqs: { eventSeq: number; nextActionSeq: number }, list: CombatEvent[] = []): ServerMessage => ({
  type: "match.events",
  matchId: match.matchId,
  eventSeq: seqs.eventSeq,
  nextActionSeq: seqs.nextActionSeq,
  events: list,
  view: match.view,
  deadline: null,
});

describe("NetMatch pending gate", () => {
  it("pending tracks the unacked action until the server acks it", () => {
    const { match, start } = makeMatch();
    expect(match.pending).toBe(false);
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(match.pending).toBe(true);

    // A partner push carries our unchanged seat seq — it does not ack ours.
    match.handle(events(start, { eventSeq: 1, nextActionSeq: 1 }));
    expect(match.pending).toBe(true);

    // The server acking our seq opens it again.
    match.handle(events(start, { eventSeq: 2, nextActionSeq: 2 }));
    expect(match.pending).toBe(false);
  });
});

describe("NetMatch action sequence", () => {
  it("rejoin resyncs the seq and drops a lost pending action", () => {
    const { match, net, start } = makeMatch();
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.map((m) => m.seq)).toEqual([1]);

    // The server never saw seq 1: the client resends it under the same seq.
    expect(match.rejoin({ ...start, nextActionSeq: 1 })).toBe(true);
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.map((m) => m.seq)).toEqual([1, 1]);

    // The server is further ahead: the client jumps to its expected seq.
    expect(match.rejoin({ ...start, nextActionSeq: 4 })).toBe(false);
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.at(-1)?.seq).toBe(4);
  });

  it("rejoin reports no loss for a pending the server already accepted", () => {
    const { match, start } = makeMatch();
    match.sendAction({ type: "endTurn" });
    // Server consumed seq 1: no unconfirmed action to complain about.
    expect(match.rejoin({ ...start, nextActionSeq: 2 })).toBe(false);
  });

  it("a pending action blocks the next send until the server acknowledges it", () => {
    const { match, net, start } = makeMatch();
    match.sendAction({ type: "endTurn" });
    expect(match.sendAction({ type: "endTurn" })).toBe(false);
    expect(net.sent).toHaveLength(1);

    // nextActionSeq=1 means the server has not consumed seq 1 yet — still pending.
    expect(match.handle(events(start, { eventSeq: 1, nextActionSeq: 1 }))).toBe(true);
    expect(match.sendAction({ type: "endTurn" })).toBe(false);

    // nextActionSeq=2 acknowledges seq 1 — the next action leaves as seq 2.
    expect(match.handle(events(start, { eventSeq: 2, nextActionSeq: 2 }))).toBe(true);
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.at(-1)?.seq).toBe(2);
  });

  it("a rejection frees the pending slot and resyncs seq from the server", () => {
    const { match, net, start } = makeMatch();
    const onRejected = vi.fn();
    match.onRejected = onRejected;
    match.sendAction({ type: "endTurn" });
    match.handle({ type: "match.rejected", matchId: start.matchId, seq: 1, reason: "bad seq", nextActionSeq: 1 });
    expect(onRejected).toHaveBeenCalledWith("bad seq");
    // The server still expects seq 1 — the retry keeps it.
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.at(-1)?.seq).toBe(1);
  });

  it("sendAction offline sends nothing and keeps the seq", () => {
    const { match, net } = makeMatch({ online: false });
    expect(match.sendAction({ type: "endTurn" })).toBe(false);
    expect(net.sent).toHaveLength(0);
    // Once back online the same seq leaves — nothing was consumed.
    net.sendMatch.mockImplementation((message: Record<string, unknown>) => {
      net.sent.push(message);
      return true;
    });
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.at(-1)?.seq).toBe(1);
  });

  it("requestSync sends match.sync without consuming an action seq", () => {
    const { match, net } = makeMatch();
    expect(match.requestSync()).toBe(true);
    expect(net.sent.at(-1)).toMatchObject({ type: "match.sync", matchId: match.matchId });
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
    expect(net.sent.at(-1)?.seq).toBe(1);
  });

  it("a match.snapshot answer applies like a rejoin and reports the lost pending", () => {
    const { match, start } = makeMatch();
    const onRejoin = vi.fn();
    match.onRejoin = onRejoin;
    match.sendAction({ type: "endTurn" }); // pending seq 1
    const snap: ServerMessage = { type: "match.snapshot", ...start, eventSeq: 7, nextActionSeq: 1 };
    expect(match.handle(snap)).toBe(true);
    expect(onRejoin).toHaveBeenCalledWith(expect.objectContaining({ eventSeq: 7 }), true);
    // Seq was resynced: the resend keeps seq 1.
    match.sendAction({ type: "endTurn" });
  });

  it("a replayed match.events at the same eventSeq still acknowledges the pending", () => {
    const { match, start } = makeMatch();
    const onPush = vi.fn();
    match.onPush = onPush;
    match.sendAction({ type: "endTurn" });
    // Same eventSeq as the snapshot (0): no push fires, but seq 1 is acknowledged.
    expect(match.handle(events(start, { eventSeq: 0, nextActionSeq: 2 }))).toBe(true);
    expect(onPush).not.toHaveBeenCalled();
    expect(match.sendAction({ type: "endTurn" })).toBe(true);
  });
});

describe("NetMatch settlement", () => {
  it("a terminal snapshot restores ended from settlement.complete", () => {
    const { state } = fixture("pvp");
    const end = {
      result: "won" as const,
      reason: "combat",
      rating: { before: 1000, after: 1016 },
      rewards: { honor: 20 },
      profileRev: 3,
    };
    const snap = snapshot(state, 0, { settlement: { status: "complete", end } });
    const match = new NetMatch(makeNet() as never, snap);
    expect(match.ended).toEqual(end);
    expect(match.settlement.status).toBe("complete");
  });

  it("settlement.failed keeps the provisional result and reports the failure", () => {
    const { state } = fixture("pvp");
    const snap = snapshot(state, 0, { settlement: { status: "failed", error: "db down" } });
    const match = new NetMatch(makeNet() as never, snap);
    expect(match.ended).toBeNull();
    expect(match.settlement).toEqual({ status: "failed", error: "db down" });
  });

  it("settlement.pending leaves ended null — the terminal view stays provisional", () => {
    const { state } = fixture("pvp");
    const snap = snapshot(state, 0, { settlement: { status: "pending" } });
    const match = new NetMatch(makeNet() as never, snap);
    expect(match.ended).toBeNull();
    expect(match.settlement.status).toBe("pending");
  });

  it("match.end completes the settlement", () => {
    const { match, start } = makeMatch();
    const onEnd = vi.fn();
    match.onEnd = onEnd;
    const frame = {
      type: "match.end" as const,
      matchId: start.matchId,
      result: "won" as const,
      reason: "combat",
      rating: { before: 1000, after: 1016 },
      rewards: { honor: 20 },
      profileRev: 5,
    };
    expect(match.handle(frame)).toBe(true);
    expect(match.ended).toMatchObject({ result: "won", profileRev: 5 });
    expect(match.settlement).toEqual({ status: "complete", end: match.ended });
    expect(onEnd).toHaveBeenCalledWith("won", "combat");
  });
});

describe("recoverMatchGone", () => {
  it("drops the match, notices, refreshes the profile and returns to the arena", () => {
    const { match } = makeMatch();
    session.match = match;
    session.notices = [];
    const abortPlayback = vi.fn();
    const startScene = vi.fn();
    const refreshProfile = vi.fn(() => Promise.resolve(true));
    recoverMatchGone(match, { abortPlayback, startScene, refreshProfile });
    expect(abortPlayback).toHaveBeenCalled();
    expect(session.match).toBeNull();
    expect(session.notices).toContain("Trận đã kết thúc.");
    expect(startScene).toHaveBeenCalledWith("arena");
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it("routes a co-op match to coop-lobby", () => {
    const { match } = makeMatch({ mode: "coop" });
    session.match = match;
    session.notices = [];
    const startScene = vi.fn();
    recoverMatchGone(match, {
      abortPlayback: vi.fn(),
      startScene,
      refreshProfile: () => Promise.resolve(true),
    });
    expect(startScene).toHaveBeenCalledWith("coop-lobby");
  });
});
