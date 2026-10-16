import { applyAction } from "../apply-action";
import { applySignatureCards, createCombat } from "../create-combat";
import { nextRandom, shuffle } from "../rng";
import type {
  CombatEvent,
  GameData,
  Loadout,
  MapNode,
  RunAction,
  RunActionResult,
  RunEvent,
  RunSetup,
  RunState,
} from "../types/index";
import { generateMap } from "./map";
import { pickOne, type Rng } from "./random";
import { drawRunEvent, EVENT_FALLBACK_HEAL_RATIO, EVENT_HEAL_RATIO, eventHealthCosts, runEventModel, runSwapChoices } from "./events";

function cloneRun(run: RunState): RunState {
  return JSON.parse(JSON.stringify(run)) as RunState;
}

export function findNode(run: RunState, nodeId: string): MapNode | undefined {
  return run.map.floors.flat().find((node) => node.id === nodeId);
}

/** A fresh array: callers may sort it without touching the map. */
export function reachableNodeIds(run: RunState): string[] {
  if (run.position === null) return run.map.floors[0]!.map((node) => node.id);
  return [...(findNode(run, run.position)?.next ?? [])];
}

/** HP each hero would regain from resting now (`11` §3.1). */
export function restHealAmounts(data: GameData, run: RunState): number[] {
  return run.heroes.map((hero) =>
    Math.min(hero.maxHp - hero.hp, Math.floor(hero.maxHp * data.runConfig.restHealRatio)),
  );
}

export function createRun(data: GameData, setup: RunSetup, loadout?: Loadout): { run: RunState; runEvents: RunEvent[] } {
  const heroDefs = setup.heroIds.map((heroId) => {
    const hero = data.heroes[heroId];
    if (!hero) throw new Error(`createRun: unknown hero "${heroId}"`);
    return hero;
  });
  for (const cardId of setup.deckCardIds) {
    const ownerId = data.cards[cardId]?.ownerId;
    if (ownerId === undefined || !setup.heroIds.includes(ownerId)) {
      throw new Error(`createRun: deck card "${cardId}" is not owned by a hero in the team`);
    }
  }
  const { map, rngState } = generateMap(data, setup.seed);
  const run: RunState = {
    status: "map",
    rngState,
    heroes: heroDefs.map((hero) => ({ defId: hero.id, hp: hero.maxHp, maxHp: hero.maxHp })),
    deck: applySignatureCards(data, setup.deckCardIds, loadout),
    availableCardIds: [...new Set(setup.availableCardIds ?? [...heroDefs.flatMap(h => h.cardIds), ...setup.deckCardIds])].filter(id => {
      const owner = data.cards[id]?.ownerId;
      return owner !== undefined && setup.heroIds.includes(owner) && [...data.heroes[owner]!.cardIds, ...data.heroes[owner]!.lockedCardIds].includes(id);
    }),
    runRelicIds: [],
    augmentIds: [],
    map,
    position: null,
    combat: null,
    pendingReward: null,
    heroLevelUps: {},
    ...(loadout ? { loadout } : {}),
  };
  return { run, runEvents: [] };
}

export function getRunActionError(data: GameData, run: RunState, action: RunAction): string | null {
  if (run.status === "won" || run.status === "lost") return "run is over";
  switch (action.type) {
    case "chooseNode":
      if (run.status !== "map") return "not choosing a node";
      return reachableNodeIds(run).includes(action.nodeId) ? null : "node is not reachable";
    case "combat":
      return run.status === "combat" && run.combat !== null ? null : "not in combat";
    case "pickAugment":
      if (run.status !== "reward" || run.pendingReward === null) return "no reward to pick";
      if (action.augmentId === null) {
        return run.pendingReward.augmentChoices.length === 0 ? null : "must pick a lõi";
      }
      return run.pendingReward.augmentChoices.includes(action.augmentId)
        ? null
        : "augment is not a reward choice";
    case "rest":
      if (run.status !== "rest") return "not resting";
      if (action.choice === "swapCard") {
        return runSwapChoices(data, run, action.cardId).includes(action.replacementId) ? null : "card swap is not available";
      }
      if (action.choice === "removeCard") {
        if (!run.deck.includes(action.cardId)) return "card is not in deck";
        if (run.deck.length <= data.runConfig.minDeckSize) return "deck is at minimum size";
      }
      return null;
    case "event": {
      if (run.status !== "event" || !run.pendingEvent) return "not at an event";
      if (action.choice !== "trade" && action.choice !== "rest") return "unknown event choice";
      const model = runEventModel(data, run)!;
      if (action.choice === "trade" && model.cardIds.length > 0) {
        return action.cardId && model.cardIds.includes(action.cardId) ? null : "choose a card from the deck";
      }
      return action.cardId === undefined ? null : "this event choice does not take a card";
    }
    case "continue":
      return run.status === "treasure" ? null : "nothing to continue";
    default: {
      const exhaustive: never = action;
      return `unknown run action ${JSON.stringify(exhaustive)}`;
    }
  }
}

