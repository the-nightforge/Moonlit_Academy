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
  | { type: "firstOwnCardFreeEachTurn" }
  | { type: "doubleDamageVsFrozen" }
  | { type: "stealBonus" };

export interface LevelUpDef {
  name: string;
  description: string;
  counter: LevelUpCounter;
  threshold: number;
  passive: LevelUpPassive;
}

export interface HeroDef {
  id: string;
  name: string;
  faction: Faction;
  archetype: Archetype;
  rarity: Rarity;
  maxHp: number;
  cardIds: string[];
  levelUp: LevelUpDef;
  art: { portrait: string; levelUp: string };
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
  type: CardType;
  tags: CardTag[];
  target: CardTarget;
  effects: Effect[];
  text: string;
  /** Only valid on `forbidden` cards. */
  requiresBloodMoon?: boolean;
}

export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies";

/** `actor` indexes `bond.owners` (bond cards only); nested effects inherit it. */
export type Effect = (
  | { type: "damage"; amount: number; to: TargetRef; hits?: number }
  | { type: "heal"; amount: number; to: TargetRef }
  | { type: "loseHp"; amount: number; to: TargetRef }
  | { type: "gainArmor"; amount: number; to: TargetRef }
  | { type: "removeArmor"; to: TargetRef }
  | { type: "applyStatus"; status: StatusId; amount: number; to: TargetRef }
  | { type: "cleanse"; to: TargetRef }
  | { type: "draw"; amount: number }
  | { type: "gainMoonPower"; amount: number }
  | { type: "shiftMoon"; amount: number }
  | { type: "stealBuff"; count: number }
  | { type: "bloodMoon"; rounds: number }
  | { type: "conditional"; condition: Condition; then: Effect[]; else?: Effect[] }
) & { actor?: 0 | 1 };

export type Condition =
  | { type: "selfHpBelow"; ratio: number }
  | { type: "targetHpAtOrBelow"; ratio: number }
  | { type: "selfHasStatus"; status: StatusId }
  | { type: "targetHasStatus"; status: StatusId }
  | { type: "moonPhaseIs"; phase: MoonPhaseId }
  | { type: "bloodMoonActive" };

export type Targeting = "random" | "lowestHp" | "highestHp" | "front";
export type IntentKind = "attack" | "defend" | "buff" | "debuff" | "attackDefend" | "special";

export interface IntentDef {
  id: string;
  name: string;
  kind: IntentKind;
  targeting?: Targeting;
  effects: Effect[];
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  intentPattern: IntentDef[];
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];
  bloodMoonOverride?: IntentDef;
  art: { portrait: string };
}

export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];
}

export type MoonModifier =
  | { type: "damageMultiplierForTag"; tag: CardTag; multiplier: number }
  | { type: "stealthDurationBonus"; amount: number }
  | { type: "costModifierForTag"; tag: CardTag; amount: number; min: number }
  | { type: "healMultiplier"; multiplier: number }
  | { type: "armorMultiplier"; multiplier: number };

export interface MoonPhaseDef {
  index: number;
  id: MoonPhaseId;
  name: string;
  icon: string;
  modifiers: MoonModifier[];
}
