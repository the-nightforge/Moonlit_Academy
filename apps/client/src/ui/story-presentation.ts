import type { GameData, StoryArcDef, StoryStageDef } from "rules";

export interface StoryProgress { cleared: string[]; unlocked: string[] }
export interface StoryStageRow { stage: StoryStageDef; index: number; status: "cleared" | "open" | "locked"; requirement: string }
export interface StoryProgressModel {
  arcs: { arc: StoryArcDef; completed: number; total: number }[];
  selectedArcId: string;
  selectedStageId: string;
  stages: StoryStageRow[];
}
export function storyProgressModel(data: GameData, progress: StoryProgress, arcId = "", stageId = ""): StoryProgressModel {
  const cleared = new Set(progress.cleared), unlocked = new Set(progress.unlocked);
  const arcs = Object.values(data.storyArcs).map(arc => ({ arc, completed: arc.stageIds.filter(id => cleared.has(id)).length, total: arc.stageIds.length }));
  const arc = arcs.find(row => row.arc.id === arcId)?.arc
    ?? arcs.find(row => row.arc.stageIds.some(id => unlocked.has(id) && !cleared.has(id)))?.arc ?? arcs[0]?.arc;
  if (!arc) return { arcs, selectedArcId: "", selectedStageId: "", stages: [] };
  const previousArc = arcs[arcs.findIndex(row => row.arc.id === arc.id) - 1]?.arc;
  const stages = arc.stageIds.flatMap((id, index): StoryStageRow[] => {
    const stage = data.storyStages[id];
    if (!stage) return [];
    const status = cleared.has(id) ? "cleared" : unlocked.has(id) ? "open" : "locked";
    const previous = data.storyStages[arc.stageIds[index - 1] ?? ""];
    const requirement = status !== "locked" ? "" : previous ? `Hoàn thành ${previous.name} để mở`
      : previousArc ? `Hoàn thành chương ${previousArc.name} để mở` : "Màn chưa được mở trên tài khoản này";
    return [{ stage, index, status, requirement }];
  });
  const selected = stages.find(row => row.stage.id === stageId) ?? stages.find(row => row.status === "open") ?? stages[0];
  return { arcs, selectedArcId: arc.id, selectedStageId: selected?.stage.id ?? "", stages };
}
