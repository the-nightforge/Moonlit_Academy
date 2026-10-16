import assets from "virtual:assets-manifest";
import type { Profile } from "rules";
import type { ShopOffer, ShopPick, ShopTab } from "./shop-presentation";
import "./shop.css";

export interface ShopViewState {
  tab: ShopTab; offers: ShopOffer[]; currencies: Profile["currencies"];
  online: boolean; busy: boolean; refreshing: boolean; error: string; notice: string;
}
const labels = { moonStar: "Nguyệt Tinh", honor: "Vinh Dự", moonJade: "Nguyệt Ngọc" } as const;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number) => value.toLocaleString("vi-VN");
function asset(key: string): string {
  const [kind, id] = key.split(":");
  return assets[kind!]?.[id!] ?? assets.ui?.seal ?? "";
}
function image(key: string, alt = "", className = ""): string {
  return '<img class="' + className + '" src="' + escape(asset(key)) + '" alt="' + escape(alt) + '">';
}
function icon(id: string) { return image("ui:" + id); }
function stock(offer: ShopOffer): string {
  return offer.limits.map(limit => (limit.period === "week" ? "Tuần " : "Tháng ") + limit.left + "/" + limit.total).join(" · ");
}
function status(offer: ShopOffer, have: number): string {
  switch (offer.status) {
    case "sold-out": return "Hết lượt";
    case "insufficient": return "Thiếu " + number(Math.max(0, offer.price - have)) + " " + labels[offer.currency];
    case "owned-all": return "Đã có đủ Hero";
    case "empty": return "Chưa có lựa chọn";
    default: return offer.type === "moonJade" ? "Đổi" : "Chọn";
  }
}
function offerCard(offer: ShopOffer, state: ShopViewState): string {
  const disabled = offer.status !== "ready" || state.busy || state.refreshing || !state.online;
  const priceLabel = number(offer.price) + " " + labels[offer.currency];
  const actionName = offer.type === "moonJade" ? "Đổi lấy " + offer.reward : offer.title;
  const accessibilityStatus = offer.status === "ready" ? "" : ", " + status(offer, state.currencies[offer.currency]);
  return '<article class="sh-offer ' + offer.status + '">' +
    '<div class="sh-offer-head"><div class="sh-art">' + image(offer.icon) + '</div>' +
    '<h2>' + escape(offer.title) + '</h2></div>' +
    '<div class="sh-offer-info"><span class="sh-price">' + image("ui:cur_" + offer.currency, labels[offer.currency]) + '<strong>' + number(offer.price) + '</strong></span>' +
    '<span class="sh-stock">' + icon("action_reset") + escape(stock(offer)) + '</span></div>' +
    '<div class="sh-offer-footer">' +
    '<button type="button" class="sh-buy" data-buy="' + escape(offer.id) + '" data-control="buy-' + escape(offer.id) + '" aria-label="' + escape(actionName + ", giá " + priceLabel + accessibilityStatus) + '" ' + (disabled ? "disabled" : "") + '>' +
    icon(offer.type === "moonJade" ? "nav_exchange" : "nav_shop") + '<span>' + escape(status(offer, state.currencies[offer.currency])) + '</span></button></div></article>';
}

/** DOM shop for both currencies; the native dialog stays mounted during profile refreshes. */
export class ShopView {
  private readonly shell = document.createElement("section");
  private readonly content = document.createElement("div");
  private readonly dialog = document.createElement("dialog");
  private readonly bodyOverflow = document.body.style.overflow;
  private state: ShopViewState | null = null;
  private resolve: ((pick: ShopPick | false) => void) | null = null;
  private dialogOfferId = "";
  private choiceId = "";
  private previousTab: ShopTab = "moon";
  private scrolls: Record<ShopTab, number> = { moon: 0, honor: 0 };

