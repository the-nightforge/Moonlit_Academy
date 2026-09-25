import type { Action, CombatEvent } from "./events";
import type { CombatState } from "./state";
import type { NodeType } from "./static";

export interface MapNode {
  /** "f3n1" = floor 3, lane 1. */
  id: string;
  floor: number;
  lane: number;
  type: NodeType;
  /** Node ids on the next floor, by increasing lane. */
  next: string[];
  /** Set for combat, elite and boss nodes. */
  encounterId?: string;
}

export interface RunMap {
  /** floors[i] = floor i + 1, by lane. */
  floors: MapNode[][];
}

export type RunStatus = "map" | "combat" | "reward" | "rest" | "treasure" | "won" | "lost";

export interface RunState {
  status: RunStatus;
  rngState: number;
  /** In team order. */
  heroes: { defId: string; hp: number; maxHp: number }[];
  /** Card ids; bond cards are added per combat, not stored here. */
  deck: string[];
  /** In acquisition order. */
  runRelicIds: string[];
  map: RunMap;
  /** Current node; null before entering floor 1. */
  position: string | null;
  combat: CombatState | null;
  pendingReward: { cardChoices: string[]; runRelicId?: string } | null;
}

export interface RunSetup {
  heroIds: [string, string, string];
  seed: number;
}

export type RunAction =
  | { type: "chooseNode"; nodeId: string }
  | { type: "combat"; action: Action }
  | { type: "pickCard"; cardId: string | null }
  | { type: "rest"; choice: "heal" }
  | { type: "rest"; choice: "removeCard"; cardId: string }
  | { type: "continue" };

export type RunEvent =
  | { type: "nodeEntered"; nodeId: string; nodeType: NodeType }
  | { type: "cardAdded"; cardId: string }
  | { type: "cardRemoved"; cardId: string }
  | { type: "runRelicGained"; runRelicId: string }
  /** heroId is the hero's defId ("m05"). */
  | { type: "heroRevived"; heroId: string; hp: number }
  | { type: "restHealed"; heroId: string; amount: number }
  | { type: "runEnded"; result: "won" | "lost" };

export type RunActionResult =
  | { ok: true; run: RunState; events: CombatEvent[]; runEvents: RunEvent[] }
  | { ok: false; error: string };
