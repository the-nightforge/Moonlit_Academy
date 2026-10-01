import { applySignatureCards, bondCardsForTeam } from "../create-combat";
import { drawCards } from "../draw";
import { planEnemyIntents } from "../intent";
import { rollMoon } from "../moon";
import { shuffle } from "../rng";
import type {
  CardInstance,
  CombatEvent,
  CombatState,
  CombatWeapon,
  CoopSide,
  EnemyState,
  GameData,
  HeroState,
  PlayerState,
} from "../types/index";

/**
 * `01` §16.1 — a two-player co-op combat. RNG order is part of the replay
 * contract: seat 0's pile is built and shuffled, then seat 1's, then each seat
 * draws `handSize` in seat order, then the boss plans its first intent chain.
 * Heroes occupy positions 0–5 (`p0_`/`p1_` prefixes); the moon phase, Blood
 * Moon and the boss are shared, everything else is per seat.
 */
export function createCoopCombat(
  data: GameData,
  setup: { seed: number; players: [CoopSide, CoopSide]; encounterId: string },
): { state: CombatState; events: CombatEvent[] } {
  const encounter = data.encounters[setup.encounterId];
  if (!encounter) throw new Error(`createCoopCombat: unknown encounter "${setup.encounterId}"`);
  if (encounter.tier !== "coop") {
    throw new Error(`createCoopCombat: encounter "${setup.encounterId}" is not a co-op encounter`);
  }

  const events: CombatEvent[] = [{ type: "combatStarted" }];
  const cards: Record<string, CardInstance> = {};
  const heroes: HeroState[] = [];
  const players: PlayerState[] = [];
  let rngState = setup.seed;

  for (const seat of [0, 1] as const) {
    const side = setup.players[seat];
    for (const heroId of side.heroIds) {
      if (!data.heroes[heroId]) throw new Error(`createCoopCombat: unknown hero "${heroId}"`);
    }

    const pile: string[] = [];
    let deckIndex = 0;
    const deckCardIds = applySignatureCards(
      data,
      side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]!.cardIds),
      side.loadout,
    );
    for (const cardId of deckCardIds) {
      const card = data.cards[cardId];
      if (!card) throw new Error(`createCoopCombat: deck references missing card "${cardId}"`);
      if (card.ownerId === undefined || !side.heroIds.includes(card.ownerId)) {
        throw new Error(`createCoopCombat: deck card "${cardId}" is not owned by a hero in the team`);
      }
      for (let copy = 0; copy < card.copies; copy++) {
        deckIndex += 1;
        const instanceId = `p${seat}_c${String(deckIndex).padStart(2, "0")}`;
        cards[instanceId] = { instanceId, cardId, ownerIds: [card.ownerId], player: seat, heldTurns: 0 };
        pile.push(instanceId);
      }
    }
    let bondIndex = 0;
    for (const card of bondCardsForTeam(data, side.heroIds)) {
      for (let copy = 0; copy < card.copies; copy++) {
        bondIndex += 1;
        const instanceId = `p${seat}_bond${String(bondIndex).padStart(2, "0")}`;
        cards[instanceId] = {
          instanceId,
          cardId: card.id,
          ownerIds: [...card.bond!.owners],
          player: seat,
          heldTurns: 0,
        };
        pile.push(instanceId);
      }
    }
    const weapons: CombatWeapon[] = [];
    for (const heroId of side.heroIds) {
      const gear = side.loadout.heroes[heroId];
      const weaponId = gear?.weaponId;
      if (weaponId === undefined || weaponId === null) continue;
      const def = data.weapons[weaponId];
      if (!def) throw new Error(`createCoopCombat: unknown weapon "${weaponId}"`);
      weapons.push({ heroId, weaponId, refinement: Math.min(5, Math.max(1, gear?.refinement ?? 1)) });
      for (let copy = 1; copy <= def.card.copies; copy++) {
        const instanceId = `p${seat}_wpn_${heroId}_${copy}`;
        cards[instanceId] = { instanceId, cardId: weaponId, ownerIds: [heroId], player: seat, heldTurns: 0 };
        pile.push(instanceId);
      }
    }
    const relics = (side.loadout.relics ?? []).map((relic) => {
      if (!data.relics[relic.id]) throw new Error(`createCoopCombat: unknown relic "${relic.id}"`);
      return { id: relic.id, resonance: Math.min(5, Math.max(1, relic.resonance)) };
    });

    const seatHeroes = side.heroIds.map((heroId, index) => {
      const def = data.heroes[heroId]!;
      const gear = side.loadout.heroes[heroId];
      const hero: HeroState = {
        id: `p${seat}_hero:${heroId}`,
        defId: heroId,
        side: "hero",
        player: seat,
        position: seat * 3 + index,
        hp: def.maxHp,
        maxHp: def.maxHp,
        armor: 0,
        statuses: [],
        alive: true,
        levelUpCounter: 0,
        leveledUp: false,
        constellation: gear?.constellation ?? 0,
        firstCardDiscountUsedThisTurn: false,
        firstCardDiscountActive: false,
        levelUpForm: gear?.levelUpForm ?? "base",
        comboBonusUsedThisTurn: false,
        firstHitUsedThisTurn: false,
      };
      heroes.push(hero);
      return hero;
    });

    const shuffled = shuffle(pile, rngState);
    rngState = shuffled.rngState;
    events.push({ type: "deckShuffled", player: seat });
    players.push({
      index: seat,
      heroIds: seatHeroes.map((hero) => hero.id),
      drawPile: shuffled.items,
      hand: [],
      discardPile: [],
      moonPower: 0,
      moonReserve: 0,
      moonPowerBonus: 0,
      cardsPlayedThisTurn: 0,
      pendingChoice: null,
      hookCounters: {},
      weapons,
      relics,
      runRelicIds: [],
      mulliganDone: false,
      done: false,
    });
  }

  const enemies: EnemyState[] = encounter.enemyIds.map((enemyId, position) => {
    const def = data.enemies[enemyId];
    if (!def) throw new Error(`createCoopCombat: unknown enemy "${enemyId}"`);
    return {
      id: `enemy:${position}`,
      defId: enemyId,
      side: "enemy",
      position,
      hp: def.maxHp,
      maxHp: def.maxHp,
      armor: 0,
      statuses: [],
      alive: true,
      plannedIntents: [],
      lastIntentIds: [],
      moonPower: 0,
      moonReserve: 0,
    };
  });
  const boss = enemies.find((enemy) => data.enemies[enemy.defId]!.phases !== undefined);

  const state: CombatState = {
    mode: "coop",
    status: "mulligan",
    activePlayer: 0,
    round: 1,
    moonIndex: 1,
    moonDecrees: [],
    bloodMoonRounds: 0,
    players,
    heroes,
    enemies,
    cards,
    rngState,
    comboUsed: {},
    playedThisTurn: [],
    ...(boss !== undefined
      ? { boss: { enemyId: boss.id, phase: 1, reviveCountdown: null, revived: false } }
      : {}),
  };
  rollMoon(data, state, undefined, events);
  for (const seat of players) drawCards(data, state, seat, data.combatConfig.handSize, events);
  planEnemyIntents(data, state, events);
  return { state, events };
}
