import type { GameData, MapNode, NodeType, RunMap } from "../types/index";
import { nextFloat, pickOne, type Rng } from "./random";

/**
 * Contiguous next-floor ranges for each of `a` nodes into `b` nodes: each range
 * has 1–2 nodes, ranges are ordered and overlap by at most one node, the first
 * starts at 0 and the last ends at b - 1 (`11` §2.1). Needs b <= 2a.
 */
function connectFloors(rng: Rng, a: number, b: number): [number, number][] {
  const ranges: [number, number][] = [];
  let lo = 0;
  for (let i = 0; i < a; i++) {
    const rest = a - 1 - i;
    const his = [lo, lo + 1].filter(
      (hi) => hi <= b - 1 && hi + 2 * rest >= b - 1 && (rest > 0 || hi === b - 1),
    );
    const hi = pickOne(rng, his);
    ranges.push([lo, hi]);
    if (rest > 0) {
      const los = [hi, hi + 1].filter((next) => next <= b - 1 && next + 1 + 2 * (rest - 1) >= b - 1);
      lo = pickOne(rng, los);
    }
  }
  return ranges;
}

function pickWeighted(rng: Rng, entries: [NodeType, number][]): NodeType {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = nextFloat(rng) * total;
  for (const [type, weight] of entries) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return entries[entries.length - 1]![0];
}

function pickNodeType(rng: Rng, data: GameData, node: MapNode, parents: MapNode[]): NodeType {
  const rule = data.runConfig.floorRules.find((r) => r.floors.includes(node.floor))!;
  if ("type" in rule) return rule.type;
  const blocked = new Set<NodeType>(
    parents.map((p) => p.type).filter((type) => type === "elite" || type === "rest"),
  );
  const entries = (Object.entries(rule.weights) as [NodeType, number | undefined][]).filter(
    (entry): entry is [NodeType, number] =>
      entry[1] !== undefined && entry[1] > 0 && !blocked.has(entry[0]),
  );
  return entries.length > 0 ? pickWeighted(rng, entries) : "combat";
}

/** Seeded map (`11` §2). RNG order: widths → edges → node types → encounters. */
export function generateMap(data: GameData, rngState: number): { map: RunMap; rngState: number } {
  const rng: Rng = { state: rngState };
  const { floors, floorWidth } = data.runConfig;

  const widths: number[] = [];
  for (let floor = 1; floor <= floors; floor++) {
    widths.push(
      floor === floors
        ? 1
        : floorWidth.min + Math.floor(nextFloat(rng) * (floorWidth.max - floorWidth.min + 1)),
    );
  }
  const nodes: MapNode[][] = widths.map((width, index) =>
    Array.from({ length: width }, (_, lane) => ({
      id: `f${index + 1}n${lane}`,
      floor: index + 1,
      lane,
      type: "combat" as NodeType,
      next: [] as string[],
    })),
  );

  for (let f = 0; f < floors - 1; f++) {
    const ranges = connectFloors(rng, widths[f]!, widths[f + 1]!);
    nodes[f]!.forEach((node, lane) => {
      const [lo, hi] = ranges[lane]!;
      for (let to = lo; to <= hi; to++) node.next.push(nodes[f + 1]![to]!.id);
    });
  }

  const parentsOf = (node: MapNode): MapNode[] =>
    node.floor === 1 ? [] : nodes[node.floor - 2]!.filter((p) => p.next.includes(node.id));

  for (const floorNodes of nodes) {
    for (const node of floorNodes) node.type = pickNodeType(rng, data, node, parentsOf(node));
  }

  const encounters = Object.values(data.encounters);
  for (const floorNodes of nodes) {
    for (const node of floorNodes) {
      if (node.type === "boss") {
        node.encounterId = encounters.find((e) => e.tier === "boss")!.id;
      } else if (node.type === "combat" || node.type === "elite") {
        const tier = node.type === "combat" ? "normal" : "elite";
        const pool = encounters
          .filter((e) => e.tier === tier && (e.minFloor ?? 1) <= node.floor)
          .map((e) => e.id);
        if (pool.length === 0) {
          throw new Error(`generateMap: no ${tier} encounter for floor ${node.floor}`);
        }
        const parentEncounters = new Set(parentsOf(node).map((p) => p.encounterId));
        const fresh = pool.filter((id) => !parentEncounters.has(id));
        node.encounterId = pickOne(rng, fresh.length > 0 ? fresh : pool);
      }
    }
  }

  return { map: { floors: nodes }, rngState: rng.state };
}
