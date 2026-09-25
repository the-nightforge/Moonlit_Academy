import { z } from "zod";
import type { Effect } from "rules";

const idSchema = z.string().regex(/^[a-z0-9_]+$/);

const factionSchema = z.enum(["thanhLoan", "huyenVu", "bachLo", "xichDien", "neutral"]);
const archetypeSchema = z.enum(["vanguard", "striker", "controller", "support", "specialist"]);
const raritySchema = z.enum(["common", "rare", "epic", "legendary"]);
const moonPhaseIdSchema = z.enum([
  "new", "waxingCrescent", "firstQuarter", "waxingGibbous",
  "full", "waningGibbous", "lastQuarter", "waningCrescent",
]);
const statusIdSchema = z.enum([
  "stealth", "taunt", "weak", "vulnerable", "mark",
  "burn", "regen", "strength", "empower", "freeze",
  "reflect",
]);
const cardTagSchema = z.enum([
  "attack", "assassin", "control", "moon", "heal", "forbidden",
  "scheme", "ward", "harmony",
]);
const targetRefSchema = z.enum(["self", "chosen", "allEnemies", "allAllies"]);
const targetingSchema = z.enum(["random", "lowestHp", "highestHp", "front"]);
const intentKindSchema = z.enum(["attack", "defend", "buff", "debuff", "attackDefend", "special"]);

const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("selfHpBelow"), ratio: z.number().gt(0).lte(1) }),
  z.object({ type: z.literal("targetHpAtOrBelow"), ratio: z.number().gt(0).lte(1) }),
  z.object({ type: z.literal("selfHasStatus"), status: statusIdSchema }),
  z.object({ type: z.literal("targetHasStatus"), status: statusIdSchema }),
  z.object({ type: z.literal("moonPhaseIs"), phase: moonPhaseIdSchema }),
  z.object({ type: z.literal("bloodMoonActive") }),
]);

const intAmount = z.number().int();
const actor = z.union([z.literal(0), z.literal(1)]).optional();

export const effectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ actor, type: z.literal("damage"), amount: intAmount, to: targetRefSchema, hits: z.number().int().positive().optional() }),
    z.object({ actor, type: z.literal("heal"), amount: intAmount, to: targetRefSchema }),
    z.object({ actor, type: z.literal("loseHp"), amount: intAmount, to: targetRefSchema }),
    z.object({ actor, type: z.literal("gainArmor"), amount: intAmount, to: targetRefSchema }),
    z.object({ actor, type: z.literal("removeArmor"), to: targetRefSchema }),
    z.object({ actor, type: z.literal("applyStatus"), status: statusIdSchema, amount: intAmount, to: targetRefSchema }),
    z.object({ actor, type: z.literal("cleanse"), to: targetRefSchema }),
    z.object({ actor, type: z.literal("chooseCard"), look: z.number().int().positive() }),
    z.object({ actor, type: z.literal("gainMoonPower"), amount: intAmount }),
    z.object({ actor, type: z.literal("shiftMoon"), amount: intAmount }),
    z.object({ actor, type: z.literal("stealBuff"), count: z.number().int().positive() }),
    z.object({ actor, type: z.literal("bloodMoon"), rounds: z.number().int().positive() }),
    z.object({
      actor,
      type: z.literal("conditional"),
      condition: conditionSchema,
      then: z.array(effectSchema),
      else: z.array(effectSchema).optional(),
    }),
  ]),
);

const levelUpPassiveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attackDamageBonus"), amount: intAmount }),
  z.object({ type: z.literal("regenSpreadsToAllAllies") }),
  z.object({ type: z.literal("firstOwnCardDiscount"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("doubleDamageVsFrozen") }),
  z.object({ type: z.literal("stealBonus") }),
]);

export const heroDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  faction: factionSchema,
  archetype: archetypeSchema,
  rarity: raritySchema,
  maxHp: z.number().int().positive(),
  cardIds: z.array(idSchema).length(6),
  rewardCardIds: z.array(idSchema),
  levelUp: z.object({
    name: z.string().min(1),
    description: z.string(),
    counter: z.enum([
      "damageTaken", "turnsWithAllyRegen", "enemiesKilled",
      "freezesApplied", "buffsStolen",
    ]),
    threshold: z.number().int().positive(),
    passive: levelUpPassiveSchema,
  }),
  art: z.object({ portrait: z.string(), levelUp: z.string() }),
});

export const cardDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  ownerId: idSchema.optional(),
  bond: z.object({ owners: z.tuple([idSchema, idSchema]) }).optional(),
  cost: z.number().int().nonnegative(),
  copies: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(["attack", "skill"]),
  tags: z.array(cardTagSchema),
  target: z.enum(["none", "enemy", "ally"]),
  effects: z.array(effectSchema).min(1),
  text: z.string(),
  requiresBloodMoon: z.boolean().optional(),
});

