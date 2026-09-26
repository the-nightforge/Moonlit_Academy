import Phaser from "phaser";
import { claimMission, missionProgress } from "rules";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;
type Tab = "daily" | "weekly" | "achievements";

const TAB_LABELS: Record<Tab, string> = { daily: "Hằng ngày", weekly: "Hằng tuần", achievements: "Thành tựu" };

/** Daily/weekly missions with a claim button, and one-time achievements (`14` §7–§8). */
export class MissionsScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tab: Tab = "daily";
  private busy = false;

  constructor() {
    super("missions");
  }

  create() {
    useDesignCamera(this);
    this.busy = false;
    this.root = this.add.container(0, 0);
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 28, "Nhiệm vụ", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, session.profile.currencies);
    (Object.keys(TAB_LABELS) as Tab[]).forEach((tab, index) => {
      addButton(this, this.root, WIDTH / 2 - 190 + index * 190, 80, 170, `${TAB_LABELS[tab]}${tab === this.tab ? " ✓" : ""}`, () => {
        this.tab = tab;
        this.render();
      });
    });
    const resetHour = (data.economyConfig.resetUtcHour + 7) % 24;
    const resetText = this.tab === "daily" ? `Làm mới lúc ${resetHour}:00 mỗi ngày (giờ Việt Nam)`
      : this.tab === "weekly" ? `Làm mới lúc ${resetHour}:00 thứ Hai (giờ Việt Nam)`
        : "Thành tựu tự nhận thưởng khi đạt";
    addText(this, this.root, WIDTH / 2, 116, resetText, 13, COLORS.dimText).setOrigin(0.5);

    if (this.tab === "achievements") this.renderAchievements();
    else this.renderMissions(this.tab);
    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("deck-select"));
  }

  private renderMissions(period: "daily" | "weekly") {
    const data = session.data;
    const now = Date.now();
    Object.values(data.missions).filter((mission) => mission.period === period).forEach((mission, index) => {
      const y = 180 + index * 90;
      const progress = Math.min(mission.goal.count, missionProgress(data, session.profile, mission.id, now));
      // A dry run of the server's claim gives the button state.
      const claim = claimMission(data, session.profile, mission.id, now);
      const claimed = !claim.ok && claim.error === "already claimed";
      this.row(y, claimed);
      addText(this, this.root, 180, y - 20, mission.name, 16);
      addText(this, this.root, 180, y + 6, mission.text, 13, COLORS.dimText);
      this.bar(760, y, progress / mission.goal.count, `${progress}/${mission.goal.count}`);
      addText(this, this.root, 900, y, `+${mission.reward.moonJade} ◆`, 14, COLORS.gold).setOrigin(0, 0.5);
      if (claimed) addText(this, this.root, 1060, y, "Đã nhận", 13, COLORS.dimText).setOrigin(0.5);
      else addButton(this, this.root, 1060, y, 120, "Nhận", () => this.claim(mission.id), claim.ok && !this.busy);
    });
  }

  private renderAchievements() {
    const data = session.data;
    Object.values(data.achievements).forEach((achievement, index) => {
      const y = 160 + index * 62;
      const done = session.profile.achievements.includes(achievement.id);
      this.row(y, done, 54);
      addText(this, this.root, 180, y - 12, `${done ? "✓ " : ""}${achievement.name}`, 15, done ? COLORS.gold : COLORS.text);
      addText(this, this.root, 180, y + 10, achievement.text, 12, COLORS.dimText);
      addText(this, this.root, 900, y, `+${achievement.reward.moonJade} ◆`, 14, COLORS.gold).setOrigin(0, 0.5);
      addText(this, this.root, 1060, y, done ? "Đã đạt" : "Chưa đạt", 13, COLORS.dimText).setOrigin(0.5);
    });
  }

  private row(y: number, done: boolean, height = 76) {
    const row = this.add.rectangle(WIDTH / 2, y, 1000, height, done ? 0x1f3a2a : 0x141b33).setStrokeStyle(1, COLORS.panelBorder);
    this.root.add(row);
  }

  private bar(x: number, y: number, ratio: number, label: string) {
    this.root.add(this.add.rectangle(x, y, 180, 14, COLORS.hpTrack).setStrokeStyle(1, COLORS.panelBorder));
    if (ratio > 0) this.root.add(this.add.rectangle(x - 90, y, 180 * ratio, 14, COLORS.goldFill).setOrigin(0, 0.5));
    addText(this, this.root, x, y - 18, label, 12).setOrigin(0.5);
  }

  private claim(missionId: string) {
    if (this.busy) return;
    this.busy = true;
    mutate("POST", `/missions/${missionId}/claim`).then(
      () => {
        this.busy = false;
        this.render();
        showToast(this, [`+${session.data.missions[missionId]!.reward.moonJade} ${CURRENCY_LABELS.moonJade}`]);
      },
      (error: unknown) => {
        this.busy = false;
        window.alert(errorText(error));
        this.render();
      },
    );
  }
}
