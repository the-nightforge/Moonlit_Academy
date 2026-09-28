import type { Loadout } from "./meta";

export type Faction = "thanhLoan" | "huyenVu" | "bachLo" | "xichDien" | "neutral";
export type Archetype = "vanguard" | "striker" | "controller" | "support" | "specialist";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type MoonPhaseId =
  | "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous"
  | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";

export type StatusId =
  | "stealth" | "taunt" | "weak" | "vulnerable" | "mark"
  | "burn" | "regen" | "strength" | "empower" | "freeze"
  | "reflect" | "guard";

export type CardTag =
  | "attack" | "assassin" | "control" | "moon" | "heal" | "forbidden"
  | "scheme" | "ward" | "harmony";

export type LevelUpCounter =
  | "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled"
  | "freezesApplied" | "buffsStolen"
  | "hitsIntercepted";

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
  | { type: "bloodMoonOwnCardDiscount"; amount: number }
  // Phase 7a (`18` §2.1).
  | { type: "armorPerTurn"; amount: number }
  | { type: "interceptArmor"; amount: number }
  | { type: "chooseMoon" }
  | { type: "freeChooseCardPerTurn"; look: number }
  | { type: "none" };

export interface LevelUpDef {
  name: string;
  description: string;
  counter: LevelUpCounter;
  threshold: number;
  /** Threshold at constellation 2 or more (`01` §8). */
  constellationThreshold: number;
  passive: LevelUpPassive;
  /** Runs once right after the hero levels up in its base form, the hero acting. */
  onLevelUp?: Effect[];
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
  /** Created during combat only (`createCard`): never in a pool, deck or reward (`01` §4). */
  token?: true;
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
  /** Co-op Hợp Kích only (`02` §6): kills targets at or under `threshold` of maxHp,
   *  else runs `elseEffects` once. */
  | { type: "execute"; threshold: number; to: TargetRef; elseEffects?: Effect[] }
  /** Lá tạo ra (`01` §4.6): puts a `token` card owned by the acting hero into its
   *  seat's hand; only on hero cards and `levelUp`/`altLevelUp` `onLevelUp`. */
  | { type: "createCard"; cardId: string }
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

export type EnemyIntentDef = IntentDef & {
  cost: number;
  /** Co-op bosses: planned every round when affordable, before weighted picks (`01` §16.5). */
  alwaysPlan?: boolean;
};

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  intents: EnemyIntentDef[];
  moonPower: { start: number; cap: number };
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];
  bloodMoonOverride?: IntentDef;
  /** Co-op boss phases (`01` §16.5); absent on normal enemies. */
  phases?: BossPhaseDef[];
  art: { portrait: string };
}

/** One boss phase: replaces `EnemyDef.intents` while active (`02` §1.5). */
export interface BossPhaseDef {
  /** Enters when hp/maxHp falls below this; phase 1 is always 1, then decreasing. */
  hpBelow: number;
  intents: EnemyIntentDef[];
  /** Overrides `combatConfig.maxIntentsPerRound`. */
  maxIntentsPerRound?: number;
  /** Runs on entry, the boss acting. */
  onEnter?: Effect[];
  /** Blood moon rounds never tick below 1 while this phase is active. */
  bloodMoonWhileActive?: true;
  /** Last phase only: rounds until the boss revives. */
  reviveAfterRounds?: number;
}

export type EncounterTier = "normal" | "elite" | "boss" | "coop";

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
export type WeaponCardDef = Omit<CardDef, "id" | "ownerId" | "bond" | "copies" | "plusOf" | "token"> & { copies: 1 | 2 };

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

/** What a shop sells (`14` §11, §14.4); `relicChoice` is honor-shop only. */
export type ShopItem =
  | { type: "moonJade"; amount: number }
  | { type: "heroChoice"; rarity: Rarity }
  | { type: "relicChoice"; rarity: Rarity };

export type ShopItemDef = {
  id: string;
  price: number;
  limitPerWeek: number;
  item: ShopItem;
};

