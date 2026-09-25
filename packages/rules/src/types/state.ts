import type { IntentDef, StatusId } from "./static";

export interface StatusInstance {
  id: StatusId;
  value: number;
  sourceId?: string;
}

export interface UnitState {
  id: string;
  defId: string;
  side: "hero" | "enemy";
  position: number;
  hp: number;
  maxHp: number;
  armor: number;
  statuses: StatusInstance[];
  alive: boolean;
}

export interface HeroState extends UnitState {
  side: "hero";
  levelUpCounter: number;
  leveledUp: boolean;
  firstCardDiscountUsedThisTurn: boolean;
  firstCardDiscountActive: boolean;
}

export interface EnemyState extends UnitState {
  side: "enemy";
  patternIndex: number;
  currentIntent: { intent: IntentDef; targetId: string | null } | null;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  /** One hero id; two for a bond card, in `bond.owners` order. */
  ownerIds: string[];
}

export type CombatStatus = "playerTurn" | "enemyTurn" | "won" | "lost";

export interface CombatState {
  status: CombatStatus;
  round: number;
  moonIndex: number;
  bloodMoonRounds: number;
  moonPower: number;
  /** Moon power carried into this turn (reserve), for display. */
  moonReserve: number;
  heroes: HeroState[];
  enemies: EnemyState[];
  cards: Record<string, CardInstance>;
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  rngState: number;
  runRelicIds: string[];
  /** Per-combat hook counters, keyed "<relicId>#<hookIndex>". */
  runRelicCounters: Record<string, number>;
}
