import { z } from "zod";
import type { Effect, GameData } from "rules";
import { rawGameDataSchema } from "./schema";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";

function effectsUseChosen(effects: Effect[]): boolean {
  return effects.some((effect) =>
    effect.type === "conditional"
      ? effectsUseChosen(effect.then) || (effect.else !== undefined && effectsUseChosen(effect.else))
      : "to" in effect && effect.to === "chosen",
  );
}

function collectCrossCheckErrors(parsed: z.infer<typeof rawGameDataSchema>): string[] {
  const { heroes, cards, enemies, encounters, moonPhases } = parsed;
  const errors: string[] = [];

  const groups = [
    ["heroes", heroes],
    ["cards", cards],
    ["enemies", enemies],
    ["encounters", encounters],
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
    if (!heroById.has(card.ownerId)) {
      errors.push(`card "${card.id}": ownerId references missing hero "${card.ownerId}"`);
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
    ];
    for (const intent of intents) {
      if (effectsUseChosen(intent.effects) && intent.targeting === undefined) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": has to "chosen" effects but no targeting`);
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
  const { heroes, cards, enemies, encounters, moonPhases } = parsed.data;
  return {
    heroes: Object.fromEntries(heroes.map((hero) => [hero.id, hero])),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    enemies: Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])),
    encounters: Object.fromEntries(encounters.map((encounter) => [encounter.id, encounter])),
    moonPhases: [...moonPhases].sort((a, b) => a.index - b.index),
  };
}

export function loadGameData(): GameData {
  return parseGameData({
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
  });
}
