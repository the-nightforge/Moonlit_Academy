import { describe, expect, it } from "vitest";
import {
  applyAction,
  getValidTargets,
  isCardPlayable,
} from "../src/index";
import type { Action, CombatState, GameData } from "../src/index";
import { makeTestCombat, setIntent } from "./helpers";
import { strike9Intent } from "./fixtures";

function pickAction(data: GameData, state: CombatState): Action {
  for (const instanceId of state.hand) {
    if (!isCardPlayable(data, state, instanceId)) continue;
    const card = data.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(data, state, instanceId);
    if (targets.length === 0) continue;
    return { type: "playCard", instanceId, targetId: targets[0] };
  }
  return { type: "endTurn" };
}

describe("turn flow", () => {
  it("T03: same seed and same actions produce identical state and events", () => {
    const runA = makeTestCombat();
    const actions: Action[] = [];
    let stateA = runA.state;
    const eventsA = [...runA.events];
    for (let i = 0; i < 10; i++) {
      const action = pickAction(runA.data, stateA);
      actions.push(action);
      const result = applyAction(runA.data, stateA, action);
      if (!result.ok) break;
      stateA = result.state;
      eventsA.push(...result.events);
    }

    const runB = makeTestCombat();
    let stateB = runB.state;
    const eventsB = [...runB.events];
    for (const action of actions) {
      const result = applyAction(runB.data, stateB, action);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      stateB = result.state;
      eventsB.push(...result.events);
    }

    expect(stateB).toEqual(stateA);
    expect(eventsB).toEqual(eventsA);
  });

  it("T07: endTurn runs the full round cycle", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        setIntent(s, 0, strike9Intent, "hero:m05");
        setIntent(s, 1, strike9Intent, "hero:m06");
      },
    });
    const hand = [...state.hand];
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round).toBe(2);
    expect(result.state.moonIndex).toBe(2);
    expect(result.state.moonPower).toBe(
      data.combatConfig.moonPower.start +
        data.combatConfig.moonPower.perRound +
        data.combatConfig.moonReserveMax,
    );
    expect(result.state.hand).toEqual(hand);
    const types = result.events.map((e) => e.type);
    expect(types).not.toContain("cardDiscarded");
    expect(types).toContain("intentExecuted");
    expect(types).toContain("moonShifted");
    expect(types).toContain("intentsRevealed");
    expect(types).not.toContain("cardsDrawn");
  });
});
