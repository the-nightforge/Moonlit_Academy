import { announceIntents } from "./intent";
import { shuffle } from "./rng";
import { runRelicHooks } from "./run-relic-hooks";
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
  const deckCardIds = setup.deckCardIds ?? heroDefs.flatMap((hero) => hero.cardIds);
  let deckIndex = 0;
  for (const cardId of deckCardIds) {
    const card = data.cards[cardId];
    if (!card) throw new Error(`createCombat: deck references missing card "${cardId}"`);
    if (card.ownerId === undefined || !setup.heroIds.includes(card.ownerId)) {
      throw new Error(`createCombat: deck card "${cardId}" is not owned by a hero in the team`);
    }
    for (let copy = 0; copy < card.copies; copy++) {
      deckIndex += 1;
      const instanceId = `c${String(deckIndex).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId, ownerIds: [card.ownerId] };
      drawPile.push(instanceId);
    }
  }
  let bondIndex = 0;
  for (const card of bondCardsForTeam(data, setup.heroIds)) {
    for (let copy = 0; copy < card.copies; copy++) {
      bondIndex += 1;
      const instanceId = `bond${String(bondIndex).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [...card.bond!.owners] };
      drawPile.push(instanceId);
    }
  }
  let rngState = setup.seed;
  const shuffled = shuffle(drawPile, rngState);
  rngState = shuffled.rngState;
  events.push({ type: "deckShuffled" });

  const heroes: HeroState[] = heroDefs.map((hero, position) => ({
    id: `hero:${hero.id}`,
    defId: hero.id,
    side: "hero",
    position,
    hp: setup.heroes?.[position]?.hp ?? hero.maxHp,
    maxHp: setup.heroes?.[position]?.maxHp ?? hero.maxHp,
    armor: 0,
    statuses: [],
    alive: true,
    levelUpCounter: 0,
    leveledUp: false,
    firstCardDiscountUsedThisTurn: false,
    firstCardDiscountActive: false,
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
    moonReserve: 0,
    heroes,
    enemies,
    cards,
    drawPile: shuffled.items,
    hand: [],
    discardPile: [],
    rngState,
    runRelicIds: [...(setup.runRelicIds ?? [])],
    runRelicCounters: {},
  };

  announceIntents(data, state, events);
  startPlayerTurn(data, state, events);
  runRelicHooks(data, state, events, { type: "combatStart" });
  return { state, events };
}
