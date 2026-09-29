import Phaser from "phaser";
import { monthKey, weekKey } from "rules";
import type { HonorShopItemDef, Rarity, ShopItemDef } from "rules";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { session } from "../session";
import { COLORS, CURRENCY_LABELS, RARITY_LABELS, SHOP_ITEM_LABELS, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;

type Tab = "moon" | "honor";

/** Item rows start below the tabs and the tab's one-line note. */
const ROWS_TOP = 170;
const ROW_STEP = 150;

/** Open hero-choice picker: which rarity, and what buying one does. */
interface HeroPick {
  rarity: Rarity;
  buy: (heroId: string) => void;
}

/** Shops (`14` §11, §14.4): Nguyệt Tinh with weekly limits, Vinh Dự with weekly/monthly limits. */
export class ShopScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private busy = false;
  private tab: Tab = "moon";
  private back = "gacha";
  private heroPick: HeroPick | null = null;

  constructor() {
    super("shop");
  }

  create(data?: { tab?: Tab; back?: string }) {
    useDesignCamera(this);
    this.busy = false;
    this.tab = data?.tab === "honor" ? "honor" : "moon";
    this.back = data?.back ?? "gacha";
    this.heroPick = null;
    this.root = this.add.container(0, 0);
    this.render();
  }

  /** Purchases this week; last week's no longer count. */
  private boughtThisWeek(itemId: string): number {
    const shop = session.profile.shop;
    return shop.weekKey === weekKey(session.data, Date.now()) ? (shop.bought[itemId] ?? 0) : 0;
  }

  private honorBought(item: HonorShopItemDef): { left: number | null; leftMonth: number | null } {
    const shop = session.profile.honorShop;
    const now = Date.now();
    const week = shop.weekKey === weekKey(session.data, now) ? (shop.bought[item.id] ?? 0) : 0;
    const month = shop.monthKey === monthKey(session.data, now) ? (shop.boughtMonth[item.id] ?? 0) : 0;
    return {
      left: item.limitPerWeek === undefined ? null : item.limitPerWeek - week,
      leftMonth: item.limitPerMonth === undefined ? null : item.limitPerMonth - month,
    };
  }

  private itemLabel(item: HonorShopItemDef["item"]): string {
    switch (item.type) {
      case "moonJade":
        return SHOP_ITEM_LABELS.moonJade(item.amount);
      case "heroChoice":
        return SHOP_ITEM_LABELS.heroChoice(item.rarity);
      case "relicChoice":
        return SHOP_ITEM_LABELS.relicChoice(item.rarity);
    }
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    const profile = session.profile;
    addText(this, this.root, WIDTH / 2, 28, this.tab === "honor" ? "Cửa hàng Vinh Dự" : "Cửa hàng Nguyệt Tinh", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, profile.currencies);
    // Same tab convention as Nhiệm vụ / Kho đồ: the open tab carries a ✓.
    addButton(this, this.root, WIDTH / 2 - 130, 66, 160, `Nguyệt Tinh${this.tab === "moon" ? " ✓" : ""}`, () => {
      this.tab = "moon";
      this.render();
    });
    addButton(this, this.root, WIDTH / 2 + 130, 66, 160, `Vinh Dự${this.tab === "honor" ? " ✓" : ""}`, () => {
      this.tab = "honor";
      this.render();
    });

    if (this.tab === "moon") {
      addText(this, this.root, WIDTH / 2, 100, `${CURRENCY_LABELS.moonStar} có từ Hero quay trùng khi Tinh Hồn đã 6 · giới hạn mua làm mới mỗi tuần`, 13, COLORS.dimText).setOrigin(0.5);
      this.renderMoonShop();
    } else {
      addText(this, this.root, WIDTH / 2, 100, `${CURRENCY_LABELS.honor} kiếm từ trận xếp hạng · giới hạn làm mới mỗi tuần/tháng`, 13, COLORS.dimText).setOrigin(0.5);
      this.renderHonorShop();
    }

    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start(this.back));
    this.renderHeroPicker();
  }

  /** "Chọn Hero ▸" row control: unowned count + the button that opens the picker. */
  private heroChoiceRow(y: number, rarity: Rarity, affordable: boolean, buy: (heroId: string) => void): void {
    const count = this.unownedHeroes(rarity).length;
    if (count === 0) {
      addText(this, this.root, 160, y + 28, "Đã sở hữu mọi Hero có thể chọn", 13, COLORS.dimText);
      return;
    }
    addText(this, this.root, 160, y + 28, `${count} Hero ${RARITY_LABELS[rarity]} chưa sở hữu`, 13, COLORS.dimText);
    addButton(this, this.root, 1020, y, 160, "Chọn Hero ▸", () => {
      this.heroPick = { rarity, buy };
      this.render();
    }, affordable);
  }

  private unownedHeroes(rarity: Rarity) {
    return Object.values(session.data.heroes).filter((hero) => hero.rarity === rarity && !session.profile.heroes[hero.id]);
  }

  /** Overlay grid of the heroes a hero-choice item can grant; picking one buys it. */
  private renderHeroPicker(): void {
    const pick = this.heroPick;
    if (!pick) return;
    const layer = this.add.container(0, 0).setDepth(300);
    this.root.add(layer);
    layer.add(this.add.rectangle(WIDTH / 2, 360, WIDTH, 720, 0x000000, 0.85).setInteractive());
    addText(this, layer, WIDTH / 2, 60, `Chọn 1 Hero ${RARITY_LABELS[pick.rarity]} chưa sở hữu`, 22, COLORS.gold).setOrigin(0.5);
    const close = () => {
      this.heroPick = null;
      this.render();
    };
    const columns = 4;
    const stepX = 280;
    const startX = WIDTH / 2 - ((columns - 1) * stepX) / 2;
    this.unownedHeroes(pick.rarity).forEach((hero, index) => {
      const x = startX + (index % columns) * stepX;
      const y = 140 + Math.floor(index / columns) * 50;
      addButton(this, layer, x, y, 260, hero.name, () => {
        this.heroPick = null;
        this.render();
        pick.buy(hero.id);
      });
    });
    addButton(this, layer, WIDTH / 2, 680, 200, "Đóng", close);
  }

  private renderMoonShop(): void {
    const data = session.data;
    const profile = session.profile;
    data.economyConfig.moonStarShop.forEach((item, index) => {
      const y = ROWS_TOP + index * ROW_STEP;
      const row = this.add.rectangle(WIDTH / 2, y, 1000, 120, 0x141b33).setStrokeStyle(1, COLORS.panelBorder);
      this.root.add(row);
      const bought = this.boughtThisWeek(item.id);
      const left = item.limitPerWeek - bought;
      addText(this, this.root, 160, y - 30, this.itemLabel(item.item), 18);
      addText(this, this.root, 160, y - 2, `Giá: ✦ ${item.price} ${CURRENCY_LABELS.moonStar}  ·  tuần này còn ${left}/${item.limitPerWeek}`, 13, COLORS.dimText);
      const affordable = profile.currencies.moonStar >= item.price && left > 0 && !this.busy;
      if (item.item.type === "moonJade") {
        addButton(this, this.root, 1020, y, 160, "Mua", () => this.buyMoon(item), affordable);
        return;
      }
      this.heroChoiceRow(y, item.item.rarity, affordable, (heroId) => this.buyMoon(item, heroId));
    });
  }

  private renderHonorShop(): void {
    const data = session.data;
    const profile = session.profile;
    const items = data.pvpConfig.honorShop ?? [];
    if (items.length === 0) {
      addText(this, this.root, WIDTH / 2, 320, "Cửa hàng Vinh Dự chưa mở.", 15, COLORS.dimText).setOrigin(0.5);
      return;
    }
    items.forEach((item, index) => {
      const y = ROWS_TOP + index * ROW_STEP;
      const row = this.add.rectangle(WIDTH / 2, y, 1000, 120, 0x141b33).setStrokeStyle(1, COLORS.panelBorder);
      this.root.add(row);
      const { left, leftMonth } = this.honorBought(item);
      const limits = [
        left !== null ? `tuần còn ${left}/${item.limitPerWeek}` : null,
        leftMonth !== null ? `tháng còn ${leftMonth}/${item.limitPerMonth}` : null,
      ].filter(Boolean).join("  ·  ");
      addText(this, this.root, 160, y - 30, this.itemLabel(item.item), 18);
      addText(this, this.root, 160, y - 2, `Giá: ❖ ${item.cost} ${CURRENCY_LABELS.honor}${limits ? `  ·  ${limits}` : ""}`, 13, COLORS.dimText);
      const affordable =
        profile.currencies.honor >= item.cost && (left === null || left > 0) && (leftMonth === null || leftMonth > 0) && !this.busy;
      if (item.item.type === "moonJade") {
        addButton(this, this.root, 1020, y, 160, "Mua", () => this.buyHonor(item), affordable);
        return;
      }
      if (item.item.type === "heroChoice") {
        this.heroChoiceRow(y, item.item.rarity, affordable, (heroId) => this.buyHonor(item, { heroId }));
        return;
      }
      // relicChoice: any relic of the rarity — a duplicate just raises Cộng Minh.
      const it = item.item;
      const choices = Object.values(data.relics).filter((relic) => relic.rarity === it.rarity);
      choices.forEach((relic, choice) => {
        // Below the price line, left-aligned with the item text.
        const x = 255 + (choice % 4) * 200;
        const rowY = y + 34 + Math.floor(choice / 4) * 36;
        addButton(this, this.root, x, rowY, 190, `${relic.name}`, () => this.buyHonor(item, { relicId: relic.id }), affordable);
      });
    });
  }

  private buyMoon(item: ShopItemDef, heroId?: string) {
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

  private buyHonor(item: HonorShopItemDef, pick?: { heroId?: string; relicId?: string }) {
    if (this.busy) return;
    const what = pick?.heroId
      ? session.data.heroes[pick.heroId]!.name
      : pick?.relicId
        ? session.data.relics[pick.relicId]!.name
        : "vật phẩm này";
    if (!window.confirm(`Dùng ${item.cost} ${CURRENCY_LABELS.honor} để mua ${what}?`)) return;
    this.busy = true;
    mutate<ProfileReply & { achievements?: string[] }>("POST", `/shop/honor/${item.id}/buy`, pick ?? {}).then(
      (reply) => {
        this.busy = false;
        this.render();
        showToast(this, [pick ? `Đã nhận ${what}!` : "Đã mua", ...achievementNotices(reply.achievements)]);
      },
      (error: unknown) => {
        this.busy = false;
        window.alert(errorText(error));
        this.render();
      },
    );
  }
}
