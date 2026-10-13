import assets from "virtual:assets-manifest";
import type { DeckError, GameData, Profile } from "rules";
import { matchesDeckText } from "./deck-presentation";
import { coopLobbyModel, coopWaitTime, normalizeCoopRoomCode, type CoopAction, type CoopGate, type CoopRoom } from "./coop-lobby-presentation";
import "./coop-lobby.css";

export interface CoopLobbyViewState extends CoopGate {
  data: GameData; profile: Profile; selectedDeckId: string | null; username: string;
  room: CoopRoom | null; waitingSeconds: number; error: string; notice: string;
  rewardsLoading: boolean; rewardsError: string; assetFailed: number;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (n: number) => n.toLocaleString("vi-VN");
function image(kind: string, id: string, alt = "") {
  const src = assets[kind]?.[id] ?? assets.ui?.seal ?? "";
  return '<img src="' + escape(src) + '" alt="' + escape(alt) + '">';
}
const icon = (id: string) => image("ui", id);

/** Native controls keep portrait borders and popup input usable at every viewport. */
export class CoopLobbyView {
  private readonly shell = document.createElement("section");
  private readonly content = document.createElement("div");
  private readonly dialog = document.createElement("dialog");
  private readonly bodyOverflow = document.body.style.overflow;
  private state: CoopLobbyViewState | null = null;
  private dialogKind: "decks" | "room" | "rules" | null = null;
  private returnFocus = "";

