export type Faction = "thanhLoan" | "huyenVu" | "bachLo" | "xichDien" | "neutral";
export type Archetype = "vanguard" | "striker" | "controller" | "support" | "specialist";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type MoonPhaseId =
  | "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous"
  | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";

export type StatusId =
  | "stealth" | "taunt" | "weak" | "vulnerable" | "mark"
  | "burn" | "regen" | "strength" | "empower" | "freeze"
  | "reflect";

export type CardTag =
  | "attack" | "assassin" | "control" | "moon" | "heal" | "forbidden"
  | "scheme" | "ward" | "harmony";

export type LevelUpCounter =
  | "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled"
  | "freezesApplied" | "buffsStolen";

export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardDiscount"; amount: number }
  | { type: "doubleDamageVsFrozen" }
  | { type: "stealBonus" }
  // Second level-up forms, Tinh Hồn 5 (`01` §8).
  | { type: "armorBonusOwnCards"; amount: number }
  | { type: "healCleanses" }
  | { type: "firstComboCountsExtra"; amount: number }
  | { type: "firstHitVulnerable"; rounds: number }
  | { type: "bloodMoonOwnCardDiscount"; amount: number };

export interface LevelUpDef {
  name: string;
  description: string;
  counter: LevelUpCounter;
  threshold: number;
  /** Threshold at constellation 2 or more (`01` §8). */
  constellationThreshold: number;
  passive: LevelUpPassive;
}

/** Second level-up form (Tinh Hồn 5): same counter and threshold, new passive (`01` §8). */
export interface AltLevelUpDef {
  name: string;
  description: string;
  passive: LevelUpPassive;
  /** Runs once right after the hero levels up, the hero acting. */
  onLevelUp?: Effect[];
}

export interface HeroBranch {
  name: string;
  cardIds: string[];
}

export interface HeroDef {
  id: string;
  name: string;
  faction: Faction;
  archetype: Archetype;
  rarity: Rarity;
  maxHp: number;
  cardIds: string[];
  /** Mastery-unlocked cards; with cardIds forms the 12-card pool. */
  lockedCardIds: string[];
  /** Two build paths; their cardIds partition the 12-card pool. */
  branches: [HeroBranch, HeroBranch];
  levelUp: LevelUpDef;
  art: { portrait: string; levelUp: string };
  /** Constellation 4 swaps `cardId` for `plusCardId` in the deck (`01` §8). */
  signature: { cardId: string; plusCardId: string };
  altLevelUp: AltLevelUpDef;
}

export type CardType = "attack" | "skill";
export type CardTarget = "none" | "enemy" | "ally";

export interface CardDef {
  id: string;
  name: string;
  /** Regular card owner. Exactly one of `ownerId` / `bond` is set. */
  ownerId?: string;
  /** Bond card: belongs to both heroes. */
  bond?: { owners: [string, string] };
  cost: number;
  /** Instances of this card in the draw pile (weak cards get more). */
  copies: 1 | 2 | 3;
  type: CardType;
  tags: CardTag[];
  target: CardTarget;
  effects: Effect[];
  text: string;
  /** Only valid on `forbidden` cards. */
  requiresBloodMoon?: boolean;
  /** Keyword ids (keywords.json) shown as explanations. */
  keywords?: string[];
  /** Constellation 4 version of this card id; never placed in a deck directly. */
  plusOf?: string;
}

export interface KeywordDef {
  id: string;
  name: string;
  text: string;
}

export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies";

/** `actor` indexes `bond.owners` (bond cards only); nested effects inherit it. */
export type Effect = (
  | { type: "damage"; amount: number; to: TargetRef; hits?: number }
  | { type: "heal"; amount: number; to: TargetRef; overflow?: "armor" }
  | { type: "loseHp"; amount: number; to: TargetRef }
  | { type: "gainArmor"; amount: number; to: TargetRef }
  | { type: "removeArmor"; to: TargetRef }
  | { type: "applyStatus"; status: StatusId; amount: number; to: TargetRef }
  | { type: "cleanse"; to: TargetRef }
  | { type: "chooseCard"; look: number }
  | { type: "gainMoonPower"; amount: number }
  | { type: "shiftMoon"; amount: number }
  | { type: "stealBuff"; count: number }
  | { type: "bloodMoon"; rounds: number }
  | { type: "drainMoonPower"; amount: number; to: TargetRef; steal?: true }
  | { type: "gainMoonPowerPerTurn"; amount: number }
  | { type: "missingHpDamage"; ratio: number; to: TargetRef; hits?: number }
  | { type: "burstRegen"; multiplier: number; to: TargetRef }
  | { type: "conditional"; condition: Condition; then: Effect[]; else?: Effect[] }
) & { actor?: 0 | 1 };

