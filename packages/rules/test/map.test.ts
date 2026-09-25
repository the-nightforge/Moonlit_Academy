import { describe, expect, it } from "vitest";
import type { MapNode, RunMap } from "../src/index";
import { generateMap } from "../src/index";
import { testData } from "./helpers";

const data = testData();
const maps = Array.from({ length: 50 }, (_, i) => generateMap(data, i + 1).map);

const nodesOf = (map: RunMap) => map.floors.flat();
const laneOf = (map: RunMap, id: string) => nodesOf(map).find((n) => n.id === id)!.lane;
const parentsOf = (map: RunMap, node: MapNode) =>
  node.floor === 1 ? [] : map.floors[node.floor - 2]!.filter((p) => p.next.includes(node.id));
const ruleOf = (floor: number) => data.runConfig.floorRules.find((r) => r.floors.includes(floor))!;

describe("map generation", () => {
  it("T96: floors 1-7 have 2-3 nodes and floor 8 is a single boss", () => {
    for (const map of maps) {
      expect(map.floors).toHaveLength(8);
      for (const floor of map.floors.slice(0, 7)) {
        expect(floor.length).toBeGreaterThanOrEqual(2);
        expect(floor.length).toBeLessThanOrEqual(3);
      }
      expect(map.floors[7]!.map((n) => n.type)).toEqual(["boss"]);
    }
  });

  it("T97: every node is connected and reachable from floor 1", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        if (node.floor < 8) expect(node.next.length).toBeGreaterThan(0);
        if (node.floor > 1) expect(parentsOf(map, node).length).toBeGreaterThan(0);
      }
      const seen = new Set(map.floors[0]!.map((n) => n.id));
      for (const floor of map.floors) {
        for (const node of floor) if (seen.has(node.id)) node.next.forEach((id) => seen.add(id));
      }
      expect(seen.size).toBe(nodesOf(map).length);
    }
  });

  it("T98: edges never cross and next lists are sorted by lane", () => {
    for (const map of maps) {
      for (const floor of map.floors) {
        for (const node of floor) {
          const lanes = node.next.map((id) => laneOf(map, id));
          expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
        }
        for (const a of floor) {
          for (const b of floor) {
            if (a.lane >= b.lane || a.next.length === 0) continue;
            const maxA = Math.max(...a.next.map((id) => laneOf(map, id)));
            const minB = Math.min(...b.next.map((id) => laneOf(map, id)));
            expect(maxA).toBeLessThanOrEqual(minB);
          }
        }
      }
    }
  });

  it("T99: node types follow floorRules; no elite/rest right after the same type", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        const rule = ruleOf(node.floor);
        if ("type" in rule) {
          expect(node.type).toBe(rule.type);
        } else {
          expect(rule.weights[node.type] ?? 0).toBeGreaterThan(0);
          if (node.type === "elite" || node.type === "rest") {
            expect(parentsOf(map, node).some((p) => p.type === node.type)).toBe(false);
          }
        }
      }
    }
  });

  it("T100: encounters match tier and minFloor and avoid parents' encounters", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        if (node.type === "rest" || node.type === "treasure") {
          expect(node.encounterId).toBeUndefined();
          continue;
        }
        const encounter = data.encounters[node.encounterId!]!;
        const tier = node.type === "combat" ? "normal" : node.type;
        expect(encounter.tier).toBe(tier);
        expect(encounter.minFloor ?? 1).toBeLessThanOrEqual(node.floor);
        const parentEncounters = new Set(parentsOf(map, node).map((p) => p.encounterId));
        if (node.type !== "boss" && parentEncounters.has(node.encounterId)) {
          const pool = Object.values(data.encounters).filter(
            (e) => e.tier === tier && (e.minFloor ?? 1) <= node.floor && !parentEncounters.has(e.id),
          );
          expect(pool).toEqual([]);
        }
      }
    }
  });

  it("T101: same seed gives the same map; seeds give different maps", () => {
    expect(generateMap(data, 7)).toEqual(generateMap(data, 7));
    const distinct = new Set(maps.slice(0, 10).map((map) => JSON.stringify(map)));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });
});
