import { reachableNodeIds, type MapNode, type NodeType, type RunState } from "rules";
export const RUN_NODE_LABELS: Record<NodeType, string> = { combat: "Trận thường", elite: "Tinh Anh", rest: "Nghỉ Chân", treasure: "Kho Báu", boss: "Thủ lĩnh" };
export const RUN_NODE_HELP: Record<NodeType, string> = {
  combat: "Thắng trận để chọn một Lõi.", elite: "Thắng trận để nhận Kỳ Vật và chọn một Lõi.",
  rest: "Hồi máu cho đội hình hoặc bỏ một lá khỏi bộ bài.", treasure: "Nhận một Kỳ Vật chưa có trong hành trình.", boss: "Đánh bại thủ lĩnh để hoàn thành Tầm Nguyệt.",
};
export type RunNodeStatus = "current" | "visited" | "open" | "upcoming" | "blocked";
export interface RunNodeRow extends MapNode { status: RunNodeStatus; x: number; y: number }
export function runMapModel(run: RunState, visited: string[] = [], selected = "") {
  const all = run.map.floors.flat(), byId = new Map(all.map(node=>[node.id,node]));
  const next = reachableNodeIds(run), open = new Set(run.status === "map" ? next : []), seen = new Set(visited);
  const future = new Set<string>(), pending = [...next];
  while (pending.length) { const id = pending.shift()!; if (future.has(id)) continue; future.add(id); pending.push(...(byId.get(id)?.next ?? [])); }
  const height = run.map.floors.length * 66;
  const nodes: RunNodeRow[] = all.map(node=>({ ...node,
    status: node.id === run.position ? "current" : seen.has(node.id) ? "visited" : open.has(node.id) ? "open" : future.has(node.id) ? "upcoming" : "blocked",
    x: 50 + (node.lane - ((run.map.floors[node.floor - 1]?.length ?? 1) - 1) / 2) * 25,
    y: height - (node.floor - 1) * 66 - 33,
  }));
  const edges = all.flatMap(node=>node.next.map(to=>({from:node.id,to,active:seen.has(node.id)&&seen.has(to)})));
  return { nodes, edges, selectedId: byId.has(selected) ? selected : next[0] ?? run.position ?? all[0]?.id ?? "", floor: byId.get(run.position ?? "")?.floor ?? 0, height };
}
export function runDeckGroups(deck: string[]): { id: string; count: number }[] {
  const counts = new Map<string,number>(); for (const id of deck) counts.set(id,(counts.get(id)??0)+1);
  return Array.from(counts,([id,count])=>({id,count}));
}
