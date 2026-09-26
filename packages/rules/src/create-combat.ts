import { drawCards } from "./draw";
import { planEnemyIntents } from "./intent";
import { shuffle } from "./rng";
import type {
  CardDef,
  CardInstance,
  CombatEvent,
  CombatSetup,
  CombatState,
  CombatWeapon,
  EnemyState,
  GameData,
  HeroState, Loadout } from "./types/index";

/** Bond cards whose owners are both in the team, in cards.json order. */
export function bondCardsForTeam(data: GameData, heroIds: readonly string[]): CardDef[] {
  return Object.values(data.cards).filter(
    (card) => card.bond !== undefined && card.bond.owners.every((ownerId) => heroIds.includes(ownerId)),
  );
}

/** At constellation 4 a hero's signature card becomes its "+" version (`01` §8). */
export function applySignatureCards(data: GameData, deckCardIds: readonly string[], loadout?: Loadout): string[] {
  return deckCardIds.map((cardId) => {
    const ownerId = data.cards[cardId]?.ownerId;
    const hero = ownerId !== undefined ? data.heroes[ownerId] : undefined;
    const constellation = ownerId !== undefined ? (loadout?.heroes[ownerId]?.constellation ?? 0) : 0;
    return hero && constellation >= 4 && hero.signature.cardId === cardId ? hero.signature.plusCardId : cardId;
  });
}

export function createCombat(
  data: GameData,
  setup: CombatSetup,
  loadout?: Loadout,
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
  const deckCardIds = applySignatureCards(data, setup.deckCardIds ?? heroDefs.flatMap((hero) => hero.cardIds), loadout);
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
      cards[instanceId] = { instanceId, cardId, ownerIds: [card.ownerId], heldTurns: 0 };
      drawPile.push(instanceId);
    }
  }
  let bondIndex = 0;
  for (const card of bondCardsForTeam(data, setup.heroIds)) {
    for (let copy = 0; copy < card.copies; copy++) {
      bondIndex += 1;
      const instanceId = `bond${String(bondIndex).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [...card.bond!.owners], heldTurns: 0 };
      drawPile.push(instanceId);
    }
  }
  // Weapon cards join the draw pile before the first shuffle, wearers in team order (`01` §14.2).
  const weapons: CombatWeapon[] = [];
  for (const heroId of setup.heroIds) {
    const gear = loadout?.heroes[heroId];
    const weaponId = gear?.weaponId;
    if (weaponId === undefined || weaponId === null) continue;
    const def = data.weapons[weaponId];
    if (!def) throw new Error(`createCombat: unknown weapon "${weaponId}"`);
    weapons.push({ heroId, weaponId, refinement: Math.min(5, Math.max(1, gear?.refinement ?? 1)) });
    for (let copy = 1; copy <= def.card.copies; copy++) {
      const instanceId = `wpn_${heroId}_${copy}`;
      cards[instanceId] = { instanceId, cardId: weaponId, ownerIds: [heroId], heldTurns: 0 };
      drawPile.push(instanceId);
    }
  }
  const relics = (loadout?.relics ?? []).map((relic) => {
    if (!data.relics[relic.id]) throw new Error(`createCombat: unknown relic "${relic.id}"`);
    return { id: relic.id, resonance: Math.min(5, Math.max(1, relic.resonance)) };
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
    hp: setup.heroes?.[position]?.hp ?? hero.maxHp,
    maxHp: setup.heroes?.[position]?.maxHp ?? hero.maxHp,
    armor: 0,
    statuses: [],
    alive: true,
    levelUpCounter: 0,
    leveledUp: false,
    constellation: loadout?.heroes[hero.id]?.constellation ?? 0,
    firstCardDiscountUsedThisTurn: false,
    firstCardDiscountActive: false,
    levelUpForm: loadout?.heroes[hero.id]?.levelUpForm ?? "base",
    comboBonusUsedThisTurn: false,
    firstHitUsedThisTurn: false,
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
      plannedIntents: [],
      lastIntentIds: [],
      moonPower: 0,
      moonReserve: 0,
    };
  });

  const state: CombatState = {
    status: "mulligan",
    round: 1,
    moonIndex: 1,
    bloodMoonRounds: 0,
    moonPower: 0,
    moonReserve: 0,
    moonPowerBonus: 0,
    cardsPlayedThisTurn: 0,
    heroes,
    enemies,
    cards,
    drawPile: shuffled.items,
    hand: [],
    discardPile: [],
    pendingChoice: null,
    rngState,
    runRelicIds: [...(setup.runRelicIds ?? [])],
    runRelicCounters: {},
    weapons,
    relics,
  };

  planEnemyIntents(data, state, events);
  drawCards(state, data.combatConfig.handSize, events);
  return { state, events };
}
