import { describe, expect, it, vi } from "vitest";
import type { CombatEvent } from "rules";
import { NetMatch } from "../src/net/match";
import type { MatchSnapshot, ServerMessage } from "../src/net/protocol";
import { fixture, snapshot } from "./helpers/combat-fixture";

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

function makeMatch(opts: { online?: boolean; nextActionSeq?: number } = {}) {
  const net = makeNet(opts);
  const { state } = fixture("pvp");
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
