import Phaser from "phaser";
import { applyServerProfile, achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { api, ApiError, auth } from "../api";
import { session } from "../session";
import { shopOffers, ShopPurchaseFlow, type ShopOffer, type ShopPick, type ShopTab } from "../ui/shop-presentation";
import { ShopView } from "../ui/shop-view";
import { useDesignCamera } from "../ui/theme";
import { monthKey, weekKey } from "rules";

/** Nguyệt Tinh and Vinh Dự share one server-authoritative storefront. */
export class ShopScene extends Phaser.Scene {
  private view: ShopView | null = null;
  private tab: ShopTab = "moon";
  private backScene = "gacha";
  private generation = 0;
  private flow = new ShopPurchaseFlow();
  private refreshing = false;
  private networkLost = false;
  private error = "";
  private notice = "";
  private renderedProfile = session.profile;
  private renderedOnline = session.online;
  private renderedPeriod = "";

  constructor() { super("shop"); }

  create(entry?: { tab?: ShopTab; back?: string }) {
    useDesignCamera(this);
    this.generation++;
    this.tab = entry?.tab === "honor" ? "honor" : "moon";
    this.backScene = entry?.back ?? "gacha";
    this.flow = new ShopPurchaseFlow();
    this.refreshing = false;
    this.networkLost = false;
    this.error = "";
    this.notice = "";
    this.view = new ShopView({
      back: () => this.scene.start(this.backScene),
      tab: tab => { this.tab = tab; this.error = ""; this.notice = ""; this.render(); },
      buy: id => { void this.buy(id); },
      refresh: () => { void this.refresh(); },
    });
    const refreshOnFocus = () => { if (document.visibilityState !== "hidden") void this.refresh(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !this.view?.confirming) {
        event.preventDefault();
        this.scene.start(this.backScene);
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", refreshOnFocus);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", refreshOnFocus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", refreshOnFocus);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      this.view?.destroy();
      this.view = null;
    });
    this.render();
    void this.refresh();
  }

  update() {
    if (!this.view) return;
    const period = this.period();
    if (session.profile !== this.renderedProfile || session.online !== this.renderedOnline || period !== this.renderedPeriod) this.render();
  }

  private period() {
    const now = Date.now();
    return weekKey(session.data, now) + "|" + monthKey(session.data, now);
  }

  private current(generation: number, account: number) {
    return !!this.view && this.generation === generation && auth.generation === account;
  }

  private render() {
    if (!this.view) return;
    this.renderedProfile = session.profile;
    this.renderedOnline = session.online;
    this.renderedPeriod = this.period();
    this.view.render({
      tab: this.tab,
      offers: shopOffers(session.data, session.profile, this.tab, Date.now()),
      currencies: session.profile.currencies,
      online: session.online && !this.networkLost,
      busy: this.flow.phase === "pending",
      refreshing: this.refreshing,
      error: this.error,
      notice: this.notice,
    });
  }

  private async refresh() {
    if (!this.view || this.refreshing || this.flow.phase === "pending" || !session.online) return;
    const generation = this.generation, account = auth.generation;
    this.refreshing = true;
    this.render();
    try {
      const reply = await api<ProfileReply>("GET", "/profile");
      if (!this.current(generation, account)) return;
      if (reply.rev >= session.rev) applyServerProfile(reply);
      this.networkLost = false;
      this.error = "";
    } catch (error) {
      if (!this.current(generation, account)) return;
      this.networkLost = error instanceof ApiError && (error.status === 0 || error.status === 503);
      this.error = errorText(error);
    } finally {
      if (this.current(generation, account)) { this.refreshing = false; this.render(); }
    }
  }

  private async buy(id: string) {
    if (!this.view || this.refreshing) return;
    const generation = this.generation, account = auth.generation, tab = this.tab;
    const offer = shopOffers(session.data, session.profile, tab, Date.now()).find(row => row.id === id);
    if (!offer) return;
    const result = await this.flow.buy(session.data, tab, id, Date.now(), {
      profile: () => session.profile,
      online: () => session.online && !this.networkLost && !this.refreshing,
      valid: () => this.current(generation, account),
      now: () => Date.now(),
      confirm: () => this.view?.confirm(offer) ?? Promise.resolve(false),
      submit: (pick: ShopPick) => mutate<ProfileReply & { achievements?: string[] }>(
        "POST", tab === "moon" ? "/shop/" + id + "/buy" : "/shop/honor/" + id + "/buy",
        tab === "moon" ? (pick.heroId ? { heroId: pick.heroId } : {}) : pick,
      ),
      changed: () => { if (this.current(generation, account)) this.render(); },
    });
    if (!this.current(generation, account)) return;
    if (result.status === "success") {
      this.error = "";
      this.networkLost = false;
      this.notice = this.receipt(offer, result.pick) + " " + achievementNotices(result.reply.achievements).join(" ");
      const notice = this.notice;
      this.time.delayedCall(4500, () => {
        if (this.current(generation, account) && this.notice === notice) { this.notice = ""; this.render(); }
      });
    } else if (result.status === "error") {
      this.networkLost = result.error instanceof ApiError && (result.error.status === 0 || result.error.status === 503);
      this.error = errorText(result.error);
    } else if (result.status === "unavailable") {
      this.error = "Số dư, giới hạn hoặc lựa chọn đã thay đổi. Cập nhật và thử lại.";
    }
    this.render();
  }

  private receipt(offer: ShopOffer, pick: ShopPick) {
    const name = pick.heroId ? session.data.heroes[pick.heroId]?.name
      : pick.relicId ? session.data.relics[pick.relicId]?.name : offer.reward;
    if (pick.relicId) {
      const outcome = offer.choices.find(choice => choice.id === pick.relicId)?.outcome;
      if (outcome && outcome !== "Chưa sở hữu") return (name ?? offer.reward) + ": " + outcome + ".";
    }
    return "Đã nhận " + (name ?? offer.reward) + ".";
  }
}
