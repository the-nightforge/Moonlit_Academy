import Phaser from "phaser";
import type { GameData, PullResult, Rarity } from "rules";
import { featuredEntry, reservedFeaturedHeroes, weekKey } from "rules";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../../account";
import { api } from "../../api";
import { session } from "../../session";
import { roundedPanel } from "../../ui/rounded-panel";
import { COLORS, CURRENCY_LABELS, RARITY_COLORS, RARITY_LABELS, visibleWorld } from "../../ui/theme";
import { alertModal, confirmModal, showToast } from "../../ui/widgets";
import type { GachaScene } from "../gacha-scene";
import { itemName, outcomeText, percent, RARITIES, type HistoryEntry } from "./shared";

/**
 * All gacha overlays that read or mutate the profile: rates/details list, pull
 * history, Nguyệt Ước picker, and the moonStar→moonJade conversion dialog.
 * `converting` feeds the scene's `busy` gate; `historyRequest` invalidates
 * in-flight history loads.
 */
export class GachaModals {
  modal: Phaser.GameObjects.Container | null = null;
  converting = false;
  historyRequest = 0;
  private cleanup: (() => void) | null = null;

  constructor(private s: GachaScene) {}

  close() {
    this.historyRequest++;
    this.cleanup?.(); this.cleanup = null;
    this.modal?.destroy(); this.modal = null;
  }

  /** Drops stale references without destroying — the scene teardown owns that. */
  reset() {
    this.modal = null;
    this.cleanup = null;
    this.converting = false;
  }