export type Condition =
  | { type: "selfHpBelow"; ratio: number }
  | { type: "targetHpAtOrBelow"; ratio: number }
  | { type: "selfHasStatus"; status: StatusId }
  | { type: "targetHasStatus"; status: StatusId }
  | { type: "moonPhaseIs"; phase: MoonPhaseId }
  | { type: "bloodMoonActive" }
  | { type: "heldTurnsAtLeast"; turns: number }
  | { type: "cardsPlayedThisTurnAtLeast"; count: number };

export type Targeting = "random" | "lowestHp" | "highestHp" | "front";
export type IntentKind = "attack" | "defend" | "buff" | "debuff" | "attackDefend" | "special";

export interface IntentDef {
  id: string;
  name: string;
  kind: IntentKind;
  targeting?: Targeting;
  effects: Effect[];
}

export type EnemyIntentDef = IntentDef & { cost: number };

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  intents: EnemyIntentDef[];
  moonPower: { start: number; cap: number };
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];
  bloodMoonOverride?: IntentDef;
  art: { portrait: string };
}

export type EncounterTier = "normal" | "elite" | "boss";

export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];
  tier: EncounterTier;
  /** Earliest map floor this encounter may appear on; default 1. */
  minFloor?: number;
}

export type MoonModifier =
  | { type: "damageMultiplierForTag"; tag: CardTag; multiplier: number }
  | { type: "stealthDurationBonus"; amount: number }
  | { type: "costModifierForTag"; tag: CardTag; amount: number; min: number; while?: "bloodMoon" }
  | { type: "healMultiplier"; multiplier: number }
  | { type: "armorMultiplier"; multiplier: number };

export interface MoonPhaseDef {
  index: number;
  id: MoonPhaseId;
  name: string;
  icon: string;
  modifiers: MoonModifier[];
}

export type NodeType = "combat" | "elite" | "rest" | "treasure" | "boss";

export type FloorRule =
  | { floors: number[]; type: NodeType }
  | { floors: number[]; weights: Partial<Record<NodeType, number>> };

export interface RunConfig {
  floors: number;
  floorWidth: { min: number; max: number };
  floorRules: FloorRule[];
  restHealRatio: number;
  reviveHpRatio: number;
  augmentChoices: number;
  minDeckSize: number;
}

export type HookTrigger =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  /** `owner` / `killer` "wearer": weapon hooks only (`01` §14.3). */
  | { type: "cardPlayed"; tag?: CardTag; cardType?: CardType; owner?: "wearer" }
  | { type: "enemyKilled"; killer?: "wearer" }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase?: MoonPhaseId }
  | { type: "bloodMoonStarted" };

export type RunRelicActor = "trigger" | "each" | "lowestHp" | "front";

export interface RunRelicHook {
  on: HookTrigger;
  actor: RunRelicActor;
  /** Fires only when this hook's per-combat counter is a multiple of `every`. */
  every?: number;
  effects: Effect[];
}

export interface RunRelicDef {
  id: string;
  name: string;
  text: string;
  /** Always-on, combined with the moon phase's modifiers. */
  modifiers?: MoonModifier[];
  hooks?: RunRelicHook[];
}

/** TFT-style run augment ("Lõi"): same shape as a run relic, stronger on average. */
export type RunAugmentDef = RunRelicDef;

/** Weapon passive (`01` §14.3): a run relic hook that may act as, or filter on, the wearer. */
export interface WeaponHook extends Omit<RunRelicHook, "actor"> {
  actor: RunRelicActor | "wearer";
}

/** The weapon card; id and owner come from the weapon and its wearer. */
export type WeaponCardDef = Omit<CardDef, "id" | "ownerId" | "bond" | "copies" | "plusOf"> & { copies: 1 | 2 };

