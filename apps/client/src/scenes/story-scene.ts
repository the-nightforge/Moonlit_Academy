import Phaser from "phaser";
import type { StoryArcDef, StoryStageDef } from "rules";
import { errorText } from "../account";
import { api } from "../api";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;
const HEIGHT = 720;

/** Arc column (left) and stage rows (right) layout. */
const ARC_X = 180;
const ARC_W = 280;
const ROW_X = 770;
const ROW_W = 840;
const ROW_H = 58;
const ROW_TOP = 150;

/** `18` §4.4: arc list left, selected arc's stages right — đã qua / đang mở / khóa + thưởng lần đầu. */
export class StoryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private cleared = new Set<string>();
  private unlocked = new Set<string>();
  private arcId = "";
  private loading = true;
  private loadError: string | null = null;

  constructor() {
    super("story");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.loading = true;
    this.loadError = null;
    this.render();
    api<{ cleared: string[]; unlocked: string[] }>("GET", "/story").then(
      (reply) => {
        this.cleared = new Set(reply.cleared);
        this.unlocked = new Set(reply.unlocked);
        this.loading = false;
        if (this.scene.isActive()) this.render();
      },
      (error: unknown) => {
        this.loading = false;
        this.loadError = errorText(error);
        if (this.scene.isActive()) this.render();
      },
    );
    showToast(this, session.notices.splice(0));
  }

  private rewardText(arc: StoryArcDef, stage: StoryStageDef, last: boolean): string {
    const parts: string[] = [];
    if (stage.firstClear.moonJade) parts.push(`+${stage.firstClear.moonJade} ${CURRENCY_LABELS.moonJade}`);
    if (stage.firstClear.darkIron) parts.push(`+${stage.firstClear.darkIron} Huyền Thiết`);
    if (stage.firstClear.masteryXp) parts.push(`+${stage.firstClear.masteryXp} XP`);
    if (last) parts.push(`Tặng: ${session.data.heroes[arc.rewardHeroId]?.name ?? arc.rewardHeroId}`);
    return parts.join("  ·  ");
  }

  private render(): void {
    this.root.removeAll(true);
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 30, "Cốt Truyện", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 175, 30, session.profile.currencies);
    addText(
      this, this.root, WIDTH - 40, 28,
      `Huyền Thiết ${session.profile.currencies.darkIron} · Nguyệt Trần ${session.profile.currencies.moonDust}`,
      13, COLORS.dimText,
    ).setOrigin(1, 0.5);
    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("deck-select"));

    if (this.loading) {
      addText(this, this.root, WIDTH / 2, HEIGHT / 2, "Đang tải tiến độ…", 16, COLORS.dimText).setOrigin(0.5);
      return;
    }
    if (this.loadError !== null) {
      addText(this, this.root, WIDTH / 2, HEIGHT / 2 - 20, this.loadError, 16, "#ff8080").setOrigin(0.5);
      addButton(this, this.root, WIDTH / 2, HEIGHT / 2 + 30, 200, "Thử lại", () => this.scene.restart());
      return;
    }

    const arcs = Object.values(data.storyArcs);
    if (this.arcId === "" || data.storyArcs[this.arcId] === undefined) {
      // Default to the arc the player is progressing through, else the first.
      this.arcId =
        arcs.find((arc) => arc.stageIds.some((id) => this.unlocked.has(id) && !this.cleared.has(id)))?.id ??
        arcs[0]?.id ??
        "";
    }
    addText(this, this.root, ARC_X, 106, "Chương", 15, COLORS.dimText).setOrigin(0.5);
    arcs.forEach((arc, index) => {
      const anyOpen = arc.stageIds.some((id) => this.unlocked.has(id));
      const done = arc.stageIds.filter((id) => this.cleared.has(id)).length;
      const picked = arc.id === this.arcId;
      addButton(
        this, this.root, ARC_X, 140 + index * 52, ARC_W,
        `${picked ? "▸ " : ""}${arc.name}  ${done}/${arc.stageIds.length}`,
        () => {
          this.arcId = arc.id;
          this.render();
        },
        anyOpen,
      );
    });

    const arc = data.storyArcs[this.arcId];
    if (!arc) return;
    const rewardHero = data.heroes[arc.rewardHeroId]?.name ?? arc.rewardHeroId;
    addText(
      this, this.root, ROW_X, 106,
      `${arc.name} — trọn chương tặng Hero: ${rewardHero}`, 15, COLORS.gold,
    ).setOrigin(0.5);

    arc.stageIds.forEach((stageId, index) => {
      const stage = data.storyStages[stageId];
      if (!stage) return;
      const cleared = this.cleared.has(stageId);
      const open = !cleared && this.unlocked.has(stageId);
      const last = index === arc.stageIds.length - 1;
      const y = ROW_TOP + index * (ROW_H + 6);
      const row = this.add.rectangle(ROW_X, y, ROW_W, ROW_H, open ? 0x1c2a55 : 0x141b33);
      row.setStrokeStyle(1, open ? COLORS.goldFill : COLORS.panelBorder);
      if (open) {
        row.setInteractive({ useHandCursor: true });
        row.on("pointerover", () => row.setFillStyle(0x2a3a70));
        row.on("pointerout", () => row.setFillStyle(0x1c2a55));
        row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (pointer.button !== 0) return;
          session.pendingStageId = stageId;
          this.scene.start("dialogue", { stageId, part: "before" });
        });
      }
      this.root.add(row);
      const color = cleared || open ? COLORS.text : COLORS.dimText;
      addText(this, this.root, ROW_X - ROW_W / 2 + 16, y - 13, `${index + 1}. ${stage.name}`, 15, color).setOrigin(0, 0.5);
      const status = cleared ? "✓ Đã qua" : open ? "Mở ▸" : "🔒 Chưa mở";
      const statusColor = cleared ? COLORS.gold : open ? "#7fe07f" : COLORS.dimText;
      addText(this, this.root, ROW_X + ROW_W / 2 - 16, y - 13, status, 13, statusColor).setOrigin(1, 0.5);
      addText(
        this, this.root, ROW_X - ROW_W / 2 + 16, y + 15,
        cleared ? "Thưởng lần đầu đã nhận" : `Thưởng lần đầu: ${this.rewardText(arc, stage, last)}`,
        12, COLORS.dimText,
      ).setOrigin(0, 0.5);
    });
  }
}
