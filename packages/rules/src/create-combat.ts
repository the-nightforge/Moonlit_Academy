import { announceIntents } from "./intent";
import { shuffle } from "./rng";
import { startPlayerTurn } from "./turn";
import type {
  CardDef,
  CardInstance,
  CombatEvent,
  CombatSetup,
  CombatState,
  EnemyState,
  GameData,
  HeroState,
} from "./types/index";

/** Bond cards whose owners are both in the team, in cards.json order. */
export function bondCardsForTeam(data: GameData, heroIds: readonly string[]): CardDef[] {
  return Object.values(data.cards).filter(
    (card) => card.bond !== undefined && card.bond.owners.every((ownerId) => heroIds.includes(ownerId)),
  );
}

export function createCombat(
  data: GameData,
  setup: CombatSetup,
): { state: CombatState; events: CombatEvent[] } {
  const encounter = data.encounters[setup.encounterId];
  if (!encounter) {
    throw new Error(`createCombat: unknown encounter "${setup.encounterId}"`);
  }
  const heroDefs = setup.heroIds.map((heroId) => {
    const hero = data.heroes[heroId];
    if (!hero) throw new Error(`createCombat: unknown hero "${heroId}"`);
    return hero;
  });

  const events: CombatEvent[] = [{ type: "combatStarted" }];

  const cards: Record<string, CardInstance> = {};
  const drawPile: string[] = [];
  let counter = 0;
  for (const hero of heroDefs) {
    for (const cardId of hero.cardIds) {
      if (!data.cards[cardId]) {
        throw new Error(`createCombat: hero "${hero.id}" references missing card "${cardId}"`);
      }
      const instanceId = `c${String(++counter).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId, ownerIds: [hero.id] };
      drawPile.push(instanceId);
    }
  }
  bondCardsForTeam(data, setup.heroIds).forEach((card, index) => {
    const instanceId = `bond${String(index + 1).padStart(2, "0")}`;
    cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [...card.bond!.owners] };
    drawPile.push(instanceId);
  });
  let rngState = setup.seed;
  const shuffled = shuffle(drawPile, rngState);
  rngState = shuffled.rngState;
  events.push({ type: "deckShuffled" });

  const heroes: HeroState[] = heroDefs.map((hero, position) => ({
    id: `hero:${hero.id}`,
    defId: hero.id,
    side: "hero",
    position,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    armor: 0,
    statuses: [],
    alive: true,
    levelUpCounter: 0,
    leveledUp: false,
    freeCardUsedThisTurn: false,
    freeCardActive: false,
  }));

  const enemies: EnemyState[] = encounter.enemyIds.map((enemyId, position) => {
    const def = data.enemies[enemyId];
    if (!def) throw new Error(`createCombat: unknown enemy "${enemyId}"`);
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
      patternIndex: 0,
      currentIntent: null,
    };
  });

  const state: CombatState = {
    status: "playerTurn",
    round: 1,
    moonIndex: 1,
    bloodMoonRounds: 0,
    moonPower: 0,
    heroes,
    enemies,
    cards,
    drawPile: shuffled.items,
    hand: [],
    discardPile: [],
    rngState,
  };

  announceIntents(data, state, events);
  startPlayerTurn(data, state, events);
  return { state, events };
}
