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
  /** Index into `CombatState.players` owning this hero (`17` §2.1); 0 in PvE. */
  player: number;
  levelUpCounter: number;
  leveledUp: boolean;
  /** Tinh Hồn from the loadout; 0 outside a run with one (`01` §8). */
  constellation: number;
  /** Fair Arena: even constellation bonuses (2 = easier level-up, 4 = "+" card) stay off (`17` §3.2). */
  pvp?: boolean;
  firstCardDiscountUsedThisTurn: boolean;
  firstCardDiscountActive: boolean;
  /** "alt" = second level-up form from the loadout (Tinh Hồn 5, `01` §8). */
  levelUpForm: "base" | "alt";
  /** Tàn Ảnh: the first Liên Hoàn card this turn already took its bonus. */
  comboBonusUsedThisTurn: boolean;
  /** Hàn Kiếm: the first hit this turn already happened. */
  firstHitUsedThisTurn: boolean;
}

export interface PlannedIntent {
  intent: IntentDef;
  cost: number;
  targetId: string | null;
}

export interface EnemyState extends UnitState {
  side: "enemy";
  plannedIntents: PlannedIntent[];
  /** Ids of the chain executed last round (the most expensive one may not lead again). */
  lastIntentIds: string[];
  /** Fund the current chain was planned with (base + reserve). */
  moonPower: number;
  /** Reserve carried into the next plan. */
  moonReserve: number;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  /** One hero id; two for a bond card, in `bond.owners` order. */
  ownerIds: string[];
  /** Seat owning the card (`17` §2.1); disambiguates equal hero defIds across players. */
  player: number;
  /** Turns spent in hand (Tích Tụ); 0 when the card enters the hand. */
  heldTurns: number;
  /** Taken into hand by Chiêm Bài this turn: costs `chooseCardDiscount` less. */
  chosenThisTurn?: boolean;
}

/** `opponentTurn` only ever appears inside `viewFor` results — a real state is always playerTurn/choosing/etc. */
export type CombatStatus = "mulligan" | "playerTurn" | "choosing" | "enemyTurn" | "won" | "lost" | "opponentTurn";

/** `17` §2.1: pve (one player vs enemies), pvp (1v1, heroes vs heroes), coop (2 players vs a boss). */
export type CombatMode = "pve" | "pvp" | "coop";

/**
 * Everything owned by one seat in a combat (`17` §2.1). In PvE `players[0]` is the
 * only seat and every hero/card/pile belongs to it.
 */
export interface PlayerState {
  /** Seat index (`players` order); also the `p<index>_` prefix of this player's unit/card ids. */
  index: number;
  /** Unit ids of this player's heroes, in position order. */
  heroIds: string[];
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  moonPower: number;
  /** Moon power carried into this turn (reserve), for display. */
  moonReserve: number;
  /** Dưỡng Nguyệt: extra moon power every turn start. */
  moonPowerBonus: number;
  /** Cards already played this player's turn (Liên Hoàn). */
  cardsPlayedThisTurn: number;
  /** A pending Chiêm Bài pick; the option instance ids are out of the draw pile until resolved. */
  pendingChoice: { kind: "chooseCard"; options: string[] } | null;
  /**
   * Per-combat hook counters, keyed "<relicId>#<hookIndex>" (run relics, augments,
   * moon relics) or "<weaponId>@<heroId>#<hookIndex>" (weapons).
   */
  hookCounters: Record<string, number>;
  /** Weapons carried by this player's heroes, in wearer position order (`01` §14). */
  weapons: CombatWeapon[];
  /** Moon relics carried by this player, in loadout order (`01` §14.4). */
  relics: { id: string; resonance: number }[];
  /** Run relics and augments carried into this combat by this player. */
  runRelicIds: string[];
  /** [GĐ5] PvP: this seat already mulliganed (`17` §4.1 — both seats mulligan in parallel). */
  mulliganDone: boolean;
  /** Co-op: this player finished their simultaneous turn (`17` §8.3). */
  done: boolean;
}

/** [GĐ6] Co-op boss progress (`01` §16.5). */
export interface CoopBossState {
  enemyId: string;
  /** Index into `EnemyDef.phases` + 1 (phases are 1-based in the docs). */
  phase: number;
  /** Phase-4 countdown; null outside the final phase. */
  reviveCountdown: number | null;
  /** The boss already recovered once — no second countdown. */
  revived: boolean;
}

export interface CombatState {
  mode: CombatMode;
  status: CombatStatus;
  /** Seat whose player turn is active (0 in PvE and co-op simultaneous turns). */
  activePlayer: number;
  round: number;
  moonIndex: number;
  bloodMoonRounds: number;
  players: PlayerState[];
  heroes: HeroState[];
  enemies: EnemyState[];
  /** Card instances of every player; multiplayer instance ids carry the `p<index>_` prefix. */
  cards: Record<string, CardInstance>;
  rngState: number;
  /** Winning seat index, or "draw" (PvP round cap / simultaneous wipe). */
  winner?: number | "draw";
  /** [GĐ5] PvP: seat taking the first turn of each round (`17` §4.1). */
  firstPlayer?: number;
  /** [GĐ6] co-op: per-combo totals and the round each combo last fired (`01` §16.4). */
  comboUsed?: Record<string, { total: number; round: number }>;
  /** [GĐ6] co-op: cards played in this shared turn, in receipt order (`01` §16.4). */
  playedThisTurn?: { player: number; instanceId: string; cardId: string }[];
  /** [GĐ6] co-op: boss phase progress when the encounter's enemy has `phases`. */
  boss?: CoopBossState;
}

export interface CombatWeapon {
  heroId: string;
  weaponId: string;
  refinement: number;
}
