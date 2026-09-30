import type { StatusId } from "./static";

export type Action =
  | { type: "playCard"; instanceId: string; targetId?: string; player?: number }
  | { type: "mulligan"; instanceIds: string[]; player?: number }
  | { type: "chooseCard"; instanceId: string; player?: number }
  | { type: "chooseMoon"; offset: 0 | 1 | 2; player?: number }
  /** `system` marks a server-forced end turn (co-op turn timer, `17` §8.3). */
  | { type: "endTurn"; player?: number; system?: true }
  /**
   * [GĐ5] Server-only system action (`01` §15.6): the seat `player` loses the
   * match. Clients cannot send it — `applyAction` rejects it without `system`.
   */
  | { type: "forfeit"; player: number; reason: "resign" | "timeout" | "disconnect"; system: true };

export type CombatEvent =
  | { type: "combatStarted" }
  | { type: "turnStarted"; side: "hero" | "enemy"; round: number; player?: number }
  | { type: "cardsDrawn"; instanceIds: string[]; player?: number }
  | { type: "deckShuffled"; player?: number }
  | { type: "cardPlayed"; instanceId: string; targetId?: string; cost: number; player?: number }
  | { type: "cardDiscarded"; instanceIds: string[]; player?: number }
  /** [GĐ7] `createCard` put a token in hand; `instanceId: null` when the hand was full (`01` §4.6). */
  | { type: "cardCreated"; cardId: string; instanceId: string | null; player?: number }
  | { type: "damageDealt"; sourceId: string; targetId: string; amount: number; blocked: number; hpLost: number }
  | { type: "hpLost"; targetId: string; amount: number; cause: "loseHp" | "burn" | "reflect" | "bloodMoon" }
  | { type: "healed"; targetId: string; amount: number }
  | { type: "armorGained"; targetId: string; amount: number }
  | { type: "armorRemoved"; targetId: string }
  | { type: "statusApplied"; targetId: string; status: StatusId; value: number }
  | { type: "statusRemoved"; targetId: string; status: StatusId }
  | { type: "moonPowerChanged"; value: number; player?: number }
  | { type: "moonReserveChanged"; side: "hero" | "enemy"; enemyId?: string; value: number; player?: number }
  | { type: "deckedOut"; player?: number }
  | { type: "cardsPurged"; heroId: string; instanceIds: string[]; player?: number }
  | { type: "mulliganed"; returned: string[]; drawn: string[]; player?: number }
  | { type: "choiceOpened"; options: string[]; player?: number }
  | { type: "cardChosen"; instanceId: string; bottomed: string[]; player?: number }
  | { type: "moonChoiceOpened"; options: number[]; player?: number }
  | { type: "moonShifted"; from: number; to: number; cause: "roundEnd" | "card" }
  | { type: "bloodMoonChanged"; rounds: number; cause: "roundEnd" | "card" | "boss" | "start" }
  | {
      type: "intentsRevealed";
      enemyId: string;
      moonPower: number;
      intents: { intentId: string; cost: number; targetId: string | null }[];
    }
  | { type: "intentsCancelled"; enemyId: string; intentIds: string[] }
  /** [GĐ7b] Phong Ấn consumed: the intent or card ran with damage only — every other effect was stripped (`01` §5.6). `refId` = intentId for enemies, instanceId for hero cards. */
  | { type: "sealStripped"; unitId: string; refId: string }
  | { type: "intentExecuted"; enemyId: string; intentId: string; targetId: string | null }
  | { type: "intentFizzled"; enemyId: string; intentId: string }
  | { type: "intentSkipped"; enemyId: string; reason: "freeze" }
  | { type: "runRelicTriggered"; runRelicId: string; player?: number }
  | { type: "relicTriggered"; relicId: string; player?: number }
  | { type: "weaponTriggered"; weaponId: string; heroId: string; player?: number }
  | { type: "heroLeveledUp"; heroId: string; name: string }
  | { type: "unitDied"; unitId: string; killerId?: string }
  /** [GĐ7b] Hồi Hồn (`18` §3.5): a fallen hero stands back up at `hp`. */
  | { type: "heroRevived"; heroId: string; hp: number; player?: number }
  /** [GĐ6] A Hợp Kích fired — both matched card instances (`01` §16.4). */
  | { type: "coopComboTriggered"; comboId: string; cardIds: [string, string]; player: number }
  /** [GĐ6] The co-op boss entered/leaves a phase, including the phase-3 revive (`01` §16.5). */
  | { type: "bossPhaseChanged"; enemyId: string; phase: number }
  /** [GĐ5] Emitted when a server-side forfeit resolves the match. */
  | { type: "playerForfeited"; player: number; reason: "resign" | "timeout" | "disconnect" }
  /** [GĐ5] Server notification inside `match.events`; never produced by `applyAction`. */
  | { type: "playerDisconnected"; player: number }
  /** [GĐ7] A Linh Thú entered the board (`01` §17). */
  | { type: "summoned"; unitId: string; summonId: string; ownerHeroId: string; player?: number }
  | { type: "summonActed"; unitId: string }
  /** [GĐ7] The owner Hero fell: its Linh Thú leaves the board with it (`01` §17.4). */
  | { type: "summonDismissed"; unitId: string }
  | { type: "combatEnded"; result: "won" | "lost" | "draw"; winner?: number | "draw" };
