import Phaser from "phaser";
import { weekKey } from "rules";
import type { ShopItemDef } from "rules";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, SHOP_ITEM_LABELS, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;

/** Moon star shop (`14` §11): weekly limits, a hero choice picks an epic hero not owned. */
export class ShopScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private busy = false;

  constructor() {
    super("shop");
  }

  create() {
    useDesignCamera(this);
    this.busy = false;
    this.root = this.add.container(0, 0);
    this.render();
  }

  /** Purchases this week; last week's no longer count. */
  private boughtThisWeek(itemId: string): number {
    const shop = session.profile.shop;
    return shop.weekKey === weekKey(session.data, Date.now()) ? (shop.bought[itemId] ?? 0) : 0;
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    const profile = session.profile;
    addText(this, this.root, WIDTH / 2, 28, "Cửa hàng Nguyệt Tinh", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, profile.currencies);
    addText(this, this.root, WIDTH / 2, 62, `${CURRENCY_LABELS.moonStar} có từ Hero quay trùng khi Tinh Hồn đã 6 · giới hạn mua làm mới mỗi tuần`, 13, COLORS.dimText).setOrigin(0.5);

    data.economyConfig.moonStarShop.forEach((item, index) => {
      const y = 140 + index * 150;
      const row = this.add.rectangle(WIDTH / 2, y, 1000, 120, 0x141b33).setStrokeStyle(1, COLORS.panelBorder);
      this.root.add(row);
      const bought = this.boughtThisWeek(item.id);
      const left = item.limitPerWeek - bought;
      const label = item.item.type === "moonJade" ? SHOP_ITEM_LABELS.moonJade(item.item.amount) : SHOP_ITEM_LABELS.heroChoice(item.item.rarity);
      addText(this, this.root, 160, y - 30, label, 18);
      addText(this, this.root, 160, y - 2, `Giá: ✦ ${item.price} ${CURRENCY_LABELS.moonStar}  ·  tuần này còn ${left}/${item.limitPerWeek}`, 13, COLORS.dimText);
      const affordable = profile.currencies.moonStar >= item.price && left > 0 && !this.busy;
      if (item.item.type === "moonJade") {
        addButton(this, this.root, 1020, y, 160, "Mua", () => this.buy(item), affordable);
        return;
      }
      const rarity = item.item.rarity;
      const choices = Object.values(data.heroes).filter((hero) => hero.rarity === rarity && !profile.heroes[hero.id]);
      if (choices.length === 0) {
        addText(this, this.root, 160, y + 28, "Đã sở hữu mọi Hero có thể chọn", 13, COLORS.dimText);
        return;
      }
      choices.forEach((hero, choice) => {
        addButton(this, this.root, 520 + choice * 180, y + 30, 170, `Chọn ${hero.name}`, () => this.buy(item, hero.id), affordable);
      });
    });

    addButton(this, this.root, 90, 680, 140, "◂ Triệu Hồi", () => this.scene.start("gacha"));
  }

  private buy(item: ShopItemDef, heroId?: string) {
    if (this.busy) return;
    const what = heroId ? session.data.heroes[heroId]!.name : "vật phẩm này";
    if (!window.confirm(`Dùng ${item.price} ${CURRENCY_LABELS.moonStar} để mua ${what}?`)) return;
    this.busy = true;
    mutate<ProfileReply & { achievements?: string[] }>("POST", `/shop/${item.id}/buy`, heroId ? { heroId } : {}).then(
      (reply) => {
        this.busy = false;
        this.render();
        showToast(this, [heroId ? `Đã nhận Hero ${what}!` : "Đã mua", ...achievementNotices(reply.achievements)]);
      },
      (error: unknown) => {
        this.busy = false;
        window.alert(errorText(error));
        this.render();
      },
    );
  }
}
