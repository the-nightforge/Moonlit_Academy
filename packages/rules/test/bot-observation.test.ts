import { describe, expect, it } from "vitest";
import {
  chooseCombatAction,
  createCoopCombat,
  createPvpCombat,
  makeBotObservation,
} from "../src/index";
import type { CombatState, CoopSide, GameData, PvpSide } from "../src/index";
import { makeTestCombat, p0, testData } from "./helpers";

function pvpSide(heroIds: [string, string, string]): PvpSide {
  return { heroIds, loadout: { heroes: {}, pvp: true } };
}

function makePvpState(seed = 42): CombatState {
  const data = testData();
  return createPvpCombat(data, {
    seed,
    players: [pvpSide(["m05", "f04", "m06"]), pvpSide(["f03", "f02", "m03"])],
  }).state;
}

function makeCoopState(seed = 42): { data: GameData; state: CombatState } {
  const data = testData();
  const side = (heroIds: [string, string, string]): CoopSide => ({
    heroIds,
    loadout: { heroes: {} },
  });
  const created = createCoopCombat(data, {
    seed,
    players: [side(["m05", "f04", "m06"]), side(["f03", "f02", "m03"])],
    encounterId: "enc_coop_01",
  });
  return { data, state: created.state };
}

describe("bot observation — hidden information", () => {
  it("hidden_variant_has_same_observation_and_default_action", () => {
    // PvE: only hidden fields may differ — draw order, rng and unrevealed chains.
    const pve = makeTestCombat();
    const variant = structuredClone(pve.state) as CombatState;
    variant.rngState = 987654321;
    variant.players[0]!.drawPile = [...variant.players[0]!.drawPile].reverse();
    for (const enemy of variant.enemies) {
      enemy.plannedIntents = enemy.plannedIntents.map((planned) => ({ ...planned, targetId: null }));
      enemy.plannedIntents = [...enemy.plannedIntents].reverse();
    }
    const beforePve = JSON.stringify(pve.state);
    const obsA = makeBotObservation(pve.data, pve.state, 0, "pve", [], null);
    const obsB = makeBotObservation(pve.data, variant, 0, "pve", [], null);
    expect(obsB.visibleState).toEqual(obsA.visibleState);
    expect(chooseCombatAction(pve.data, obsB.visibleState, 0)).toEqual(
      chooseCombatAction(pve.data, obsA.visibleState, 0),
    );
    expect(JSON.stringify(pve.state)).toBe(beforePve); // original state not mutated
    // Own hand/choice stay visible; enemy fund (public on the portrait) stays.
    expect(obsA.visibleState.players[0]!.hand).toEqual(pve.state.players[0]!.hand);
    expect(obsA.visibleState.enemies.map((e) => e.moonPower)).toEqual(
      pve.state.enemies.map((e) => e.moonPower),
    );
    // Frozen: policy code cannot reach back into engine state.
    expect(Object.isFrozen(obsA.visibleState)).toBe(true);
    expect(Object.isFrozen(obsA.visibleState.players[0])).toBe(true);
    expect(Object.isFrozen(obsA.history)).toBe(true);
    expect(Object.isFrozen(obsA)).toBe(true);

    // PvP: opponent hand/choice/deck and every hidden cards mapping may differ.
    const pvp = makePvpState();
    const variantPvp = structuredClone(pvp) as CombatState;
    variantPvp.rngState = 123456789;
    variantPvp.players[1]!.drawPile = [...variantPvp.players[1]!.drawPile].reverse();
    variantPvp.players[1]!.hand = [...variantPvp.players[1]!.hand].reverse();
    variantPvp.players[1]!.pendingChoice = { kind: "chooseMoon", expiresAt: 0 } as never;
    for (const instance of Object.values(variantPvp.cards)) {
      if (instance.player === 1) instance.cardId = instance.cardId; // ids hidden anyway
    }
    const obsP0 = makeBotObservation(testData(), pvp, 0, "pvp", [], null);
    const obsP0v = makeBotObservation(testData(), variantPvp, 0, "pvp", [], null);
    expect(obsP0v.visibleState).toEqual(obsP0.visibleState);
    expect(chooseCombatAction(testData(), obsP0v.visibleState, 0)).toEqual(
      chooseCombatAction(testData(), obsP0.visibleState, 0),
    );
    expect(obsP0.visibleState.players[1]!.pendingChoice).toBeNull();
    expect(obsP0.visibleState.players[1]!.hand.every((id) => id.startsWith("hidden_"))).toBe(true);

    // A card the opponent publicly discarded stays addressable (prior reveal usable).
    const pvp2 = makePvpState(7);
    const discardId = pvp2.players[1]!.hand[0]!;
    pvp2.players[1]!.hand.shift();
    pvp2.players[1]!.discardPile.push(discardId);
    const obsReveal = makeBotObservation(testData(), pvp2, 0, "pvp", [], null);
    expect(obsReveal.visibleState.cards[discardId]?.cardId).toBe(pvp2.cards[discardId]!.cardId);

    // Co-op: partner hand is public, draw order + partner choice are hidden.
    const coop = makeCoopState();
    const variantCoop = structuredClone(coop.state) as CombatState;
    variantCoop.rngState = 555;
    for (const seat of variantCoop.players) seat.drawPile = [...seat.drawPile].reverse();
    variantCoop.players[1]!.pendingChoice = { kind: "chooseMoon" } as never;
    const obsC = makeBotObservation(coop.data, coop.state, 0, "coop", [], null);
    const obsCv = makeBotObservation(coop.data, variantCoop, 0, "coop", [], null);
    expect(obsCv.visibleState).toEqual(obsC.visibleState);
    expect(obsC.visibleState.players[1]!.hand).toEqual(coop.state.players[1]!.hand);
    expect(obsC.visibleState.players[1]!.pendingChoice).toBeNull();
  });
});
