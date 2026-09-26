import { z } from "zod";
import type { Effect, GameData, RunRelicDef } from "rules";
import { rawGameDataSchema } from "./schema";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runAugmentsJson from "../run-augments.json";
import runConfigJson from "../run-config.json";
import combatConfigJson from "../combat-config.json";
import keywordsJson from "../keywords.json";
import metaConfigJson from "../meta-config.json";
import economyConfigJson from "../economy-config.json";
import missionsJson from "../missions.json";
import achievementsJson from "../achievements.json";

function someEffect(effects: Effect[], test: (effect: Effect) => boolean): boolean {
  return effects.some(
    (effect) =>
      test(effect) ||
      (effect.type === "conditional" &&
        (someEffect(effect.then, test) || someEffect(effect.else ?? [], test))),
  );
}

function effectsUseChosen(effects: Effect[]): boolean {
  // stealBuff always takes from the chosen target.
  return someEffect(
    effects,
    (effect) => effect.type === "stealBuff" || ("to" in effect && effect.to === "chosen"),
  );
}

function collectCrossCheckErrors(parsed: z.infer<typeof rawGameDataSchema>): string[] {
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runAugments, runConfig, combatConfig, keywords, metaConfig, economyConfig, missions, achievements } =
    parsed;
  const errors: string[] = [];

  const groups = [
    ["heroes", heroes],
    ["cards", cards],
    ["enemies", enemies],
    ["encounters", encounters],
    ["runRelics", runRelics],
    ["runAugments", runAugments],
    ["keywords", keywords],
  ] as const;
  for (const [label, defs] of groups) {
    const seen = new Set<string>();
    for (const def of defs) {
      if (seen.has(def.id)) errors.push(`${label}: duplicate id "${def.id}"`);
      seen.add(def.id);
    }
  }

  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const enemyById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const keywordIds = new Set(keywords.map((keyword) => keyword.id));

  /** Effects and conditions only usable on player cards (`13` §2.3). */
  const cardOnly = (effect: Effect): boolean =>
    effect.type === "drainMoonPower" ||
    effect.type === "gainMoonPowerPerTurn" ||
    effect.type === "burstRegen" ||
    (effect.type === "heal" && effect.overflow !== undefined) ||
    (effect.type === "conditional" &&
      (effect.condition.type === "heldTurnsAtLeast" ||
        effect.condition.type === "cardsPlayedThisTurnAtLeast"));

  const nestedChoose = (effects: Effect[]) =>
    effects.some(
      (effect) =>
        effect.type === "conditional" &&
        someEffect([...effect.then, ...(effect.else ?? [])], (inner) => inner.type === "chooseCard"),
    );

  for (const hero of heroes) {
    for (const cardId of hero.cardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": cardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": card "${cardId}" has ownerId "${card.ownerId}"`);
      }
    }
  }

  for (const card of cards) {
    if ((card.ownerId === undefined) === (card.bond === undefined)) {
      errors.push(`card "${card.id}": must have exactly one of ownerId or bond`);
    }
    if (card.ownerId !== undefined && !heroById.has(card.ownerId)) {
      errors.push(`card "${card.id}": ownerId references missing hero "${card.ownerId}"`);
    }
    if (card.bond !== undefined) {
      const [first, second] = card.bond.owners;
      if (first === second) errors.push(`card "${card.id}": bond owners must be different heroes`);
      for (const ownerId of card.bond.owners) {
        if (!heroById.has(ownerId)) {
          errors.push(`card "${card.id}": bond owner references missing hero "${ownerId}"`);
        }
      }
    } else if (someEffect(card.effects, (effect) => effect.actor !== undefined)) {
      errors.push(`card "${card.id}": actor is only allowed on bond cards`);
    }
    if (card.requiresBloodMoon && !card.tags.includes("forbidden")) {
      errors.push(`card "${card.id}": requiresBloodMoon requires tag "forbidden"`);
    }
    const usesChosen = effectsUseChosen(card.effects);
    if (card.target === "none" && usesChosen) {
      errors.push(`card "${card.id}": target "none" must not have effects with to "chosen"`);
    }
    if (card.target !== "none" && !usesChosen) {
      errors.push(`card "${card.id}": target "${card.target}" requires at least one effect with to "chosen"`);
    }
    const chooseIndex = card.effects.findIndex((effect) => effect.type === "chooseCard");
    if ((chooseIndex >= 0 && chooseIndex !== card.effects.length - 1) || nestedChoose(card.effects)) {
      errors.push(`card "${card.id}": chooseCard must be the last top-level effect`);
    }
    for (const id of card.keywords ?? []) {
      if (!keywordIds.has(id)) errors.push(`card "${card.id}": unknown keyword "${id}"`);
    }
    if (
      card.target !== "enemy" &&
      someEffect(card.effects, (e) => e.type === "drainMoonPower" && e.to === "chosen")
    ) {
      errors.push(`card "${card.id}": drainMoonPower to "chosen" needs target "enemy"`);
    }
  }

  for (const enemy of enemies) {
    if (enemy.moonPower.start > enemy.moonPower.cap) {
      errors.push(`enemy "${enemy.id}": moonPower start must be <= cap`);
    }
    const intentIds = new Set<string>();
    for (const intent of enemy.intents) {
      if (intentIds.has(intent.id)) errors.push(`enemy "${enemy.id}": duplicate intent id "${intent.id}"`);
      intentIds.add(intent.id);
    }
    const intents = [
      ...enemy.intents,
      ...(enemy.moonOverrides ?? []).map((override) => override.intent),
      ...(enemy.bloodMoonOverride ? [enemy.bloodMoonOverride] : []),
    ];
    for (const intent of intents) {
      if (effectsUseChosen(intent.effects) && intent.targeting === undefined) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": has to "chosen" effects but no targeting`);
      }
      if (someEffect(intent.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": actor is only allowed on bond cards`);
      }
      if (someEffect(intent.effects, (effect) => effect.type === "chooseCard")) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": chooseCard is not allowed`);
      }
      if (someEffect(intent.effects, cardOnly)) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": card-only keyword`);
      }
    }
  }

  if (moonPhases.length !== 8) {
    errors.push(`moonPhases: expected 8 phases, got ${moonPhases.length}`);
  }
  const seenIndex = new Set<number>();
  for (const phase of moonPhases) {
    if (seenIndex.has(phase.index)) errors.push(`moonPhases: duplicate index ${phase.index}`);
    seenIndex.add(phase.index);
  }

  for (const encounter of encounters) {
    for (const enemyId of encounter.enemyIds) {
      if (!enemyById.has(enemyId)) {
        errors.push(`encounter "${encounter.id}": enemyIds references missing enemy "${enemyId}"`);
      }
    }
  }

  for (const hero of heroes) {
    for (const cardId of hero.lockedCardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": lockedCardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": locked card "${cardId}" has ownerId "${card.ownerId}"`);
      } else if (hero.cardIds.includes(cardId)) {
        errors.push(`hero "${hero.id}": locked card "${cardId}" is also a starting card`);
      }
    }
    const pool = new Set([...hero.cardIds, ...hero.lockedCardIds]);
    const branchCards = hero.branches.flatMap((branch) => branch.cardIds);
    if (
      new Set(branchCards).size !== branchCards.length ||
      branchCards.some((id) => !pool.has(id)) ||
      branchCards.length !== pool.size
    ) {
      errors.push(`hero "${hero.id}": branches must split the 12-card pool exactly`);
    }
    const cheapFree = hero.cardIds.filter((id) => (cardById.get(id)?.cost ?? 99) <= 3).length;
    if (cheapFree < 2) {
      errors.push(`hero "${hero.id}": needs at least 2 free cards with cost <= 3`);
    }
  }

  const byTier = (tier: string) => encounters.filter((encounter) => encounter.tier === tier);
  if (byTier("boss").length !== 1) {
    errors.push(`encounters: expected exactly 1 boss encounter, got ${byTier("boss").length}`);
  }
  if (!byTier("normal").some((encounter) => (encounter.minFloor ?? 1) <= 1)) {
    errors.push(`encounters: need a normal encounter with minFloor 1`);
  }
  if (byTier("elite").length === 0) errors.push(`encounters: need at least 1 elite encounter`);

  const { floors, floorWidth, floorRules } = runConfig;
  if (floorWidth.max < floorWidth.min || floorWidth.max > 2 * floorWidth.min) {
    errors.push(`runConfig: floorWidth needs min <= max <= 2 x min`);
  }
  for (let floor = 1; floor <= floors; floor++) {
    const count = floorRules.filter((rule) => rule.floors.includes(floor)).length;
    if (count !== 1) errors.push(`runConfig: floor ${floor} has ${count} floorRules (expected 1)`);
  }
  for (const rule of floorRules) {
    if (rule.floors.some((floor) => floor < 1 || floor > floors)) {
      errors.push(`runConfig: floorRules reference a floor outside 1..${floors}`);
    }
    const allowsBoss = "type" in rule ? rule.type === "boss" : (rule.weights.boss ?? 0) > 0;
    if (allowsBoss && rule.floors.some((floor) => floor !== floors)) {
      errors.push(`runConfig: boss nodes are only allowed on floor ${floors}`);
    }
  }
  const lastRule = floorRules.find((rule) => rule.floors.includes(floors));
  if (!lastRule || !("type" in lastRule) || lastRule.type !== "boss") {
    errors.push(`runConfig: floor ${floors} must be type "boss"`);
  }

  if (combatConfig.moonPower.start > combatConfig.moonPower.cap) {
    errors.push(`combatConfig: moonPower start must be <= cap`);
  }

  const levels = metaConfig.masteryLevels;
  if (levels.some((value, index) => index > 0 && value <= levels[index - 1]!)) {
    errors.push(`metaConfig: masteryLevels must increase`);
  }
  for (const hero of heroes) {
    if (hero.lockedCardIds.length !== levels.length) {
      errors.push(`metaConfig: masteryLevels needs one level per locked card of "${hero.id}"`);
    }
  }

  const starters = economyConfig.starterHeroIds;
  if (new Set(starters).size !== starters.length) {
    errors.push(`economyConfig: starterHeroIds must be distinct`);
  }
  for (const heroId of starters) {
    if (!heroes.some((hero) => hero.id === heroId)) {
      errors.push(`economyConfig: unknown starter hero "${heroId}"`);
    }
  }
  const { gacha } = economyConfig;
  if (gacha.rates.legendary + gacha.rates.epic >= 1) errors.push(`economyConfig: gacha rates must leave room for rare`);
  if (gacha.legendarySoftPityStart >= gacha.legendaryPity) {
    errors.push(`economyConfig: legendarySoftPityStart must be below legendaryPity`);
  }
  const duplicate = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of duplicate(economyConfig.moonStarShop.map((item) => item.id))) errors.push(`economyConfig: duplicate shop item "${id}"`);
  for (const id of duplicate(missions.map((mission) => mission.id))) errors.push(`missions: duplicate id "${id}"`);
  for (const id of duplicate(achievements.map((achievement) => achievement.id))) errors.push(`achievements: duplicate id "${id}"`);
  for (const achievement of achievements) {
    const goal = achievement.goal;
    if (goal.type === "bossKillWithBond" && !cards.some((card) => card.id === goal.bondCardId && card.bond)) {
      errors.push(`achievements: "${achievement.id}" needs a bond card, got "${goal.bondCardId}"`);
    }
  }

  for (const augment of runAugments) {
    if (runRelics.some((relic) => relic.id === augment.id)) {
      errors.push(`runAugments: id "${augment.id}" collides with a runRelic`);
    }
  }

  const validateHooks = (
    defs: Pick<RunRelicDef, "id" | "hooks">[],
    label: string,
    allowCardOnly: boolean,
  ) => {
    for (const def of defs) {
      for (const [index, hook] of (def.hooks ?? []).entries()) {
        const hookLabel = `${label} "${def.id}" hook ${index}`;
        if (someEffect(hook.effects, (effect) => "to" in effect && effect.to === "chosen")) {
          errors.push(`${hookLabel}: effects must not use to "chosen"`);
        }
        if (someEffect(hook.effects, (effect) => effect.type === "stealBuff")) {
          errors.push(`${hookLabel}: effects must not use stealBuff`);
        }
        if (someEffect(hook.effects, (effect) => effect.actor !== undefined)) {
          errors.push(`${hookLabel}: effects must not use actor`);
        }
        if (someEffect(hook.effects, (effect) => effect.type === "chooseCard")) {
          errors.push(`${hookLabel}: effects must not use chooseCard`);
        }
        if (!allowCardOnly && someEffect(hook.effects, (e) => cardOnly(e) || e.type === "missingHpDamage")) {
          errors.push(`${hookLabel}: card-only keyword`);
        }
        if (
          someEffect(
            hook.effects,
            (effect) => effect.type === "conditional" && effect.condition.type.startsWith("target"),
          )
        ) {
          errors.push(`${hookLabel}: conditions must not reference a target`);
        }
        if (hook.on.type === "heroDied" && hook.actor === "trigger") {
          errors.push(`${hookLabel}: heroDied cannot use actor "trigger"`);
        }
      }
    }
  };
  validateHooks(runRelics, "runRelic", false);
  // Augments are player-side powers: card-only effects (drainMoonPower,
  // gainMoonPowerPerTurn, ...) are allowed here, unlike run relics.
  validateHooks(runAugments, "runAugment", true);

  return errors;
}

export function parseGameData(raw: unknown): GameData {
  const parsed = rawGameDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid game data:\n${z.prettifyError(parsed.error)}`);
  }
  const errors = collectCrossCheckErrors(parsed.data);
  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join("\n- ")}`);
  }
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runAugments, runConfig, combatConfig, keywords, metaConfig, economyConfig, missions, achievements } =
    parsed.data;
  return {
    heroes: Object.fromEntries(heroes.map((hero) => [hero.id, hero])),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    enemies: Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])),
    encounters: Object.fromEntries(encounters.map((encounter) => [encounter.id, encounter])),
    moonPhases: [...moonPhases].sort((a, b) => a.index - b.index),
    runRelics: Object.fromEntries(runRelics.map((relic) => [relic.id, relic])),
    augments: Object.fromEntries(runAugments.map((augment) => [augment.id, augment])),
    runConfig,
    combatConfig,
    keywords: Object.fromEntries(keywords.map((keyword) => [keyword.id, keyword])),
    metaConfig,
    economyConfig,
    missions: Object.fromEntries(missions.map((mission) => [mission.id, mission])),
    achievements: Object.fromEntries(achievements.map((achievement) => [achievement.id, achievement])),
  };
}

export function loadGameData(): GameData {
  return parseGameData({
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
    runRelics: runRelicsJson,
    runAugments: runAugmentsJson,
    runConfig: runConfigJson,
    combatConfig: combatConfigJson,
    keywords: keywordsJson,
    metaConfig: metaConfigJson,
    economyConfig: economyConfigJson,
    missions: missionsJson,
    achievements: achievementsJson,
  });
}
