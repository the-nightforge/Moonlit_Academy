import { checkCombatEnd, resolveEffects } from "../effects";
import { cardDefOf } from "../gear";
import type {
  CardMatcher,
  CombatEvent,
  CombatState,
  Effect,
  GameData,
  HeroState,
  PlayerState,
} from "../types/index";

type PlayedEntry = { player: number; instanceId: string; cardId: string; comboId?: string; moonAfter: number };

function walkEffects(effects: Effect[], visit: (effect: Effect) => boolean): boolean {
  for (const effect of effects) {
    if (visit(effect)) return true;
    if (effect.type === "conditional") {
      if (walkEffects(effect.then, visit)) return true;
      if (effect.else !== undefined && walkEffects(effect.else, visit)) return true;
    }
  }
  return false;
}

/**
 * `01` §16.4 — does a card definition satisfy one combo half? `moonAfter` is the
 * moon index right after the card resolved (for `moonPhaseAfter`); callers
 * evaluating a not-yet-played card pass their best guess.
 */
export function cardMatchesPart(
  data: GameData,
  card: { tags: string[]; ownerId?: string; effects: Effect[] } | undefined,
  part: CardMatcher,
  moonAfter: number,
): boolean {
  if (card === undefined) return false;
  if (part.tag !== undefined && !card.tags.includes(part.tag)) return false;
  if (part.ownerId !== undefined && card.ownerId !== part.ownerId) return false;
  if (part.appliesStatus !== undefined) {
    const found = walkEffects(
      card.effects,
      (effect) => effect.type === "applyStatus" && effect.status === part.appliesStatus,
    );
    if (!found) return false;
  }
  if (part.effect !== undefined) {
    const found = walkEffects(card.effects, (effect) => effect.type === part.effect);
    if (!found) return false;
  }
  if (part.moonPhaseAfter !== undefined && data.moonPhases[moonAfter]?.id !== part.moonPhaseAfter) {
    return false;
  }
  return true;
}

/** Does a played card match one combo half? (`01` §16.4 — `moonPhaseAfter` reads the entry's phase.) */
export function entryMatchesPart(
  data: GameData,
  state: CombatState,
  part: CardMatcher,
  entry: PlayedEntry,
): boolean {
  return cardMatchesPart(data, cardDefOf(data, state, state.cards[entry.instanceId]!), part, entry.moonAfter);
}

/**
 * `01` §16.4 — after a card fully resolves (post `cardPlayed` hooks, pre discard),
 * see whether it completes a Hợp Kích with an unconsumed partner card in
 * `playedThisTurn`. Effects resolve with the triggering hero acting and
 * `comboScope` widening `allAllies` to all six heroes.
 */
export function fireCoopCombos(
  data: GameData,
  state: CombatState,
  seat: PlayerState,
  entry: PlayedEntry,
  actor: HeroState,
  events: CombatEvent[],
): void {
  const journal = state.playedThisTurn ?? [];
  const used = state.comboUsed ?? {};
  // File order decides ties when several combos match at once (`01` §16.4).
  for (const combo of Object.values(data.coopCombos)) {
    const counts = used[combo.id];
    if (counts !== undefined && counts.round === state.round) continue;
    if (counts !== undefined && combo.limit.perCombat !== undefined && counts.total >= combo.limit.perCombat) {
      continue;
    }
    // Either part order: the new card fills one half, a partner's earlier card the other.
    for (const [mine, theirs] of [
      [0, 1],
      [1, 0],
    ] as const) {
      if (!entryMatchesPart(data, state, combo.parts[mine], entry)) continue;
      const partner = journal.find(
        (candidate) =>
          candidate.player !== seat.index &&
          candidate.instanceId !== entry.instanceId &&
          candidate.comboId === undefined &&
          entryMatchesPart(data, state, combo.parts[theirs], candidate),
      );
      if (partner === undefined) continue;
      entry.comboId = combo.id;
      partner.comboId = combo.id;
      state.comboUsed = {
        ...used,
        [combo.id]: { total: (counts?.total ?? 0) + 1, round: state.round },
      };
      events.push({
        type: "coopComboTriggered",
        comboId: combo.id,
        cardIds: [entry.instanceId, partner.instanceId],
        player: seat.index,
      });
      resolveEffects(data, state, combo.effects, { source: actor, comboScope: true }, events);
      if (checkCombatEnd(state, events)) return;
      return;
    }
  }
}
