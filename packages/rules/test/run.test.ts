import { describe, expect, it } from "vitest";
import type { GameData, NodeType, RunAction, RunState } from "../src/index";
import { applyRunAction, createRun, reachableNodeIds, starterDeck } from "../src/index";
import { testData } from "./helpers";

const DEFAULT_TEAM: [string, string, string] = ["m05", "f04", "m06"];

function newRun(seed = 42) {
  const data = testData();
  return { data, run: createRun(data, { heroIds: DEFAULT_TEAM, seed, deckCardIds: starterDeck(data, DEFAULT_TEAM) }).run };
}

function act(data: GameData, run: RunState, action: RunAction) {
  const result = applyRunAction(data, run, action);
  if (!result.ok) throw new Error(`unexpected run error: ${result.error}`);
  return result;
}

/** Test setup: turn the first floor-1 node into the given type. */
function forceFirstNode(run: RunState, type: NodeType, encounterId?: string): string {
  const node = run.map.floors[0]![0]!;
  node.type = type;
  if (encounterId !== undefined) node.encounterId = encounterId;
  else delete node.encounterId;
  return node.id;
}

function firstNodeId(run: RunState): string {
  return run.map.floors[0]![0]!.id;
}

function keepHand(data: GameData, run: RunState): RunState {
  if (run.combat?.status !== "mulligan") return run;
  return act(data, run, { type: "combat", action: { type: "mulligan", instanceIds: [] } }).run;
}

/** Every enemy dies to burn at the next enemy turn start. */
function winCombat(data: GameData, run: RunState) {
  const ready = keepHand(data, run);
  for (const enemy of ready.combat!.enemies) enemy.statuses.push({ id: "burn", value: 999 });
  return act(data, ready, { type: "combat", action: { type: "endTurn" } });
}

/** Every hero dies to burn at the next player turn start. */
function loseCombat(data: GameData, run: RunState) {
  const ready = keepHand(data, run);
  for (const hero of ready.combat!.heroes) hero.statuses.push({ id: "burn", value: 999 });
  return act(data, ready, { type: "combat", action: { type: "endTurn" } });
}

function augmentPool(data: GameData): string[] {
  return Object.keys(data.augments);
}

