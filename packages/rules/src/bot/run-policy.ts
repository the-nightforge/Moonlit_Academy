import { reachableNodeIds } from "../run/run";
import type { Effect, GameData, RunAction, RunState } from "../types/index";
import { makeBotObservation } from "./observation";
import { chooseBotAction, type BotContext, type BotProfile } from "./policy";

/**
 * The portfolio's run-mode policy (`Task 3`): map node choice by team HP and
 * style, augment picks scored against the current deck, rest-site heal vs
 * card removal by deck value (not "cheapest automatically"). Reads only the
 * run state a player legitimately sees — current map, own deck, HP, pending
 * rewards; never unrevealed future node contents. Combat decisions are routed
 * through the shared observation + portfolio path.
 */
export function chooseRunAction(
  data: GameData,
  run: RunState,
  profile: BotProfile,
  context: BotContext,
): RunAction {
  switch (run.status) {
    case "map": {
      const hp = teamHpRatio(run);
      const scored = reachableNodeIds(run).map((nodeId) => ({
        nodeId,
        score: nodeScore(data, run, nodeId, hp, profile),
      }));
      scored.sort((a, b) => b.score - a.score || (a.nodeId < b.nodeId ? -1 : 1));
      return { type: "chooseNode", nodeId: scored[0]!.nodeId };
    }
    case "combat": {
      // The seat view is sanitized; the runner knows its registered deck.
      const obs = makeBotObservation(data, run.combat!, 0, "pve", [], [...run.deck]);
      const decision = chooseBotAction(data, obs, profile, context);
      if (decision === null) throw new Error("run-policy: no legal combat action");
      return { type: "combat", action: decision.action };
    }
    case "reward": {
      const choices = run.pendingReward?.augmentChoices ?? [];
      if (choices.length === 0) return { type: "pickAugment", augmentId: null };
      const scored = choices.map((augmentId) => ({
        augmentId,
        score: augmentScore(data, run, augmentId, profile),
      }));
      scored.sort((a, b) => b.score - a.score || (a.augmentId < b.augmentId ? -1 : 1));
      return { type: "pickAugment", augmentId: scored[0]!.augmentId };
    }
    case "rest": {
      const hp = teamHpRatio(run);
      const restBias = restWeight(profile);
      if (hp < 0.6 * restBias || run.deck.length <= data.runConfig.minDeckSize) {
        return { type: "rest", choice: "heal" };
      }
      // Remove the card with the lowest deck value — dead weight and
      // synergy-breakers first, not simply the cheapest.
      const worst = [...run.deck].sort(
        (a, b) => deckCardValue(data, run, a) - deckCardValue(data, run, b) || (a < b ? -1 : 1),
      )[0]!;
      return { type: "rest", choice: "removeCard", cardId: worst };
    }
    case "treasure":
      return { type: "continue" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}

function teamHpRatio(run: RunState): number {
  const hp = run.heroes.reduce((sum, h) => sum + h.hp, 0);
  const max = run.heroes.reduce((sum, h) => sum + h.maxHp, 0);
  return max === 0 ? 0 : hp / max;
}

/** How much a style respects rest sites and fears elites. */
function restWeight(profile: BotProfile): number {
  return profile.style === "defensive" ? 1.4 : profile.style === "aggressive" ? 0.8 : 1;
}

/** Node desirability — only `type`, never `encounterId` contents the player hasn't reached. */
function nodeScore(data: GameData, run: RunState, nodeId: string, hp: number, profile: BotProfile): number {
  const node = run.map.floors.flat().find((n) => n.id === nodeId)!;
  const rest = restWeight(profile);
  const aggro = profile.style === "aggressive" ? 1.3 : profile.style === "defensive" ? 0.9 : 1;
  switch (node.type) {
    case "rest":
      return hp < 0.6 * rest ? 10 : 2;
    case "treasure":
      return 4;
    case "elite":
      return hp < 0.5 * rest ? -5 : 5 * aggro;
    case "boss":
      return 8;
    case "combat":
    default:
      return hp < 0.4 ? 1 : 3 * aggro;
  }
}

/** Augment usefulness for this deck — hooks and always-on modifiers summed roughly. */
function augmentScore(data: GameData, run: RunState, augmentId: string, profile: BotProfile): number {
  const def = data.augments[augmentId] ?? data.runRelics[augmentId];
  if (def === undefined) return 0;
  let score = 0;
  const styleMul = profile.style === "defensive" ? { heal: 1.5, armor: 1.5, damage: 0.8 } :
    profile.style === "aggressive" ? { heal: 0.8, armor: 0.8, damage: 1.5 } :
    { heal: 1, armor: 1, damage: 1 };
  for (const modifier of def.modifiers ?? []) {
    // Always-on modifiers are worth their headline stat.
    if ("amount" in modifier) score += modifier.amount;
    if ("multiplier" in modifier) score += modifier.multiplier * 2;
  }
  for (const hook of def.hooks ?? []) {
    for (const effect of hook.effects) {
      if (effect.type === "damage") score += effect.amount * styleMul.damage * 0.5;
      else if (effect.type === "heal") score += effect.amount * styleMul.heal * 0.5;
      else if (effect.type === "gainArmor") score += effect.amount * styleMul.armor * 0.5;
      else if (effect.type === "gainMoonPower") score += effect.amount;
      else if (effect.type === "drawCards") score += effect.amount * 1.5;
      else score += 0.5;
    }
  }
  return score;
}

/**
 * Deck value of one card id — what the run loses by removing it. Cards that
 * are dead weight (above what the deck's curve supports, or clashing with the
 * team's tags) score low so rest removal targets them before cheap staples.
 */
function deckCardValue(data: GameData, run: RunState, cardId: string): number {
  const card = data.cards[cardId];
  if (card === undefined) return 0;
  // Approximate benefit from effect text — same scale as combat keep-value.
  let value = card.cost * -0.1;
  const walk = (effects: readonly Effect[]): void => {
    for (const e of effects) {
      if (e.type === "conditional") {
        walk(e.then);
        walk(e.else ?? []);
        continue;
      }
      if (e.type === "execute") {
        walk(e.elseEffects ?? []);
        continue;
      }
      if (e.type === "damage" || e.type === "scaledDamage") value += e.amount;
      else if (e.type === "heal" || e.type === "gainArmor") value += e.amount * 0.8;
      else if (e.type === "burstRegen") value += e.multiplier * 2;
      else if (e.type === "drawCards" || e.type === "chooseCard") value += 1.5;
      else if (e.type === "gainMoonPower" || e.type === "gainMoonPowerPerTurn" || e.type === "shiftMoon") value += e.amount;
      else if (e.type === "applyStatus" || e.type === "sealIntent") value += 1;
      else if (e.type === "summon" || e.type === "createCard") value += 2;
      else if (e.type === "revive") value += 4;
      else if (e.type === "loseHp") value -= e.amount * 0.5;
    }
  };
  walk(card.effects);
  // Team synergy: a card whose owner's hero is in the run counts; bond cards
  // with a missing partner are dead weight.
  const owners = card.bond?.owners ?? (card.ownerId !== undefined ? [card.ownerId] : []);
  const inTeam = owners.filter((id) => run.heroes.some((h) => h.defId === id));
  if (owners.length > 0 && inTeam.length === 0) return -10;
  if (card.bond !== undefined && inTeam.length < owners.length) value -= 3;
  return value + inTeam.length * 0.5;
}
