import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { registerAccount, openSignedIn } from "./helpers/online";
import { activeSceneKey } from "./helpers/combat";

async function boot(page: Page, scene: string, withArt = true) {
  const account = await registerAccount();
  await openSignedIn(page, account);
  await page.evaluate(({ scene, withArt }) => {
    const h = (window as any).__vn;
    // Different aspect ratios catch accidental stretch/crop in full art and thumbnails.
    if (withArt) for (const [category, ids] of [["weapons", Object.keys(h.session.data.weapons)], ["relics", Object.keys(h.session.data.relics)]] as const) {
      for (const id of ids) {
        const canvas = document.createElement("canvas");
        canvas.width = category === "weapons" ? 200 : 600; canvas.height = 400;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = category === "weapons" ? "#7fbaca" : "#ab8cd0"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        h.game.textures.addCanvas(`${category}:${id}`, canvas);
      }
    }
    for (const id of Object.keys(h.session.data.weapons)) h.session.profile.weapons[id] = { refinement: 1 };
    for (const id of Object.keys(h.session.data.relics)) h.session.profile.relics[id] = { resonance: 1 };
    h.session.editingDeck = { id: "", name: "Art test", heroIds: [...h.session.heroIds], cardIds: [...h.session.deckCardIds] };
    h.game.scene.getScenes(true)[0]!.scene.start(scene);
  }, { scene, withArt });
  await expect.poll(async () => activeSceneKey(page), { timeout: 15_000 }).toBe(scene);
}

async function probe(page: Page, key: string) {
  return page.evaluate(key => {
    const scene = (window as any).__vn.game.scene.getScene(key), images: any[] = [], texts: any[] = [];
    const walk = (nodes: any[]) => nodes.forEach(n => {
      const b = n.getBounds?.();
      if (n.type === "Image") images.push({ key: n.texture.key, w: b.width, h: b.height, x: b.x, y: b.y });
      if (n.type === "Text") texts.push({ text: n.text, x: b.x, y: b.y, w: b.width, h: b.height });
      if (n.list) walk(n.list);
    });
    walk(scene.children.list); return { images, texts };
  }, key);
}

async function clickText(page: Page, scene: string, text: string) {
  const node = (await probe(page, scene)).texts.find(n => n.text === text || n.text.startsWith(text));
  expect(node, `visible text: ${text}`).toBeTruthy();
  const box = (await page.locator("canvas").boundingBox())!;
  const scale = Math.min(box.width / 1280, box.height / 720);
  await page.mouse.click(box.x + (box.width - 1280 * scale) / 2 + (node.x + node.w / 2) * scale,
    box.y + (box.height - 720 * scale) / 2 + (node.y + node.h / 2) * scale);
}

