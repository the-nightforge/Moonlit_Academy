import { applyAction } from "../apply-action";
import { nextRandom } from "../rng";
import type { Action, CombatState, GameData } from "../types/index";
import { canonicalActionKey, enumerateBotActions } from "./actions";
import { sampleBeliefStates } from "./belief";
import { actionFeatures, type FeatureName } from "./features";
import { makeBotObservation, type BotObservation } from "./observation";
import type { BotContext, BotDecision, BotProfile } from "./policy";

/**
 * Bounded belief search (`Task 4`). Root actions come from the *observation*;
 * lookahead happens inside sampled hypothetical worlds (`sampleBeliefStates`)
 * where every node re-sanitizes a fresh observation for the acting seat before
 * enumerating — the tree never reads hidden information the seat lacks.
 *
 * Beam = the acting seat's `beamWidth` best heuristic-scored actions per node;
 * leaves evaluate `stateValue` for the deciding seat (max on our side's nodes,
 * min on the opponent's, max on allies'). `expansions` counts node expansions
 * (one enumerate + one applyAction each) across ALL samples — the budget is
 * per decision, never multiplied by samples. When the budget runs dry the
 * best partially-evaluated root action wins; with nothing evaluated at all
 * the caller falls back to the legal heuristic and the decision says so.
 */
export function searchBotAction(
  data: GameData,
  obs: BotObservation,
  profile: BotProfile,
  context: BotContext,
): BotDecision | null {
  const budget = profile.search.maxExpansions;
  if (budget <= 0) return null;
  const rootActions = enumerateBotActions(data, obs);
  if (rootActions.length === 0) return null;

  const sampleErrors: string[] = [];
  const worlds = sampleBeliefStates(data, obs, profile, context.beliefSeed, sampleErrors);
  if (worlds.length === 0) return null;

  let expansions = 0;
  const totals = new Map<string, { action: Action; score: number; evaluated: boolean }>();
  for (const action of rootActions) {
    totals.set(canonicalActionKey(action), { action, score: 0, evaluated: false });
  }

  // The budget is per decision, but it must still be shared fairly: one
  // world's beam can eat everything (leaving later samples unevaluated), and
  // one root action's beam can do the same inside a world. Slice it both ways
  // so every candidate sees every sample.
  const perWorld = Math.max(1, Math.ceil(budget / worlds.length));
  const perAction = Math.max(1, Math.floor(perWorld / rootActions.length));
  for (const world of worlds) {
    const worldCap = Math.min(budget, expansions + perWorld);
    for (const action of rootActions) {
      const actionCap = Math.min(worldCap, expansions + perAction);
      if (expansions >= actionCap) break;
      const overAction = () => expansions >= actionCap;
      const key = canonicalActionKey(action);
      const applied = applyAction(data, world, action);
      expansions++;
      if (!applied.ok) {
        // A root action failing inside a belief world is a synthetic-state
        // error: flag it, skip the line, never patch the world to fit.
        sampleErrors.push(`root ${key} rejected in belief world: ${applied.error}`);
        continue;
      }
      const entry = totals.get(key)!;
      entry.score += beamValue(data, obs, applied.state, profile, context, overAction, () => { expansions++; });
      entry.evaluated = true;
    }
    if (expansions >= budget) break;
  }

  const ranked = [...totals.values()]
    .filter((e) => e.evaluated)
    .sort((a, b) => b.score - a.score || (canonicalActionKey(a.action) < canonicalActionKey(b.action) ? -1 : 1));
  if (ranked.length === 0) return null;
  const best = ranked[0]!;
  return {
    action: best.action,
    reason: expansions >= budget ? "search-budget-exhausted" : "search-complete",
    expansions,
    actionScores: ranked.map((e) => ({ key: canonicalActionKey(e.action), score: e.score })),
  };
}

