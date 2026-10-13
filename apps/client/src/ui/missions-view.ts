import assets from "virtual:assets-manifest";
import type { Profile } from "rules";
import type { AchievementRow, MissionRow, MissionTab } from "./missions-presentation";
import "./missions.css";

export interface MissionsViewState {
  tab: MissionTab; missions: Record<"daily" | "weekly", MissionRow[]>; achievements: AchievementRow[];
  currencies: Profile["currencies"]; online: boolean; busy: boolean; refreshing: boolean;
  error: string; notice: string; resetHour: number; periodKey: string;
}
const LABELS: Record<MissionTab, string> = { daily: "Hằng ngày", weekly: "Hằng tuần", achievements: "Thành tựu" };
const GROUP_ICONS = { daily: "moon_full", weekly: "nav_history", achievements: "star" };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const image = (id: string, size = "small", alt = "") => `<img class="mi-image ${size}" src="${escape(assets.ui?.[id] ?? "")}" alt="${escape(alt)}">`;
const progress = (row: MissionRow | AchievementRow) => row.progress ? `<div class="mi-progress"><span>${row.progress.value} / ${row.progress.goal}${row.status === "claimed" ? '<span class="mi-muted">Đã nhận</span>' : ""}</span><div class="mi-track" role="progressbar" aria-label="${escape(`Tiến độ ${row.name}`)}" aria-valuemin="0" aria-valuemax="${row.progress.goal}" aria-valuenow="${row.progress.value}"><i style="width:${row.progress.goal ? row.progress.value / row.progress.goal * 100 : 0}%"></i></div></div>` : `<span class="mi-muted">${row.status === "claimed" ? "Đã đạt" : "Chưa đạt"}</span>`;

