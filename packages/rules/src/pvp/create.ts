import { applySignatureCards, bondCardsForTeam } from "../create-combat";
import { drawCards } from "../draw";
import { nextRandom, shuffle } from "../rng";
import type {
  CardInstance,
  CombatEvent,
  CombatState,
  CombatWeapon,
  GameData,
  HeroState,
  PlayerState,
  PvpSide,
} from "../types/index";

/**
 * `17` §4.1 — a 1v1 arena combat. RNG order matters for replays: one draw picks
 * `firstPlayer`, then each seat's pile is built and shuffled in seat order, then
 * each seat draws `handSize` (seat 0 first). Unit/card ids carry `p<i>_` prefixes.
 */
export function createPvpCombat(
  data: GameData,
  setup: { seed: number; players: [PvpSide, PvpSide] },
): { state: CombatState; events: CombatEvent[] } {
  const events: CombatEvent[] = [{ type: "combatStarted" }];
  const cards: Record<string, CardInstance> = {};
  const heroes: HeroState[] = [];
  const players: PlayerState[] = [];

  let roll = nextRandom(setup.seed);
  const firstPlayer = roll.value < 0.5 ? 0 : 1;
  let rngState = roll.rngState;

  for (const seat of [0, 1] as const) {
    const side = setup.players[seat];
    for (const heroId of side.heroIds) {
      if (!data.heroes[heroId]) throw new Error(`createPvpCombat: unknown hero "${heroId}"`);
      if (!data.pvpConfig.heroStats[heroId]) {
        throw new Error(`createPvpCombat: no pvp stats for hero "${heroId}"`);
      }
    }

    const pile: string[] = [];
    let deckIndex = 0;
    const deckCardIds = applySignatureCards(data, side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]!.cardIds), side.loadout);
    for (const cardId of deckCardIds) {
      const card = data.cards[cardId];
      if (!card) throw new Error(`createPvpCombat: deck references missing card "${cardId}"`);
      if (card.ownerId === undefined || !side.heroIds.includes(card.ownerId)) {
        throw new Error(`createPvpCombat: deck card "${cardId}" is not owned by a hero in the team`);
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
        cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [...card.bond!.owners], player: seat, heldTurns: 0 };
        pile.push(instanceId);
      }
    }
    const weapons: CombatWeapon[] = [];
    for (const heroId of side.heroIds) {
      const gear = side.loadout.heroes[heroId];
      const weaponId = gear?.weaponId;
      if (weaponId === undefined || weaponId === null) continue;
      const def = data.weapons[weaponId];
      if (!def) throw new Error(`createPvpCombat: unknown weapon "${weaponId}"`);
      weapons.push({ heroId, weaponId, refinement: Math.min(5, Math.max(1, gear?.refinement ?? 1)) });
      for (let copy = 1; copy <= def.card.copies; copy++) {
        const instanceId = `p${seat}_wpn_${heroId}_${copy}`;
        cards[instanceId] = { instanceId, cardId: weaponId, ownerIds: [heroId], player: seat, heldTurns: 0 };
        pile.push(instanceId);
      }
    }
    const relics = (side.loadout.relics ?? []).map((relic) => {
      if (!data.relics[relic.id]) throw new Error(`createPvpCombat: unknown relic "${relic.id}"`);
      return { id: relic.id, resonance: Math.min(5, Math.max(1, relic.resonance)) };
    });

    const seatHeroes = side.heroIds.map((heroId, position) => {
      const def = data.heroes[heroId]!;
      const gear = side.loadout.heroes[heroId];
      const hero: HeroState = {
        id: `p${seat}_hero:${heroId}`,
        defId: heroId,
        side: "hero",
        player: seat,
        position,
        hp: data.pvpConfig.heroStats[heroId]!.maxHp,
        maxHp: data.pvpConfig.heroStats[heroId]!.maxHp,
        armor: 0,
        statuses: [],
        alive: true,
        levelUpCounter: 0,
        leveledUp: false,
        constellation: gear?.constellation ?? 0,
        ...(side.loadout.pvp === true ? { pvp: true } : {}),
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

  const state: CombatState = {
    mode: "pvp",
    status: "mulligan",
    activePlayer: firstPlayer,
    firstPlayer,
    round: 1,
    moonIndex: 1,
    bloodMoonRounds: 0,
    players,
    heroes,
    enemies: [],
    cards,
    rngState,
  };
  for (const seat of players) drawCards(state, seat, data.combatConfig.handSize, events);
  return { state, events };
}