export const intentDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: intentKindSchema,
  targeting: targetingSchema.optional(),
  effects: z.array(effectSchema).min(1),
});

export const enemyIntentDefSchema = intentDefSchema.extend({
  cost: z.number().int().nonnegative(),
});

export const enemyDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  maxHp: z.number().int().positive(),
  intents: z.array(enemyIntentDefSchema).min(1),
  moonPower: z.object({
    start: z.number().int().nonnegative(),
    cap: z.number().int().nonnegative(),
  }),
  moonOverrides: z.array(z.object({ phase: moonPhaseIdSchema, intent: intentDefSchema })).optional(),
  bloodMoonOverride: intentDefSchema.optional(),
  art: z.object({ portrait: z.string() }),
});

export const encounterDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  enemyIds: z.array(idSchema).min(1).max(3),
  tier: z.enum(["normal", "elite", "boss"]),
  minFloor: z.number().int().positive().optional(),
});

const moonModifierSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("damageMultiplierForTag"), tag: cardTagSchema, multiplier: z.number().positive() }),
  z.object({ type: z.literal("stealthDurationBonus"), amount: intAmount }),
  z.object({ type: z.literal("costModifierForTag"), tag: cardTagSchema, amount: intAmount, min: intAmount }),
  z.object({ type: z.literal("healMultiplier"), multiplier: z.number().positive() }),
  z.object({ type: z.literal("armorMultiplier"), multiplier: z.number().positive() }),
]);

export const moonPhaseDefSchema = z.object({
  index: z.number().int().min(0).max(7),
  id: moonPhaseIdSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  modifiers: z.array(moonModifierSchema),
});

const nodeTypeSchema = z.enum(["combat", "elite", "rest", "treasure", "boss"]);

const hookTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("combatStart") }),
  z.object({ type: z.literal("playerTurnStart") }),
  z.object({ type: z.literal("playerTurnEnd") }),
  z.object({
    type: z.literal("cardPlayed"),
    tag: cardTagSchema.optional(),
    cardType: z.enum(["attack", "skill"]).optional(),
  }),
  z.object({ type: z.literal("enemyKilled") }),
  z.object({ type: z.literal("heroDied") }),
  z.object({ type: z.literal("moonPhaseEntered"), phase: moonPhaseIdSchema.optional() }),
  z.object({ type: z.literal("bloodMoonStarted") }),
]);

export const runRelicDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  text: z.string(),
  modifiers: z.array(moonModifierSchema).optional(),
  hooks: z
    .array(
      z.object({
        on: hookTriggerSchema,
        actor: z.enum(["trigger", "each", "lowestHp", "front"]),
        every: z.number().int().min(2).optional(),
        effects: z.array(effectSchema).min(1),
      }),
    )
    .optional(),
});

const floorsSchema = z.array(z.number().int().positive()).min(1);
const weightSchema = z.number().positive().optional();

export const runConfigSchema = z.object({
  floors: z.number().int().min(2),
  floorWidth: z.object({ min: z.number().int().min(2), max: z.number().int().min(2) }),
  floorRules: z.array(
    z.union([
      z.object({ floors: floorsSchema, type: nodeTypeSchema }),
      z.object({
        floors: floorsSchema,
        weights: z.object({
          combat: weightSchema,
          elite: weightSchema,
          rest: weightSchema,
          treasure: weightSchema,
          boss: weightSchema,
        }),
      }),
    ]),
  ),
  restHealRatio: z.number().gt(0).lte(1),
  reviveHpRatio: z.number().gt(0).lte(1),
  rewardCardChoices: z.number().int().positive(),
  minDeckSize: z.number().int().positive(),
});

export const combatConfigSchema = z.object({
  moonPower: z.object({
    start: z.number().int().nonnegative(),
    perRound: z.number().int().nonnegative(),
    cap: z.number().int().nonnegative(),
  }),
  moonReserveMax: z.number().int().nonnegative(),
  handSize: z.number().int().positive(),
  maxMulligan: z.number().int().nonnegative(),
  maxIntentsPerRound: z.number().int().positive(),
  bloodMoonHpLoss: z.number().int().nonnegative(),
});

export const rawGameDataSchema = z.object({
  heroes: z.array(heroDefSchema),
  cards: z.array(cardDefSchema),
  enemies: z.array(enemyDefSchema),
  encounters: z.array(encounterDefSchema),
  moonPhases: z.array(moonPhaseDefSchema),
  runRelics: z.array(runRelicDefSchema),
  runConfig: runConfigSchema,
  combatConfig: combatConfigSchema,
});