  constructor(private readonly actions: {
    back: () => void; tab: (tab: ShopTab) => void; buy: (id: string) => void; refresh: () => void;
  }) {
    document.body.style.overflow = "hidden";
    this.shell.className = "vn-shop";
    this.shell.setAttribute("aria-label", "Cửa hàng");
    this.content.className = "sh-shell";
    this.dialog.className = "sh-dialog";
    this.dialog.setAttribute("aria-labelledby", "shop-confirm-title");
    this.shell.append(this.content, this.dialog);
    document.body.append(this.shell);
    this.content.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      if (button.dataset.tab) this.actions.tab(button.dataset.tab as ShopTab);
      else if (button.dataset.buy) this.actions.buy(button.dataset.buy);
      else if (button.dataset.control === "back") this.actions.back();
      else if (button.dataset.control === "refresh") this.actions.refresh();
    });
    this.content.addEventListener("keydown", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
      if (!button || button.disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next: ShopTab = event.key === "Home" ? "moon" : event.key === "End" ? "honor"
        : button.dataset.tab === "moon" ? "honor" : "moon";
      this.actions.tab(next);
      this.restoreFocus("tab-" + next);
    });
    this.dialog.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-choice]");
      if (!button || button.disabled) return;
      this.choiceId = button.dataset.choice ?? "";
      this.syncDialog();
    });
    this.dialog.addEventListener("close", () => {
      const offer = this.state?.offers.find(row => row.id === this.dialogOfferId);
      const pick: ShopPick | false = this.dialog.returnValue === "buy" && offer
        ? offer.type === "heroChoice" ? { heroId: this.choiceId }
          : offer.type === "relicChoice" ? { relicId: this.choiceId } : {}
        : false;
      const resolve = this.resolve;
      const focusId = this.dialogOfferId;
      this.resolve = null;
      this.dialogOfferId = "";
      this.choiceId = "";
      resolve?.(pick);
      this.restoreFocus("buy-" + focusId);
    });
  }
  get confirming() { return this.dialog.open; }

  confirm(offer: ShopOffer): Promise<ShopPick | false> {
    const state = this.state;
    if (!state || this.resolve || offer.status !== "ready") return Promise.resolve(false);
    this.dialogOfferId = offer.id;
    this.choiceId = "";
    this.dialog.returnValue = "";
    const balance = state.currencies[offer.currency];
    this.dialog.innerHTML = '<form method="dialog"><header><div><span class="sh-kind">' + labels[offer.currency] + '</span>' +
      '<h2 id="shop-confirm-title">' + (offer.type === "moonJade" ? "Xác nhận đổi" : "Chọn vật phẩm") + '</h2></div>' +
      '<button type="submit" class="sh-icon-button" value="cancel" aria-label="Đóng xác nhận mua">' + icon("action_close") + '</button></header>' +
      '<div class="sh-dialog-content"><div class="sh-reward">' + image(offer.icon) + '<div><strong>' + escape(offer.reward) + '</strong>' +
      '<span>' + (offer.type === "moonJade" ? "Nhận ngay sau khi đổi" : "Chọn một vật phẩm trước khi mua") + '</span></div></div>' +
      (offer.choices.length ? '<div class="sh-choices" role="group" aria-label="Chọn ' + (offer.type === "heroChoice" ? "Hero" : "Nguyệt Bảo") + '">' +
        offer.choices.map(choice => '<button type="button" class="sh-choice" data-choice="' + escape(choice.id) + '" aria-pressed="false" aria-label="' + escape("Chọn " + choice.name + ", " + choice.outcome) + '">' +
          image(choice.art) + '<strong data-choice-name>' + escape(choice.name) + '</strong><span data-choice-outcome>' + escape(choice.outcome) + '</span></button>').join("") + '</div>' : "") +
      '<p class="sh-choice-result" data-choice-result>' + (offer.choices.length ? "Chưa chọn vật phẩm" : "") + '</p>' +
      '<div class="sh-checkout"><span>Giá</span><strong>' + image("ui:cur_" + offer.currency, labels[offer.currency]) + number(offer.price) + '</strong>' +
      '<span>Số dư sau mua</span><strong data-after>' + number(Math.max(0, balance - offer.price)) + '</strong>' +
      '<span>Giới hạn còn lại</span><strong data-stock>' + escape(stock(offer)) + '</strong></div>' +
      '<p class="sh-dialog-error" data-unavailable hidden></p></div><footer><button type="submit" value="cancel">Hủy</button>' +
      '<button type="submit" class="sh-primary" value="buy" data-confirm>Mua</button></footer></form>';
    this.syncDialog();
    this.dialog.showModal();
    return new Promise(resolve => { this.resolve = resolve; });
  }

  private syncDialog() {
    if (!this.dialogOfferId || !this.state) return;
    const state = this.state, offer = state.offers.find(row => row.id === this.dialogOfferId);
    const selected = offer?.choices.find(choice => choice.id === this.choiceId);
    if (this.choiceId && !selected) this.choiceId = "";
    const available = !!offer && offer.status === "ready" && state.online && !state.busy && !state.refreshing;
    this.dialog.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach(button => {
      const choice = offer?.choices.find(row => row.id === button.dataset.choice);
      const active = button.dataset.choice === this.choiceId;
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !available || !choice;
      const name = button.querySelector<HTMLElement>("[data-choice-name]");
      const outcome = button.querySelector<HTMLElement>("[data-choice-outcome]");
      const currentName = choice?.name ?? name?.textContent ?? "Vật phẩm";
      const currentOutcome = choice?.outcome ?? (offer?.type === "heroChoice" ? "Đã sở hữu" : "Không còn lựa chọn");
      if (name) name.textContent = currentName;
      if (outcome) outcome.textContent = currentOutcome;
      button.setAttribute("aria-label", "Chọn " + currentName + ", " + currentOutcome);
    });
    const result = this.dialog.querySelector<HTMLElement>("[data-choice-result]");
    if (result && offer?.type !== "moonJade") result.textContent = selected ? selected.name + " · " + selected.outcome
      : offer?.status === "owned-all" ? "Đã sở hữu mọi Hero có thể chọn" : "Chưa chọn vật phẩm";
    const after = this.dialog.querySelector<HTMLElement>("[data-after]");
    if (after && offer) after.textContent = number(Math.max(0, state.currencies[offer.currency] - offer.price));
    const stockNode = this.dialog.querySelector<HTMLElement>("[data-stock]");
    if (stockNode && offer) stockNode.textContent = stock(offer);
    const confirm = this.dialog.querySelector<HTMLButtonElement>("[data-confirm]");
    if (confirm) confirm.disabled = !available || (!!offer?.choices.length && !selected);
    const reason = this.dialog.querySelector<HTMLElement>("[data-unavailable]");
    if (reason) {
      reason.hidden = available;
      reason.textContent = !state.online ? "Đang ngoại tuyến. Kết nối để mua." : state.refreshing ? "Đang cập nhật số dư…" : !available ? "Vật phẩm không còn mua được. Đóng và chọn lại." : "";
    }
  }

  render(state: ShopViewState) {
    const oldList = this.content.querySelector<HTMLElement>(".sh-offers");
    if (oldList) this.scrolls[this.previousTab] = oldList.scrollTop;
    const active = document.activeElement as HTMLElement | null;
    const focus = active && this.content.contains(active) ? active.dataset.control : undefined;
    this.state = state;
    this.previousTab = state.tab;
    const currency = state.tab === "moon" ? "moonStar" : "honor";
    const currentLabel = labels[currency];
    const notice = !state.online ? "Đang ngoại tuyến. Kết nối để cập nhật và mua."
      : state.busy ? "Đang xử lý giao dịch…"
        : state.refreshing ? "Đang cập nhật cửa hàng…" : state.error;
    this.content.innerHTML = '<header class="sh-header"><button type="button" class="sh-icon-button" data-control="back" aria-label="Trở về màn trước">' + icon("nav_back") + '</button>' +
      '<h1>Cửa hàng</h1><div class="sh-wallet">' +
      (["moonJade", "moonStar", "honor"] as const).map(id => '<span aria-label="' + labels[id] + ": " + number(state.currencies[id]) + '">' +
        image("ui:cur_" + id) + number(state.currencies[id]) + '</span>').join("") + '</div></header>' +
      '<div class="sh-tabs" role="tablist" aria-label="Loại cửa hàng">' +
      (["moon", "honor"] as const).map(tab => '<button type="button" role="tab" id="shop-tab-' + tab + '" data-tab="' + tab + '" data-control="tab-' + tab +
        '" aria-controls="shop-offers" tabindex="' + (state.tab === tab ? "0" : "-1") + '" aria-selected="' + (state.tab === tab) + '" ' + (state.busy ? "disabled" : "") + '>' +
        icon(tab === "moon" ? "cur_moonStar" : "cur_honor") + '<span>' + (tab === "moon" ? "Nguyệt Tinh" : "Vinh Dự") + '</span></button>').join("") + '</div>' +
      '<div class="sh-intro"><div class="sh-current">' + image("ui:cur_" + currency, currentLabel) + '<div><span>Đang có</span><strong>' + number(state.currencies[currency]) + ' ' + currentLabel + '</strong></div></div>' +
      '<p>' + (state.tab === "moon" ? "Nhận Nguyệt Tinh khi quay trùng Hero đã đủ Tinh Hồn." : "Nhận Vinh Dự khi chơi trận xếp hạng Đấu Trường.") + '</p></div>' +
      (notice ? '<div class="sh-notice" role="status"><span>' + escape(notice) + '</span>' +
        (!state.busy && !state.refreshing ? '<button type="button" class="sh-icon-button" data-control="refresh" aria-label="Cập nhật lại cửa hàng">' + icon("action_reset") + '</button>' : "") + '</div>' : "") +
      '<main id="shop-offers" role="tabpanel" aria-labelledby="shop-tab-' + state.tab + '" class="sh-offers" tabindex="0" data-control="offers" aria-label="Vật phẩm ' + currentLabel + '">' +
      (state.offers.length ? state.offers.map(row => offerCard(row, state)).join("") :
        '<div class="sh-empty">' + icon("nav_shop") + '<p>Cửa hàng này chưa có vật phẩm.</p></div>') + '</main>' +
      '<p class="sh-receipt" role="status" aria-live="polite">' + escape(state.notice) + '</p>';
    const list = this.content.querySelector<HTMLElement>(".sh-offers");
    if (list) list.scrollTop = this.scrolls[state.tab];
    this.syncDialog();
    if (focus) this.restoreFocus(focus);
  }

  private restoreFocus(control: string) {
    const target = Array.from(this.content.querySelectorAll<HTMLElement>("[data-control]")).find(element =>
      element.dataset.control === control && !(element instanceof HTMLButtonElement && element.disabled));
    (target ?? this.content.querySelector<HTMLElement>('[data-control="offers"]') ?? this.content.querySelector<HTMLElement>('[data-control="back"]'))?.focus({ preventScroll: true });
  }

  destroy() {
    if (this.dialog.open) this.dialog.close("cancel");
    this.shell.remove();
    document.body.style.overflow = this.bodyOverflow;
  }
}
