export type Faction = "thanhLoan" | "huyenVu" | "bachLo" | "xichDien" | "neutral";
export type Archetype = "vanguard" | "striker" | "controller" | "support" | "specialist";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type MoonPhaseId =
  | "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous"
  | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";

export type StatusId =
  | "stealth" | "taunt" | "weak" | "vulnerable" | "mark"
  | "burn" | "regen" | "strength" | "empower" | "freeze";

export type CardTag = "attack" | "assassin" | "control" | "moon" | "heal" | "forbidden";

export type LevelUpCounter = "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled";

export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardFreeEachTurn" };

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
  ownerId: string;
  cost: number;
  type: CardType;
  tags: CardTag[];
  target: CardTarget;
  effects: Effect[];
  text: string;
}

export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies";

export type Effect =
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
  | { type: "conditional"; condition: Condition; then: Effect[]; else?: Effect[] };

export type Condition =
  | { type: "selfHpBelow"; ratio: number }
  | { type: "targetHpAtOrBelow"; ratio: number }
  | { type: "selfHasStatus"; status: StatusId }
  | { type: "targetHasStatus"; status: StatusId }
  | { type: "moonPhaseIs"; phase: MoonPhaseId };

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
