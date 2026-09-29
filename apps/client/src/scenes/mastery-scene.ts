import Phaser from "phaser";
import { masteryLevel, pendingUnlocks } from "rules";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addScreenHeader, addText, alertModal, confirmModal, showToast } from "../ui/widgets";

const WIDTH = 1280;

export class MasteryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private heroId = "";
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("mastery");
  }

  create(data?: { heroId?: string }) {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.heroId = data?.heroId ?? Object.keys(session.data.heroes)[0]!;
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    const levels = data.metaConfig.masteryLevels;
    addScreenHeader(this, this.root, {
      title: "Tu Luyện",
      back: { onBack: () => this.scene.start("deck-select") },
      currencies: session.profile.currencies,
    });
    // Only owned heroes train; others come from the gacha.
    const owned = Object.values(data.heroes).filter((hero) => session.profile.heroes[hero.id]);
    if (!session.profile.heroes[this.heroId]) this.heroId = owned[0]!.id;
    owned.forEach((hero, index) => {
      const y = 100 + index * 90;
      const { xp } = session.profile.heroes[hero.id]!;
      const level = masteryLevel(data, xp);
      const pending = pendingUnlocks(data, session.profile, hero.id);
      const next = levels[level];
      const panel = this.add.rectangle(230, y, 380, 76, hero.id === this.heroId ? 0x2a3a70 : 0x141b33);
      panel.setStrokeStyle(1, hero.id === this.heroId ? COLORS.goldFill : COLORS.panelBorder);
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerup", () => {
        this.heroId = hero.id;
        this.render();
      });
      this.root.add(panel);
      addText(this, this.root, 55, y - 22, `${hero.name}  ·  cấp ${level}/${levels.length}`, 15);
      addText(this, this.root, 55, y + 2, next !== undefined ? `XP ${xp}/${next}` : `XP ${xp} (tối đa)`, 12, COLORS.dimText);
      if (pending > 0) addText(this, this.root, 55, y + 20, `● Còn ${pending} lượt mở`, 12, COLORS.gold);
    });
    const hero = data.heroes[this.heroId]!;
    const unlocked = session.profile.heroes[hero.id]!.unlockedCardIds;
    const pending = pendingUnlocks(data, session.profile, hero.id);
    addText(this, this.root, 480, 70, `${hero.name} — lá khóa`, 18, COLORS.gold);
    hero.lockedCardIds.forEach((cardId, index) => {
      const y = 120 + index * 64;
      const card = data.cards[cardId]!;
      const done = unlocked.includes(cardId);
      const row = this.add.rectangle(480, y, 520, 54, done ? 0x1f3a2a : 0x141b33).setOrigin(0, 0.5);
      row.setStrokeStyle(1, COLORS.panelBorder);
      row.setInteractive();
      row.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, 1010, y, data, cardId);
      });
      row.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
      this.root.add(row);
      addText(this, this.root, 494, y, `${card.cost} · ${card.name}${done ? "  ✓" : ""}`, 15).setOrigin(0, 0.5);
      if (!done) {
        addButton(this, this.root, 920, y, 140, "Mở khóa", () => {
          void confirmModal(this, `Mở khóa "${card.name}"? Dùng 1 lượt mở của ${hero.name}.`, { label: "Mở khóa" }).then((ok) => {
            if (!ok) return;
            mutate<ProfileReply & { achievements?: string[] }>("POST", "/profile/unlock", { heroId: hero.id, cardId }).then(
              (reply) => {
                this.render();
                showToast(this, achievementNotices(reply.achievements));
              },
              (error: unknown) => {
                void alertModal(this, errorText(error));
                this.render();
              },
            );
          });
        }, pending > 0, {
          variant: "primary",
          disabledReason: "Chưa có lượt mở — lên cấp Tu Luyện bằng XP từ Lượt chơi",
        });
      }
    });
  }
}