function gainRunRelic(data: GameData, run: RunState, runEvents: RunEvent[]): string | undefined {
  const pool = Object.keys(data.runRelics).filter((id) => !run.runRelicIds.includes(id));
  if (pool.length === 0) return undefined;
  const rng: Rng = { state: run.rngState };
  const runRelicId = pickOne(rng, pool);
  run.rngState = rng.state;
  run.runRelicIds.push(runRelicId);
  runEvents.push({ type: "runRelicGained", runRelicId });
  return runRelicId;
}

function drawAugmentChoices(data: GameData, run: RunState): string[] {
  const pool = Object.keys(data.augments).filter((id) => !run.augmentIds.includes(id));
  const shuffled = shuffle(pool, run.rngState);
  run.rngState = shuffled.rngState;
  return shuffled.items.slice(0, data.runConfig.augmentChoices);
}

function enterNode(
  data: GameData,
  run: RunState,
  nodeId: string,
  events: CombatEvent[],
  runEvents: RunEvent[],
): void {
  const node = findNode(run, nodeId)!;
  run.position = node.id;
  runEvents.push({ type: "nodeEntered", nodeId: node.id, nodeType: node.type });
  switch (node.type) {
    case "combat":
    case "elite":
    case "boss": {
      const roll = nextRandom(run.rngState);
      run.rngState = roll.rngState;
      const created = createCombat(data, {
        heroIds: run.heroes.map((hero) => hero.defId) as [string, string, string],
        encounterId: node.encounterId!,
        seed: Math.floor(roll.value * 2 ** 32),
        deckCardIds: [...run.deck],
        heroes: run.heroes.map(({ hp, maxHp }) => ({ hp, maxHp })),
        runRelicIds: [...run.runRelicIds, ...run.augmentIds],
      }, run.loadout);
      run.combat = created.state;
      events.push(...created.events);
      // A relic hook may have ended the combat during setup (combatStart/playerTurnStart).
      if (created.state.status === "won" || created.state.status === "lost") {
        finishCombat(data, run, runEvents);
        return;
      }
      run.status = "combat";
      return;
    }
    case "rest":
      run.status = "rest";
      return;
    case "treasure":
      gainRunRelic(data, run, runEvents);
      run.status = "treasure";
      return;
    case "event":
      run.pendingEvent = drawRunEvent(data, run);
      run.status = "event";
      return;
    default: {
      const exhaustive: never = node.type;
      throw new Error(`unknown node type ${String(exhaustive)}`);
    }
  }
}

function finishCombat(data: GameData, run: RunState, runEvents: RunEvent[]): void {
  const combat = run.combat!;
  run.combat = null;
  if (combat.status === "lost") {
    run.status = "lost";
    runEvents.push({ type: "runEnded", result: "lost" });
    return;
  }
  combat.heroes.forEach((unit, index) => {
    const hero = run.heroes[index]!;
    const floor = Math.min(hero.maxHp, Math.max(1, Math.ceil(hero.maxHp * data.runConfig.reviveHpRatio)));
    if (unit.alive) {
      hero.hp = Math.min(hero.maxHp, Math.max(unit.hp, floor));
      if (hero.hp > unit.hp) runEvents.push({ type: "heroRecovered", heroId: hero.defId, amount: hero.hp - unit.hp });
      return;
    }
    hero.hp = floor;
    runEvents.push({ type: "heroRevived", heroId: hero.defId, hp: hero.hp });
  });
  const node = findNode(run, run.position!)!;
  if (node.type === "boss") {
    run.status = "won";
    runEvents.push({ type: "runEnded", result: "won" });
    return;
  }
  const augmentChoices = drawAugmentChoices(data, run);
  const runRelicId = node.type === "elite" ? gainRunRelic(data, run, runEvents) : undefined;
  if (augmentChoices.length === 0 && runRelicId === undefined) {
    run.status = "map";
    return;
  }
  run.pendingReward = { augmentChoices, ...(runRelicId !== undefined ? { runRelicId } : {}) };
  run.status = "reward";
}

