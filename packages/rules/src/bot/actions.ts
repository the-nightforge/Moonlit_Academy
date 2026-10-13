import { decreeModifier } from "../moon";
import { getValidTargets, isCardPlayable } from "../queries";
import { heroesOf } from "../players";
import type { Action, CombatState, GameData, PlayerState } from "../types/index";
import type { BotObservation } from "./observation";

/**
 * Every legal action a seat could take right now (`Task 2` of the playtest
 * plan). Reads only `obs.visibleState` — the sanitized seat view — so a policy
 * can enumerate without touching authoritative state. Mirrors `applyAction`'s
 * gates exactly: anything returned here applies, anything not returned does
 * not. System-only/terminal actions (`forfeit`, `endTurn.system`, `surrender`) are never produced.
 */
export function enumerateBotActions(data: GameData, obs: BotObservation): readonly Action[] {
  const state = obs.visibleState;
  const seat = state.players[obs.seat];
  if (seat === undefined || !seatCanAct(state, seat)) return [];
  const actions: Action[] = [];

  if (state.status === "mulligan") {
    for (const ids of mulliganSubsets(seat.hand, data.combatConfig.maxMulligan)) {
      actions.push({ type: "mulligan", instanceIds: ids, player: seat.index });
    }
    return sort(actions);
  }

  const pending = seat.pendingChoice;
  if (pending !== null) {
    if (pending.kind === "chooseCard") {
      for (const instanceId of pending.options) {
        actions.push({ type: "chooseCard", instanceId, player: seat.index });
      }
    } else {
      for (const offset of pending.options) {
        actions.push({ type: "chooseMoon", offset: offset as 0 | 1 | 2, player: seat.index });
      }
    }
    // Co-op keeps status "playerTurn" with the choice pending: endTurn is still
    // legal (the engine auto-picks the choice). pve/pvp sit in "choosing" where
    // endTurn is rejected outright.
    if (state.mode === "coop" && !seat.done) {
      actions.push({ type: "endTurn", player: seat.index });
    }
    return sort(actions);
  }

  if (state.status !== "playerTurn") return [];
  if (state.mode === "coop" && seat.done) return [];

  for (const instanceId of seat.hand) {
    if (!isCardPlayable(data, state, instanceId, seat.index)) continue;
    const instance = state.cards[instanceId]!;
    const card = data.cards[instance.cardId]!;
    if (card.target === "none") {
      actions.push({ type: "playCard", instanceId, player: seat.index });
    } else {
      for (const targetId of getValidTargets(data, state, instanceId)) {
        actions.push({ type: "playCard", instanceId, targetId, player: seat.index });
      }
    }
  }

  // Hủy Bài (`01` §5.8): Xả Thân decree only, up to `perTurn` cards a turn.
  const discardRule = decreeModifier(data, state, "discardForMoonPower");
  if (discardRule !== undefined && (seat.discardsThisTurn ?? 0) < discardRule.perTurn) {
    for (const instanceId of seat.hand) {
      actions.push({ type: "discardCard", instanceId, player: seat.index });
    }
  }

  // Huyết Tế (`01` §5.9): once a turn, a living hero that survives the cost.
  const pactRule = decreeModifier(data, state, "bloodPact");
  if (pactRule !== undefined && seat.bloodPactUsed !== true) {
    for (const hero of heroesOf(state, seat.index)) {
      if (hero.alive && hero.hp > pactRule.hp) {
        actions.push({ type: "bloodPact", heroId: hero.id, player: seat.index });
      }
    }
  }

  actions.push({ type: "endTurn", player: seat.index });
  return sort(actions);
}

/** The seat-activity gate from `applyAction` — mulligan debt and the co-op shared turn. */
function seatCanAct(state: CombatState, seat: PlayerState): boolean {
  if (state.status === "mulligan") return !seat.mulliganDone;
  if (seat.index !== state.activePlayer) {
    // Only the co-op shared turn lets the non-active seat act (`01` §16.2).
    return state.mode === "coop" && state.status === "playerTurn";
  }
  return true;
}

/** All subsets of `hand` of size ≤ `cap`, each in hand order — the mulligan space. */
function mulliganSubsets(hand: readonly string[], cap: number): string[][] {
  const limit = Math.min(cap, hand.length);
  const out: string[][] = [[]];
  const walk = (start: number, picked: string[]): void => {
    if (picked.length === limit) return;
    for (let i = start; i < hand.length; i++) {
      picked.push(hand[i]!);
      out.push([...picked]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

/** Deterministic order: canonical keys, lexically (`stable lexical tie breaking`). */
function sort(actions: Action[]): readonly Action[] {
  return [...actions].sort((a, b) =>
    canonicalActionKey(a) < canonicalActionKey(b) ? -1 : 1,
  );
}

/**
 * A stable identity for an action — used to dedupe, compare candidate lists and
 * key score maps. Mulligan ids are order-insensitive (the engine treats them as
 * a set), so they are sorted inside the key only; the action itself keeps the
 * caller's order.
 */
export function canonicalActionKey(action: Action): string {
  const player = action.player ?? -1;
  switch (action.type) {
    case "playCard":
      return `playCard|${player}|${action.instanceId}|${action.targetId ?? ""}`;
    case "mulligan":
      return `mulligan|${player}|${[...action.instanceIds].sort().join(",")}`;
    case "chooseCard":
      return `chooseCard|${player}|${action.instanceId}`;
    case "chooseMoon":
      return `chooseMoon|${player}|${action.offset}`;
    case "discardCard":
      return `discardCard|${player}|${action.instanceId}`;
    case "bloodPact":
      return `bloodPact|${player}|${action.heroId}`;
    case "endTurn":
      return `endTurn|${player}|${action.system === true ? "system" : ""}`;
    case "forfeit":
      return `forfeit|${player}|${action.reason}`;
    case "surrender":
      return `surrender|${player}`;
    default: {
      const exhaustive: never = action;
      return String(exhaustive);
    }
  }
}
