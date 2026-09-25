import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { makeTestCombat } from "./helpers";

describe("mulligan (Đổi Bài)", () => {
  it("T137: swapped cards are replaced by the top of the pile before the reshuffle", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    expect(state.status).toBe("mulligan");
    expect(state.hand).toHaveLength(6);
    const [a, b] = state.hand as [string, string];
    const top = state.drawPile.slice(0, 2);

    const result = applyAction(data, state, { type: "mulligan", instanceIds: [a, b] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[0]).toEqual({ type: "mulliganed", returned: [a, b], drawn: top });
    expect(result.state.hand.slice(0, 2)).toEqual(top);
    expect(result.state.hand).not.toContain(a);
    expect(result.state.hand).not.toContain(b);
    expect(result.state.drawPile).toContain(a);
    expect(result.state.drawPile).toContain(b);
    expect(result.state.status).toBe("playerTurn");

    const kept = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.state.hand).toEqual(state.hand);
    expect(kept.state.drawPile).toEqual(state.drawPile);
    expect(kept.state.rngState).toBe(state.rngState);
  });

  it("T138: invalid mulligans and other actions during the mulligan are rejected", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    const [a, b, c] = state.hand as [string, string, string];
    const reject = (action: Parameters<typeof applyAction>[2]) =>
      applyAction(data, state, action);

    expect(reject({ type: "mulligan", instanceIds: [a, b, c] })).toEqual({ ok: false, error: "too many cards to mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [a, a] })).toEqual({ ok: false, error: "duplicate card in mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [state.drawPile[0]!] })).toEqual({ ok: false, error: "card is not in hand" });
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
