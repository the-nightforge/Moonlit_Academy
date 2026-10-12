import { describe, expect, it } from "vitest";
import type { Action, CombatState, GameData, PvpSide } from "../src/index";
import { applyAction, createPvpCombat, makeBotObservation } from "../src/index";
import { canonicalActionKey, enumerateBotActions } from "../src/bot/actions";
import { sampleBeliefStates } from "../src/bot/belief";
import { chooseBotAction, type BotContext, type BotProfile } from "../src/bot/policy";
import { searchBotAction } from "../src/bot/search";
import type { BotObservation } from "../src/bot/observation";
import { injectCard, makeTestCombat, p0, testData, withoutDecrees } from "./helpers";
import { chooseThreeCard, testCard } from "./fixtures";

const CTX: BotContext = { policySeed: 11, beliefSeed: 31337 };

const SEARCHER: BotProfile = {
  id: "test-searcher",
  version: "1",
  skill: "regular",
  style: "tempo",
  mistakeRate: 0,
  temperature: 0,
  weights: { damage: 3, lethal: 6, heal: 1, control: 1, draw: 1, reserve: 2, waste: -2, hold: 1, cost: -0.1 },
  search: { maxExpansions: 256, depth: 3, beamWidth: 4, samples: 4 },
};

function pveObs(data: GameData, state: CombatState): BotObservation {
  return makeBotObservation(data, state, 0, "pve", [], null);
}

function decide(data: GameData, obs: BotObservation, profile = SEARCHER, ctx = CTX) {
  const decision = searchBotAction(data, obs, profile, ctx);
  if (decision === null) throw new Error("search returned null");
  return decision;
}

describe("belief sampling", () => {
  it("sampled_worlds_satisfy_zone_and_count_invariants", () => {
    const { data, state } = makeTestCombat();
    const obs = pveObs(data, state);
    const worlds = sampleBeliefStates(data, obs, SEARCHER, CTX.beliefSeed);
    expect(worlds).toHaveLength(SEARCHER.search.samples);
    for (const world of worlds) {
      const seat = world.players[0]!;
      expect(seat.hand).toEqual(obs.visibleState.players[0]!.hand);
      expect(seat.drawPile).toHaveLength(obs.visibleState.players[0]!.drawPile.length);
      expect(seat.drawPile.every((id) => !id.startsWith("hidden_"))).toBe(true);
      // Same membership, only the order may differ.
      expect(new Set(seat.drawPile)).toEqual(new Set(Object.keys(world.cards).filter(
        (id) => world.cards[id]!.player === 0 && !seat.hand.includes(id) && !seat.discardPile.includes(id),
      )));
      // Public board untouched.
      expect(world.heroes.map((h) => [h.id, h.hp, h.armor])).toEqual(
        state.heroes.map((h) => [h.id, h.hp, h.armor]),
      );
      expect(world.status).toBe(state.status);
    }
  });

  it("swapping_inaccessible_true_cards_cannot_change_samples", () => {
    const data = testData();
    withoutDecrees(data);
    const side: PvpSide = { heroIds: ["m05", "f04", "m06"], loadout: { heroes: {}, pvp: true } };
    let state = createPvpCombat(data, { seed: 5, players: [side, side] }).state;
    for (const seat of [0, 1]) {
      const mulligan = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!mulligan.ok) throw new Error(mulligan.error);
      state = mulligan.state;
    }
    const acting = state.activePlayer;
    const obsA = makeBotObservation(data, state, acting, "pvp", [], null);

    // Rewrite the opponent's hidden hand/pile to different card ids on the
    // TRUE state — the observation must not see it, so the decision must not.
    const opponent = state.players[1 - acting]!;
    const swapPool = Object.keys(data.cards);
    const swapped = structuredClone(state);
    swapped.players[1 - acting]!.hand.forEach((id, i) => {
      swapped.cards[id] = { ...swapped.cards[id]!, cardId: swapPool[i % swapPool.length]! };
    });
    swapped.players[1 - acting]!.drawPile.forEach((id, i) => {
      swapped.cards[id] = { ...swapped.cards[id]!, cardId: swapPool[(i + 3) % swapPool.length]! };
    });
    const obsB = makeBotObservation(data, swapped, acting, "pvp", [], null);
    void opponent;

    const a = decide(data, obsA);
    const b = decide(data, obsB);
    expect(canonicalActionKey(b.action)).toBe(canonicalActionKey(a.action));
  });

  it("belief_never_mutates_the_observation", () => {
    const { data, state } = makeTestCombat();
    const obs = pveObs(data, state);
    const before = JSON.stringify(obs.visibleState);
    sampleBeliefStates(data, obs, SEARCHER, CTX.beliefSeed);
    decide(data, obs);
    expect(JSON.stringify(obs.visibleState)).toBe(before);
  });
});

