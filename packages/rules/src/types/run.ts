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
