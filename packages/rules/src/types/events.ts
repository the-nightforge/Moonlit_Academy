import type { StatusId } from "./static";

export type Action =
  | { type: "playCard"; instanceId: string; targetId?: string }
  | { type: "mulligan"; instanceIds: string[] }
  | { type: "chooseCard"; instanceId: string }
  | { type: "endTurn" };

export type CombatEvent =
  | { type: "combatStarted" }
  | { type: "turnStarted"; side: "hero" | "enemy"; round: number }
  | { type: "cardsDrawn"; instanceIds: string[] }
  | { type: "deckShuffled" }
  | { type: "cardPlayed"; instanceId: string; targetId?: string; cost: number }
  | { type: "cardDiscarded"; instanceIds: string[] }
  | { type: "damageDealt"; sourceId: string; targetId: string; amount: number; blocked: number; hpLost: number }
  | { type: "hpLost"; targetId: string; amount: number; cause: "loseHp" | "burn" | "reflect" | "bloodMoon" }
  | { type: "healed"; targetId: string; amount: number }
  | { type: "armorGained"; targetId: string; amount: number }
  | { type: "armorRemoved"; targetId: string }
  | { type: "statusApplied"; targetId: string; status: StatusId; value: number }
  | { type: "statusRemoved"; targetId: string; status: StatusId }
  | { type: "moonPowerChanged"; value: number }
  | { type: "moonReserveChanged"; side: "hero" | "enemy"; enemyId?: string; value: number }
  | { type: "deckedOut" }
  | { type: "cardsPurged"; heroId: string; instanceIds: string[] }
  | { type: "mulliganed"; returned: string[]; drawn: string[] }
  | { type: "choiceOpened"; options: string[] }
  | { type: "cardChosen"; instanceId: string; bottomed: string[] }
  | { type: "moonShifted"; from: number; to: number; cause: "roundEnd" | "card" }
  | { type: "bloodMoonChanged"; rounds: number; cause: "roundEnd" | "card" }
  | {
      type: "intentsRevealed";
      enemyId: string;
      moonPower: number;
      intents: { intentId: string; cost: number; targetId: string | null }[];
    }
  | { type: "intentExecuted"; enemyId: string; intentId: string; targetId: string | null }
  | { type: "intentFizzled"; enemyId: string; intentId: string }
  | { type: "intentSkipped"; enemyId: string; reason: "freeze" }
  | { type: "runRelicTriggered"; runRelicId: string }
  | { type: "heroLeveledUp"; heroId: string; name: string }
  | { type: "unitDied"; unitId: string; killerId?: string }
  | { type: "combatEnded"; result: "won" | "lost" };