/** What changes at one refinement level (R2..R5); fields left out stay as before. */
export interface WeaponRefinement {
  text: string;
  card?: Partial<WeaponCardDef>;
  hooks?: WeaponHook[];
  signatureHooks?: WeaponHook[];
}

/** Binh Khí (`01` §14, `14` §13). */
export interface WeaponDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Shared weapons: shown only, any hero may carry any weapon. */
  archetype?: Archetype;
  signatureHeroId?: string;
  /** R1 passive, shown to the player. */
  text: string;
  card: WeaponCardDef;
  hooks: WeaponHook[];
  /** Replaces `hooks` when the wearer is `signatureHeroId`. */
  signatureHooks?: WeaponHook[];
  /** Exactly 4 entries: R2, R3, R4, R5. */
  refinement: WeaponRefinement[];
}

/** One resonance level of a moon relic: a complete definition. */
export interface RelicLevel {
  text: string;
  modifiers?: MoonModifier[];
  hooks?: RunRelicHook[];
}

/** Nguyệt Bảo (`01` §14.4, `14` §13). */
export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Exactly 5 levels, Cộng Minh 1..5. */
  resonance: RelicLevel[];
}

export interface CombatConfig {
  moonPower: { start: number; perRound: number; cap: number };
  moonReserveMax: number;
  /** Chiêm Bài: the card taken this way costs this much less until end of turn. */
  chooseCardDiscount: number;
  handSize: number;
  maxMulligan: number;
  maxIntentsPerRound: number;
  bloodMoonHpLoss: number;
}

/** Account economy (`14` §1). Phase 4c: starter heroes only. */
/** Account economy (`14` §1). */
export interface EconomyConfig {
  /** Heroes a new account owns. */
  starterHeroIds: string[];
  starterGift: { moonJade: number };
  pullCost: number;
  runRewards: { moonJadePerFloor: number; moonJadeWin: number; firstWinOfDay: number };
  /** Day and week start at this UTC hour (21 = 04:00 in Vietnam). */
  resetUtcHour: number;
  gacha: {
    rates: { legendary: number; epic: number };
    epicPity: number;
    legendarySoftPityStart: number;
    legendarySoftPityStep: number;
    legendaryPity: number;
    newPlayerEpicHero: boolean;
  };
  dupeMoonStar: Record<Rarity, number>;
  /** Moon stars for a weapon or relic duplicate already at level 5 (`14` §13.1). */
  gearDupeMoonStar: Record<Rarity, number>;
  moonStarShop: ShopItemDef[];
}

export type ShopItemDef = {
  id: string;
  price: number;
  limitPerWeek: number;
  item: { type: "moonJade"; amount: number } | { type: "heroChoice"; rarity: Rarity };
};

export type MissionGoalType =
  | "runsFinished" | "runsWon" | "floorsReached" | "bossKills"
  | "distinctHeroesUsed" | "gachaPulls" | "cardsUnlocked";

/** Daily or weekly mission (`14` §7). */
export interface MissionDef {
  id: string;
  name: string;
  text: string;
  period: "daily" | "weekly";
  goal: { type: MissionGoalType; count: number };
  reward: { moonJade: number };
}

export type AchievementGoal =
  | { type: "runsWon"; count: number }
  | { type: "bossKillWithBond"; bondCardId: string }
  | { type: "masteryLevel"; level: number }
  | { type: "ownAllHeroes" }
  | { type: "starterFloor"; floor: number }
  | { type: "allLockedUnlocked" };

/** A gacha banner (`14` §9). Phase 4d has hero banners only. */
export interface BannerDef {
  id: string;
  name: string;
  kind: "hero";
  pool: Record<Rarity, string[]>;
}

/** One-time, auto-claimed achievement (`14` §8). */
export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  goal: AchievementGoal;
  reward: { moonJade: number };
}

export interface MetaConfig {
  /** Cumulative XP thresholds for mastery level 1..n (one per locked card). */
  masteryLevels: number[];
  masteryXp: { perFloor: number; win: number; heroLevelUp: number };
  deckSize: number;
  minCardsPerHero: number;
  maxDecks: number;
  /** Moon relics per deck (`14` §3.1). */
  maxRelics: number;
}
