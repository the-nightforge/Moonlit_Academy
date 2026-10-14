import type { GameData } from "rules";
import { storyProgressModel, type StoryProgress, type StoryStageRow } from "./story-presentation";
import { storyEscape as esc, storyIcon as icon, storyPortrait as portrait } from "./story-art";
import "./story.css";

export interface StoryViewState {
  data: GameData; progress: StoryProgress | null; online: boolean; loading: boolean; error: string; notice: string;
}
const statusText = { cleared: "Đã qua", open: "Đang mở", locked: "Chưa mở" };
const statusIcon = { cleared: "check", open: "mode_story", locked: "lock" };

/** Server progress drives the journey; selecting a locked node only inspects it. */
export class StoryView {
  private readonly shell = document.createElement("section");
  private readonly oldOverflow = document.body.style.overflow;
  private arcId = "";
  private stageId = "";
  private state: StoryViewState | null = null;
  constructor(private readonly actions: { back: () => void; retry: () => void; start: (id: string) => void }) {
    this.shell.className = "vn-story";
    this.shell.setAttribute("aria-label", "Cốt Truyện");
    document.body.style.overflow = "hidden";
    document.body.append(this.shell);
    this.shell.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled || !this.state) return;
      const action = button.dataset.action;
      if (action === "back") this.actions.back();
      if (action === "retry") this.actions.retry();
      if (action === "arc") { this.arcId = button.dataset.id!; this.stageId = ""; this.render(this.state, button.dataset.control); }
      if (action === "stage") {
        this.stageId = button.dataset.id!; this.render(this.state, button.dataset.control);
        if (window.matchMedia("(max-width:720px)").matches) this.shell.querySelector(".st-detail")?.scrollIntoView({ block: "start" });
      }
      if (action === "start" && this.state.online && !this.state.loading && !this.state.error && this.state.progress) {
        const row = storyProgressModel(this.state.data, this.state.progress, this.arcId, this.stageId).stages.find(row => row.stage.id === this.stageId);
        if (row?.status === "open") this.actions.start(this.stageId);
      }
    });
  }
  render(state: StoryViewState, focusControl?: string) {
    this.state = state;
    const active = document.activeElement as HTMLElement | null;
    const focus = focusControl ?? (this.shell.contains(active) ? active?.dataset.control : undefined);
    const scroll = this.shell.scrollTop;
    const header = `<header class="st-header"><button class="st-icon-button" data-action="back" data-control="back" aria-label="Quay lại">${icon("nav_back")}</button><div><h1>Cốt Truyện</h1><p>${Object.keys(state.data.storyArcs).length} chương · ${Object.keys(state.data.storyStages).length} màn</p></div>${icon("mode_story")}</header>`;
    let body = "";
    if (!state.online) body = `<section class="st-empty">${icon("lock")}<h2>Cần đăng nhập để tiếp tục</h2><p>Tiến độ Cốt Truyện được lưu trên tài khoản.</p></section>`;
    else if (state.loading) body = '<section class="st-empty" role="status"><div class="st-loading"></div><p>Đang tải tiến độ…</p></section>';
    else if (state.error) body = `<section class="st-empty" role="alert"><h2>Chưa tải được tiến độ</h2><p>${esc(state.error)}</p><button data-action="retry" data-control="retry">${icon("action_reset")}Thử lại</button></section>`;
    else if (state.progress) body = this.journey(state);
    this.shell.innerHTML = `<div class="st-shell">${header}${state.notice ? `<p class="st-notice" role="status">${esc(state.notice)}</p>` : ""}${body}</div>`;
    if (focus) Array.from(this.shell.querySelectorAll<HTMLButtonElement>("[data-control]")).find(node => node.dataset.control === focus)?.focus({ preventScroll: true });
    this.shell.scrollTop = scroll;
  }
  private journey(state: StoryViewState) {
    const model = storyProgressModel(state.data, state.progress!, this.arcId, this.stageId);
    this.arcId = model.selectedArcId; this.stageId = model.selectedStageId;
    const selected = model.stages.find(row => row.stage.id === this.stageId);
    const summary = model.arcs.find(row => row.arc.id === this.arcId);
    if (!summary || !selected) return '<section class="st-empty"><h2>Chưa có chương truyện</h2></section>';
    const arcs = model.arcs.map(({ arc, completed, total }, index) => `<button class="st-arc ${arc.id === this.arcId ? "selected" : ""}" data-action="arc" data-id="${esc(arc.id)}" data-control="arc-${esc(arc.id)}" aria-pressed="${arc.id === this.arcId}"><span class="st-arc-number">Chương ${index + 1}</span><strong>${esc(arc.name)}</strong><span class="st-meter" aria-hidden="true"><i style="width:${total ? completed / total * 100 : 0}%"></i></span><span>${completed}/${total} màn${completed === total ? " · Hoàn thành" : ""}</span></button>`).join("");
    const hero = state.data.heroes[summary.arc.rewardHeroId];
    const heroReward = `<section class="st-chapter-reward"><figure>${portrait(state.data, summary.arc.rewardHeroId)}<figcaption>${esc(hero?.name ?? "")}</figcaption></figure><div><span>Thưởng hoàn thành chương</span><strong>${esc(hero?.name ?? "Hero")}</strong><p>${summary.completed === summary.total ? "Đã nhận thưởng chương" : "Hoàn thành tất cả màn trong chương"}</p></div></section>`;
    const stages = model.stages.map(row => `<button class="st-stage ${row.status} ${row.stage.id === this.stageId ? "selected" : ""}" data-action="stage" data-id="${esc(row.stage.id)}" data-control="stage-${esc(row.stage.id)}" aria-pressed="${row.stage.id === this.stageId}" aria-label="Màn ${row.index + 1}: ${esc(row.stage.name)}, ${statusText[row.status]}"><span class="st-stage-number">${String(row.index + 1).padStart(2, "0")}</span><strong>${esc(row.stage.name)}</strong><span class="st-stage-status">${icon(statusIcon[row.status])}${statusText[row.status]}</span></button>`).join("");
    return `<main class="st-layout"><nav class="st-arcs" aria-label="Chọn chương">${arcs}${heroReward}</nav><section class="st-journey"><header><span class="st-kicker">Chương ${model.arcs.findIndex(row => row.arc.id === this.arcId) + 1}</span><h2>${esc(summary.arc.name)}</h2><p>${summary.completed}/${summary.total} màn đã hoàn thành</p></header><div class="st-stages" aria-label="Chọn màn">${stages}</div></section>${this.detail(state, selected)}</main>`;
  }
  private detail(state: StoryViewState, row: StoryStageRow) {
    const stage = row.stage;
    const encounter = state.data.encounters[stage.encounterId];
    const enemies = [...new Set(encounter?.enemyIds ?? [])].map(id => `<figure>${portrait(state.data, id)}<figcaption>${esc(state.data.enemies[id]?.name ?? id)}${(encounter?.enemyIds.filter(enemy => enemy === id).length ?? 0) > 1 ? ` ×${encounter!.enemyIds.filter(enemy => enemy === id).length}` : ""}</figcaption></figure>`).join("");
    const reward = stage.firstClear;
    const rewards = [["cur_moonJade", "Nguyệt Ngọc", reward.moonJade], ["cur_darkIron", "Huyền Thiết", reward.darkIron], ["nav_mastery", "Kinh nghiệm Tu Luyện", reward.masteryXp]] as const;
    const loot = rewards.filter(([, , value]) => value).map(([key, label, value]) => `<span class="st-loot">${icon(key, label)}<strong>${value}</strong></span>`).join("");
    const button = row.status === "open" ? `<button class="st-start" data-action="start" data-control="start" aria-label="Tiếp tục vào màn ${esc(stage.name)}">${icon("mode_story")}Tiếp tục</button>`
      : `<button class="st-start" disabled>${icon(statusIcon[row.status])}${statusText[row.status]}</button>`;
    const arc = state.data.storyArcs[stage.arcId];
    const chapterDone = arc?.stageIds.every(id => state.progress?.cleared.includes(id));
    const chapterReward = arc ? `<div class="st-detail-chapter">${portrait(state.data, arc.rewardHeroId)}<p>${chapterDone ? "Đã nhận thưởng chương" : "Thưởng hoàn thành chương"}<strong>${esc(state.data.heroes[arc.rewardHeroId]?.name ?? "Hero")}</strong></p></div>` : "";
    return `<aside class="st-detail" aria-label="Chi tiết màn"><span class="st-kicker">Màn ${row.index + 1}</span><h2>${esc(stage.name)}</h2><div class="st-enemies">${enemies}</div><section class="st-rewards ${row.status === "cleared" ? "claimed" : ""}"><h3>Thưởng lần đầu${row.status === "cleared" ? " · Đã nhận" : ""}</h3><div>${loot}</div></section>${button}${row.requirement ? `<p class="st-requirement">${esc(row.requirement)}</p>` : ""}${chapterReward}</aside>`;
  }
  destroy() { this.shell.remove(); document.body.style.overflow = this.oldOverflow; }
}
