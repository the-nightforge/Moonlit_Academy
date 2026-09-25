import { z } from "zod";
import type { Effect, GameData } from "rules";
import { rawGameDataSchema } from "./schema";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runConfigJson from "../run-config.json";

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
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runConfig } = parsed;
  const errors: string[] = [];

  const groups = [
    ["heroes", heroes],
    ["cards", cards],
    ["enemies", enemies],
    ["encounters", encounters],
    ["runRelics", runRelics],
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
  }

  for (const enemy of enemies) {
    const intents = [
      ...enemy.intentPattern,
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
    for (const cardId of hero.rewardCardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": rewardCardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": reward card "${cardId}" has ownerId "${card.ownerId}"`);
      } else if (hero.cardIds.includes(cardId)) {
        errors.push(`hero "${hero.id}": reward card "${cardId}" is also a starting card`);
      }
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

  for (const relic of runRelics) {
    for (const [index, hook] of (relic.hooks ?? []).entries()) {
      const label = `runRelic "${relic.id}" hook ${index}`;
      if (someEffect(hook.effects, (effect) => "to" in effect && effect.to === "chosen")) {
        errors.push(`${label}: effects must not use to "chosen"`);
      }
      if (someEffect(hook.effects, (effect) => effect.type === "stealBuff")) {
        errors.push(`${label}: effects must not use stealBuff`);
      }
      if (someEffect(hook.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`${label}: effects must not use actor`);
      }
      if (
        someEffect(
          hook.effects,
          (effect) => effect.type === "conditional" && effect.condition.type.startsWith("target"),
        )
      ) {
        errors.push(`${label}: conditions must not reference a target`);
      }
      if (hook.on.type === "heroDied" && hook.actor === "trigger") {
        errors.push(`${label}: heroDied cannot use actor "trigger"`);
      }
    }
  }

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
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runConfig } = parsed.data;
  return {
    heroes: Object.fromEntries(heroes.map((hero) => [hero.id, hero])),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    enemies: Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])),
    encounters: Object.fromEntries(encounters.map((encounter) => [encounter.id, encounter])),
    moonPhases: [...moonPhases].sort((a, b) => a.index - b.index),
    runRelics: Object.fromEntries(runRelics.map((relic) => [relic.id, relic])),
    runConfig,
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
    runConfig: runConfigJson,
  });
}
