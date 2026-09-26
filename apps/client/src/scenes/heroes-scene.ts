import Phaser from "phaser";
import { pendingUnlocks } from "rules";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, CONSTELLATION_TEXT, FACTION_LABELS, OWNER_COLORS, RARITY_COLORS, RARITY_LABELS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText } from "../ui/widgets";

const WIDTH = 1280;
const MAX_CONSTELLATION = CONSTELLATION_TEXT.length;

const stars = (level: number) => "★".repeat(level) + "☆".repeat(MAX_CONSTELLATION - level);

/** Every hero, owned or not: Tinh Hồn and what each level gives (`14` §10). */
export class HeroesScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private heroId = "";
  private tooltip: Phaser.GameObjects.Container | null = null;
  private busy = false;

  constructor() {
    super("heroes");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.heroId = Object.keys(session.data.heroes)[0]!;
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    const profile = session.profile;
    addText(this, this.root, WIDTH / 2, 28, "Kho Hero", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, profile.currencies);

    Object.values(data.heroes).forEach((hero, index) => {
      const y = 100 + index * 92;
      const owned = profile.heroes[hero.id];
      const chosen = hero.id === this.heroId;
      const panel = this.add.rectangle(230, y, 380, 80, chosen ? 0x2a3a70 : 0x141b33).setAlpha(owned ? 1 : 0.55);
      const golden = owned?.constellation === MAX_CONSTELLATION;
      panel.setStrokeStyle(golden ? 3 : 1, golden ? COLORS.goldFill : chosen ? COLORS.goldFill : RARITY_COLORS[hero.rarity]);
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerup", () => {
        this.heroId = hero.id;
        this.render();
      });
      this.root.add(panel);
      this.root.add(this.add.rectangle(48, y, 6, 64, OWNER_COLORS[hero.id] ?? COLORS.panelBorder));
      addText(this, this.root, 62, y - 24, `${hero.name}  ·  ${RARITY_LABELS[hero.rarity]}`, 15);
      addText(this, this.root, 62, y + 2, owned ? `Tinh Hồn ${stars(owned.constellation)}` : "Chưa sở hữu", 13, owned ? COLORS.gold : COLORS.dimText);
      if (owned && pendingUnlocks(data, profile, hero.id) > 0) addText(this, this.root, 62, y + 22, "● Có lượt mở lá", 12, COLORS.gold);
    });

    this.renderDetail();
    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("deck-select"));
    addButton(this, this.root, 250, 680, 150, "Triệu Hồi", () => this.scene.start("gacha"));
    addButton(this, this.root, 410, 680, 150, "Tu Luyện", () => this.scene.start("mastery", { heroId: this.heroId }), profile.heroes[this.heroId] !== undefined);
  }

  /** Level-up form choice (Tinh Hồn 5, `14` §10.1); the server checks it again. */
  private renderLevelUpForm(x: number, y: number) {
    const hero = session.data.heroes[this.heroId]!;
    const owned = session.profile.heroes[hero.id];
    const alt = hero.altLevelUp;
    const form = owned?.levelUpForm === "alt" && owned.constellation >= 5 ? "alt" : "base";
    this.root.add(this.add.text(x, y, `Dạng thứ hai — ${alt.name}: ${alt.description}`, {
      ...TEXT_BASE, fontSize: "13px", color: form === "alt" ? COLORS.gold : COLORS.text, wordWrap: { width: 760 },
    }));
    if (!owned) return;
    const canAlt = owned.constellation >= 5;
    const choose = (next: "base" | "alt") => {
      if (this.busy || next === form) return;
      this.busy = true;
      mutate("PUT", `/profile/heroes/${hero.id}/level-up-form`, { form: next }).then(
        () => {
          this.busy = false;
          this.render();
        },
        (error: unknown) => {
          this.busy = false;
          window.alert(errorText(error));
          this.render();
        },
      );
    };
    addButton(this, this.root, x + 90, y + 58, 180, `${hero.levelUp.name}${form === "base" ? " ✓" : ""}`, () => choose("base"));
    addButton(this, this.root, x + 290, y + 58, 180, `${alt.name}${form === "alt" ? " ✓" : ""}`, () => choose("alt"), canAlt);
    if (!canAlt) addText(this, this.root, x + 400, y + 58, "cần Tinh Hồn 5", 12, COLORS.dimText).setOrigin(0, 0.5);
  }

  private renderDetail() {
    const data = session.data;
    const hero = data.heroes[this.heroId]!;
    const owned = session.profile.heroes[hero.id];
    const level = owned?.constellation ?? 0;
    const x = 470;
    addText(this, this.root, x, 70, hero.name, 24, COLORS.gold);
    addText(this, this.root, x, 104, `${RARITY_LABELS[hero.rarity]}  ·  ${FACTION_LABELS[hero.faction]}  ·  HP ${hero.maxHp}`, 14, COLORS.dimText);
    addText(this, this.root, x, 128, owned ? `Tinh Hồn ${level}/${MAX_CONSTELLATION}  ${stars(level)}` : "Chưa sở hữu — nhận từ Triệu Hồi hoặc Cửa hàng Nguyệt Tinh", 15, owned ? COLORS.gold : "#ff8080");

    const { levelUp } = hero;
    const threshold = level >= 2 ? levelUp.constellationThreshold : levelUp.threshold;
    this.root.add(this.add.text(x, 162, `Thăng cấp — ${levelUp.name}: ${levelUp.description}\nNgưỡng hiện tại: ${threshold} (cơ bản ${levelUp.threshold}, Tinh Hồn 2: ${levelUp.constellationThreshold})`, {
      ...TEXT_BASE, fontSize: "13px", color: COLORS.text, wordWrap: { width: 760 }, lineSpacing: 4,
    }));

    addText(this, this.root, x, 232, "Tinh Hồn (quay trùng Hero để tăng)", 15);
    CONSTELLATION_TEXT.forEach((text, index) => {
      const reached = level > index;
      addText(this, this.root, x, 260 + index * 24, `${reached ? "★" : "☆"} ${index + 1}. ${text}`, 13, reached ? COLORS.gold : COLORS.dimText);
    });
    if (owned && owned.bonusUnlocks > 0) {
      addText(this, this.root, x, 410, `Lượt mở lá thêm từ Tinh Hồn: ${owned.bonusUnlocks}`, 13, COLORS.text);
    }
    this.renderLevelUpForm(x, 426);

    addText(this, this.root, x, 514, "Lá chủ lực (di chuột để xem)", 15);
    const { cardId, plusCardId } = hero.signature;
    [cardId, plusCardId].forEach((id, index) => {
      const y = 550 + index * 46;
      const active = index === 0 ? level < 4 : level >= 4;
      const card = data.cards[id]!;
      const row = this.add.rectangle(x, y, 520, 38, active ? 0x1f3a2a : 0x141b33).setOrigin(0, 0.5);
      row.setStrokeStyle(1, COLORS.panelBorder);
      row.setInteractive();
      row.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, 1010, y - 100, data, id);
      });
      row.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
      this.root.add(row);
      const note = index === 0 ? "bản thường" : "Tinh Hồn 4";
      addText(this, this.root, x + 14, y, `${card.cost} · ${card.name}  (${note})${active ? "  ✓ đang dùng" : ""}`, 14).setOrigin(0, 0.5);
    });
  }
}