  /** Whole visible text rows keep the scroll list clear of modal controls in WebGL. */
  private open(title: string, lines: { text: string; color?: string }[], footer?: (layer: Phaser.GameObjects.Container) => void, header?: (layer: Phaser.GameObjects.Container) => void) {
    const s = this.s;
    this.close();
    const layer = s.add.container(0, 0).setDepth(500); this.modal = layer;
    const view = visibleWorld(s);
    layer.add(s.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0.8).setInteractive());
    layer.add(roundedPanel(s, 640, 360, 1030, 650, 0x0f1e34, 0.99, 0xbba172, 20));
    s.text(layer, 640, 70, title, 24, "#f3dfb5").setOrigin(0.5);
    s.text(layer, 640, 105, "Cuộn để xem toàn bộ · Esc để đóng", 13, "#a8bbd2").setOrigin(0.5);
    header?.(layer);
    const top = header ? 168 : 137;
    const content = s.add.container(0, 0); layer.add(content);
    const rows: Phaser.GameObjects.Text[] = [];
    let y = top + 6;
    lines.forEach(line => {
      const measure = s.text(content, 178, y, line.text, 16, line.color ?? "#d8e0e9", 918);
      const wrapped = measure.getWrappedText();
      measure.destroy();
      for (const value of wrapped) {
        const row = s.text(content, 178, y, value, 16, line.color ?? "#d8e0e9");
        rows.push(row);
        y += row.height + 5;
      }
      y += 13;
    });
    let offset = 0;
    const updateRows = () => {
      content.setY(-offset);
      rows.forEach(row => row.setVisible(row.y - offset >= top && row.y - offset + row.height <= 577));
    };
    const scroll = (delta: number) => {
      offset = Phaser.Math.Clamp(offset + delta, 0, Math.max(0, y - 577));
      updateRows();
    };
    updateRows();
    const wheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const p = s.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (p.x >= 166 && p.x <= 1114 && p.y >= top && p.y <= 577) scroll(Math.sign(dy) * 90);
    };
    s.input.on("wheel", wheel);
    this.cleanup = () => { s.input.off("wheel", wheel); };
    s.button(layer, 1125, 199, 42, "▲", () => scroll(-180));
    s.button(layer, 1125, 527, 42, "▼", () => scroll(180));
    if (footer) footer(layer);
    else s.button(layer, 640, 636, 220, "Đóng", () => { this.close(); s.render(); });
    s.render();
  }

  details() {
    const s = this.s;
    if (s.busy || this.modal) return;
    const data = session.data, banner = data.banners[s.bannerId]!, profile = session.profile, g = data.economyConfig.gacha;
    const featured = featuredEntry(banner, Date.now());
    const lines: { text: string; color?: string }[] = [
      { text: `Legendary ${percent(g.rates.legendary)} · Epic ${percent(g.rates.epic)} · còn lại Rare/Common`, color: "#eed4a1" },
      { text: `Bảo hiểm Epic: chắc chắn trong ${g.epicPity} lượt. Legendary chắc chắn ở lượt ${g.legendaryPity}.` },
      { text: `Legendary: từ lượt ${g.legendarySoftPityStart + 1}, tỉ lệ tăng ${percent(g.legendarySoftPityStep)} mỗi lượt.` },
      ...(banner.pityGroup ? [{ text: "Bảo hiểm chung giữa các banner Hero." }] : []),
      ...(banner.epitomized ? [{
        text: `Nguyệt Ước: khóa 1 Legendary làm mục tiêu — trượt ${banner.epitomized.maxPoints} lần thì Legendary kế chắc chắn trúng mục tiêu. Đổi/hủy mục tiêu mất điểm.`,
        color: "#f3d98c",
      }] : []),
      ...(g.newPlayerEpicHero && banner.kind === "hero" ? [{ text: "Bảo vệ người mới: Epic ưu tiên Hero chưa sở hữu." }] : []),
      ...(featured && banner.featured ? [
        { text: banner.pool.legendary.length === 0
            ? `Legendary luôn trúng ${itemName(data, featured.heroId)} (tướng tuần).`
            : `Legendary trúng: ${percent(banner.featured.rateUp)} ${itemName(data, featured.heroId)} (tướng tuần) · ${percent(1 - banner.featured.rateUp)} một tướng Legendary khác.`, color: "#f3d98c" },
        ...(featured.name ? [{ text: `Tuần này: ${featured.name}` }] : []),
      ] : []),
    ];
    // This week's rotating heroes are reserved to their featured banner's rate-up:
    // filtered out of every other legendary draw, including this banner's fallback.
    const reserved = new Set(reservedFeaturedHeroes(data, Date.now()));
    const hidden = banner.pool.legendary.filter((id) => reserved.has(id) && id !== featured?.heroId);
    for (const id of hidden) {
      lines.push({ text: `${itemName(data, id)} hiện không nằm trong banner này — chỉ trên banner luân chuyển tuần này.`, color: "#8fa2bd" });
    }
    const pool: Record<Rarity, string[]> = featured && banner.featured
      ? { legendary: [featured.heroId, ...banner.pool.legendary.filter((id) => !reserved.has(id))], epic: featured.pool.epic, rare: featured.pool.rare, common: featured.pool.common }
      : { ...banner.pool, legendary: banner.pool.legendary.filter((id) => !reserved.has(id)) };
    for (const rarity of RARITIES) {
      if (!pool[rarity].length) continue;
      lines.push({ text: RARITY_LABELS[rarity], color: `#${RARITY_COLORS[rarity].toString(16).padStart(6, "0")}` });
      for (const id of pool[rarity]) {
        const featuredTag = (featured && rarity === "legendary" && id === featured.heroId ? " ★" : "")
          + (rarity === "legendary" && profile.epitomized[s.bannerId]?.targetId === id ? " ☾" : "");
        const owned = banner.kind === "hero" ? (profile.heroes[id] ? `Tinh Hồn ${profile.heroes[id]!.constellation}` : "chưa có")
          : banner.kind === "weapon" ? (profile.weapons[id] ? `Tinh Luyện ${profile.weapons[id]!.refinement}` : "chưa có")
          : (profile.relics[id] ? `Cộng Minh ${profile.relics[id]!.resonance}` : "chưa có");
        lines.push({ text: `${itemName(data, id)}${featuredTag}   ·   ${owned}` });
      }
    }
    this.open(`${banner.name} · Tỉ lệ & vật phẩm`, lines);
  }

  private chip(parent: Phaser.GameObjects.Container, x: number, y: number, label: string, active: boolean, action: () => void) {
    const s = this.s;
    const panel = roundedPanel(s, x, y, 130, 30, active ? 0x3a4d70 : 0x14243a, 0.95, active ? 0xe8c784 : 0x53627d, 15);
    parent.add(panel);
    s.text(panel, 0, 0, label, 13, active ? "#f4dfb2" : "#aab9d0").setOrigin(0.5);
    const hit = s.add.rectangle(0, 0, 130, 30, 0, 0);
    panel.add(hit);
    if (!active) {
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", action);
      hit.on("pointerover", () => panel.setAlpha(0.8));
      hit.on("pointerout", () => panel.setAlpha(1));
    }
  }

  private bannerTabLabel(banner: GameData["banners"][string]) {
    return banner.featured ? "Xoay tua" : banner.kind === "hero" ? "Tướng" : banner.kind === "weapon" ? "Binh khí" : "Bảo vật";
  }

  async history(page: number, bannerFilter?: string) {
    const s = this.s;
    if (s.busy || !s.alive) return;
    const banners = Object.values(session.data.banners);
    const tabs = (layer: Phaser.GameObjects.Container) => {
      const defs: (string | undefined)[] = [undefined, ...banners.map(b => b.id)];
      defs.forEach((id, index) => {
        const label = id === undefined ? "Tất cả" : this.bannerTabLabel(banners[index - 1]!);
        this.chip(layer, 640 + (index - (defs.length - 1) / 2) * 140, 138, label, id === bannerFilter, () => void this.history(0, id));
      });
    };
    this.open(`Nhật ký quay — trang ${page + 1}`, [{ text: "Đang tải nhật ký…" }], layer => s.button(layer, 640, 636, 220, "Đóng", () => { this.close(); s.render(); }), tabs);
    const request = ++this.historyRequest, generation = s.generation;
    try {
      const filter = bannerFilter ? `&banner=${bannerFilter}` : "";
      const { entries } = await api<{ entries: HistoryEntry[] }>("GET", `/gacha/history?page=${page}${filter}`);
      if (!s.alive || generation !== s.generation || request !== this.historyRequest || !this.modal) return;
      const lines = entries.map(entry => ({ text: `${new Date(entry.createdAt).toLocaleString("vi-VN")} · ${session.data.banners[entry.bannerId]?.name ?? entry.bannerId}\n${entry.results.map(result => `${itemName(session.data, result.itemId)} (${RARITY_LABELS[result.rarity]}) · ${outcomeText(result).replace("\n", " · ")}`).join("; ")}` }));
      this.open(`Nhật ký quay — trang ${page + 1}`, lines.length ? lines : [{ text: "Chưa có lượt quay nào" }], layer => {
        s.button(layer, 430, 636, 170, "◂ Mới hơn", () => void this.history(page - 1, bannerFilter), page > 0);
        s.button(layer, 640, 636, 170, "Đóng", () => { this.close(); s.render(); });
        s.button(layer, 850, 636, 170, "Cũ hơn ▸", () => void this.history(page + 1, bannerFilter), entries.length === 20);
      }, tabs);
    } catch (error) {
      if (!s.alive || generation !== s.generation || request !== this.historyRequest || !this.modal) return;
      this.close(); s.render(); void alertModal(s, errorText(error));
    }
  }

  /** Convert moonStar into moonJade through the weekly shop item when the pull cost is short. */
  async convert() {
    const s = this.s;
    const item = session.data.economyConfig.moonStarShop.find(entry => entry.item.type === "moonJade");
    if (!item || s.busy || !s.alive) return;
    const shop = session.profile.shop;
    const bought = shop.weekKey === weekKey(session.data, Date.now()) ? (shop.bought[item.id] ?? 0) : 0;
    const left = item.limitPerWeek - bought;
    const gain = item.item.type === "moonJade" ? item.item.amount : 0;
    const ok = await confirmModal(s, `Đổi ${item.price} ${CURRENCY_LABELS.moonStar} lấy ${gain} ${CURRENCY_LABELS.moonJade}?\nTuần này còn ${Math.max(0, left)}/${item.limitPerWeek} lần đổi.`, { label: "Đổi" });
    if (!ok || s.busy || !s.alive) return;
    this.converting = true;
    s.render();
    mutate<ProfileReply & { achievements?: string[] }>("POST", `/shop/${item.id}/buy`).then(
      reply => {
        this.converting = false;
        if (!s.alive) return;
        s.render();
        showToast(s, [`Đã đổi +${gain} ${CURRENCY_LABELS.moonJade}`, ...achievementNotices(reply.achievements)]);
      },
      (error: unknown) => {
        this.converting = false;
        if (!s.alive) return;
        void alertModal(s, errorText(error));
        s.render();
      },
    );
  }

  /** Epitomized Path picker (spec P6): lock one legendary weapon as the target. */
  pathPicker() {
    const s = this.s;
    const data = session.data, banner = data.banners[s.bannerId];
    if (!banner?.epitomized || s.busy || !s.alive) return;
    this.close();
    const layer = s.add.container(0, 0).setDepth(500); this.modal = layer;
    const view = visibleWorld(s);
    layer.add(s.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0.8).setInteractive());
    layer.add(roundedPanel(s, 640, 360, 760, 620, 0x0f1e34, 0.99, 0xbba172, 20));
    s.image(layer, "ui:epitomized_moon", 538, 76, 30, 30);
    s.text(layer, 640, 76, "NGUYỆT ƯỚC", 24, "#f3dfb5").setOrigin(0.5);
    s.text(layer, 640, 108, `Trượt ${banner.epitomized.maxPoints} lần → Legendary kế chắc chắn là mục tiêu. Đổi/hủy mục tiêu mất điểm.`, 13, "#a8bbd2").setOrigin(0.5);
    const path = session.profile.epitomized[s.bannerId];
    s.text(layer, 640, 136, path ? `Đang khóa: ${itemName(data, path.targetId)} — ${path.points}/${banner.epitomized.maxPoints} điểm` : "Chưa khóa mục tiêu nào", 14, path ? "#f3d98c" : "#8fa2bd").setOrigin(0.5);
    // Grid: 4 columns, second row centered when it isn't full.
    const cols = 4, cw = 168, ch = 186, gapX = 14, gapY = 12;
    const ids = banner.pool.legendary;
    ids.forEach((id, index) => {
      const gridRow = Math.floor(index / cols), gridCol = index % cols;
      const inRow = Math.min(cols, ids.length - gridRow * cols);
      const rowW = inRow * cw + (inRow - 1) * gapX;
      const x = 640 - rowW / 2 + gridCol * (cw + gapX) + cw / 2;
      const y = 280 + gridRow * (ch + gapY);
      const locked = path?.targetId === id;
      const cell = roundedPanel(s, x, y, cw, ch, locked ? 0x2c3a55 : 0x14243a, 0.95, locked ? 0xe8c784 : 0x53627d, 12);
      layer.add(cell);
      const thumb = s.image(cell, `weapons:${id}`, 0, -18, 116, 116);
      if (!thumb) s.image(cell, "ui:gear", 0, -18, 60, 60);
      s.text(cell, 0, 52, itemName(data, id), 13, locked ? "#f4dfb2" : COLORS.text, cw - 12).setOrigin(0.5).setAlign("center");
      s.text(cell, 0, 72, session.profile.weapons[id] ? `Tinh Luyện ${session.profile.weapons[id]!.refinement}` : "Chưa sở hữu", 11, "#8fa2bd").setOrigin(0.5);
      const hit = s.add.rectangle(0, 0, cw, ch, 0, 0);
      cell.add(hit);
      if (!locked) {
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => void this.selectPath(id));
        hit.on("pointerover", () => cell.setAlpha(0.85));
        hit.on("pointerout", () => cell.setAlpha(1));
      }
    });
    s.button(layer, 512, 622, 170, "Đóng", () => { this.close(); s.render(); });
    s.button(layer, 768, 622, 170, "Hủy Nguyệt Ước", () => void this.selectPath(null), path !== undefined);
  }

  private async selectPath(targetId: string | null) {
    const s = this.s;
    if (s.busy || !s.alive) return;
    this.converting = true;
    try {
      await mutate<ProfileReply>("POST", `/gacha/${s.bannerId}/path`, { targetId });
      if (!s.alive) return;
      this.converting = false;
      this.pathPicker();
      showToast(s, [targetId === null ? "Đã hủy Nguyệt Ước" : `Đã khóa mục tiêu: ${itemName(session.data, targetId)}`], 695);
    } catch (error) {
      this.converting = false;
      if (!s.alive) return;
      this.close();
      void alertModal(s, errorText(error));
    }
    if (s.alive) s.render();
  }
}
