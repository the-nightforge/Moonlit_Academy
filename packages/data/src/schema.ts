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
    z.object({ actor, type: z.literal("draw"), amount: z.number().int().positive() }),
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
  z.object({ type: z.literal("firstOwnCardFreeEachTurn") }),
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
  cardIds: z.array(idSchema).length(5),
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

export const enemyDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  maxHp: z.number().int().positive(),
  intentPattern: z.array(intentDefSchema).min(1),
  moonOverrides: z.array(z.object({ phase: moonPhaseIdSchema, intent: intentDefSchema })).optional(),
  bloodMoonOverride: intentDefSchema.optional(),
  art: z.object({ portrait: z.string() }),
});

export const encounterDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  enemyIds: z.array(idSchema).min(1).max(3),
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

export const rawGameDataSchema = z.object({
  heroes: z.array(heroDefSchema),
  cards: z.array(cardDefSchema),
  enemies: z.array(enemyDefSchema),
  encounters: z.array(encounterDefSchema),
  moonPhases: z.array(moonPhaseDefSchema),
});