/** Native menu, like LoginView: semantic actions and a responsive independent list. */
export class MissionsView {
  private readonly shell = document.createElement("section");
  private lastKey = "";
  private order: string[] = [];
  private holdOrder = false;
  private scrolls = new Map<string, number>();
  constructor(private readonly actions: {
    back: () => void; tab: (tab: MissionTab) => void; claim: (ids: string[]) => void;
    navigate: (destination: MissionRow["destination"]) => void; refresh: () => void;
  }) {
    this.shell.className = "vn-missions"; this.shell.setAttribute("aria-label", "Nhiệm vụ");
    this.shell.addEventListener("click", e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b || b.disabled || !this.shell.contains(b)) return;
      if (b.dataset.tab) this.actions.tab(b.dataset.tab as MissionTab);
      else if (b.dataset.claim) { this.holdOrder = true; this.actions.claim(b.dataset.claim.split(",")); }
      else if (b.dataset.destination) this.actions.navigate(b.dataset.destination as MissionRow["destination"]);
      else if (b.dataset.control === "back") this.actions.back();
      else if (b.dataset.control === "refresh") this.actions.refresh();
    });
    this.shell.addEventListener("keydown", e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
      if (!b || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const tabs = Object.keys(LABELS) as MissionTab[], index = tabs.indexOf(b.dataset.tab as MissionTab);
      const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (["ArrowLeft", "ArrowUp"].includes(e.key) ? 2 : 1)) % 3;
      this.actions.tab(tabs[next]!); this.shell.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next]}"]`)?.focus();
    });
    const releaseOrder = () => { this.holdOrder = false; };
    this.shell.addEventListener("pointerout", e => {
      const content = (e.target as HTMLElement).closest(".mi-content");
      if (content && e.relatedTarget instanceof Node && !content.contains(e.relatedTarget)) releaseOrder();
    });
    this.shell.addEventListener("focusout", e => {
      const content = (e.target as HTMLElement).closest(".mi-content");
      if (content && e.relatedTarget instanceof Node && !content.contains(e.relatedTarget)) queueMicrotask(releaseOrder);
    });
    document.body.append(this.shell);
  }

  render(state: MissionsViewState) {
    const oldList = this.shell.querySelector<HTMLElement>(".mi-rows");
    const scroll = oldList?.scrollTop ?? 0;
    if (oldList && this.lastKey) this.scrolls.set(this.lastKey, scroll);
    const anchor = oldList ? Array.from(oldList.querySelectorAll<HTMLElement>("[data-row]")).find(r => r.offsetTop + r.offsetHeight > scroll) : undefined;
    const anchorOffset = anchor ? anchor.offsetTop - scroll : 0;
    const active = document.activeElement as HTMLElement | null;
    const focus = active && this.shell.contains(active) ? active.dataset.control : undefined;
    const key = `${state.tab}:${state.periodKey}`;
    const sameList = key === this.lastKey;
    const source = state.tab === "achievements" ? state.achievements : state.missions[state.tab];
    if (!sameList) this.holdOrder = false;
    if (!sameList || !state.busy && !this.holdOrder) this.order = source.map(r => r.id);
    this.lastKey = key;
    const rows = [...source].sort((a, b) => this.order.indexOf(a.id) - this.order.indexOf(b.id));
    const ready = rows.filter(r => r.status === "ready");
    const blocked = !state.online || state.busy || state.refreshing;
    const reset = state.tab === "achievements" ? "Tự nhận thưởng khi đạt • Không làm mới"
      : `Làm mới lúc ${String(state.resetHour).padStart(2,"0")}:00 ${state.tab === "daily" ? "mỗi ngày" : "thứ Hai"} • Giờ Việt Nam`;
    const notice = !state.online ? "Đang ngoại tuyến. Kết nối để cập nhật tiến độ và nhận thưởng." : state.busy ? "Đang nhận thưởng…" : state.refreshing ? "Đang cập nhật tiến độ…" : state.error;
    const done = rows.filter(r => state.tab === "achievements" ? r.status === "claimed" : r.progress && r.progress.value >= r.progress.goal).length;
    this.shell.innerHTML = `<div class="mi-shell"><header class="mi-header"><button type="button" class="mi-icon-button" data-control="back" aria-label="Trở về màn hình chính">${image("nav_back")}</button><h1>Nhiệm vụ</h1><div class="mi-wallet">${([['moonJade','Nguyệt Ngọc'],['moonStar','Nguyệt Tinh'],['honor','Vinh Dự']] as const).map(([id,label]) => `<span class="mi-coin">${image(`cur_${id}`,"small",label)}${state.currencies[id].toLocaleString("vi-VN")}</span>`).join("")}</div></header>
      <div class="mi-body"><nav class="mi-tabs" role="tablist" aria-label="Nhóm nhiệm vụ">${(Object.keys(LABELS) as MissionTab[]).map(tab => {
        const count = tab === "achievements" ? `${state.achievements.filter(r => r.status === "claimed").length} / ${state.achievements.length}` : String(state.missions[tab].filter(r => r.status === "ready").length || "");
        return `<button type="button" role="tab" id="mission-tab-${tab}" data-control="tab-${tab}" data-tab="${tab}" aria-selected="${tab === state.tab}" aria-controls="mission-panel" tabindex="${tab === state.tab ? 0 : -1}">${image(GROUP_ICONS[tab])}<span>${LABELS[tab]}</span><span class="mi-badge">${count}</span></button>`;
      }).join("")}</nav><main id="mission-panel" class="mi-content" role="tabpanel" aria-labelledby="mission-tab-${state.tab}">
      <div class="mi-overview"><div><h2>${LABELS[state.tab]}</h2><p class="mi-muted">${reset}</p></div><div class="mi-summary"><strong>${done} / ${rows.length}</strong><span class="mi-muted">${state.tab === "achievements" ? "Thành tựu đã đạt" : "Nhiệm vụ hoàn thành"}</span></div></div>
      ${notice ? `<div class="mi-notice" role="status"><span>${escape(notice)}</span>${!state.busy && !state.refreshing ? `<button type="button" class="mi-icon-button" data-control="refresh" aria-label="Cập nhật lại tiến độ nhiệm vụ">${image("action_reset")}</button>` : ""}</div>` : ""}
      <div class="mi-rows" data-control="list" tabindex="0" aria-label="Danh sách ${LABELS[state.tab].toLocaleLowerCase('vi-VN')}">${rows.length ? rows.map(row => `<article class="mi-row ${row.status}" tabindex="-1" data-control="row-${row.id}" data-row="${row.id}"><div class="mi-type">${image(row.icon,"medium")}</div><div class="mi-description"><h3>${escape(row.name)}</h3><p>${escape(row.text)}</p></div>${progress(row)}<div class="mi-reward mi-coin">${image("cur_moonJade","small","Nguyệt Ngọc")}${row.reward}</div><div class="mi-action">${state.tab === "achievements" || row.status === "claimed" ? `<span class="mi-state" aria-label="${row.status === "claimed" ? state.tab === "achievements" ? "Đã tự nhận thưởng" : "Đã nhận thưởng" : "Chưa đạt"}">${image(row.status === "claimed" ? "check" : "lock")}</span>` : row.status === "ready" ? `<button type="button" class="mi-icon-button mi-claim" data-control="claim-${row.id}" data-claim="${row.id}" aria-label="${escape(`Nhận ${row.reward} Nguyệt Ngọc từ nhiệm vụ ${row.name}`)}" ${blocked ? "disabled" : ""}>${image("node_treasure")}</button>` : `<button type="button" class="mi-icon-button" data-control="go-${row.id}" data-destination="${(row as MissionRow).destination}" aria-label="${escape((row as MissionRow).destinationName)}">${image(row.icon)}</button>`}</div></article>`).join("") : `<div class="mi-empty">${image("seal","large")}<p>${state.tab === "achievements" ? "Chưa có thành tựu trong nhóm này." : "Chưa có nhiệm vụ trong kỳ này."}</p></div>`}</div>
      ${state.tab !== "achievements" && rows.length ? `<footer class="mi-footer"><span class="mi-muted">Tổng thưởng trong kỳ: ${rows.reduce((n,r) => n+r.reward,0)} Nguyệt Ngọc</span>${ready.length >= 2 ? `<button type="button" class="mi-claim-all" data-control="claim-all" data-claim="${ready.map(r=>r.id).join(',')}" aria-label="Nhận tất cả ${ready.length} nhiệm vụ đã hoàn thành, ${ready.reduce((n,r)=>n+r.reward,0)} Nguyệt Ngọc" ${blocked ? "disabled" : ""}>${image("node_treasure")}<span>Nhận tất cả</span>${image("cur_moonJade")}<strong>${ready.reduce((n,r)=>n+r.reward,0)}</strong></button>` : `<span class="mi-muted">${ready.length ? "1 nhiệm vụ có thể nhận thưởng" : rows.every(r=>r.status==='claimed') ? "Đã nhận toàn bộ thưởng trong kỳ" : "Tiếp tục hành trình để mở thưởng"}</span>`}</footer>` : ""}
      </main></div><div class="mi-receipt" role="status" aria-live="polite">${escape(state.notice)}</div></div>`;
    const list = this.shell.querySelector<HTMLElement>(".mi-rows")!;
    const newAnchor = sameList && anchor ? Array.from(list.querySelectorAll<HTMLElement>("[data-row]")).find(r => r.dataset.row === anchor.dataset.row) : undefined;
    list.scrollTop = newAnchor ? newAnchor.offsetTop - anchorOffset : this.scrolls.get(key) ?? 0;
    if (focus) {
      const target = Array.from(this.shell.querySelectorAll<HTMLElement>("[data-control]")).find(b => b.dataset.control === focus && !(b instanceof HTMLButtonElement && b.disabled));
      const rowId = focus.startsWith("claim-") ? focus.slice(6) : "";
      const nearby = rowId ? Array.from(list.querySelectorAll<HTMLElement>("[data-row]")).find(r => r.dataset.row === rowId) : undefined;
      (target ?? nearby ?? list).focus({ preventScroll: true });
    }
  }
  destroy() { this.shell.remove(); }
}
