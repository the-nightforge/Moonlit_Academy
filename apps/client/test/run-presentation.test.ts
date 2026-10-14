import { expect, it } from "vitest";
import { loadGameData } from "data";
import { createRun, reachableNodeIds, starterDeck } from "rules";
import { runDeckGroups, runMapModel } from "../src/ui/run-presentation";
const data = loadGameData(), heroIds: [string, string, string] = ["m05", "f04", "m06"];
const fresh = () => createRun(data, {heroIds,seed:42,deckCardIds:starterDeck(data,heroIds)}).run;
it("selects a reachable entry and keeps every map node and real edge", () => {
  const run = fresh(), model = runMapModel(run);
  expect(model.selectedId).toBe(reachableNodeIds(run)[0]);
  expect(model.nodes.filter(n=>n.status==='open').map(n=>n.id)).toEqual(reachableNodeIds(run));
  expect(model.nodes).toHaveLength(run.map.floors.flat().length);
  expect(model.edges).toHaveLength(run.map.floors.flat().reduce((n,node)=>n+node.next.length,0));
});
it("inspects a distant node without making it reachable", () => {
  const run=fresh(), id=run.map.floors.at(-1)![0]!.id;
  const model=runMapModel(run,[],id);
  expect(model.selectedId).toBe(id);
  expect(model.nodes.find(n=>n.id===id)?.status).toBe('upcoming');
});
it("marks actual recorded path and current position instead of all earlier nodes", () => {
  const run=fresh(), first=run.map.floors[0]![0]!, second=run.map.floors[1]!.find(n=>first.next.includes(n.id))!;
  run.position=second.id;
  const model=runMapModel(run,[first.id,second.id]);
  expect(model.nodes.find(n=>n.id===first.id)?.status).toBe('visited');
  expect(model.nodes.find(n=>n.id===second.id)?.status).toBe('current');
  expect(model.nodes.filter(n=>n.status==='open').map(n=>n.id)).toEqual(reachableNodeIds(run));
  expect(model.edges.find(e=>e.from===first.id&&e.to===second.id)?.active).toBe(true);
  expect(model.nodes.find(n=>n.id===run.map.floors[0]![1]!.id)?.status).toBe('blocked');
});
it("repairs a removed selection and preserves map data during presentation", () => {
  const run=fresh(), before=JSON.stringify(run), model=runMapModel(run,[], 'missing');
  expect(model.selectedId).toBe(reachableNodeIds(run)[0]);
  expect(model.nodes.every(n=>n.x>0&&n.x<100&&n.y>0&&n.y<model.height)).toBe(true);
  expect(JSON.stringify(run)).toBe(before);
});
it("groups repeated cards without losing their exact count or first-seen order", () => {
  expect(runDeckGroups(['a','b','a','c','b','a'])).toEqual([{id:'a',count:3},{id:'b',count:2},{id:'c',count:1}]);
});
