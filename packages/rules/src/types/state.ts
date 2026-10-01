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
  /** Phong Ấn (`01` §5.6): hero id that sealed this unit; its next-turn intents/cards keep damage but lose every other effect. Cleared after that unit's side next turn, used or not. */
  sealedBy?: string;
  /** Thế Thủ (`01` §7.5): this unit's first single-target hit of the round was already reduced. Cleared at round end. */
  shieldUsed?: true;
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
  /** Bác Học: the first scheme card this turn already repeated. */
  firstSchemeUsedThisTurn?: boolean;
  /** Sử Bút: the first Phong Ấn this turn already cancelled an extra intent (`01` §5.6). */
  firstSealUsedThisTurn?: boolean;
  /** Hồi Hồn (`18` §3.5): this hero already came back once — a second fall is final. */
  revived?: true;
}

/** Linh Thú on the board (`01` §17). Shares the hero side; never counts for defeat. */
export interface SummonState extends UnitState {
  side: "hero";
  /** Seat owning the summoner. */
  player: number;
  /** Unit id of the summoning hero. */
  ownerHeroId: string;
  /** `SummonDef` id in use (switches to `awakenedId` when awakened). */
  summonId: string;
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
  /** Thiên Cơ: this turn only (`01` §3.1). */
  turnDiscount?: number;
}

/** A choice the seat must answer before acting (`01` §3.1, §4). */
export type PendingChoice =
  | { kind: "chooseCard"; options: string[] }
  | { kind: "chooseMoon"; options: number[] };

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
  /** Attack cards already resolved this turn (Liên Kích, `01` §7.5) — the count at resolve time gates the chain bonus. */
  attackCardsThisTurn?: number;
  /** Cards created this combat (`createCard`); names the next `t<n>` instance. */
  createdCards?: number;
  /** A pending Chiêm Bài pick or Chọn Pha; Chiêm Bài option instance ids are out of the draw pile until resolved. */
  pendingChoice: PendingChoice | null;
  /** Chọn Pha owed this turn (a hero was leveled with `chooseMoon` at turn start). */
  moonChoicePending?: true;
  /** Bói Nguyệt (`01` §3.1 step 12): the decree's free Chiêm Bài is queued behind an already-open choice; opens when that choice is answered, before Chọn Pha. */
  omenPending?: true;
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
  /** Hồi Hồn (`18` §3.5): draw-pile cards purged when a hero fell, keyed by hero unit id. */
  purged?: Record<string, string[]>;
  /** Hồi Hồn (`18` §3.5): hero unit ids in the order they fell (for `lastFallen`). */
  fallenOrder?: string[];
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
  /** Nguyệt Lệnh id per phase index (`01` §7.3). */
  moonDecrees: string[];
  /** Tập Kích (`01` §7.5): sides whose first damage hit of their turn already took the bonus — keys `p<seat>` / `"enemy"`, cleared when that side's turn starts. */
  firstHitKeys?: string[];
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
  /** [GĐ6] co-op: cards played in this shared turn, in receipt order (`01` §16.4). `comboId` marks a card already consumed by a Hợp Kích; `moonAfter` is the moon index right after the card resolved. */
  playedThisTurn?: { player: number; instanceId: string; cardId: string; comboId?: string; moonAfter: number }[];
  /** [GĐ6] co-op: boss phase progress when the encounter's enemy has `phases`. */
  boss?: CoopBossState;
  /** [GĐ7] Linh Thú; absent until the first summon. */
  summons?: SummonState[];
}

export interface CombatWeapon {
  heroId: string;
  weaponId: string;
  refinement: number;
}
