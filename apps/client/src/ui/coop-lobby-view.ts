import assets from "virtual:assets-manifest";
import type { DeckError, GameData, Profile } from "rules";
import { matchesDeckText } from "./deck-presentation";
import { coopLobbyModel, coopRewardSummary, coopRoomDialogState, coopWaitTime, normalizeCoopRoomCode, type CoopAction, type CoopGate, type CoopRoom } from "./coop-lobby-presentation";
import "./coop-lobby.css";

export interface CoopLobbyViewState extends CoopGate {
  data: GameData; profile: Profile; selectedDeckId: string | null; username: string;
  room: CoopRoom | null; waitingSeconds: number; error: string; notice: string;
  rewardsLoading: boolean; rewardsError: string; assetFailed: number;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function image(kind: string, id: string, alt = "") {
  const src = assets[kind]?.[id] ?? assets.ui?.seal ?? "";
  return '<img src="' + escape(src) + '" alt="' + escape(alt) + '">';
}
const icon = (id: string, alt = "") => image("ui", id, alt);
// A code-native card stack distinguishes deck selection from reconnect/reset.
const deckIcon = '<svg viewBox="0 0 42 42" width="42" height="42" aria-hidden="true"><g fill="#18283e" stroke="#efd293" stroke-width="1.6"><rect x="8" y="8" width="22" height="28" rx="3" transform="rotate(-14 19 22)"/><rect x="12" y="7" width="22" height="28" rx="3"/><path d="M23 13l3 6 5 2-5 2-3 6-3-6-5-2 5-2z" fill="#b1d2c2"/></g></svg>';
const loot = (jade: number, dust: number) => '<strong>' + icon("cur_moonJade", "Nguyệt Ngọc") + jade + '</strong>' + (dust ? '<strong>' + icon("cur_moonDust", "Nguyệt Trần") + dust + '</strong>' : "");
type DialogKind = "decks" | "room" | "rules" | "errors";

/** Persistent regions keep native controls, timer focus and room inputs intact. */
export class CoopLobbyView {
  private readonly shell = document.createElement("section");
  private readonly content = document.createElement("div");
  private readonly dialog = document.createElement("dialog");
  private readonly bodyOverflow = document.body.style.overflow;
  private readonly markup = new Map<string, string>();
  private state: CoopLobbyViewState | null = null;
  private dialogKind: DialogKind | null = null;
  private returnFocus = "";
  private roomAttempted = false;
  private roomBusy = false;
  private copyNotice = "";

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
    this.content.innerHTML = '<header class="cl-header" data-region="header"></header><section class="cl-rewards" data-region="rewards" aria-label="Lượt thưởng Liên Thủ"></section><main class="cl-main" tabindex="0" data-control="main"><section class="cl-team" data-region="team"></section><section class="cl-modes" data-region="modes" aria-label="Chọn cách chơi"></section></main><footer class="cl-status" data-region="status"></footer>';
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
      else if (control === "errors") this.openErrors();
      else if (control === "copy") void this.copyRoom();
    });
    this.dialog.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      if (button.dataset.deck) { this.actions.selectDeck(button.dataset.deck); this.dialog.close(); }
      else if (button.dataset.control === "create-room") { this.roomAttempted = true; this.actions.start("create-room"); this.syncDialog(); }
      else if (button.dataset.control === "clear-search") {
        const search = this.dialog.querySelector<HTMLInputElement>("[data-search]");
        if (search) { search.value = ""; search.focus(); this.syncDialog(); }
      }
    });
    this.dialog.addEventListener("input", event => {
      const input = event.target as HTMLInputElement;
      if (input.hasAttribute("data-code")) {
        const position = input.selectionStart, removed = input.value.length - input.value.trimStart().length;
        const code = input.value.trim().toUpperCase();
        if (input.value !== code) { input.value = code; if (position !== null) input.setSelectionRange(Math.max(0, position - removed), Math.max(0, position - removed)); }
      }
      this.syncDialog();
    });
    this.dialog.addEventListener("submit", event => {
      if (this.dialogKind !== "room" || !(event.target as HTMLFormElement).hasAttribute("data-join")) return;
      event.preventDefault();
      const code = normalizeCoopRoomCode(this.dialog.querySelector<HTMLInputElement>("[data-code]")?.value ?? "");
      if (code && !this.roomBusy) { this.roomAttempted = true; this.actions.start("join-room", code); this.syncDialog(); }
    });
    this.dialog.addEventListener("cancel", event => { if (this.dialogKind === "room" && this.roomBusy) event.preventDefault(); });
    this.dialog.addEventListener("close", () => { this.dialogKind = null; this.roomBusy = false; this.restoreFocus(this.returnFocus); });
  }

  get dialogOpen() { return this.dialog.open; }
  private patch(region: string, html: string) {
    if (this.markup.get(region) === html) return;
    this.content.querySelector<HTMLElement>('[data-region="' + region + '"]')!.innerHTML = html;
    this.markup.set(region, html);
  }
  render(state: CoopLobbyViewState) {
    const previous = this.state;
    const active = document.activeElement as HTMLElement | null;
    const focus = active && this.content.contains(active) ? active.dataset.control : undefined;
    const main = this.content.querySelector<HTMLElement>(".cl-main")!;
    const scroll = main.scrollTop, outerScroll = this.shell.scrollTop;
    const waiting = state.phase !== "idle";
    if (previous?.room?.code !== state.room?.code) this.copyNotice = "";
    this.state = state;
    this.shell.dataset.waiting = String(waiting);
    const model = coopLobbyModel(state.data, state.profile, state.selectedDeckId, state);
    const selected = model.selected, locked = !model.canEdit;
    const busyBack = ["creating-room", "joining-room", "starting-practice", "match"].includes(state.phase);
    const encounter = state.data.encounters[state.data.coopConfig.encounterId];
    const target = state.data.enemies[encounter?.enemyIds[0] ?? ""]?.name ?? encounter?.name ?? "Phối hợp hai người";
    this.patch("header", '<button class="cl-icon" type="button" data-control="back" aria-label="Trở về màn hình chính" ' + (busyBack ? "disabled" : "") + '>' + icon("nav_back") + '</button><div class="cl-title"><h1>Liên Thủ</h1><span>' + escape(target) + '</span></div><button class="cl-icon cl-help" type="button" data-control="rules" aria-label="Xem luật và thưởng Liên Thủ">?</button>');
    const reward = coopRewardSummary(state.data, state), win = state.data.coopConfig.rewards.win;
    const cap = state.data.coopConfig.rewardedMatchesPerDay;
    this.patch("rewards", !reward.eligible ? '<div class="cl-no-reward">' + icon("lock") + '<span>' + (state.phase === "starting-practice" ? "Đấu Tập" : state.phase === "match" ? "Đang vào trận" : "Phòng riêng") + ' · Không có thưởng</span></div>' :
      '<div class="cl-claims"><span>Lượt thưởng còn lại</span><strong>' + (model.claimsLeft === null ? "—" : model.claimsLeft) + ' / ' + cap + '</strong></div><div class="cl-loot"><span>' + (model.claimsLeft === 0 ? "Vẫn có thể chơi" : reward.firstWinJade ? "Thắng đầu ngày" : "Thưởng thắng") + '</span><div>' + (model.claimsLeft === 0 ? '<strong class="cl-muted">Không nhận thêm thưởng</strong>' : loot(win.moonJade + (reward.firstWinJade ?? 0), win.moonDust)) + '</div></div>' +
      (state.rewardsError ? '<div class="cl-reward-note" role="status">Chưa tải được lượt thưởng<button class="cl-icon" type="button" data-control="retry-rewards" aria-label="Tải lại lượt thưởng Liên Thủ">' + icon("action_reset") + '</button></div>' : state.rewardsLoading ? '<span class="cl-reward-note">Đang cập nhật…</span>' : ""));
    const controls = selected ? '<div class="cl-team-actions"><button class="cl-icon" type="button" data-control="decks" aria-label="Chọn bộ bài đã lưu" ' + (locked ? "disabled" : "") + '>' + deckIcon + '</button><button class="cl-icon" type="button" data-control="edit" aria-label="Chỉnh sửa ' + escape(selected.deck.name) + '" ' + (locked ? "disabled" : "") + '>' + icon("action_edit") + '</button></div>' : "";
    this.patch("team", '<header><div><span class="cl-muted">Đội hình xuất trận</span><h2>' + escape(selected?.deck.name ?? "Chuẩn bị đội hình") + '</h2></div>' + controls + '</header>' +
      (selected ? '<div class="cl-heroes">' + selected.deck.heroIds.map(id => '<figure>' + image("heroes", id) + '<figcaption>' + escape(state.data.heroes[id]?.name ?? id) + '</figcaption></figure>').join("") + '</div><div class="cl-deck-meta"><span class="cl-valid">' + icon(selected.errors.length ? "lock" : "check", selected.errors.length ? "Bộ bài chưa hợp lệ" : "Bộ bài hợp lệ") + '</span><span>' + selected.slots + ' / ' + state.data.metaConfig.deckSize + ' ô bộ bài</span><span>' + selected.copies + ' lá trong chồng</span></div>' +
        (selected.errors.length ? '<div class="cl-validation" role="status"><p>' + escape(this.actions.deckError(selected.errors[0]!)) + '</p>' + (selected.errors.length > 1 ? '<button class="cl-icon" type="button" data-control="errors" aria-label="Xem tất cả lỗi bộ bài">' + icon("action_more") + '</button>' : "") + '</div>' : "") :
        '<div class="cl-empty">' + icon("mode_coop") + '<p>' + (model.decks.length ? "Chọn bộ bài đã lưu để xuất trận" : "Lưu bộ bài đầu tiên để chơi Liên Thủ") + '</p><button type="button" data-control="' + (model.decks.length ? "decks" : "create-deck") + '" ' + (locked ? "disabled" : "") + '>' + (model.decks.length ? "Chọn bộ bài" : "Tạo bộ bài") + '</button></div>'));
    const formError = this.dialogKind === "room" && this.roomAttempted;
    const message = (formError ? "" : state.error) || (state.phase === "idle" && selected ? model.blockedReason : "");
    const retry = state.assets === "error" ? '<button class="cl-icon" type="button" data-control="retry-assets" aria-label="Thử chuẩn bị trận lại">' + icon("action_reset") + '</button>' : !state.connected && state.online ? '<button class="cl-icon" type="button" data-control="reconnect" aria-label="Kết nối lại Liên Thủ">' + icon("action_reset") + '</button>' : "";
    this.patch("modes", (message ? '<div class="cl-notice" role="status"><span>' + escape(message) + '</span>' + retry + '</div>' : "") + this.modes(state, model.canStart, model.claimsLeft));
    this.patch("status", '<span class="cl-connection ' + (state.connected ? "connected" : "") + '">' + (!state.online ? "Ngoại tuyến" : state.connected ? "Đã kết nối" : "Đang kết nối") + '</span><span role="status" aria-live="polite">' + escape(state.notice) + '</span>');
    const timer = this.content.querySelector<HTMLElement>(".cl-timer");
    if (timer && timer.textContent !== coopWaitTime(state.waitingSeconds)) timer.textContent = coopWaitTime(state.waitingSeconds);
    const copy = this.content.querySelector<HTMLElement>(".cl-copy-status");
    if (copy) copy.textContent = this.copyNotice;
    if (this.dialogKind === "decks" && previous?.profile !== state.profile) this.paintDecks();
    this.syncDialog();
    if (focus && active && !active.isConnected && !this.dialog.open) this.restoreFocus(focus);
    const enteredWaiting = waiting && previous?.phase === "idle";
    main.scrollTop = enteredWaiting ? 0 : scroll;
    this.shell.scrollTop = enteredWaiting ? 0 : outerScroll;
  }

  private modes(state: CoopLobbyViewState, canStart: boolean, claimsLeft: number | null) {
    if (state.phase === "queued" || state.phase === "joining-queue") return '<div class="cl-wait">' + icon("mode_coop") + '<h2>Đang tìm đồng đội</h2><strong class="cl-timer" aria-label="Thời gian tìm đồng đội">0:00</strong><button type="button" data-control="leave">Hủy tìm đồng đội</button></div>';
    if (state.room) return '<div class="cl-room"><header><h2>Phòng riêng</h2><span>' + state.room.players.length + ' / 2</span></header><p class="cl-muted">Trận bắt đầu khi đủ hai người</p><div class="cl-room-code"><strong aria-label="Mã phòng">' + escape(state.room.code) + '</strong><button class="cl-icon" type="button" data-control="copy" aria-label="Sao chép mã phòng">' + icon("action_copy") + '</button></div><span class="cl-copy-status" role="status" aria-live="polite"></span><div class="cl-partners">' +
      [0, 1].map(index => { const player = state.room!.players[index]; return '<div class="cl-partner">' + icon(player?.ready ? "check" : player ? "mode_coop" : "action_new") + '<div><strong>' + escape(player?.username ?? "Đang chờ đồng đội") + (player?.username === state.username ? '<span class="cl-you">Bạn</span>' : "") + '</strong><span>' + (player ? player.ready ? "Sẵn sàng" : "Đang chuẩn bị" : "Gửi mã phòng cho bạn bè") + '</span></div></div>'; }).join("") + '</div><button class="cl-leave" type="button" data-control="leave">Rời phòng</button></div>';
    if (state.phase !== "idle") return '<div class="cl-wait">' + icon(state.phase === "starting-practice" ? "mode_practice" : "mode_private") + '<h2>' + (state.phase === "starting-practice" || state.phase === "match" ? "Đang vào trận…" : "Đang mở phòng…") + '</h2></div>';
    return [
      ["queue", "mode_coop", "Tìm đồng đội", claimsLeft === 0 ? "Hết lượt thưởng · vẫn có thể chơi" : claimsLeft === null ? "Thưởng theo lượt còn lại" : "Có thưởng"],
      ["private", "mode_private", "Phòng riêng", "Mã phòng · không có thưởng"],
      ["practice", "mode_practice", "Đấu Tập", "Đồng đội máy · không có thưởng"],
    ].map(([control, art, title, detail]) => '<button class="cl-mode ' + (control === "queue" ? "primary" : "") + '" type="button" data-control="' + control + '" aria-label="' + title + ", " + detail + '" ' + (canStart ? "" : "disabled") + '>' + icon(art!) + '<span><strong>' + title + '</strong><span>' + detail + '</span></span><span aria-hidden="true">›</span></button>').join("");
  }
  private dialogHeader(title: string) { return '<header><h2 id="coop-dialog-title">' + title + '</h2><form method="dialog"><button class="cl-icon" aria-label="Đóng hộp thoại" data-close value="cancel">' + icon("action_close") + '</button></form></header>'; }
  private showDialog(kind: DialogKind, control: string) { this.dialogKind = kind; this.returnFocus = control; this.syncDialog(); this.dialog.showModal(); }
  private openDecks() {
    if (!this.state || !coopLobbyModel(this.state.data, this.state.profile, this.state.selectedDeckId, this.state).canEdit) return;
    this.paintDecks(); this.showDialog("decks", "decks");
    if (window.matchMedia("(min-width: 721px)").matches) this.dialog.querySelector<HTMLInputElement>("[data-search]")?.focus();
  }
  private paintDecks() {
    if (!this.state) return;
    const s = this.state, model = coopLobbyModel(s.data, s.profile, s.selectedDeckId, s);
    const query = this.dialog.querySelector<HTMLInputElement>("[data-search]")?.value ?? "";
    const scroll = this.dialog.querySelector<HTMLElement>(".cl-deck-list")?.scrollTop ?? 0;
    const focusedSearch = document.activeElement?.hasAttribute("data-search");
    this.dialog.innerHTML = this.dialogHeader("Chọn bộ bài") + '<div class="cl-dialog-body"><div class="cl-search"><input type="search" data-search aria-label="Tìm bộ bài" placeholder="Tìm bộ bài" value="' + escape(query) + '"><button class="cl-icon" type="button" data-control="clear-search" aria-label="Xóa tìm kiếm" hidden>' + icon("action_close") + '</button></div><div class="cl-deck-list">' +
      model.decks.map(row => '<button type="button" class="cl-deck ' + (row.errors.length ? "invalid" : "") + '" data-deck="' + escape(row.deck.id) + '" aria-pressed="' + (row.deck.id === s.selectedDeckId) + '"><div class="cl-deck-portraits">' + row.deck.heroIds.map(id => image("heroes", id)).join("") + '</div><div class="cl-deck-name"><strong>' + escape(row.deck.name) + '</strong><span>' + escape(row.deck.heroIds.map(id => s.data.heroes[id]?.name ?? id).join(" · ")) + '</span>' + (row.errors.length ? '<span class="cl-deck-error">' + escape(this.actions.deckError(row.errors[0]!)) + '</span>' : "") + (row.deck.id === s.selectedDeckId ? '<span class="cl-selected">Đang dùng</span>' : "") + '</div><div class="cl-deck-check">' + icon(row.errors.length ? "lock" : "check", row.errors.length ? "Bộ bài chưa hợp lệ" : "Bộ bài hợp lệ") + '</div></button>').join("") + '</div><p data-search-empty hidden>Không tìm thấy bộ bài</p></div>';
    const list = this.dialog.querySelector<HTMLElement>(".cl-deck-list"); if (list) list.scrollTop = scroll;
    if (focusedSearch) this.dialog.querySelector<HTMLInputElement>("[data-search]")?.focus();
  }
  private openRoom() {
    if (!this.state || !coopLobbyModel(this.state.data, this.state.profile, this.state.selectedDeckId, this.state).canStart) return;
    this.roomAttempted = false; this.roomBusy = false;
    this.dialog.innerHTML = this.dialogHeader("Phòng riêng") + '<div class="cl-dialog-body"><button class="cl-create-room" type="button" data-control="create-room">' + icon("mode_private") + '<span>Tạo phòng mới</span></button><div class="cl-divider">Hoặc nhập mã phòng</div><form data-join novalidate><label for="coop-room-code">Mã phòng</label><input id="coop-room-code" data-code type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ví dụ: K7Q2MX" aria-describedby="coop-code-hint coop-room-error"><span id="coop-code-hint" class="cl-muted">6 chữ hoặc số</span><p id="coop-room-error" data-dialog-error class="cl-validation" role="alert" hidden></p><button class="cl-primary" type="submit" data-control="join-room" disabled>Vào phòng</button></form><p data-dialog-blocked class="cl-validation" hidden></p></div>';
    this.showDialog("room", "private");
  }
  private openErrors() {
    if (!this.state) return;
    const row = coopLobbyModel(this.state.data, this.state.profile, this.state.selectedDeckId, this.state).selected;
    this.dialog.innerHTML = this.dialogHeader("Kiểm tra bộ bài") + '<div class="cl-dialog-body cl-validation">' + (row?.errors ?? []).map(e => '<p>' + escape(this.actions.deckError(e)) + '</p>').join("") + '</div>';
    this.showDialog("errors", "errors");
  }
  private openRules() {
    if (!this.state) return;
    const cfg = this.state.data.coopConfig;
    this.dialog.innerHTML = this.dialogHeader("Luật Liên Thủ") + '<div class="cl-dialog-body cl-rules"><div class="cl-rule-summary">' + icon("mode_coop") + '<p>Hai người · Lượt chung ' + cfg.turnSeconds + ' giây</p></div><p>Dùng bộ bài đã lưu và trang bị theo luật Tầm Nguyệt. Bạn thấy tay bài đồng đội trong trận.</p><p>Bấm <strong>Xong lượt</strong> khi hoàn tất hành động.</p><h3>Thưởng tìm đồng đội</h3><p>Tối đa ' + cfg.rewardedMatchesPerDay + ' lượt thưởng mỗi ngày. Hết lượt vẫn có thể chơi.</p><dl><dt>Thắng</dt><dd>' + loot(cfg.rewards.win.moonJade, cfg.rewards.win.moonDust) + '</dd><dt>Thua</dt><dd>' + loot(cfg.rewards.loss.moonJade, cfg.rewards.loss.moonDust) + '</dd><dt>Thắng đầu ngày</dt><dd>' + loot(cfg.rewards.firstWinOfDay.moonJade, cfg.rewards.firstWinOfDay.moonDust ?? 0) + '<span>thêm</span></dd></dl><p>Phòng riêng và Đấu Tập không có thưởng. Bỏ cuộc hoặc bị xử thua do mất kết nối không có thưởng.</p></div>';
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
      const empty = this.dialog.querySelector<HTMLElement>("[data-search-empty]"); if (empty) empty.hidden = visible !== 0;
      const clear = this.dialog.querySelector<HTMLElement>('[data-control="clear-search"]'); if (clear) clear.hidden = !query;
    } else if (this.dialogKind === "room") {
      const entry = coopRoomDialogState(s.phase, !!s.room);
      if (entry.complete) { if (this.dialog.open) this.dialog.close(); return; }
      const wasBusy = this.roomBusy;
      this.roomBusy = entry.busy;
      const create = this.dialog.querySelector<HTMLButtonElement>('[data-control="create-room"]');
      const join = this.dialog.querySelector<HTMLButtonElement>('[data-control="join-room"]');
      const input = this.dialog.querySelector<HTMLInputElement>("[data-code]");
      const close = this.dialog.querySelector<HTMLButtonElement>("[data-close]");
      if (create) { create.disabled = !model.canStart; create.querySelector("span")!.textContent = s.phase === "creating-room" ? "Đang tạo phòng…" : "Tạo phòng mới"; }
      if (join) { join.disabled = !model.canStart || !normalizeCoopRoomCode(input?.value ?? ""); join.textContent = s.phase === "joining-room" ? "Đang vào phòng…" : "Vào phòng"; }
      if (input) input.disabled = entry.busy;
      if (close) close.disabled = entry.busy;
      const error = this.roomAttempted && !entry.busy ? s.error : "";
      const alert = this.dialog.querySelector<HTMLElement>("[data-dialog-error]"); if (alert) { alert.hidden = !error; alert.textContent = error; }
      const blocked = this.dialog.querySelector<HTMLElement>("[data-dialog-blocked]"); if (blocked) { blocked.hidden = model.canStart || entry.busy || !!error; blocked.textContent = model.blockedReason; }
      if (wasBusy && !entry.busy && error) input?.focus();
    }
  }
  private async copyRoom() {
    const code = this.state?.room?.code; if (!code) return;
    let notice: string;
    try { await navigator.clipboard.writeText(code); notice = "Đã sao chép mã phòng"; }
    catch { notice = "Chọn mã phòng để sao chép thủ công"; }
    if (this.state?.room?.code !== code) return;
    this.copyNotice = notice;
    const node = this.content.querySelector<HTMLElement>(".cl-copy-status"); if (node) node.textContent = notice;
  }
  private restoreFocus(control: string) {
    const target = [...this.content.querySelectorAll<HTMLElement>("[data-control]")].find(e => e.dataset.control === control && !(e instanceof HTMLButtonElement && e.disabled));
    (target ?? this.content.querySelector<HTMLElement>(".cl-main"))?.focus({ preventScroll: true });
  }
  destroy() { if (this.dialog.open) this.dialog.close(); this.shell.remove(); document.body.style.overflow = this.bodyOverflow; }
}