/** Depth-limited beam over acting seats; minimax by side. */
function beamValue(
  data: GameData,
  rootObs: BotObservation,
  state: CombatState,
  profile: BotProfile,
  context: BotContext,
  overBudget: () => boolean,
  count: () => void,
  depth = profile.search.depth,
): number {
  const terminal = terminalValue(state, rootObs.seat);
  // Wins found deeper in the tree are worth less — a line that kills now
  // beats the same kill deferred past enemy turns.
  if (terminal !== undefined) return terminal * 0.9 ** (profile.search.depth - depth);
  if (depth <= 0 || overBudget()) return stateValue(data, state, rootObs);

  const acting = actingSeat(state, rootObs);
  if (acting === undefined) return stateValue(data, state, rootObs);
  const nodeObs = makeBotObservation(data, state, acting, rootObs.mode, [], null);
  count();
  const legal = enumerateBotActions(data, nodeObs);
  if (legal.length === 0) return stateValue(data, state, rootObs);

  // Cheap heuristic ranking keeps only `beamWidth` lines, canonical tie-break.
  const scored = legal
    .map((action) => ({ action, score: heuristicRank(data, nodeObs, action, profile, context) }))
    .sort((a, b) => b.score - a.score || (canonicalActionKey(a.action) < canonicalActionKey(b.action) ? -1 : 1))
    .slice(0, Math.max(1, profile.search.beamWidth));

  const ownSide = ownSeat(rootObs, acting);
  let best: number | undefined;
  for (const { action } of scored) {
    if (overBudget()) break;
    const applied = applyAction(data, state, action);
    count();
    if (!applied.ok) continue; // enumeration guarantees legality — a miss here is a tool error elsewhere
    const value = beamValue(data, rootObs, applied.state, profile, context, overBudget, count, depth - 1);
    if (best === undefined || (ownSide ? value > best : value < best)) best = value;
  }
  return best ?? stateValue(data, state, rootObs);
}

/** Terminal score for the deciding seat, or undefined mid-combat. */
function terminalValue(state: CombatState, seat: number): number | undefined {
  if (state.winner === "draw") return 0;
  if (state.winner !== undefined) return state.winner === seat ? 1000 : -1000;
  if (state.status === "won") return state.mode === "pvp" ? (state.winner === seat ? 1000 : -1000) : 1000;
  if (state.status === "lost") return -1000;
  return undefined;
}

/** Which seat acts next in this node; undefined when nobody can. */
function actingSeat(state: CombatState, rootObs: BotObservation): number | undefined {
  if (state.status === "won" || state.status === "lost") return undefined;
  if (state.mode === "coop") {
    // Simultaneous turns: any seat not yet `done` acts; the deciding seat first.
    const open = state.players.filter((p) => !p.done).map((p) => p.index).sort((a, b) => a - b);
    if (open.length === 0) return undefined;
    return open.includes(rootObs.seat) ? rootObs.seat : open[0];
  }
  if (state.status === "playerTurn" || state.status === "choosing" || state.status === "mulligan") {
    return state.activePlayer;
  }
  return undefined;
}

/** Allies share the deciding seat's value — co-op partners maximize together. */
function ownSeat(rootObs: BotObservation, acting: number): boolean {
  if (rootObs.mode === "pvp") return acting === rootObs.seat;
  return true;
}

/** One-line action ranking for beam pruning, on the acting seat's own view. */
function heuristicRank(
  data: GameData,
  nodeObs: BotObservation,
  action: Action,
  profile: BotProfile,
  context: BotContext,
): number {
  const vec = actionFeatures(data, nodeObs, action);
  let score = 0;
  for (const name of Object.keys(vec) as FeatureName[]) {
    score += (profile.weights[name] ?? 0) * vec[name]!;
  }
  // Deterministic jitter below the canonical tie-break: keeps equally-scored
  // lines in a stable but non-alphabetical order across seeds.
  const r = nextRandom((context.beliefSeed ^ hash(canonicalActionKey(action))) >>> 0);
  return score * 1000 + r.value;
}

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Static eval for the deciding seat in small points: board control minus
 * threat. Deliberately simple — profiles differentiate at the action level,
 * the horizon only needs to tell winning boards from losing ones.
 */
export function stateValue(data: GameData, state: CombatState, obs: BotObservation): number {
  const terminal = terminalValue(state, obs.seat);
  if (terminal !== undefined) return terminal;
  const mine = state.heroes.filter((h) => obs.mode === "pvp" ? h.player === obs.seat : h.side === "hero");
  const theirs = state.heroes.filter((h) => obs.mode === "pvp" && h.player !== obs.seat);
  const myBoard =
    mine.reduce((s, h) => s + (h.alive ? h.hp + h.armor * 0.7 : -10), 0) +
    (state.summons ?? [])
      .filter((s) => obs.mode === "pvp" ? s.player === obs.seat : true)
      .reduce((s, u) => s + (u.alive ? 3 + u.hp * 0.3 : 0), 0);
  const foeBoard =
    state.enemies.reduce((s, e) => s + (e.alive ? e.hp + e.armor * 0.7 : -10), 0) +
    theirs.reduce((s, h) => s + (h.alive ? h.hp + h.armor * 0.7 : -10), 0);
  const me = state.players[obs.seat];
  const resources = me === undefined ? 0 : me.moonPower * 1.5 + me.moonReserve + me.hand.length;
  return myBoard - foeBoard + resources;
}
