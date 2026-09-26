import Phaser from "phaser";
import type { GameData, PullResult, Rarity } from "rules";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { api } from "../api";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, RARITY_COLORS, RARITY_LABELS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;
const CARD_W = 130;
const CARD_H = 170;
const RARITIES: readonly Rarity[] = ["legendary", "epic", "rare", "common"];

interface HistoryEntry {
  bannerId: string;
  results: PullResult[];
  createdAt: number;
}

/** Hero, weapon or moon relic name for a pull result. */
const itemName = (data: GameData, id: string) => data.heroes[id]?.name ?? data.weapons[id]?.name ?? data.relics[id]?.name ?? id;

const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

/** Hero banner: public rates and pity, 1/10 pulls with a flip per result, pull log (`15` §6). */
export class GachaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private results!: Phaser.GameObjects.Container;
  private history: Phaser.GameObjects.Container | null = null;
  private bannerId = "";
  private busy = false;

  constructor() {
    super("gacha");
  }

  create() {
    useDesignCamera(this);
    this.busy = false;
    this.history = null;
    this.root = this.add.container(0, 0);
    this.results = this.add.container(0, 0);
    this.bannerId = Object.keys(session.data.banners)[0]!;
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    const { gacha, pullCost } = data.economyConfig;
    const banner = data.banners[this.bannerId]!;
    const profile = session.profile;
    const pity = profile.pity[this.bannerId] ?? { sinceEpic: 0, sinceLegendary: 0 };

    addText(this, this.root, WIDTH / 2, 28, "Triệu Hồi", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, profile.currencies);

    Object.values(data.banners).forEach((entry, index) => {
      const chosen = entry.id === this.bannerId;
      addButton(this, this.root, 230, 80 + index * 42, 380, `${entry.name}${chosen ? " ✓" : ""}`, () => {
        this.bannerId = entry.id;
        this.results.removeAll(true);
        this.render();
      });
    });

    const info = [
      `Tỉ lệ: Legendary ${percent(gacha.rates.legendary)} · Epic ${percent(gacha.rates.epic)} · còn lại Rare/Common`,
      `Bảo hiểm Epic: chắc chắn trong ${gacha.epicPity} lượt`,
      `Legendary: từ lượt ${gacha.legendarySoftPityStart} tỉ lệ +${percent(gacha.legendarySoftPityStep)} mỗi lượt,`,
      `chắc chắn ở lượt ${gacha.legendaryPity}`,
      ...(gacha.newPlayerEpicHero && banner.kind === "hero" ? ["Bảo vệ người mới: Epic ưu tiên Hero chưa sở hữu"] : []),
    ];
    // The info block starts below the banner buttons.
    const top = 80 + Object.keys(data.banners).length * 42 - 14;
    this.root.add(this.add.text(40, top, info.join("\n"), { ...TEXT_BASE, fontSize: "13px", color: COLORS.dimText, lineSpacing: 5 }));

    addText(this, this.root, 40, top + 132, `Còn ${Math.max(1, gacha.epicPity - pity.sinceEpic)} lượt tới Epic chắc chắn`, 15, COLORS.gold);
    addText(this, this.root, 40, top + 156, `Còn ${Math.max(1, gacha.legendaryPity - pity.sinceLegendary)} lượt tới Legendary chắc chắn`, 15, COLORS.gold);

    addText(this, this.root, 40, top + 196, "Có thể nhận:", 14);
    let y = top + 222;
    for (const rarity of RARITIES) {
      const ids = banner.pool[rarity];
      if (ids.length === 0) continue;
      const names = ids.map((id) => {
        const name = itemName(data, id);
        const level =
          banner.kind === "hero" ? (profile.heroes[id] ? `Tinh Hồn ${profile.heroes[id]!.constellation}` : null)
            : banner.kind === "weapon" ? (profile.weapons[id] ? `R${profile.weapons[id]!.refinement}` : null)
              : (profile.relics[id] ? `Cộng Minh ${profile.relics[id]!.resonance}` : null);
        return `${name} (${level ?? "chưa có"})`;
      });
      const label = this.add.text(40, y, `${RARITY_LABELS[rarity]}: ${names.join(", ")}`, {
        ...TEXT_BASE, fontSize: "13px", color: COLORS.text, wordWrap: { width: 380 },
      });
      label.setColor(`#${RARITY_COLORS[rarity].toString(16).padStart(6, "0")}`);
      this.root.add(label);
      y += label.height + 6;
    }

    const jade = profile.currencies.moonJade;
    addButton(this, this.root, 720, 640, 220, `Quay 1  (◆ ${pullCost})`, () => this.pull(1), jade >= pullCost && !this.busy);
    addButton(this, this.root, 960, 640, 220, `Quay 10  (◆ ${pullCost * 10})`, () => this.pull(10), jade >= pullCost * 10 && !this.busy);
    if (this.results.length === 0) {
      addText(this, this.root, 860, 330, `Mỗi lượt quay tốn ${pullCost} ${CURRENCY_LABELS.moonJade}`, 15, COLORS.dimText).setOrigin(0.5);
    }

    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("deck-select"));
    addButton(this, this.root, 250, 680, 150, "Nhật ký quay", () => void this.showHistory(0));
    addButton(this, this.root, 430, 680, 180, "Cửa hàng Nguyệt Tinh", () => this.scene.start("shop"));
  }

  private pull(count: 1 | 10) {
    if (this.busy) return;
    this.busy = true;
    this.results.removeAll(true);
    this.render();
    type PullReply = ProfileReply & { results: PullResult[]; achievements: string[] };
    mutate<PullReply>("POST", `/gacha/${this.bannerId}/pull`, { count }).then(
      (reply) => {
        this.busy = false;
        this.reveal(reply.results);
        this.render();
        showToast(this, achievementNotices(reply.achievements), 80);
      },
      (error: unknown) => {
        this.busy = false;
        window.alert(errorText(error));
        this.render();
      },
    );
  }

  /** Face-down cards flip one by one; the rarity sets the colour and the pause. */
  private reveal(results: PullResult[]) {
    const data = session.data;
    const perRow = 5;
    results.forEach((result, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const single = results.length === 1;
      const x = single ? 860 : 560 + col * 150;
      const y = single ? 330 : 220 + row * 200;
      const card = this.add.container(x, y);
      const back = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x1a2244).setStrokeStyle(2, COLORS.panelBorder);
      const mark = this.add.text(0, 0, "☾", { ...TEXT_BASE, fontSize: "40px", color: COLORS.dimText }).setOrigin(0.5);
      card.add([back, mark]);
      this.results.add(card);

      const color = RARITY_COLORS[result.rarity];
      const grand = result.rarity === "legendary" || result.rarity === "epic";
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 140,
        delay: 250 + index * 220,
        onComplete: () => {
          mark.destroy();
          back.setFillStyle(0x141b33).setStrokeStyle(grand ? 4 : 2, color);
          const name = itemName(data, result.itemId);
          card.add(this.add.rectangle(0, -CARD_H / 2 + 14, CARD_W, 28, color));
          card.add(this.add.text(0, -CARD_H / 2 + 14, RARITY_LABELS[result.rarity], { ...TEXT_BASE, fontSize: "12px", color: "#0b1026" }).setOrigin(0.5));
          card.add(this.add.text(0, -8, name, { ...TEXT_BASE, fontSize: "15px", color: COLORS.text, align: "center", wordWrap: { width: CARD_W - 12 } }).setOrigin(0.5));
          card.add(this.add.text(0, 44, this.outcomeText(result), { ...TEXT_BASE, fontSize: "12px", color: COLORS.gold, align: "center", wordWrap: { width: CARD_W - 12 } }).setOrigin(0.5));
          if (result.rarity === "legendary") this.cameras.main.flash(300, 255, 220, 120);
          this.tweens.add({
            targets: card,
            scaleX: 1,
            duration: 160,
            onComplete: () => {
              if (grand) this.tweens.add({ targets: card, scale: 1.08, duration: 180, yoyo: true });
            },
          });
        },
      });
    });
  }

  private outcomeText(result: PullResult): string {
    switch (result.outcome) {
      case "newHero":
        return "MỚI!";
      case "constellation":
        return `Tinh Hồn ${result.constellation}`;
      case "moonStar":
        return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}`;
      case "newWeapon":
      case "newRelic":
        return "MỚI!";
      case "refinement":
        return `Tinh Luyện ${result.refinement}`;
      case "resonance":
        return `Cộng Minh ${result.resonance}`;
      case "maxed":
        return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}, +1 ${result.darkIron ? "Huyền Thiết" : "Nguyệt Trần"}`;
      default: {
        const exhaustive: never = result.outcome;
        return String(exhaustive);
      }
    }
  }

  private async showHistory(page: number) {
    let entries: HistoryEntry[];
    try {
      entries = (await api<{ entries: HistoryEntry[] }>("GET", `/gacha/history?page=${page}`)).entries;
    } catch (error) {
      window.alert(errorText(error));
      return;
    }
    this.history?.destroy();
    const layer = this.add.container(0, 0).setDepth(500);
    this.history = layer;
    const shade = this.add.rectangle(WIDTH / 2, 360, WIDTH, 720, 0x000000, 0.85).setInteractive();
    layer.add(shade);
    addText(this, layer, WIDTH / 2, 40, `Nhật ký quay — trang ${page + 1}`, 22, COLORS.gold).setOrigin(0.5);
    const data = session.data;
    if (entries.length === 0) addText(this, layer, WIDTH / 2, 200, "Chưa có lượt quay nào", 15, COLORS.dimText).setOrigin(0.5);
    entries.forEach((entry, index) => {
      const when = new Date(entry.createdAt).toLocaleString("vi-VN");
      const names = entry.results.map((result) => `${itemName(data, result.itemId)}${result.rarity === "legendary" || result.rarity === "epic" ? ` (${RARITY_LABELS[result.rarity]})` : ""}`);
      const line = this.add.text(60, 80 + index * 28, `${when}  ·  ${data.banners[entry.bannerId]?.name ?? entry.bannerId}  ·  ${names.join(", ")}`, {
        ...TEXT_BASE, fontSize: "12px", color: COLORS.text, wordWrap: { width: WIDTH - 120 }, maxLines: 1,
      });
      layer.add(line);
    });
    addButton(this, layer, WIDTH / 2 - 170, 680, 140, "◂ Mới hơn", () => void this.showHistory(page - 1), page > 0);
    addButton(this, layer, WIDTH / 2, 680, 140, "Đóng", () => {
      this.history?.destroy();
      this.history = null;
    });
    addButton(this, layer, WIDTH / 2 + 170, 680, 140, "Cũ hơn ▸", () => void this.showHistory(page + 1), entries.length === 20);
  }
}
