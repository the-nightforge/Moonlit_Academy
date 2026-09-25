import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand } from "./helpers";

function setupGuide() {
  return makeTestCombat({
    setup: (s) => {
      setHand(s, ["f04_nguyet_quang_dan"]);
      s.moonPower = 11;
    },
  });
}

describe("chooseCard (Chiêm Bài)", () => {
  it("T144: opens a choice of the top 3; the pick goes to hand, the rest to the bottom in order", () => {
    const { data, state } = setupGuide();
    const guide = instanceIdOf(state, "f04_nguyet_quang_dan");
    const top = state.drawPile.slice(0, 3) as [string, string, string];
    const played = applyAction(data, state, { type: "playCard", instanceId: guide });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.status).toBe("choosing");
    expect(played.state.pendingChoice).toEqual({ kind: "chooseCard", options: top });
    expect(played.events).toContainEqual({ type: "choiceOpened", options: top });
    expect(played.state.drawPile).not.toContain(top[0]);
    expect(played.state.discardPile).toContain(guide);

    expect(applyAction(data, played.state, { type: "endTurn" })).toEqual({ ok: false, error: "choice pending" });
    expect(
      applyAction(data, played.state, { type: "chooseCard", instanceId: played.state.drawPile[0]! }),
    ).toEqual({ ok: false, error: "not a choice option" });

    const chosen = applyAction(data, played.state, { type: "chooseCard", instanceId: top[1] });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(chosen.events).toEqual([{ type: "cardChosen", instanceId: top[1], bottomed: [top[0], top[2]] }]);
    expect(chosen.state.hand).toContain(top[1]);
    expect(chosen.state.drawPile.slice(-2)).toEqual([top[0], top[2]]);
    expect(chosen.state.status).toBe("playerTurn");
    expect(chosen.state.pendingChoice).toBeNull();
    expect(applyAction(data, chosen.state, { type: "chooseCard", instanceId: top[0] })).toEqual({
      ok: false,
      error: "no pending choice",
    });
  });

  it("T145: with one card left it is taken directly; with none nothing happens", () => {
    const one = setupGuide();
    const last = one.state.drawPile[0]!;
    one.state.drawPile = [last];
    const took = applyAction(one.data, one.state, {
      type: "playCard",
      instanceId: instanceIdOf(one.state, "f04_nguyet_quang_dan"),
    });
    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.state.status).toBe("playerTurn");
    expect(took.state.hand).toContain(last);
    expect(took.events).toContainEqual({ type: "cardsDrawn", instanceIds: [last] });

    const none = setupGuide();
    none.state.drawPile = [];
    const empty = applyAction(none.data, none.state, {
      type: "playCard",
      instanceId: instanceIdOf(none.state, "f04_nguyet_quang_dan"),
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.state.status).toBe("playerTurn");
    expect(empty.events.some((e) => e.type === "choiceOpened" || e.type === "cardsDrawn")).toBe(false);
  });
});