  constructor(private readonly actions: {
    back: () => void; selectDeck: (id: string) => void; editDeck: () => void; createDeck: () => void;
    start: (action: CoopAction, code?: string) => boolean; leave: () => void;
    reconnect: () => void; retryAssets: () => void; retryRewards: () => void;
    deckError: (error: DeckError) => string;
  }) {
    document.body.style.overflow = "hidden";
    this.shell.className = "vn-coop";
    this.shell.setAttribute("aria-label", "Sảnh Liên Thủ");
    this.content.className = "cl-shell";
    this.dialog.className = "cl-dialog";
    this.dialog.setAttribute("aria-labelledby", "coop-dialog-title");
    this.shell.append(this.content, this.dialog);
    document.body.append(this.shell);
    this.content.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      const control = button.dataset.control;
      if (control === "back") this.actions.back();
      else if (control === "decks") this.openDecks();
      else if (control === "edit") this.actions.editDeck();
      else if (control === "create-deck") this.actions.createDeck();
      else if (control === "queue") this.actions.start("queue");
      else if (control === "practice") this.actions.start("practice");
      else if (control === "private") this.openRoom();
      else if (control === "leave") this.actions.leave();
      else if (control === "retry-assets") this.actions.retryAssets();
      else if (control === "retry-rewards") this.actions.retryRewards();
      else if (control === "reconnect") this.actions.reconnect();
      else if (control === "rules") this.openRules();
      else if (control === "copy") void this.copyRoom();
    });
    this.dialog.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      if (button.dataset.deck) {
        this.actions.selectDeck(button.dataset.deck);
        this.dialog.close();
      } else if (button.dataset.control === "create-room" && this.actions.start("create-room")) this.dialog.close();
    });
    this.dialog.addEventListener("input", () => this.syncDialog());
    this.dialog.addEventListener("submit", event => {
      if (this.dialogKind !== "room" || !(event.target as HTMLFormElement).hasAttribute("data-join")) return;
      event.preventDefault();
      const input = this.dialog.querySelector<HTMLInputElement>("[data-code]");
      const code = normalizeCoopRoomCode(input?.value ?? "");
      if (code && this.actions.start("join-room", code)) this.dialog.close();
    });
    this.dialog.addEventListener("close", () => {
      this.dialogKind = null;
      this.restoreFocus(this.returnFocus);
    });
  }

  get dialogOpen() { return this.dialog.open; }

  render(state: CoopLobbyViewState) {
    const previousProfile = this.state?.profile;
    const main = this.content.querySelector<HTMLElement>(".cl-main");
    const scroll = main?.scrollTop ?? 0, outerScroll = this.shell.scrollTop;
    const active = document.activeElement as HTMLElement | null;
    const focus = active && this.content.contains(active) ? active.dataset.control : undefined;
    this.state = state;
    const model = coopLobbyModel(state.data, state.profile, state.selectedDeckId, state);
    const selected = model.selected;
    const cap = state.data.coopConfig.rewardedMatchesPerDay;
    const locked = !model.canEdit;
    const busyBack = ["creating-room", "joining-room", "starting-practice", "match"].includes(state.phase);
    const message = state.error || (state.phase === "idle" && selected ? model.blockedReason : "");
    const rewards = state.data.coopConfig.rewards.win;
    this.content.innerHTML = '<header class="cl-header"><button class="cl-icon" type="button" data-control="back" aria-label="Trở về màn hình chính" ' + (busyBack ? "disabled" : "") + '>' + icon("nav_back") + '</button>' +
      '<div class="cl-title"><h1>Liên Thủ</h1><span>Phối hợp hai người</span></div><div class="cl-wallet">' +
      ([['moonJade','Nguyệt Ngọc'],['moonDust','Nguyệt Trần']] as const).map(([id, label]) => '<span aria-label="' + label + ": " + number(state.profile.currencies[id]) + '">' + icon("cur_" + id) + number(state.profile.currencies[id]) + '</span>').join("") +
      '</div><button class="cl-icon cl-help" type="button" data-control="rules" aria-label="Xem luật và thưởng Liên Thủ">?</button></header>' +
      '<section class="cl-rewards" aria-label="Lượt thưởng Liên Thủ"><div><span>Lượt thưởng hôm nay</span><strong>' + (model.claimsLeft === null ? "—" : model.claimsLeft) + ' / ' + cap + '</strong></div>' +
      '<div class="cl-loot"><span>Thưởng thắng</span><strong>' + image("ui", "cur_moonJade", "Nguyệt Ngọc") + rewards.moonJade + '</strong><strong>' + image("ui", "cur_moonDust", "Nguyệt Trần") + rewards.moonDust + '</strong></div>' +
      (state.rewardsError ? '<span class="cl-reward-error">Chưa tải được lượt thưởng</span><button class="cl-icon" type="button" data-control="retry-rewards" aria-label="Tải lại lượt thưởng Liên Thủ">' + icon("action_reset") + '</button>' :
        state.rewardsLoading ? '<span class="cl-muted">Đang cập nhật…</span>' : model.claimsLeft === 0 ? '<span class="cl-muted">Vẫn có thể chơi, không nhận thêm thưởng hôm nay</span>' : "") + '</section>' +
      (message ? '<div class="cl-notice" role="status"><span>' + escape(message) + '</span>' +
        (state.assets === "error" ? '<button class="cl-icon" type="button" data-control="retry-assets" aria-label="Thử tải lại hình trận">' + icon("action_reset") + '</button>' : !state.connected && state.online ? '<button class="cl-icon" type="button" data-control="reconnect" aria-label="Kết nối lại Liên Thủ">' + icon("action_reset") + '</button>' : "") + '</div>' : "") +
      '<main class="cl-main" tabindex="0" data-control="main"><section class="cl-team"><header><div><span class="cl-muted">Đội hình xuất trận</span><h2>' + escape(selected?.deck.name ?? "Chọn bộ bài") + '</h2></div>' +
      '<button class="cl-icon" type="button" data-control="decks" aria-label="Chọn bộ bài đã lưu" ' + (locked || !model.decks.length ? "disabled" : "") + '>' + icon("nav_exchange") + '</button></header>' +
      (selected ? '<div class="cl-heroes">' + selected.deck.heroIds.map(id => '<figure>' + image("heroes", id) + '<figcaption>' + escape(state.data.heroes[id]?.name ?? id) + '</figcaption></figure>').join("") + '</div>' +
        '<div class="cl-deck-meta"><span>' + selected.slots + ' / ' + state.data.metaConfig.deckSize + ' ô bộ bài</span><span>' + selected.copies + ' lá trong chồng</span></div>' +
        (selected.errors.length ? '<div class="cl-validation" role="status">' + selected.errors.map(error => '<p>' + escape(this.actions.deckError(error)) + '</p>').join("") + '</div>' : "") +
        '<footer><span class="cl-valid">' + icon(selected.errors.length ? "lock" : "check") + (selected.errors.length ? "Cần chỉnh bộ bài" : "Bộ bài hợp lệ") + '</span><button class="cl-icon" type="button" data-control="edit" aria-label="Chỉnh sửa ' + escape(selected.deck.name) + '" ' + (locked ? "disabled" : "") + '>' + icon("action_edit") + '</button></footer>' :
        '<div class="cl-empty">' + icon("mode_coop") + '<p>' + (model.decks.length ? "Chọn một bộ bài đã lưu để chuẩn bị đội hình" : "Lưu một bộ bài để bắt đầu Liên Thủ") + '</p><button type="button" data-control="' + (model.decks.length ? "decks" : "create-deck") + '" ' + (locked ? "disabled" : "") + '>' + (model.decks.length ? "Chọn bộ bài" : "Tạo bộ bài") + '</button></div>') + '</section>' +
      '<section class="cl-modes" aria-label="Chọn cách chơi">' + this.modes(state, model.canStart, model.claimsLeft) + '</section></main>' +
      '<footer class="cl-status"><span class="cl-connection ' + (state.connected ? "connected" : "") + '">' + (!state.online ? "Ngoại tuyến" : state.connected ? "Đã kết nối" : "Đang kết nối") + '</span><span role="status" aria-live="polite">' + escape(state.notice) + '</span></footer>';
    const newMain = this.content.querySelector<HTMLElement>(".cl-main");
    if (newMain) newMain.scrollTop = scroll;
    if (this.dialogKind === "decks" && previousProfile !== state.profile) this.paintDecks();
    this.syncDialog();
    if (focus) this.restoreFocus(focus);
    this.shell.scrollTop = outerScroll;
  }

  private modes(state: CoopLobbyViewState, canStart: boolean, claimsLeft: number | null) {
    if (state.phase === "queued" || state.phase === "joining-queue") return '<div class="cl-wait"><div class="cl-mode-art">' + icon("mode_coop") + '</div><h2>Đang tìm đồng đội</h2><strong class="cl-timer" aria-label="Thời gian tìm đồng đội">' + coopWaitTime(state.waitingSeconds) + '</strong><p>Vào trận khi tìm được người cùng chơi</p><button type="button" data-control="leave">Hủy tìm đồng đội</button></div>';
    if (state.room) return '<div class="cl-room"><header><h2>Phòng riêng</h2><span>' + state.room.players.length + ' / 2</span></header><div class="cl-room-code"><strong aria-label="Mã phòng">' + escape(state.room.code) + '</strong><button class="cl-icon" type="button" data-control="copy" aria-label="Sao chép mã phòng">' + icon("action_copy") + '</button></div><div class="cl-partners">' +
      [0, 1].map(index => { const player = state.room!.players[index]; return '<div class="cl-partner">' + icon(player?.ready ? "check" : "mode_coop") + '<div><strong>' + escape(player ? player.username + (player.username === state.username ? " · Bạn" : "") : "Đang chờ đồng đội") + '</strong><span>' + (player ? player.ready ? "Sẵn sàng" : "Đang chuẩn bị" : "Gửi mã phòng cho bạn bè") + '</span></div></div>'; }).join("") + '</div><p class="cl-muted">Phòng riêng không có thưởng. Trận bắt đầu khi đủ hai người.</p><button type="button" data-control="leave">Rời phòng</button></div>';
    if (state.phase !== "idle") return '<div class="cl-wait">' + icon(state.phase === "starting-practice" ? "mode_practice" : "mode_private") + '<h2>' + (state.phase === "starting-practice" || state.phase === "match" ? "Đang vào trận…" : "Đang mở phòng…") + '</h2><p>Đang chờ phản hồi từ máy chủ</p></div>';
    return [
      ["queue", "mode_coop", "Tìm đồng đội", claimsLeft === 0 ? "Ghép với một người chơi · đã hết lượt thưởng" : "Ghép với một người chơi · có thưởng"],
      ["private", "mode_private", "Phòng riêng", "Mã phòng · không có thưởng"],
      ["practice", "mode_practice", "Đấu Tập", "Đồng đội máy · không có thưởng"],
    ].map(([control, art, title, detail]) => '<button class="cl-mode ' + (control === "queue" ? "primary" : "") + '" type="button" data-control="' + control + '" aria-label="' + title + ", " + detail + '" ' + (canStart ? "" : "disabled") + '>' + icon(art!) + '<span><strong>' + title + '</strong><span>' + detail + '</span></span><span aria-hidden="true">›</span></button>').join("");
  }

  private dialogHeader(title: string) { return '<header><h2 id="coop-dialog-title">' + title + '</h2><form method="dialog"><button class="cl-icon" aria-label="Đóng hộp thoại" value="cancel">' + icon("action_close") + '</button></form></header>'; }
  private showDialog(kind: "decks" | "room" | "rules", control: string) { this.dialogKind = kind; this.returnFocus = control; this.syncDialog(); this.dialog.showModal(); }

  private openDecks() {
    if (!this.state || !coopLobbyModel(this.state.data, this.state.profile, this.state.selectedDeckId, this.state).canEdit) return;
    this.paintDecks();
    this.showDialog("decks", "decks");
  }
  private paintDecks() {
    if (!this.state) return;
    const s = this.state, model = coopLobbyModel(s.data, s.profile, s.selectedDeckId, s);
    const query = this.dialog.querySelector<HTMLInputElement>("[data-search]")?.value ?? "";
    const scroll = this.dialog.querySelector<HTMLElement>(".cl-deck-list")?.scrollTop ?? 0;
    const focusedSearch = document.activeElement?.hasAttribute("data-search");
    this.dialog.innerHTML = this.dialogHeader("Chọn bộ bài") + '<div class="cl-dialog-body"><input type="search" data-search aria-label="Tìm bộ bài" placeholder="Tìm bộ bài" value="' + escape(query) + '"><div class="cl-deck-list">' +
      model.decks.map(row => '<button type="button" class="cl-deck" data-deck="' + escape(row.deck.id) + '" aria-pressed="' + (row.deck.id === s.selectedDeckId) + '"><div class="cl-deck-portraits">' + row.deck.heroIds.map(id => image("heroes", id)).join("") + '</div><div><strong>' + escape(row.deck.name) + '</strong><span>' + escape(row.deck.heroIds.map(id => s.data.heroes[id]?.name ?? id).join(" · ")) + '</span><span class="cl-deck-check">' + (row.errors.length ? escape(this.actions.deckError(row.errors[0]!)) : "Bộ bài hợp lệ") + '</span></div></button>').join("") + '</div><p data-search-empty hidden>Không tìm thấy bộ bài</p></div>';
    const list = this.dialog.querySelector<HTMLElement>(".cl-deck-list");
    if (list) list.scrollTop = scroll;
    if (focusedSearch) this.dialog.querySelector<HTMLInputElement>("[data-search]")?.focus();
  }
  private openRoom() {
    if (!this.state || !coopLobbyModel(this.state.data, this.state.profile, this.state.selectedDeckId, this.state).canStart) return;
    this.dialog.innerHTML = this.dialogHeader("Phòng riêng") + '<div class="cl-dialog-body"><button class="cl-create-room" type="button" data-control="create-room">' + icon("mode_private") + '<span>Tạo phòng mới</span></button><div class="cl-divider">hoặc vào phòng của bạn bè</div><form data-join novalidate><label for="coop-room-code">Mã phòng</label><input id="coop-room-code" data-code type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7Q2MX" aria-describedby="coop-code-hint"><span id="coop-code-hint" class="cl-muted">6 chữ hoặc số</span><button class="cl-primary" type="submit" data-control="join-room" disabled>Vào phòng</button></form><p data-dialog-blocked class="cl-validation" hidden></p></div>';
    this.showDialog("room", "private");
  }
  private openRules() {
    if (!this.state) return;
    const cfg = this.state.data.coopConfig;
    this.dialog.innerHTML = this.dialogHeader("Luật Liên Thủ") + '<div class="cl-dialog-body cl-rules"><p>Hai người phối hợp đánh Nguyệt Thực Ma Quân. Mỗi người dùng bộ bài đã lưu và trang bị theo luật Tầm Nguyệt.</p><p>Lượt chung ' + cfg.turnSeconds + ' giây. Trong trận, bạn thấy tay bài đồng đội và bấm Xong khi hoàn tất hành động.</p><h3>Thưởng qua tìm đồng đội</h3><p>Tối đa ' + cfg.rewardedMatchesPerDay + ' trận có thưởng mỗi ngày. Hết lượt thưởng vẫn có thể chơi.</p><dl><dt>Thắng</dt><dd>' + cfg.rewards.win.moonJade + ' Nguyệt Ngọc · ' + cfg.rewards.win.moonDust + ' Nguyệt Trần</dd><dt>Thua</dt><dd>' + cfg.rewards.loss.moonJade + ' Nguyệt Ngọc · ' + cfg.rewards.loss.moonDust + ' Nguyệt Trần</dd><dt>Lần thắng đầu ngày</dt><dd>Thêm ' + cfg.rewards.firstWinOfDay.moonJade + ' Nguyệt Ngọc</dd></dl><p>Phòng riêng và Đấu Tập không có thưởng. Bỏ cuộc hoặc bị xử thua do mất kết nối không có thưởng.</p></div>';
    this.showDialog("rules", "rules");
  }

  private syncDialog() {
    if (!this.dialogKind || !this.state) return;
    const s = this.state, model = coopLobbyModel(s.data, s.profile, s.selectedDeckId, s);
    if (this.dialogKind === "decks") {
      const query = this.dialog.querySelector<HTMLInputElement>("[data-search]")?.value ?? "";
      let visible = 0;
      this.dialog.querySelectorAll<HTMLButtonElement>("[data-deck]").forEach(button => {
        const row = model.decks.find(row => row.deck.id === button.dataset.deck);
        button.disabled = !model.canEdit || !row;
        button.setAttribute("aria-pressed", String(row?.deck.id === s.selectedDeckId));
        button.hidden = !row || !matchesDeckText(query, row.deck.name, ...row.deck.heroIds.map(id => s.data.heroes[id]?.name ?? id));
        if (!button.hidden) visible++;
      });
      const empty = this.dialog.querySelector<HTMLElement>("[data-search-empty]");
      if (empty) empty.hidden = visible !== 0;
    } else if (this.dialogKind === "room") {
      const create = this.dialog.querySelector<HTMLButtonElement>('[data-control="create-room"]');
      const join = this.dialog.querySelector<HTMLButtonElement>('[data-control="join-room"]');
      if (create) create.disabled = !model.canStart;
      if (join) join.disabled = !model.canStart || !normalizeCoopRoomCode(this.dialog.querySelector<HTMLInputElement>("[data-code]")?.value ?? "");
      const blocked = this.dialog.querySelector<HTMLElement>("[data-dialog-blocked]");
      if (blocked) { blocked.hidden = model.canStart; blocked.textContent = model.blockedReason; }
    }
  }
  private async copyRoom() {
    const code = this.state?.room?.code;
    if (!code) return;
    try { await navigator.clipboard.writeText(code); this.announce("Đã sao chép mã phòng"); }
    catch { this.announce("Không thể sao chép. Chọn mã phòng để sao chép thủ công."); }
  }
  private announce(text: string) {
    const node = this.content.querySelector<HTMLElement>('.cl-status [role="status"]');
    if (node) node.textContent = text;
  }
  private restoreFocus(control: string) {
    const target = [...this.content.querySelectorAll<HTMLElement>("[data-control]")].find(e => e.dataset.control === control && !(e instanceof HTMLButtonElement && e.disabled));
    (target ?? this.content.querySelector<HTMLElement>(".cl-main"))?.focus({ preventScroll: true });
  }
  destroy() { if (this.dialog.open) this.dialog.close(); this.shell.remove(); document.body.style.overflow = this.bodyOverflow; }
}