describe("bounded search", () => {
  it("two_cheap_cards_find_lethal", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies = [s.enemies[0]!];
        s.enemies[0]!.hp = 5;
      },
    });
    const strikes = [1, 2].map((i) =>
      testCard({ id: `t_strike_${i}`, cost: 1, target: "enemy", effects: [{ type: "damage", amount: 3, to: "chosen" }] }),
    );
    const filler = testCard({ id: "t_filler", cost: 1, effects: [{ type: "applyStatus", status: "strength", amount: 1, to: "self" }] });
    const ids = [...strikes, filler].map((card) => injectCard(state, data, card));
    p0(state).discardPile.push(...p0(state).hand);
    p0(state).hand = ids;
    p0(state).moonPower = 8;

    // Search follows the line to the kill instead of stopping at one hit.
    let current = state;
    let moves = 0;
    while (current.status !== "won" && current.status !== "lost" && moves < 6) {
      const decision = decide(data, pveObs(data, current));
      const applied = applyAction(data, current, decision.action);
      if (!applied.ok) throw new Error(applied.error);
      current = applied.state;
      moves++;
    }
    expect(current.status).toBe("won");
    expect(moves).toBeLessThanOrEqual(3);
  });

  it("draw_choice_branch_keeps_root_ids", () => {
    const { data, state } = makeTestCombat();
    const chooser = injectCard(state, data, chooseThreeCard);
    const played = applyAction(data, state, { type: "playCard", instanceId: chooser });
    if (!played.ok) throw new Error(played.error);
    const pending = played.state.players[0]!.pendingChoice;
    expect(pending?.kind).toBe("chooseCard");

    const decision = decide(data, pveObs(data, played.state));
    expect(decision.action.type).toBe("chooseCard");
    if (decision.action.type === "chooseCard") {
      expect(pending!.options).toContain(decision.action.instanceId);
    }
  });

  it("end_turn_reserve_beats_wasted_card", () => {
    const { data, state } = makeTestCombat();
    // A near-useless 7-cost card: playing it burns almost the whole pool.
    const waste = testCard({ id: "t_waste", cost: 7, target: "enemy", effects: [{ type: "damage", amount: 1, to: "chosen" }] });
    const wasteId = injectCard(state, data, waste);
    p0(state).discardPile.push(...p0(state).hand);
    p0(state).hand = [wasteId];
    p0(state).moonPower = 8;

    const decision = decide(data, pveObs(data, state));
    expect(decision.action).toMatchObject({ type: "endTurn" });
  });

  it("same_seed_and_budget_replay", () => {
    const { data, state } = makeTestCombat();
    const a = decide(data, pveObs(data, state));
    const b = decide(data, pveObs(data, state));
    expect(canonicalActionKey(a.action)).toBe(canonicalActionKey(b.action));
    expect(a.expansions).toBe(b.expansions);
    expect(a.actionScores).toEqual(b.actionScores);
  });

  it("total_expansions_never_exceed_budget", () => {
    const { data, state } = makeTestCombat();
    const decision = decide(data, pveObs(data, state));
    expect(decision.expansions).toBeLessThanOrEqual(SEARCHER.search.maxExpansions);
    expect(decision.expansions).toBeGreaterThan(0);
  });

  it("policy_falls_back_to_heuristic_when_search_yields_nothing", () => {
    const { data, state } = makeTestCombat();
    const empty: BotProfile = { ...SEARCHER, search: { maxExpansions: 256, depth: 3, beamWidth: 4, samples: 0 } };
    const decision = chooseBotAction(data, pveObs(data, state), empty, CTX);
    expect(decision).not.toBeNull();
    expect(decision!.expansions).toBe(0);
    const legal = new Set(enumerateBotActions(data, pveObs(data, state)).map(canonicalActionKey));
    expect(legal.has(canonicalActionKey(decision!.action))).toBe(true);
  });

  it("hidden_order_rng_and_enemy_deck_do_not_change_decision", () => {
    const { data, state } = makeTestCombat({ seed: 99 });
    // Reorder the true draw pile and perturb the true rng — the observation
    // (and therefore the decision) must not notice.
    const perturbed = structuredClone(state);
    perturbed.rngState = state.rngState ^ 0xabcdef;
    const pile = p0(perturbed).drawPile;
    p0(perturbed).drawPile = [...pile].reverse();
    const a = decide(data, pveObs(data, state));
    const b = decide(data, pveObs(data, perturbed));
    expect(canonicalActionKey(b.action)).toBe(canonicalActionKey(a.action));
    expect(b.actionScores).toEqual(a.actionScores);
  });
});
