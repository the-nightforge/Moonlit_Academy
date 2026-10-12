import { describe, expect, it } from "vitest";
import type { GameData, RunState } from "../src/index";
import { applyRunAction, createRun, reachableNodeIds, starterDeck } from "../src/index";
import { chooseRunAction } from "../src/bot/run-policy";
import type { BotContext, BotProfile } from "../src/bot/policy";
import { testData } from "./helpers";
import { loadProfiles } from "./playtest-bot";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const CTX: BotContext = { policySeed: 9, beliefSeed: 7 };

function regular(): BotProfile {
  return loadProfiles().find((p) => p.id === "regular-tempo")!;
}

function newRun(data: GameData, seed = 42): RunState {
  return createRun(data, { heroIds: TEAM, seed, deckCardIds: starterDeck(data, TEAM) }).run;
}

function setHp(run: RunState, ratio: number): void {
  for (const hero of run.heroes) hero.hp = Math.floor(hero.maxHp * ratio);
}

describe("run-policy", () => {
  it("useful_augment_beats_first_option", () => {
    const data = testData();
    const run = newRun(data);
    data.augments.t_aug_weak = { id: "t_aug_weak", name: "Yếu", text: "", hooks: [] };
    data.augments.t_aug_strong = {
      id: "t_aug_strong",
      name: "Mạnh",
      text: "",
      hooks: [
        {
          on: { type: "enemyKilled" },
          actor: "trigger",
          effects: [{ type: "damage", amount: 8, to: "allEnemies" }],
        },
      ],
    };
    run.status = "reward";
    run.pendingReward = { augmentChoices: ["t_aug_weak", "t_aug_strong"] };

    const action = chooseRunAction(data, run, regular(), CTX);
    expect(action).toEqual({ type: "pickAugment", augmentId: "t_aug_strong" });
  });

  it("remove_dead_card_by_deck_value_not_cheapest", () => {
    const data = testData();
    const run = newRun(data);
    // A card owned by a hero who is not in the team is dead weight even when pricey.
    data.cards.t_dead = {
      id: "t_dead", name: "Chết", ownerId: "m01", cost: 4, copies: 1, type: "attack",
      tags: ["attack"], target: "enemy",
      effects: [{ type: "damage", amount: 12, to: "chosen" }], text: "",
    };
    run.deck = [...run.deck, "t_dead"];
    // Find the cheapest card in deck — the dead card must NOT be it, and must be removed anyway.
    const cheapest = [...run.deck].sort((a, b) => data.cards[a]!.cost - data.cards[b]!.cost)[0]!;
    expect(cheapest).not.toBe("t_dead");

    run.status = "rest";
    setHp(run, 0.9);
    const action = chooseRunAction(data, run, regular(), CTX);
    expect(action).toEqual({ type: "rest", choice: "removeCard", cardId: "t_dead" });
  });

  it("low_hp_prioritizes_reachable_rest", () => {
    const data = testData();
    const run = newRun(data);
    // Floor 1: one rest + one combat, both reachable from the start.
    run.map.floors[0] = [
      { id: "f1n0", floor: 1, lane: 0, type: "rest", next: [] },
      { id: "f1n1", floor: 1, lane: 1, type: "combat", next: [], encounterId: "enc_01" },
    ];
    setHp(run, 0.2);
    const action = chooseRunAction(data, run, regular(), CTX);
    expect(action).toEqual({ type: "chooseNode", nodeId: "f1n0" });
  });

  it("healthy_team_skips_rest_for_fights", () => {
    const data = testData();
    const run = newRun(data);
    run.map.floors[0] = [
      { id: "f1n0", floor: 1, lane: 0, type: "rest", next: [] },
      { id: "f1n1", floor: 1, lane: 1, type: "combat", next: [], encounterId: "enc_01" },
    ];
    const action = chooseRunAction(data, run, regular(), CTX);
    expect(action).toEqual({ type: "chooseNode", nodeId: "f1n1" });
  });

  it("does_not_peek_at_unrevealed_future_node_contents", () => {
    const data = testData();
    const runA = newRun(data, 7);
    const runB = newRun(data, 7);
    // Identical map shape; only hidden encounter contents differ on reachable nodes.
    for (const node of runB.map.floors.flat()) {
      if (node.encounterId !== undefined) {
        node.encounterId = node.encounterId === "enc_01" ? "enc_02" : "enc_01";
      }
    }
    const a = chooseRunAction(data, runA, regular(), CTX);
    const b = chooseRunAction(data, runB, regular(), CTX);
    expect(b).toEqual(a);
  });

  it("combat_status_delegates_to_portfolio_and_stays_legal", () => {
    const data = testData();
    const run = newRun(data);
    // Enter the first combat node for real.
    run.map.floors[0] = [
      { id: "f1n0", floor: 1, lane: 0, type: "combat", next: [], encounterId: "enc_01" },
    ];
    const entered = applyRunAction(data, run, { type: "chooseNode", nodeId: "f1n0" });
    if (!entered.ok) throw new Error(entered.error);
    expect(entered.run.status).toBe("combat");
    const action = chooseRunAction(data, entered.run, regular(), CTX);
    expect(action.type).toBe("combat");
    const applied = applyRunAction(data, entered.run, action);
    expect(applied.ok).toBe(true);
  });
});