test("armory displays each equipment's full art without stretching or overlapping its details", async ({ page }) => {
  await boot(page, "armory");
  let p = await probe(page, "armory");
  let art = p.images.find(i => i.key === "weapons:w_xich_diem_thuong");
  expect(art).toBeTruthy();
  expect(art.w / art.h).toBeCloseTo(0.5);
  for (const line of p.texts.filter(t => /^[★☆] R\d/.test(t.text))) {
    expect(line.x).toBeGreaterThanOrEqual(art.x + art.w);
    expect(line.y + line.h).toBeLessThan(660);
  }
  await clickText(page, "armory", "Sau"); await clickText(page, "armory", "Sau");
  await clickText(page, "armory", "Dẫn Hồn Đăng");
  expect((await probe(page, "armory")).images.some(i => i.key === "weapons:w_dan_hon_dang")).toBe(true);
  await clickText(page, "armory", "Nguyệt Bảo");
  p = await probe(page, "armory"); art = p.images.find(i => i.key === "relics:r_thien_sach");
  expect(art).toBeTruthy(); expect(art.w / art.h).toBeCloseTo(1.5);
  const folder = fileURLToPath(new URL("../../../output/equipment-art/", import.meta.url));
  mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/armory-relic.png` });
});

test("equipment without art stays usable and does not load a missing texture", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await boot(page, "armory", false);
  // Every shipped item has generated art; a synthetic def exercises the no-art path.
  await page.evaluate(() => {
    const h = (window as any).__vn, scene = h.game.scene.getScene("armory");
    const def = h.session.data.weapons.w_xich_diem_thuong;
    h.session.data.weapons.w_no_art_probe = { ...def, id: "w_no_art_probe", name: "Vô Hình Kiếm" };
    h.session.profile.weapons.w_no_art_probe = { refinement: 1 };
    scene.selected = "w_no_art_probe";
    scene.render();
  });
  const p = await probe(page, "armory");
  expect(p.texts.some(t => t.text === "Chưa có art")).toBe(true);
  expect(p.images.some(i => i.key === "__MISSING")).toBe(false);
  await clickText(page, "armory", "Nguyệt Bảo");
  expect((await probe(page, "armory")).texts.some(t => t.text.includes("CM1."))).toBe(true);
  expect(errors).toEqual([]);
});

test("gear picker shows thumbnails and lets the last weapon be equipped", async ({ page }) => {
  await boot(page, "deck-builder");
  await clickText(page, "deck-builder", "⚔ Vũ khí:");
  expect((await probe(page, "deck-builder")).images.some(i => i.key === "weapons:w_xich_diem_thuong")).toBe(true);
  await clickText(page, "deck-builder", "Sau"); await clickText(page, "deck-builder", "Sau");
  await clickText(page, "deck-builder", "Dẫn Hồn Đăng");
  expect(await page.evaluate(() => Object.values((window as any).__vn.session.editingDeck.weapons).includes("w_dan_hon_dang"))).toBe(true);
  await clickText(page, "deck-builder", "☾ Nguyệt Bảo 1:");
  expect((await probe(page, "deck-builder")).images.some(i => i.key === "relics:r_thien_sach")).toBe(true);
});

for (const [itemId, key, withArt] of [
  ["w_xich_diem_thuong", "weapons:w_xich_diem_thuong", true],
  ["r_thien_sach", "relics:r_thien_sach", true],
  ["w_xich_diem_thuong", "gacha:weapon_banner", false],
] as const) test(`gacha result uses ${key} (${withArt ? "specific art" : "fallback"})`, async ({ page }) => {
  await boot(page, "gacha", withArt);
  await page.evaluate(({ itemId, withArt }) => {
    const h = (window as any).__vn, scene = h.game.scene.getScene("gacha");
    if (!withArt) {
      // Fallback art needs an item with no uploaded file; shipped items all have one.
      const def = h.session.data.weapons[itemId];
      h.session.data.weapons.w_no_art_probe = { ...def, id: "w_no_art_probe", name: "Vô Hình Kiếm" };
      itemId = "w_no_art_probe";
    }
    scene.phase = "revealing";
    scene.resultsFx.start([{ itemId, rarity: "legendary", outcome: "new" }]);
    scene.resultsFx.skip();
  }, { itemId, withArt });
  const p = await probe(page, "gacha");
  expect(p.images.some(i => i.key === key)).toBe(true);
  expect(p.texts.some(t => t.text === "Minh họa loại trang bị")).toBe(!withArt);
});

test("all equipment descriptions and upgrade controls fit beside the full art", async ({ page }) => {
  await boot(page, "armory");
  const overflow = await page.evaluate(() => {
    const h = (window as any).__vn, scene = h.game.scene.getScene("armory"), overflow: string[] = [];
    for (const category of ["weapons", "relics"]) {
      scene.tab = category;
      for (const id of Object.keys(h.session.data[category])) {
        scene.selected = id; scene.render();
        for (const node of scene.root.list) {
          if (node.type !== "Text" || node.x < 770) continue;
          const b = node.getBounds();
          if (b.bottom > 700 || b.right > 1250) overflow.push(`${id}: ${node.text} at ${b.bottom}, ${b.right}`);
        }
      }
    }
    return overflow;
  });
  expect(overflow).toEqual([]);
});

test("large material counts keep the upgrade cost above its button", async ({ page }) => {
  await boot(page, "armory");
  const bounds = await page.evaluate(() => {
    const h = (window as any).__vn, scene = h.game.scene.getScene("armory");
    h.session.profile.currencies.moonDust = 999999999;
    scene.tab = "relics"; scene.selected = "r_thien_sach"; scene.render();
    const cost = scene.root.list.find((n: any) => n.type === "Text" && n.text.startsWith("Nâng Cấp →"));
    const button = scene.root.list.find((n: any) => n.type === "Rectangle" && n.x === 860 && n.width === 180);
    return { costBottom: cost.getBounds().bottom, buttonTop: button.getBounds().top };
  });
  expect(bounds.buttonTop).toBeGreaterThan(bounds.costBottom);
});

for (const [category, id, extension, scene] of [
  ["weapons", "w_xich_diem_thuong", "png", "armory"],
  ["relics", "r_thien_sach", "webp", "gacha"],
  ["weapons", "w_xich_diem_thuong", "jpg", "deck-builder"],
] as const) test(`${scene} loads a manually added ${extension} from ${category}`, async ({ page }) => {
  const folder = fileURLToPath(new URL(`../public/assets/${category}/`, import.meta.url));
  // Never overwrite or delete the user's own uploaded artwork.
  test.skip(["png", "webp", "jpg", "jpeg"].some(ext => existsSync(`${folder}/${id}.${ext}`)), "Real artwork already exists");
  const bytes = await page.evaluate(extension => {
    const canvas = document.createElement("canvas"); canvas.width = 24; canvas.height = 36;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#83bace"; ctx.fillRect(0, 0, 24, 36);
    return canvas.toDataURL(`image/${extension === "jpg" ? "jpeg" : extension}`).split(",")[1]!;
  }, extension);
  const path = `${folder}/${id}.${extension}`;
  mkdirSync(folder, { recursive: true });
  try {
    writeFileSync(path, Buffer.from(bytes, "base64"));
    await boot(page, scene, false);
    expect(await page.evaluate(key => {
      const texture = (window as any).__vn.game.textures.get(key);
      return { width: texture.getSourceImage().width, height: texture.getSourceImage().height };
    }, `${category}:${id}`)).toEqual({ width: 24, height: 36 });
  } finally {
    await page.goto("about:blank");
    // Vite may still be streaming an image when the scene has become active.
    for (let attempt = 0; ; attempt++) {
      try { unlinkSync(path); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EBUSY" || attempt >= 19) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
});
