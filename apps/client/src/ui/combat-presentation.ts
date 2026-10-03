import { cloneState } from "rules";
import type { CombatEvent, CombatState, GameData, PlayerState, StatusInstance, SummonState, UnitState } from "rules";

/**
 * The batch's working copy of `before`: every visible number, badge and zone
 * moves off it while the batch animates, so beats read mid-action values
 * instead of jumping between two snapshots. `before`/`after` stay untouched.
 */
export function createPresentation(before: CombatState): CombatState {
  return cloneState(before);
}

/** Scene hooks that patch rendered objects from the presentation state mid-batch. */
export interface PresentationBindings {
  /** Rebuild one unit's card (hp/armor/status/alive) from the visual state. */
  updateUnit(unitId: string, visual: CombatState): void;
  /** Rebuild one seat's zones (hand, piles, moon power) from the visual state. */
  updateSeat(player: number, visual: CombatState): void;
  /** Create a summoned unit's view+anchor so later beats can find it. */
  ensureSummon(unitId: string, visual: CombatState): void;
  /** Repaint the moon badge from the visual state. */
  updateMoon(visual: CombatState): void;
}

function unitsOf(state: CombatState): UnitState[] {
  return [...state.heroes, ...state.enemies, ...(state.summons ?? [])];
}

function unitAt(state: CombatState, id: string): UnitState | undefined {
  return unitsOf(state).find((unit) => unit.id === id);
}

function seatOf(state: CombatState, player?: number): PlayerState | undefined {
  return state.players[player ?? 0];
}

/**
 * Drops `id` from `list`; when the id is a placeholder the event only carries
 * a count for (redacted remote zones), falls back to popping one entry.
 */
function takeCard(list: string[], id: string): void {
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else if (list.length > 0) list.pop();
}

/**
 * Moves the presentation state one event forward. Uses the event's own values
 * and public definitions/snapshot metadata — never recomputes mitigation or
 * rules math, and never mutates `after`/`before`. Anything the event does not
 * describe is seeded from `after` only where the event itself can't carry it
 * (level-up form, boss phase record); the batch-end commit still wins.
 */