describe("run lifecycle", () => {
  it("T102: a new run starts on the map with the starting deck", () => {
    const { data, run } = newRun();
    expect(run.status).toBe("map");
    expect(run.deck).toEqual(DEFAULT_TEAM.flatMap((id) => data.heroes[id]!.cardIds));
    expect(run.heroes).toEqual(
      DEFAULT_TEAM.map((id) => ({ defId: id, hp: data.heroes[id]!.maxHp, maxHp: data.heroes[id]!.maxHp })),
    );
    expect(run.runRelicIds).toEqual([]);
    expect(run.position).toBeNull();
  });

  it("T103: only reachable nodes can be chosen", () => {
    const { data, run } = newRun();
    const before = JSON.stringify(run);
    const floor2 = run.map.floors[1]![0]!.id;
    expect(applyRunAction(data, run, { type: "chooseNode", nodeId: floor2 })).toEqual({
      ok: false,
      error: "node is not reachable",
    });
    expect(JSON.stringify(run)).toBe(before);
    expect(reachableNodeIds(run)).toEqual(run.map.floors[0]!.map((n) => n.id));
    expect(applyRunAction(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).ok).toBe(true);
  });

  it("T104: entering a combat node uses the run's HP and deck", () => {
    const { data, run } = newRun();
    run.heroes[1]!.hp = 20;
    const { run: next } = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) });
    expect(next.status).toBe("combat");
    expect(next.combat!.heroes[1]!.hp).toBe(20);
    expect([...new Set(Object.values(next.combat!.cards).map((c) => c.cardId))].sort()).toEqual([...run.deck].sort());
  });

  it("T105: winning carries HP, revives fallen heroes and offers 3 reward cards", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const [m05, f04] = entered.combat!.heroes;
    m05!.hp = 25;
    f04!.hp = 0;
    f04!.alive = false;
    const { run: won, runEvents } = winCombat(data, entered);
    expect(won.heroes.map((h) => h.hp)).toEqual([25, 12, 28]);
    expect(runEvents).toContainEqual({ type: "heroRevived", heroId: "f04", hp: 12 });
    expect(won.status).toBe("reward");
    expect(won.combat).toBeNull();
    const choices = won.pendingReward!.augmentChoices;
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    for (const augmentId of choices) {
      expect(augmentPool(data)).toContain(augmentId);
      expect(won.augmentIds).not.toContain(augmentId);
    }
  });

  it("T106: picking an augment stores it; the deck stays at 18", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const reward = winCombat(data, entered).run;
    const pick = reward.pendingReward!.augmentChoices[0]!;
    const picked = act(data, reward, { type: "pickAugment", augmentId: pick });
    expect(picked.run.deck).toHaveLength(18);
    expect(picked.run.augmentIds).toEqual([pick]);
    expect(picked.run.status).toBe("map");
    expect(picked.runEvents).toEqual([{ type: "augmentGained", augmentId: pick }]);
    expect(applyRunAction(data, reward, { type: "pickAugment", augmentId: null })).toEqual({
      ok: false,
      error: "must pick a lõi",
    });
  });

  it("T107: an augment outside the choices is rejected", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const reward = winCombat(data, entered).run;
    const other = augmentPool(data).find((id) => !reward.pendingReward!.augmentChoices.includes(id))!;
    expect(applyRunAction(data, reward, { type: "pickAugment", augmentId: other })).toEqual({
      ok: false,
      error: "augment is not a reward choice",
    });
  });

  it("T108: winning an elite also grants a run relic", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "elite", "enc_elite_01");
    const entered = act(data, run, { type: "chooseNode", nodeId }).run;
    const { run: won, runEvents } = winCombat(data, entered);
    expect(won.runRelicIds).toHaveLength(1);
    expect(runEvents).toContainEqual({ type: "runRelicGained", runRelicId: won.runRelicIds[0] });
    expect(won.pendingReward!.runRelicId).toBe(won.runRelicIds[0]);
    expect(won.pendingReward!.augmentChoices).toHaveLength(3);
    expect(won.status).toBe("reward");
  });

  it("T109: resting heals 40% max HP, capped", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "rest");
    const resting = act(data, run, { type: "chooseNode", nodeId }).run;
    expect(resting.status).toBe("rest");
    resting.heroes[0]!.hp = 20;
    const { run: healed, runEvents } = act(data, resting, { type: "rest", choice: "heal" });
    expect(healed.heroes.map((h) => h.hp)).toEqual([36, 30, 28]);
    expect(runEvents).toEqual([{ type: "restHealed", heroId: "m05", amount: 16 }]);
    expect(healed.status).toBe("map");
  });

  it("T110: resting can remove a card down to the minimum deck size", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "rest");
    const resting = act(data, run, { type: "chooseNode", nodeId }).run;
    resting.deck = resting.deck.slice(0, 11);
    const removed = act(data, resting, { type: "rest", choice: "removeCard", cardId: resting.deck[0]! });
    expect(removed.run.deck).toHaveLength(10);
    expect(removed.run.status).toBe("map");
    expect(removed.runEvents).toEqual([{ type: "cardRemoved", cardId: resting.deck[0] }]);
    resting.deck = resting.deck.slice(0, 10);
    expect(
      applyRunAction(data, resting, { type: "rest", choice: "removeCard", cardId: resting.deck[0]! }),
    ).toEqual({ ok: false, error: "deck is at minimum size" });
  });

  it("T111: a treasure node grants a run relic", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "treasure");
    const { run: treasure, runEvents } = act(data, run, { type: "chooseNode", nodeId });
    expect(treasure.status).toBe("treasure");
    expect(treasure.runRelicIds).toHaveLength(1);
    expect(runEvents).toContainEqual({ type: "runRelicGained", runRelicId: treasure.runRelicIds[0] });
    expect(act(data, treasure, { type: "continue" }).run.status).toBe("map");
  });

  it("T112: beating the boss wins the run; losing a combat loses it", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "boss", "enc_04");
    const fighting = act(data, run, { type: "chooseNode", nodeId }).run;
    const { run: won, runEvents } = winCombat(data, fighting);
    expect(won.status).toBe("won");
    expect(runEvents).toContainEqual({ type: "runEnded", result: "won" });
    expect(applyRunAction(data, won, { type: "continue" })).toEqual({ ok: false, error: "run is over" });

    const other = newRun();
    const inCombat = act(other.data, other.run, { type: "chooseNode", nodeId: firstNodeId(other.run) }).run;
    const { run: lost, runEvents: lostEvents } = loseCombat(other.data, inCombat);
    expect(lost.status).toBe("lost");
    expect(lostEvents).toContainEqual({ type: "runEnded", result: "lost" });
  });

  it("T113: same seed and actions give identical runs", () => {
    const playThrough = () => {
      const { data, run } = newRun(7);
      const log: unknown[] = [];
      let current = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) });
      log.push(current.events, current.runEvents);
      current = winCombat(data, current.run);
      log.push(current.events, current.runEvents);
      current = act(data, current.run, { type: "pickAugment", augmentId: current.run.pendingReward!.augmentChoices[0]! });
      log.push(current.runEvents);
      current = act(data, current.run, { type: "chooseNode", nodeId: reachableNodeIds(current.run)[0]! });
      log.push(current.events, current.runEvents);
      return { run: current.run, log };
    };
    expect(playThrough()).toEqual(playThrough());
  });

  it("T114: augment choices shrink with the pool; an empty pool skips the reward", () => {
    const { data, run } = newRun();
    const pool = augmentPool(data);
    run.augmentIds.push(...pool.slice(0, pool.length - 1));
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    expect(winCombat(data, entered).run.pendingReward!.augmentChoices).toEqual([
      pool[pool.length - 1],
    ]);

    const full = newRun();
    full.run.augmentIds.push(...pool);
    const fullEntered = act(full.data, full.run, { type: "chooseNode", nodeId: firstNodeId(full.run) }).run;
    const done = winCombat(full.data, fullEntered).run;
    expect(done.status).toBe("map");
    expect(done.pendingReward).toBeNull();
  });

  it("T172: a picked augment's hook is active in the next combat", () => {
    const { data, run } = newRun();
    run.augmentIds.push("aug_cuong_hoa");
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    expect(entered.combat!.runRelicIds).toContain("aug_cuong_hoa");
    // combatStart hooks fire after the mulligan resolves.
    const playing = keepHand(data, entered);
    for (const hero of playing.combat!.heroes) {
      expect(hero.statuses).toContainEqual({ id: "empower", value: 2 });
    }
  });

  it("a combat ended by a combatStart relic hook flows through finishCombat", () => {
    const data = testData();
    data.runRelics["test_annihilate"] = {
      id: "test_annihilate",
      name: "Test",
      text: "",
      hooks: [
        {
          on: { type: "combatStart" },
          actor: "front",
          effects: [{ type: "damage", amount: 999, to: "allEnemies" }],
        },
      ],
    };
    const run = createRun(data, { heroIds: DEFAULT_TEAM, seed: 42, deckCardIds: starterDeck(data, DEFAULT_TEAM) }).run;
    run.runRelicIds.push("test_annihilate");
    const entered = applyRunAction(data, run, { type: "chooseNode", nodeId: firstNodeId(run) });
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    expect(entered.run.combat?.status).toBe("mulligan");
    const result = applyRunAction(data, entered.run, {
      type: "combat",
      action: { type: "mulligan", instanceIds: [] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.status).toBe("reward");
    expect(result.run.combat).toBeNull();
    expect(result.events).toContainEqual({
      type: "runRelicTriggered",
      runRelicId: "test_annihilate",
    });
  });
});