/** An honor shop entry — priced in Vinh Dự, weekly and/or monthly limits (`14` §14.4). */
export type HonorShopItemDef = {
  id: string;
  item: ShopItem;
  cost: number;
  limitPerWeek?: number;
  limitPerMonth?: number;
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

/** A gacha banner (`14` §9): heroes, weapons or moon relics. */
export interface BannerDef {
  id: string;
  name: string;
  kind: "hero" | "weapon" | "relic";
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

/** Fair Arena configuration — `pvp-config.json` (`02` §1.13, `17` §3.1). */
export interface PvpConfig {
  /** Per-hero HP in the arena (every hero must have an entry). */
  heroStats: Record<string, { maxHp: number }>;
  /** Heroes playable without ownership (starter cards only). */
  trialHeroIds: string[];
  /** Gear usable without ownership, normalized to level 1. */
  freeWeaponIds: string[];
  freeRelicIds: string[];
  /** Moon power granted to the second player on their first turn. */
  secondPlayerBonus: { moonPower: number };
  /** Server timers (`01` §15.2, `17` §4.7). */
  turnSeconds: number;
  mulliganSeconds: number;
  timeoutsToForfeit: number;
  reconnectSeconds: number;
  /** Hard round cap; beyond it the match is a draw (`17` §4.6). */
  roundCap: number;
  /** Ranking tiers, honor shop and fixed emotes (`14` §14). */
  tiers?: { id: string; name: string; minRating: number }[];
  honorShop?: HonorShopItemDef[];
  emotes?: string[];
}

/** Currency paid for one co-op result (`14` §15). */
export interface CoopReward {
  moonJade: number;
  moonDust: number;
}

/** Co-op configuration — `coop-config.json` (`02` §1.14). */
export interface CoopConfig {
  /** Simultaneous-turn clock; the server auto-submits `endTurn` (`01` §16.2). */
  turnSeconds: number;
  /** Grace before a disconnected player's heroes fall (`01` §16.6). */
  reconnectSeconds: number;
  /** The fixed raid encounter (tier `"coop"`). */
  encounterId: string;
  /** Rewards per result and the first-win-of-the-day bonus (`14` §15). */
  rewards: { win: CoopReward; loss: CoopReward; firstWinOfDay: CoopReward };
  /** Queue matches per game day that pay out (`14` §15). */
  rewardedMatchesPerDay: number;
  /** Fixed co-op emotes (`17` §9.3). */
  emotes?: string[];
}

/** One card's half of a Hợp Kích pair (`02` §1.14). */
export interface CardMatcher {
  tag?: CardTag;
  ownerId?: string;
  /** Card carries this `applyStatus` (nested `conditional` counts). */
  appliesStatus?: StatusId;
  /** Card carries an effect of this type (nested `conditional` counts). */
  effect?: Effect["type"];
  /** After the card resolves, the moon sits on this phase. */
  moonPhaseAfter?: MoonPhaseId;
}

/** A Hợp Kích — one matched card from each player in the same turn (`01` §16.4). */
export interface CoopComboDef {
  id: string;
  name: string;
  text: string;
  parts: [CardMatcher, CardMatcher];
  limit: { perRound: 1; perCombat?: number };
  /** Resolve with the triggering card's hero acting; `allAllies` covers 6 heroes. */
  effects: Effect[];
}

/** One side of a PvP match (`17` §4.1). */
export interface PvpSide {
  heroIds: [string, string, string];
  /** 18 slots like `CombatSetup.deckCardIds`; default: the team's cards. */
  deckCardIds?: string[];
  /** Normalized by `buildPvpLoadout` — `pvp: true` (`14` §12). */
  loadout: Loadout;
}

/** One side of a co-op match (`17` §8.1) — full PvE-strength loadout. */
export interface CoopSide {
  heroIds: [string, string, string];
  deckCardIds?: string[];
  loadout: Loadout;
}
