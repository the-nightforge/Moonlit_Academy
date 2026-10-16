import type { DialogueLine, GameData } from "rules";
import { storyEscape as esc, storyIcon as icon, storyPortrait as portrait, storyImage } from "./story-art";
import { displayText } from "./display-text";
import "./story.css";
import "./dialogue.css";

export interface DialogueContext { stageId?: string; part?: "before" | "after"; replayOnly?: boolean }
interface ReadLine { index: number; name: string; text: string }

/** Scenery, portraits and speech keep separate frames; history never changes story progress. */
export class DialogueView {
  private readonly shell = document.createElement("section");
  private readonly dialog = document.createElement("dialog");
  private readonly oldOverflow = document.body.style.overflow;
  private speaker: string | null = null;
  private contextKey = "";
  private history: ReadLine[] = [];
  private ready = false;
  private destroyed = false;
  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.ready || this.dialog.open || !this.shell.isConnected || event.defaultPrevented) return;
    if (event.code !== "Space" && event.key !== "Enter") return;
    if (event.repeat) { event.preventDefault(); return; }
    const target = event.target instanceof Element ? event.target : document.activeElement;
    if (target?.closest("button,input,textarea,select,[contenteditable]:not([contenteditable=false])")) return;
    event.preventDefault(); this.actions.next();
  };
  constructor(private readonly actions: { next: () => void; skip: () => void }) {
    this.shell.className = "vn-story-dialogue";
    this.shell.setAttribute("aria-label", "Hội thoại Cốt Truyện");
    this.shell.innerHTML = `<div class="sd-shell">
      <header class="sd-header"><div class="sd-title"><span>Cốt Truyện</span><h1></h1></div>
        <nav aria-label="Điều khiển hội thoại"><button class="sd-tool" data-action="history" aria-label="Xem lịch sử hội thoại" disabled>${icon("nav_history")}</button><button class="sd-tool sd-skip" data-action="skip" aria-label="Bỏ qua đoạn hội thoại" disabled><span aria-hidden="true">»</span></button></nav>
      </header>
      <div class="sd-meta"><span class="sd-part"></span><span class="sd-count"></span><div class="sd-progress" role="progressbar" aria-label="Tiến độ hội thoại"><i></i></div></div>
      <main class="sd-main"><figure class="sd-setting" hidden></figure><div class="sd-dialogue"><figure class="sd-portrait"></figure><section class="sd-speech" aria-live="polite" aria-atomic="true"></section></div></main>
      <footer class="sd-footer"><span class="sd-hint">Phím cách hoặc Enter để tiếp tục</span><button class="sd-next" data-action="next" disabled><span class="sd-next-label">Tiếp tục</span><span class="sd-arrow" aria-hidden="true">→</span></button></footer>
    </div>`;
    this.dialog.className = "sd-history";
    this.dialog.setAttribute("aria-labelledby", "sd-history-title");
    this.shell.append(this.dialog);
    document.body.style.overflow = "hidden";
    document.body.append(this.shell);
    this.shell.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
      if (!button || button.disabled || !this.ready || this.dialog.open) return;
      if (button.dataset.action === "next") this.actions.next();
      if (button.dataset.action === "skip") this.actions.skip();
      if (button.dataset.action === "history") this.openHistory();
    });
    this.dialog.addEventListener("close", () => {
      if (this.shell.isConnected) this.shell.querySelector<HTMLButtonElement>('[data-action="history"]')?.focus({preventScroll:true});
    });
    window.addEventListener("keydown", this.onKey);
  }
  render(data: GameData, stageName: string, line: DialogueLine, index: number, total: number, context: DialogueContext = {}) {
    if (this.destroyed) return;
    const key = JSON.stringify([context.stageId ?? stageName, context.part ?? "before"]);
    if (this.contextKey !== key) {
      this.contextKey = key; this.history = []; this.speaker = null;
      if (this.dialog.open) this.dialog.close();
      const setting = this.shell.querySelector<HTMLElement>(".sd-setting")!;
      const art = context.stageId && data.storyStages[context.stageId] ? storyImage("story", context.stageId, `Khung cảnh ${stageName}`) : "";
      setting.innerHTML = art; setting.hidden = !art;
    }
    const actor = data.heroes[line.speaker] ?? data.enemies[line.speaker];
    const name = actor?.name ?? "Người dẫn chuyện", text = displayText(line.text);
    this.history = this.history.filter(entry => entry.index < index);
    this.history.push({index,name,text});
    this.shell.querySelector("h1")!.textContent = stageName;
    this.shell.querySelector(".sd-part")!.textContent = `${context.replayOnly ? "Xem lại hội thoại · " : ""}${context.part === "after" ? "Sau trận" : context.part === "before" ? "Trước trận" : ""}`;
    const count = this.shell.querySelector(".sd-count")!;
    count.textContent = `${index + 1} / ${total}`; count.setAttribute("aria-label", `Lời thoại ${index + 1} trên ${total}`);
    const progress = this.shell.querySelector<HTMLElement>(".sd-progress")!;
    progress.setAttribute("aria-valuemin", "0"); progress.setAttribute("aria-valuemax", String(Math.max(1,total)));
    progress.setAttribute("aria-valuenow", String(Math.min(index+1,Math.max(1,total))));
    progress.querySelector<HTMLElement>("i")!.style.width = `${Math.min(100, (index+1)/Math.max(1,total)*100)}%`;
    this.shell.querySelector(".sd-main")!.classList.toggle("narrator", !actor);
    if (this.speaker !== line.speaker) {
      this.shell.querySelector(".sd-portrait")!.innerHTML = (actor ? portrait(data,line.speaker) : "") || icon("mode_story", "Người dẫn chuyện");
      this.speaker = line.speaker;
    }
    this.shell.querySelector(".sd-speech")!.innerHTML = `<h2>${esc(name)}</h2><p>${esc(text)}</p>`;
    const last = index >= total-1;
    this.shell.querySelector(".sd-next-label")!.textContent = !last ? "Tiếp tục" : context.replayOnly ? "Về Cốt Truyện" : context.part === "before" ? "Chọn bộ bài" : context.part === "after" ? "Về Cốt Truyện" : "Hoàn tất";
    this.shell.querySelector('[data-action="skip"]')!.setAttribute("aria-label", context.replayOnly ? "Đóng hội thoại và về Cốt Truyện" : "Bỏ qua đoạn hội thoại");
    this.ready = true;
    this.shell.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button => button.disabled = false);
    this.shell.scrollTop = 0;
  }
  private openHistory() {
    if (!this.history.length || this.dialog.open) return;
    this.dialog.innerHTML = `<form method="dialog"><header><div><span>Cốt Truyện</span><h2 id="sd-history-title">Lịch sử hội thoại</h2></div><button class="sd-tool" value="close" aria-label="Đóng lịch sử hội thoại">${icon("action_close")}</button></header>
      <ol class="sd-history-list">${this.history.map((line,i) => `<li ${i === this.history.length-1 ? 'aria-current="true"' : ""}><span class="sd-history-index" aria-hidden="true">${line.index+1}</span><div><h3>${esc(line.name)}</h3><p>${esc(line.text)}</p></div></li>`).join("")}</ol></form>`;
    this.dialog.showModal();
    const list = this.dialog.querySelector<HTMLElement>(".sd-history-list")!;
    list.scrollTop = list.scrollHeight;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.ready = false;
    window.removeEventListener("keydown", this.onKey);
    if (this.dialog.open) this.dialog.close();
    this.shell.remove(); document.body.style.overflow = this.oldOverflow;
  }
}
