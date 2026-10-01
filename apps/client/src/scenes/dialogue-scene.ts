import Phaser from "phaser";
import type { DialogueLine, StoryRewards } from "rules";
import manifest from "virtual:assets-manifest";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, OWNER_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton } from "../ui/widgets";

const WIDTH = 1280;
const HEIGHT = 720;

const PORTRAIT_X = 170;
const PORTRAIT_Y = 290;
const PORTRAIT_W = 160;
const PORTRAIT_H = 200;

interface DialogueData {
  stageId?: string;
  part?: "before" | "after";
}

/** Lines for the rewards toast after the after-dialogue (`18` §4.4); Vietnamese, from the profile diff. */
function rewardLines(rewards: StoryRewards): string[] {
  const data = session.data;
  const lines: string[] = [];
  if (rewards.moonJade > 0) lines.push(`+${rewards.moonJade} ${CURRENCY_LABELS.moonJade}`);
  if (rewards.darkIron > 0) lines.push(`+${rewards.darkIron} Huyền Thiết`);
  for (const gain of rewards.gains) {
    const name = data.heroes[gain.heroId]?.name ?? gain.heroId;
    const levelUp = gain.levelAfter > gain.levelBefore ? ` — Lên cấp Tu Luyện ${gain.levelAfter}!` : "";
    lines.push(`${name} +${gain.xp} XP${levelUp}`);
  }
  if (rewards.hero !== null) {
    const name = data.heroes[rewards.hero.itemId]?.name ?? rewards.hero.itemId;
    if (rewards.hero.outcome === "newHero") lines.push(`Hero mới: ${name}!`);
    else if (rewards.hero.outcome === "constellation") lines.push(`${name} +1 Tinh Hồn`);
    else lines.push(`+${rewards.hero.moonStar ?? 0} ${CURRENCY_LABELS.moonStar}`);
  }
  return lines;
}

/** Stage dialogue (`18` §4.4): portrait frame left, line text in the bottom box; click / Space / Bỏ Qua. */
export class DialogueScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private stageId = "";
  private part: "before" | "after" = "before";
  private lines: DialogueLine[] = [];
  private index = 0;
  private finished = false;

  constructor() {
    super("dialogue");
  }

  preload() {
    for (const [category, files] of Object.entries(manifest)) {
      for (const key of Object.keys(files)) {
        this.load.image(`${category}:${key}`, files[key]!);
      }
    }
  }

  create(data: DialogueData) {
    useDesignCamera(this);
    this.stageId = data.stageId ?? session.pendingStageId ?? "";
    this.part = data.part ?? "before";
    this.index = 0;
    this.finished = false;
    const stage = session.data.storyStages[this.stageId];
    this.lines = stage?.[this.part] ?? [];
    // A stage with no lines skips straight to its next step (`18` §4.4).
    if (stage === undefined || this.lines.length === 0) {
      this.proceed();
      return;
    }
    this.root = this.add.container(0, 0);
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.next();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.next());
    this.input.keyboard?.on("keydown-ENTER", () => this.next());
    this.render();
  }

  private next(): void {
    if (this.finished) return;
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.finish();
      return;
    }
    this.render();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.proceed();
  }

  /** `before` → deck select (the stage is still `session.pendingStageId`); `after` → story + rewards toast. */
  private proceed(): void {
    if (this.part === "before") {
      this.scene.start("deck-select");
      return;
    }
    const last = session.lastStory;
    session.lastStory = null;
    if (last?.won === true && last.rewards.firstClear) {
      session.notices.push("Thưởng lần đầu:", ...rewardLines(last.rewards));
    }
    this.scene.start("story");
  }

  private coverPortrait(key: string): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    const source = this.textures.get(key).getSourceImage();
    const scale = Math.max(PORTRAIT_W / source.width, PORTRAIT_H / source.height);
    const cropW = Math.min(source.width, PORTRAIT_W / scale);
    const cropH = Math.min(source.height, PORTRAIT_H / scale);
    const image = this.add.image(PORTRAIT_X, PORTRAIT_Y, key);
    image.setScale(scale);
    image.setCrop((source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH);
    this.root.add(image);
    return image;
  }

  private render(): void {
    this.root.removeAll(true);
    const data = session.data;
    const stage = data.storyStages[this.stageId]!;
    const line = this.lines[this.index]!;

    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.background));
    this.root.add(
      this.add
        .text(WIDTH / 2, 28, stage.name, { ...TEXT_BASE, fontSize: "20px", color: COLORS.gold })
        .setOrigin(0.5),
    );
    this.root.add(
      this.add
        .text(WIDTH - 40, 28, `${this.index + 1}/${this.lines.length}`, { ...TEXT_BASE, fontSize: "13px", color: COLORS.dimText })
        .setOrigin(1, 0.5),
    );
    addButton(this, this.root, WIDTH - 90, 62, 120, "Bỏ Qua ▸", () => this.finish());

    // Speaker: hero id, enemy id or "narrator" (`02` §1.16).
    const speaker = line.speaker;
    const hero = data.heroes[speaker];
    const enemy = data.enemies[speaker];
    const name = hero?.name ?? enemy?.name ?? "";
    const art = hero?.art.portrait || enemy?.art.portrait || "";
    const texKey = art !== "" ? art : hero !== undefined ? `heroes:${speaker}` : `enemies:${speaker}`;
    const portrait = speaker === "narrator" ? null : this.coverPortrait(texKey);
    const frame = this.add
      .rectangle(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_W, PORTRAIT_H, OWNER_COLORS[speaker] ?? COLORS.panelHero, portrait === null ? 0.55 : 0)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.root.add(frame);
    if (portrait === null && name !== "") {
      this.root.add(
        this.add
          .text(PORTRAIT_X, PORTRAIT_Y, name, { ...TEXT_BASE, fontSize: "15px", color: COLORS.text, align: "center", wordWrap: { width: PORTRAIT_W - 16 } })
          .setOrigin(0.5),
      );
    }
    if (name !== "") {
      this.root.add(
        this.add
          .text(PORTRAIT_X, PORTRAIT_Y + PORTRAIT_H / 2 + 18, name, { ...TEXT_BASE, fontSize: "16px", color: COLORS.gold })
          .setOrigin(0.5),
      );
    }

    const box = this.add.rectangle(WIDTH / 2, 570, 1160, 220, 0x101830, 0.92).setStrokeStyle(1, COLORS.panelBorder);
    this.root.add(box);
    this.root.add(
      this.add
        .text(95, 480, line.text, {
          ...TEXT_BASE,
          fontSize: "17px",
          color: COLORS.text,
          lineSpacing: 6,
          wordWrap: { width: 1090 },
        })
        .setOrigin(0, 0),
    );
    this.root.add(
      this.add
        .text(WIDTH - 40, HEIGHT - 20, "Click hoặc Space để tiếp ▸", { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText })
        .setOrigin(1, 0.5),
    );
  }
}
