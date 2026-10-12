import { expect, test, type Page } from "@playwright/test";
import { clickDesign } from "./helpers/combat";
import { openScene } from "./helpers/online";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on("pageerror", error => { errors.push(error.message); console.error("Inventory browser error:", error.message); });
});
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

async function texts(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("armory");
    const walk = (nodes: any[]): any[] => nodes.flatMap(n => [n, ...(n.list ? walk(n.list) : [])]);
    return walk(s.root.list).filter(n => n.type === "Text").map(n => n.text as string);
  });
}
async function fixture(page: Page) {
  await openScene(page, "armory");
  await page.evaluate(() => {
    const h = (window as any).__vn;
    h.session.profile.weapons = { w_xich_diem_thuong: { refinement: 3 }, w_thiet_thuan: { refinement: 5 }, w_anh_nguyet_chuy: { refinement: 2 } };
    h.session.profile.relics = { r_vong_nguyet_kinh: { resonance: 2 }, r_thien_sach: { resonance: 1 } };
    h.session.profile.currencies.darkIron = 96; h.session.profile.currencies.moonDust = 18;
    const s = h.game.scene.getScene("armory"); s.selectItem("w_xich_diem_thuong");
  });
}
test.describe("equipment collection", () => {
  test("search/filter/reset and paging keep the selected item readable", async ({ page }, info) => {
    await fixture(page);
    const search = page.getByRole("searchbox", { name: "Tìm trang bị" });
    await search.fill("XICH DIEM");
    await expect.poll(() => texts(page)).toContain("Hiển thị 1/25 · Trang 1/1");
    await page.getByRole("button", { name: /^Chưa sở hữu \(/ }).click();
    await expect.poll(() => texts(page)).toContain("Không tìm thấy trang bị phù hợp");
    await expect(page.getByRole("button",{name:"Món nằm ngoài bộ lọc · Xóa bộ lọc",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Xóa bộ lọc",exact:true}).first().click();
    await expect(search).toHaveValue("");
    await expect.poll(() => texts(page)).toContain("Hiển thị 25/25 · Trang 1/3");
    await page.getByRole("button",{name:"Trang sau",exact:true}).click();
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").selected)).toBe("w_xich_diem_thuong");
    await page.getByRole("button",{name:"Trang trước",exact:true}).click();
    await page.screenshot({ path: info.outputPath("inventory-weapons.png") });
  });
  test("category switches remember separate filters and selections", async ({ page }, info) => {
    await fixture(page);
    await page.getByRole("searchbox", { name: "Tìm trang bị" }).fill("xich diem");
    await page.getByRole("button", { name: /^Nguyệt Bảo/ }).click();
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveValue("");
    await page.getByRole("searchbox", { name: "Tìm trang bị" }).fill("vong nguyet kinh");
    await expect.poll(() => texts(page)).toContain("Hiển thị 1/16 · Trang 1/1");
    await page.getByRole("button", { name: /^Binh Khí/ }).click();
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveValue("xich diem");
    await page.getByRole("button", { name: /^Nguyệt Bảo/ }).click();
    await clickDesign(page, 90, 260);
    await expect.poll(() => texts(page)).toContain("Mỗi lần trăng đổi pha: mọi Hero 3 giáp.");
    await page.getByRole("tab",{name:"Các cấp",exact:true}).click();
    await expect.poll(() => texts(page)).toContain("Mỗi cấp thay thế toàn bộ cấp trước");
    await page.screenshot({ path: info.outputPath("inventory-relics.png") });
  });
  test("level preview does not change owned level or the real upgrade cost", async ({ page }) => {
    await fixture(page);
    await page.getByRole("button", {name:"Xem Tinh Luyện 5",exact:true}).click();
    await expect.poll(() => texts(page)).toContain("Đang xem Tinh Luyện 5");
    await expect.poll(() => texts(page)).toContain("Gây 9 sát thương, Thiêu Đốt 2.");
    await expect.poll(() => texts(page)).toContain("Cần 65 Huyền Thiết");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.weapons.w_xich_diem_thuong.refinement)).toBe(3);
  });
  test("max, unowned and offline items explain why upgrading is disabled", async ({ page }) => {
    await fixture(page);
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").selectItem("w_thiet_thuan"));
    await expect.poll(() => texts(page)).toContain("Đã đạt cấp tối đa.");
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").selectItem("w_liet_cung"));
    await expect.poll(() => texts(page)).toContain("Cần sở hữu trang bị trước khi nâng cấp.");
    await page.evaluate(() => { const h = (window as any).__vn; h.session.online = false; h.game.scene.getScene("armory").selectItem("w_xich_diem_thuong"); });
    await expect.poll(() => texts(page)).toContain("Cần kết nối để nâng cấp.");
    await page.getByRole("button", { name: /^Nâng cấp được \(/ }).click();
    await expect.poll(() => texts(page)).toContain("Không tìm thấy trang bị phù hợp");
  });
  test("upgrade sends one request and renders the server profile while preserving the query", async ({ page }) => {
    await fixture(page);
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; }); let count = 0;
    const profile = await page.evaluate(() => (window as any).__vn.session.profile);
    profile.weapons.w_xich_diem_thuong.refinement = 4; profile.currencies.darkIron = 31;
    await page.route("**/api/profile/weapons/w_xich_diem_thuong/upgrade", async route => { count++; await pending; await route.fulfill({ json: { profile, rev: 22 } }); });
    await page.getByRole("searchbox", { name: "Tìm trang bị" }).fill("xich diem");
    await page.getByRole("button", {name:"Nâng lên Tinh Luyện 4",exact:true}).click();
    await expect.poll(() => texts(page)).toContain("Đang nâng cấp…");
    await clickDesign(page, 906, 636);
    expect(count).toBe(1);
    release();
    await expect.poll(() => texts(page)).toContain("Đã có · Tinh Luyện 4/5");
    await expect.poll(() => texts(page)).toContain("Cần 75 Huyền Thiết");
    await expect.poll(() => texts(page)).toContain("Thiếu 44 Huyền Thiết.");
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveValue("xich diem");
  });
  test("late failed upgrades cannot draw over a re-entered scene", async ({ page }) => {
    await fixture(page);
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; }); let replied = false;
    await page.route("**/api/profile/weapons/w_xich_diem_thuong/upgrade", async route => { await pending; await route.fulfill({ status: 500, json: { error: "inventory_late" } }); replied = true; });
    await page.getByRole("button", {name:"Nâng lên Tinh Luyện 4",exact:true}).click();
    await expect.poll(() => texts(page)).toContain("Đang nâng cấp…");
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").scene.start("deck-select"));
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveCount(0);
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.start("armory"));
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeVisible();
    release(); await expect.poll(() => replied).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").busy)).toBe(false);
    expect((await texts(page)).join("\n")).not.toContain("inventory_late");
  });
  test("long details scroll below fixed tabs/actions and overlays close cleanly", async ({ page }, info) => {
    await fixture(page);
    await page.evaluate(() => { const h = (window as any).__vn; h.session.data.weapons.w_xich_diem_thuong.text = h.session.data.weapons.w_xich_diem_thuong.text.repeat(30); h.game.scene.getScene("armory").state.history=true; h.game.scene.getScene("armory").render(); });
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").scrollDetail(800));
    await page.getByRole("tab",{name:"Các cấp",exact:true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").detailTab)).toBe("levels");
    const footer = await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").root.list.find((n: any) => n.name === "equipment-actions").getBounds().bottom);
    expect(footer).toBeLessThanOrEqual(704);
    await page.getByRole("button",{name:"Phóng to hình trang bị",exact:true}).click();
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeHidden();
    await page.screenshot({ path: info.outputPath("inventory-art.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeVisible();
    await page.setViewportSize({ width: 900, height: 650 });
    const box = await page.getByRole("searchbox", { name: "Tìm trang bị" }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(900);
  });
});

test("equipment costs never overlap the upgrade hit target", async ({ page }) => {
  await fixture(page);
  const bounds = await page.evaluate(() => {
    const footer = (window as any).__vn.game.scene.getScene("armory").root.list.find((n: any) => n.name === "equipment-actions");
    const button = footer.list.find((n: any) => n.type === "Rectangle" && n.width === 462).getBounds();
    const icon = footer.list.find((n: any) => n.type === "Image").getBounds();
    const label = footer.list.find((n: any) => typeof n.text === "string" && n.text.startsWith("Cần 65")).getBounds();
    return { top: button.top, iconBottom: icon.bottom, labelBottom: label.bottom };
  });
  expect(bounds.iconBottom).toBeLessThan(bounds.top);
  expect(bounds.labelBottom).toBeLessThan(bounds.top);
});

test("keyboard selection, pinned card preview and real deck links remain usable", async ({ page }, info) => {
  await fixture(page);
  await clickDesign(page, 96, 250);
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").selected)).toBe("w_thiet_thuan");
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").selectItem("w_xich_diem_thuong"));
  await page.getByRole("button",{name:"Xem lá Binh Khí",exact:true}).click();
  await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeHidden();
  await page.screenshot({ path: info.outputPath("inventory-card.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeVisible();
  await page.evaluate(() => {
    const h = (window as any).__vn;
    h.session.profile.decks[0].weapons = { m05: "w_xich_diem_thuong" };
    h.game.scene.getScene("armory").render();
  });
  await page.getByRole("tab", {name:/Bộ bài/}).click();
  await expect.poll(() => texts(page)).toContain("Hoắc Liệt");
  await page.getByRole("button",{name:/Mở bộ bài/}).click();
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScenes(true)[0].sys.settings.key)).toBe("deck-builder");
  expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.weapons.m05)).toBe("w_xich_diem_thuong");
  await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveCount(0);
});

test("a late successful upgrade refreshes price in the re-entered scene", async ({ page }) => {
  await fixture(page);
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  const profile = await page.evaluate(() => (window as any).__vn.session.profile);
  profile.weapons.w_xich_diem_thuong.refinement = 4; profile.currencies.darkIron = 131;
  await page.route("**/api/profile/weapons/w_xich_diem_thuong/upgrade", async route => { await pending; await route.fulfill({ json: { profile, rev: 33 } }); });
  await page.getByRole("button", {name:"Nâng lên Tinh Luyện 4",exact:true}).click();
  await expect.poll(() => texts(page)).toContain("Đang nâng cấp…");
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").scene.start("deck-select"));
  await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toHaveCount(0);
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.start("armory"));
  await expect(page.getByRole("searchbox", { name: "Tìm trang bị" })).toBeVisible();
  release();
  await expect.poll(() => page.evaluate(() => (window as any).__vn.session.rev)).toBe(33);
  await expect.poll(() => texts(page)).toContain("Đã có · Tinh Luyện 4/5");
  await expect.poll(() => texts(page)).toContain("Đang có 131 · Sau nâng còn 56");
});

test("scrolling long text leaves fixed detail tabs visually unchanged", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { const h = (window as any).__vn; h.session.data.weapons.w_xich_diem_thuong.text = h.session.data.weapons.w_xich_diem_thuong.text.repeat(30); h.game.scene.getScene("armory").state.history=true; h.game.scene.getScene("armory").render(); });
  const clip = await page.evaluate(() => {
    const h = (window as any).__vn, game = h.game, cam = game.scene.getScene("armory").cameras.main, rect = game.canvas.getBoundingClientRect();
    const sx = rect.width / game.scale.width, sy = rect.height / game.scale.height;
    return { x: rect.left + (cam.x + (880 - cam.worldView.x) * cam.zoom) * sx, y: rect.top + (cam.y + (184 - cam.worldView.y) * cam.zoom) * sy, width: 340 * cam.zoom * sx, height: 48 * cam.zoom * sy };
  });
  const before = await page.screenshot({ clip });
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("armory").scrollDetail(800));
  const after = await page.screenshot({ clip });
  expect(after.equals(before)).toBe(true);
});
