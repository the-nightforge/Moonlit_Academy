import { reachableNodeIds, type MapNode, type NodeType, type RunState } from "rules";
export const RUN_NODE_LABELS: Record<NodeType, string> = { combat: "Trận thường", elite: "Tinh Anh", rest: "Nghỉ Chân", treasure: "Kho Báu", event: "Kỳ Ngộ", boss: "Thủ lĩnh" };
export const RUN_NODE_HELP: Record<NodeType, string> = {
  combat: "Thắng trận để chọn một Lõi.", elite: "Thắng trận để nhận Kỳ Vật và chọn một Lõi.",
  rest: "Hồi máu cho đội hình, bỏ một lá hoặc đổi một lá đã mở của cùng anh hùng. Chỉ chọn một lần.", treasure: "Nhận một Kỳ Vật chưa có trong hành trình.", event: "Chọn trao đổi máu, lá bài hoặc Kỳ Vật để nhận sức mạnh, hoặc hồi máu an toàn.", boss: "Đánh bại thủ lĩnh để hoàn thành Tầm Nguyệt.",
};
export type RunNodeStatus = "current" | "visited" | "open" | "upcoming" | "blocked";
export interface RunNodeRow extends MapNode { status: RunNodeStatus; x: number; y: number }
export function runMapModel(run: RunState, visited: string[] = [], selected = "") {
  const all = run.map.floors.flat(), byId = new Map(all.map(node=>[node.id,node]));
  const next = reachableNodeIds(run), open = new Set(run.status === "map" ? next : []), seen = new Set(visited);
  const future = new Set<string>(), pending = [...next];
  while (pending.length) { const id = pending.shift()!; if (future.has(id)) continue; future.add(id); pending.push(...(byId.get(id)?.next ?? [])); }
  const height = 328, width = Math.max(820, run.map.floors.length * 100);
  const nodes: RunNodeRow[] = all.map(node=>({ ...node,
    status: node.id === run.position ? "current" : seen.has(node.id) ? "visited" : open.has(node.id) ? "open" : future.has(node.id) ? "upcoming" : "blocked",
    x: 6 + (node.floor - 1) * 88 / Math.max(1,run.map.floors.length - 1),
    y: height / 2 + Math.sin((node.floor - 1) * .9) * 16 + (node.lane - ((run.map.floors[node.floor - 1]?.length ?? 1) - 1) / 2) * 82,
  }));
  const edges = all.flatMap(node=>node.next.map(to=>({from:node.id,to,active:seen.has(node.id)&&seen.has(to)})));
  return { nodes, edges, selectedId: byId.has(selected) ? selected : next[0] ?? run.position ?? all[0]?.id ?? "", floor: byId.get(run.position ?? "")?.floor ?? 0, height, width };
}
export function runDeckGroups(deck: string[]): { id: string; count: number }[] {
  const counts = new Map<string,number>(); for (const id of deck) counts.set(id,(counts.get(id)??0)+1);
  return Array.from(counts,([id,count])=>({id,count}));
}