export function applyPresentationEvent(
  data: GameData,
  visual: CombatState,
  event: CombatEvent,
  after: CombatState,
): void {
  switch (event.type) {
    case "damageDealt": {
      const unit = unitAt(visual, event.targetId);
      if (!unit) return;
      unit.armor = Math.max(0, unit.armor - event.blocked);
      unit.hp -= event.hpLost;
      return;
    }
    case "hpLost": {
      const unit = unitAt(visual, event.targetId);
      if (unit) unit.hp -= event.amount;
      return;
    }
    case "healed": {
      const unit = unitAt(visual, event.targetId);
      if (unit) unit.hp = Math.min(unit.maxHp, unit.hp + event.amount);
      return;
    }
    case "armorGained": {
      const unit = unitAt(visual, event.targetId);
      if (unit) unit.armor += event.amount;
      return;
    }
    case "armorRemoved": {
      const unit = unitAt(visual, event.targetId);
      if (unit) unit.armor = 0;
      return;
    }
    case "statusApplied": {
      const unit = unitAt(visual, event.targetId);
      if (!unit) return;
      const found = unit.statuses.find((status) => status.id === event.status);
      if (found) found.value = event.value;
      else unit.statuses.push({ id: event.status, value: event.value } satisfies StatusInstance);
      return;
    }
    case "statusRemoved": {
      const unit = unitAt(visual, event.targetId);
      if (unit) unit.statuses = unit.statuses.filter((status) => status.id !== event.status);
      return;
    }
    case "unitDied": {
      const unit = unitAt(visual, event.unitId);
      if (unit) {
        unit.alive = false;
        unit.hp = 0;
        unit.armor = 0;
      }
      return;
    }
    case "heroRevived": {
      const hero = visual.heroes.find((entry) => entry.id === event.heroId);
      if (hero) {
        hero.alive = true;
        hero.hp = event.hp;
        hero.revived = true;
      }
      return;
    }
    case "heroLeveledUp": {
      // The new form is snapshot metadata: the event only carries the name.
      const hero = visual.heroes.find((entry) => entry.id === event.heroId);
      const grown = after.heroes.find((entry) => entry.id === event.heroId);
      if (hero && grown) {
        hero.defId = grown.defId;
        hero.levelUpForm = grown.levelUpForm;
        hero.leveledUp = grown.leveledUp;
        hero.levelUpCounter = grown.levelUpCounter;
        hero.maxHp = grown.maxHp;
      }
      return;
    }
    case "summoned": {
      const defId = event.summonId;
      const existing = visual.summons?.find((summon) => summon.id === event.unitId);
      if (existing) {
        // Awakened form (`01` §17.1): same unit, new def — hp keeps its ratio.
        const def = data.summons[defId];
        if (def) {
          const ratio = existing.maxHp > 0 ? existing.hp / existing.maxHp : 1;
          existing.defId = defId;
          existing.summonId = defId;
          existing.maxHp = def.maxHp;
          existing.hp = Math.max(1, Math.floor(ratio * def.maxHp));
        }
        return;
      }
      const owner = visual.heroes.find((hero) => hero.id === event.ownerHeroId);
      const def = data.summons[defId];
      if (!owner || !def) return;
      const summon: SummonState = {
        id: event.unitId,
        defId,
        summonId: defId,
        side: "hero",
        player: event.player ?? owner.player,
        ownerHeroId: event.ownerHeroId,
        position: owner.position,
        hp: def.maxHp,
        maxHp: def.maxHp,
        armor: 0,
        statuses: [],
        alive: true,
      };
      visual.summons = [...(visual.summons ?? []), summon];
      return;
    }
    case "summonDismissed": {
      visual.summons = (visual.summons ?? []).filter((summon) => summon.id !== event.unitId);
      return;
    }
    case "sealStripped": {
      const unit = unitAt(visual, event.unitId);
      if (unit) delete unit.sealedBy;
      return;
    }
    case "bossPhaseChanged": {
      // Phase record is snapshot metadata the event doesn't carry.
      if (visual.boss && after.boss) {
        visual.boss.phase = after.boss.phase;
        visual.boss.reviveCountdown = after.boss.reviveCountdown;
        visual.boss.revived = after.boss.revived;
      }
      return;
    }
    case "moonPowerChanged": {
      const seat = seatOf(visual, event.player);
      if (seat) seat.moonPower = event.value;
      return;
    }
    case "moonReserveChanged": {
      if (event.side === "enemy") {
        const enemy = event.enemyId !== undefined ? visual.enemies.find((entry) => entry.id === event.enemyId) : undefined;
        if (enemy) enemy.moonReserve = event.value;
        return;
      }
      const seat = seatOf(visual, event.player);
      if (seat) seat.moonReserve = event.value;
      return;
    }
    case "moonShifted":
      visual.moonIndex = event.to;
      return;
    case "moonDecreesRolled":
      visual.moonIndex = event.moonIndex;
      visual.moonDecrees = [...event.decrees];
      return;
    case "bloodMoonChanged":
      visual.bloodMoonRounds = event.rounds;
      return;
    case "turnStarted":
      visual.round = event.round;
      if (event.player !== undefined) visual.activePlayer = event.player;
      return;
    case "cardsDrawn": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      // The draw pile's front is its top (`drawCards` splices index 0); only
      // the count is public for hidden piles, so drop that many entries.
      seat.drawPile.splice(0, Math.min(event.instanceIds.length, seat.drawPile.length));
      seat.hand.push(...event.instanceIds);
      return;
    }
    case "cardPlayed": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      takeCard(seat.hand, event.instanceId);
      seat.discardPile.push(event.instanceId);
      return;
    }
    case "cardDiscarded": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      for (const id of event.instanceIds) {
        takeCard(seat.hand, id);
        seat.discardPile.push(id);
      }
      return;
    }
    case "cardsRecycled": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      for (const id of event.instanceIds) takeCard(seat.discardPile, id);
      // Newest discards to the bottom of the draw pile (last id = deepest).
      seat.drawPile.push(...event.instanceIds);
      return;
    }
    case "cardCreated": {
      if (event.instanceId === null) return;
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      // The instance is public: `after` carries it for the owner's seat.
      visual.cards[event.instanceId] = after.cards[event.instanceId] ?? {
        instanceId: event.instanceId,
        cardId: event.cardId,
        ownerIds: [],
        player: seat.index,
        heldTurns: 0,
      };
      seat.hand.push(event.instanceId);
      return;
    }
    case "cardsPurged": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      for (const id of event.instanceIds) takeCard(seat.drawPile, id);
      return;
    }
    case "mulliganed": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      // Real mulligan: the drawn leave the pile's top into the hand, and the
      // returned are shuffled back into the pile (order is hidden anyway).
      seat.drawPile.splice(0, Math.min(event.drawn.length, seat.drawPile.length));
      for (const id of event.returned) takeCard(seat.hand, id);
      seat.drawPile.push(...event.returned);
      seat.hand.push(...event.drawn);
      return;
    }
    case "choiceOpened": {
      const seat = seatOf(visual, event.player);
      if (seat) seat.pendingChoice = { kind: "chooseCard", options: [...event.options] };
      return;
    }
    case "moonChoiceOpened": {
      const seat = seatOf(visual, event.player);
      if (seat) seat.pendingChoice = { kind: "chooseMoon", options: [...event.options] };
      return;
    }
    case "cardChosen": {
      const seat = seatOf(visual, event.player);
      if (!seat) return;
      seat.pendingChoice = null;
      takeCard(seat.drawPile, event.instanceId);
      seat.hand.push(event.instanceId);
      for (const id of event.bottomed) takeCard(seat.drawPile, id);
      seat.drawPile.push(...event.bottomed);
      return;
    }
    case "intentsRevealed": {
      const enemy = visual.enemies.find((entry) => entry.id === event.enemyId);
      if (enemy) enemy.moonPower = event.moonPower;
      return;
    }
    case "combatEnded": {
      // The state has no "draw" status — a draw round-caps into "won" + winner "draw".
      visual.status = event.result === "draw" ? "won" : event.result;
      visual.winner = event.winner;
      return;
    }
    default:
      // Beats without visual state: combatStarted, deckShuffled, deckedOut,
      // intentsCancelled, intentExecuted/Skipped/Fizzled, relic/weapon/runRelic
      // triggers, summonActed, coopComboTriggered, playerForfeited/Disconnected.
      return;
  }
}
