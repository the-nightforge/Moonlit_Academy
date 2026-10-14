import type { DialogueLine, GameData } from "rules";
import { storyEscape as esc, storyIcon as icon, storyPortrait as portrait } from "./story-art";
import "./story.css";
import "./dialogue.css";

/** Portrait and text occupy separate responsive regions, without image cropping. */
export class DialogueView {
  private readonly shell = document.createElement("section");
  private readonly oldOverflow = document.body.style.overflow;
  private speaker = "";
  constructor(private readonly actions: { next: () => void; skip: () => void }) {
    this.shell.className = "vn-story-dialogue";
    this.shell.setAttribute("aria-label", "Hội thoại Cốt Truyện");
    this.shell.innerHTML = '<div class="sd-shell"><header class="sd-header"><div><span>Cốt Truyện</span><h1></h1></div><span class="sd-count"></span><button data-action="skip">Bỏ qua</button></header><main class="sd-main"><figure></figure><section class="sd-speech" aria-live="polite" aria-atomic="true"></section></main><footer><span>Phím cách để tiếp tục</span><button data-action="next">Tiếp tục <span aria-hidden="true">→</span></button></footer></div>';
    document.body.style.overflow = "hidden";
    document.body.append(this.shell);
    this.shell.addEventListener("click", event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (target?.dataset.action === "next") this.actions.next();
      if (target?.dataset.action === "skip") this.actions.skip();
    });
  }
  render(data: GameData, stageName: string, line: DialogueLine, index: number, total: number) {
    const actor = data.heroes[line.speaker] ?? data.enemies[line.speaker];
    const name = actor?.name ?? "Người dẫn chuyện";
    const art = actor ? portrait(data, line.speaker) : icon("mode_story");
    this.shell.querySelector("h1")!.textContent = stageName;
    const count = this.shell.querySelector(".sd-count")!;
    count.textContent = `${index + 1}/${total}`;
    count.setAttribute("aria-label", `Lời thoại ${index + 1} trên ${total}`);
    this.shell.querySelector(".sd-main")!.classList.toggle("narrator", !actor);
    if (this.speaker !== line.speaker) { this.shell.querySelector("figure")!.innerHTML = art; this.speaker = line.speaker; }
    this.shell.querySelector(".sd-speech")!.innerHTML = `<h2>${esc(name)}</h2><p>${esc(line.text)}</p>`;
    this.shell.scrollTop = 0;
  }
  destroy() { this.shell.remove(); document.body.style.overflow = this.oldOverflow; }
}
