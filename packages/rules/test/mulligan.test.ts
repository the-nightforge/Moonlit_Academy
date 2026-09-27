import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { makeTestCombat, p0 } from "./helpers";

describe("mulligan (Đổi Bài)", () => {
  it("T137: swapped cards are replaced by the top of the pile before the reshuffle", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    expect(state.status).toBe("mulligan");
    expect(p0(state).hand).toHaveLength(6);
    const [a, b] = p0(state).hand as [string, string];
    const top = p0(state).drawPile.slice(0, 2);

    const result = applyAction(data, state, { type: "mulligan", instanceIds: [a, b] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[0]).toEqual({ type: "mulliganed", returned: [a, b], drawn: top });
    expect(p0(result.state).hand.slice(0, 2)).toEqual(top);
    expect(p0(result.state).hand).not.toContain(a);
    expect(p0(result.state).hand).not.toContain(b);
    expect(p0(result.state).drawPile).toContain(a);
    expect(p0(result.state).drawPile).toContain(b);
    expect(result.state.status).toBe("playerTurn");

    const kept = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(p0(kept.state).hand).toEqual(p0(state).hand);
    expect(p0(kept.state).drawPile).toEqual(p0(state).drawPile);
    expect(kept.state.rngState).toBe(state.rngState);
  });

  it("T138: invalid mulligans and other actions during the mulligan are rejected", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    const [a, b, c] = p0(state).hand as [string, string, string];
    const reject = (action: Parameters<typeof applyAction>[2]) =>
      applyAction(data, state, action);

    expect(reject({ type: "mulligan", instanceIds: [a, b, c] })).toEqual({ ok: false, error: "too many cards to mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [a, a] })).toEqual({ ok: false, error: "duplicate card in mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [p0(state).drawPile[0]!] })).toEqual({ ok: false, error: "card is not in hand" });
    expect(reject({ type: "endTurn" })).toEqual({ ok: false, error: "mulligan pending" });
    expect(reject({ type: "playCard", instanceId: a })).toEqual({ ok: false, error: "mulligan pending" });

    const done = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(applyAction(data, done.state, { type: "mulligan", instanceIds: [] })).toEqual({
      ok: false,
      error: "mulligan already done",
    });
  });
});
