import Phaser from "phaser";
import type { DialogueLine, StoryRewards } from "rules";
import { session } from "../session";
import { CURRENCY_LABELS, useDesignCamera } from "../ui/theme";
import { DialogueView } from "../ui/dialogue-view";

interface DialogueData { stageId?: string; part?: "before" | "after" }

/** Rewards are the server-confirmed profile diff, never a client-side grant. */
function rewardLines(rewards: StoryRewards): string[] {
  const data = session.data;
  const lines: string[] = [];
  if (rewards.moonJade > 0) lines.push(`+${rewards.moonJade} ${CURRENCY_LABELS.moonJade}`);
  if (rewards.darkIron > 0) lines.push(`+${rewards.darkIron} Huyền Thiết`);
  for (const gain of rewards.gains) {
    const name = data.heroes[gain.heroId]?.name ?? gain.heroId;
    const levelUp = gain.levelAfter > gain.levelBefore ? ` — Lên cấp Tu Luyện ${gain.levelAfter}!` : "";
    lines.push(`${name} +${gain.xp} kinh nghiệm Tu Luyện${levelUp}`);
  }
  if (rewards.hero !== null) {
    const name = data.heroes[rewards.hero.itemId]?.name ?? rewards.hero.itemId;
    if (rewards.hero.outcome === "newHero") lines.push(`Hero mới: ${name}!`);
    else if (rewards.hero.outcome === "constellation") lines.push(`${name} +1 Tinh Hồn`);
    else lines.push(`+${rewards.hero.moonStar ?? 0} ${CURRENCY_LABELS.moonStar}`);
  }
  return lines;
}

/** Responsive dialogue preserves the existing before/after transitions and keys. */
export class DialogueScene extends Phaser.Scene {
  private view: DialogueView | null = null;
  private stageId = "";
  private part: "before" | "after" = "before";
  private lines: DialogueLine[] = [];
  private index = 0;
  private finished = false;
  constructor() { super("dialogue"); }
  create(data: DialogueData = {}) {
    useDesignCamera(this);
    this.stageId = data.stageId ?? session.pendingStageId ?? "";
    this.part = data.part ?? "before";
    this.index = 0; this.finished = false;
    this.lines = session.data.storyStages[this.stageId]?.[this.part] ?? [];
    if (this.lines.length === 0) { this.finish(); return; }
    this.view = new DialogueView({ next: () => this.next(), skip: () => this.finish() });
    const key = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== "Enter") return;
      if (event.repeat || (event.target as HTMLElement).closest("button,input,textarea,select")) return;
      event.preventDefault(); this.next();
    };
    window.addEventListener("keydown", key);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { window.removeEventListener("keydown", key); this.view?.destroy(); this.view = null; });
    this.render();
  }
  private next() {
    if (this.finished) return;
    this.index++;
    if (this.index >= this.lines.length) this.finish(); else this.render();
  }
  private finish() {
    if (this.finished) return;
    this.finished = true;
    if (this.part === "before") { this.scene.start("deck-select"); return; }
    const last = session.lastStory;
    session.lastStory = null;
    if (last?.won === true && last.rewards.firstClear) session.notices.push("Thưởng lần đầu:", ...rewardLines(last.rewards));
    this.scene.start("story");
  }
  private render() { this.view?.render(session.data, session.data.storyStages[this.stageId]!.name, this.lines[this.index]!, this.index, this.lines.length); }
}