export function applyRunAction(data: GameData, run: RunState, action: RunAction): RunActionResult {
  const error = getRunActionError(data, run, action);
  if (error !== null) return { ok: false, error };
  const next = cloneRun(run);
  const events: CombatEvent[] = [];
  const runEvents: RunEvent[] = [];
  switch (action.type) {
    case "chooseNode":
      enterNode(data, next, action.nodeId, events, runEvents);
      break;
    case "combat": {
      const result = applyAction(data, next.combat!, action.action);
      if (!result.ok) return { ok: false, error: result.error };
      next.combat = result.state;
      events.push(...result.events);
      for (const event of result.events) {
        if (event.type !== "heroLeveledUp") continue;
        const defId = result.state.heroes.find((hero) => hero.id === event.heroId)!.defId;
        next.heroLevelUps[defId] = (next.heroLevelUps[defId] ?? 0) + 1;
      }
      if (result.state.status === "won" || result.state.status === "lost") {
        finishCombat(data, next, runEvents);
      }
      break;
    }
    case "pickAugment":
      if (action.augmentId !== null) {
        next.augmentIds.push(action.augmentId);
        runEvents.push({ type: "augmentGained", augmentId: action.augmentId });
      }
      next.pendingReward = null;
      next.status = "map";
      break;
    case "rest":
      if (action.choice === "heal") {
        restHealAmounts(data, next).forEach((amount, index) => {
          const hero = next.heroes[index]!;
          hero.hp += amount;
          if (amount > 0) runEvents.push({ type: "restHealed", heroId: hero.defId, amount });
        });
      } else if (action.choice === "removeCard") {
        next.deck.splice(next.deck.indexOf(action.cardId), 1);
        runEvents.push({ type: "cardRemoved", cardId: action.cardId });
      } else {
        next.deck[next.deck.indexOf(action.cardId)] = action.replacementId;
        runEvents.push({ type: "cardSwapped", cardId: action.cardId, replacementId: action.replacementId });
      }
      next.status = "map";
      break;
    case "event": {
      const event = next.pendingEvent!;
      const model = runEventModel(data, next)!;
      if (action.choice === "rest" || !model.hasReward) {
        const ratio = action.choice === "rest" ? EVENT_HEAL_RATIO : EVENT_FALLBACK_HEAL_RATIO;
        next.heroes.forEach(hero => {
          const amount = Math.min(hero.maxHp - hero.hp, Math.floor(hero.maxHp * ratio));
          hero.hp += amount;
          if (amount > 0) runEvents.push({ type: "restHealed", heroId: hero.defId, amount });
        });
      } else {
        if (event.id === "forgottenArchive") {
          next.deck.splice(next.deck.indexOf(action.cardId!), 1);
          runEvents.push({ type: "cardRemoved", cardId: action.cardId! });
        } else if (event.id === "wanderingSmith" && next.runRelicIds.length > 0) {
          runEvents.push({ type: "runRelicLost", runRelicId: next.runRelicIds.pop()! });
        } else {
          eventHealthCosts(next).forEach((amount, i) => {
            const hero = next.heroes[i]!;
            hero.hp -= amount;
            if (amount > 0) runEvents.push({ type: "heroPaidHealth", heroId: hero.defId, amount });
          });
        }
        if (event.runRelicId) {
          next.runRelicIds.push(event.runRelicId);
          runEvents.push({ type: "runRelicGained", runRelicId: event.runRelicId });
        }
        if (event.augmentId) {
          next.augmentIds.push(event.augmentId);
          runEvents.push({ type: "augmentGained", augmentId: event.augmentId });
        }
      }
      runEvents.push({ type: "eventResolved", eventId: event.id, choice: action.choice });
      next.pendingEvent = null;
      next.status = "map";
      break;
    }
    case "continue":
      next.status = "map";
      break;
    default: {
      const exhaustive: never = action;
      return { ok: false, error: `unknown run action ${JSON.stringify(exhaustive)}` };
    }
  }
  return { ok: true, run: next, events, runEvents };
}
