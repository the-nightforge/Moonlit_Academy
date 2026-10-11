import { clickArenaAction, selectArenaDeck } from "./helpers/arena";
import { expect, test, type Page } from "@playwright/test";
import { activeSceneKey, clickDesign, clickSceneText, sceneTexts, waitForScene } from "./helpers/combat";
import { openSignedIn, registerAccount, saveDeck } from "./helpers/online";

/**
 * Home (`deck-select`) acceptance specs for the home-ui-redesign plan. Canvas
 * UI is not DOM-readable: canvas texts are found by walking the live scene's
 * display list through `window.__vn`, like the combat helpers do.
 */

const selectedDeckId = (page: Page) => page.evaluate(() => (window as any).__vn.session.selectedDeckId);

/** Finds visible text or an icon's semantic label, prioritizing the open modal. `arg` reaches the predicate as its second parameter. */
async function clickText(page: Page, sceneKey: string, match: (text: string, arg?: any) => boolean, timeout = 15_000, arg?: unknown): Promise<void> {
  const find = () =>
    page.evaluate(({ sceneKey, source, arg: predicateArg }) => {
      const matches = new Function("t", "arg", `return (${source})(t, arg)`);
      const scene = (window as any).__vn?.game.scene.getScene(sceneKey);
      if (!scene?.scene?.isActive()) return null;
      let found: any = null;
      const walk = (nodes: any[] | undefined) => {
        for (const node of nodes ?? []) {
          if (found) return;
          const label = node.type === "Text" ? node.text : node.getData?.("actionLabel");
          if (typeof label === "string" && matches(label, predicateArg)) found = node;
          else if (Array.isArray(node.list)) walk(node.list);
        }
      };
      if (scene.deckOverlay) walk([scene.deckOverlay]);
      if (!found) walk(scene.children.list);
      if (!found) return null;
      const b = found.getBounds();
      return { x: b.centerX, y: b.centerY };
    }, { sceneKey, source: match.toString(), arg });
  await expect.poll(find, { timeout }).not.toBeNull();
  const point = (await find())!;
  await clickDesign(page, point.x, point.y);
}

/** Moves the mouse to a design-space (1280×720) coordinate — for hover tooltips. */
async function moveDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  const s = Math.min(box!.width / 1280, box!.height / 720);
  const left = box!.x + (box!.width - 1280 * s) / 2;
  const top = box!.y + (box!.height - 720 * s) / 2;
  await page.mouse.move(left + x * s, top + y * s);
}

/** The texts currently on the deck-select scene. */
const homeTexts = (page: Page) => sceneTexts(page, "deck-select");

test.describe("home details", () => {
  test("overlay keyboard focus survives a background Home refresh", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await clickText(page, "deck-select", (text) => text === "Đổi bộ bài ▾");
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").controls.focused?.panel.getData("actionLabel") === "Sao chép & sửa");
    }
    expect(found).toBe(true);
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").render());
    await page.keyboard.press("Enter");
    await waitForScene(page, "deck-builder", 15_000);
  });

  test("keyboard can reveal a truncated selected deck name", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.includes("điểm")))).toBe(true);
    const full = "WWWWWWWWWWWWWWWWWWWWWWWW";
    await page.evaluate((name) => {
      const s = (window as any).__vn.session;
      s.profile.decks[0].name = name;
      s.selectedDeckId = s.profile.decks[0].id;
      (window as any).__vn.game.scene.getScene("deck-select").render();
    }, full);
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").controls.focused?.hit.text?.startsWith("WWW") ?? false);
    }
    expect(found).toBe(true);
    await page.keyboard.press("Enter");
    expect(await homeTexts(page)).toContain(full);
  });

  test("offline portrait shortcut cannot bypass the disabled editor", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await page.evaluate(() => {
      (window as any).__vn.session.online = false;
      (window as any).__vn.game.scene.getScene("deck-select").render();
    });
    await clickDesign(page, 606, 365);
    expect(await activeSceneKey(page)).toBe("deck-select");
  });

  test("starter action explains copying and hero tooltip contains progression", async ({ page }, testInfo) => {
    await openSignedIn(page, await registerAccount());
    await expect.poll(() => homeTexts(page)).toContain("Sao chép & sửa");
    await moveDesign(page, 606, 365);
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.includes("HP tối đa") && text.includes("Tu Luyện") && text.includes("Thăng cấp")))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("home-hero-tooltip.png") });
    await clickText(page, "deck-select", (text) => text === "Sao chép & sửa");
    await waitForScene(page, "deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe("");
  });

  test("keyboard focus reaches footer routes and respects reduced motion", async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem("vongnguyet.combatSettings.v1", JSON.stringify({ speed: 1, reducedMotion: true, volume: 0 })));
    await openSignedIn(page, await registerAccount());
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.includes("điểm")))).toBe(true);
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").controls.focused?.panel.list.some((node: any) => node.type === "Text" && node.text === "Triệu Hồi") ?? false);
    }
    expect(found).toBe(true);
    const motion = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select");
      return { alpha: scene.root.alpha, tweens: scene.tweens.getTweens().length };
    });
    expect(motion.alpha).toBe(1);
    expect(motion.tweens).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("home-keyboard-focus.png") });
    await page.keyboard.press("Enter");
    await waitForScene(page, "gacha");
  });

  test("long selected name is readable in a tooltip and rank shows the next milestone", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    const full = "WWWWWWWWWWWWWWWWWWWWWWWW";
    await page.evaluate((name) => {
      const s = (window as any).__vn.session;
      s.profile.decks[0].name = name;
      s.selectedDeckId = s.profile.decks[0].id;
      (window as any).__vn.game.scene.getScene("deck-select").render();
    }, full);
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text === "Còn 100 điểm đến Tú Tài"))).toBe(true);
    await moveDesign(page, 670, 151);
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.includes(full)))).toBe(true);
  });

  test("starter hides direct editing; offline copy tooltip stays above its button", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await clickText(page, "deck-select", (text) => text === "Đổi bộ bài ▾");
    await expect.poll(() => page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("deck-select");
      const walk = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...(n.list ? walk(n.list) : [])]);
      return walk(s.overlayPanel.list).some((n) => n.getData?.("actionLabel") === "Chỉnh sửa");
    })).toBe(false);
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.online = false;
      const s = h.game.scene.getScene("deck-select");
      s.renderDeckList(s.overlayPanel);
    });
    const point = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select");
      const walk = (nodes: any[]): any => nodes.flatMap((node: any) => node.type === "Rectangle" && node.getData?.("actionLabel") === "Sao chép & sửa" ? [node] : Array.isArray(node.list) ? walk(node.list) : []);
      const text = walk(scene.overlayPanel.list)[0];
      const b = text.getBounds();
      return { x: b.centerX, y: b.centerY };
    });
    await moveDesign(page, point.x, point.y);
    await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.startsWith("Cần đăng nhập và kết nối server")))).toBe(true);
    const tip = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select");
      const panel = scene.children.list.find((node: any) => node.type === "Container" && node.list.some((child: any) => child.type === "Text" && child.text.startsWith("Cần đăng nhập và kết nối server")));
      const b = panel.getBounds();
      return { bottom: b.bottom, x: b.centerX, depth: panel.depth };
    });
    expect(Math.abs(tip.x - point.x)).toBeLessThan(150);
    expect(point.y - tip.bottom).toBeGreaterThanOrEqual(15);
    expect(point.y - tip.bottom).toBeLessThan(70);
    expect(tip.depth).toBeGreaterThan(900);
  });
});

test.describe("home hierarchy", () => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`mode, rank, deck and labeled footer fit at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const account = await registerAccount();
      await openSignedIn(page, account);
      await expect.poll(() => homeTexts(page)).toEqual(expect.arrayContaining([
        "Triệu Hồi", "Hero", "Kho Đồ", "Nhiệm Vụ", "Tu Luyện", "Đội hình xuất trận", "Sao chép & sửa",
      ]));
      await expect.poll(() => homeTexts(page).then((texts) => texts.some((text) => text.includes("điểm")))).toBe(true);
      const layout = await page.evaluate(() => {
        const scene = (window as any).__vn.game.scene.getScene("deck-select");
        const texts: Record<string, any> = {};
        let rank: any;
        const rect = (node: any) => {
          const b = node.getBounds();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height, cx: b.centerX, cy: b.centerY };
        };
        const walk = (nodes: any[]) => {
          for (const node of nodes) {
            if (node.type === "Text") {
              const parent = node.parentContainer;
              // Use the tile's hit rectangle, since container bounds include
              // overflowing children and cannot prove emblem containment.
              const tileHit = parent?.list.find((child: any) => child.type === "Rectangle" && child.input && child.height >= 80);
              texts[node.text] = { bounds: rect(node), parent: rect(tileHit ?? parent ?? node) };
            }
            if (node.type === "Image" && node.texture.key.startsWith("ui:rank_")) rank = rect(node);
            if (Array.isArray(node.list)) walk(node.list);
          }
        };
        walk(scene.children.list);
        return { texts, rank };
      });
      const arena = layout.texts["Đấu Trường"].parent;
      const run = layout.texts["Tầm Nguyệt"].parent;
      const coop = layout.texts["Liên Thủ"].parent;
      const story = layout.texts["Cốt Truyện"].parent;
      expect(arena.width).toBeGreaterThan(coop.width * 1.8);
      expect(run.width).toBeGreaterThan(story.width * 1.8);
      expect(coop.cy).toBeCloseTo(story.cy, 1);
      expect(coop.right + 8).toBeLessThanOrEqual(story.left);
      expect(layout.rank.left).toBeGreaterThanOrEqual(arena.left);
      expect(layout.rank.right).toBeLessThanOrEqual(arena.right);
      expect(layout.rank.top).toBeGreaterThanOrEqual(arena.top);
      expect(layout.rank.bottom).toBeLessThanOrEqual(arena.bottom);
      for (const label of ["Triệu Hồi", "Hero", "Kho Đồ", "Nhiệm Vụ", "Tu Luyện"]) {
        const b = layout.texts[label].bounds;
        expect(b.top).toBeGreaterThanOrEqual(612);
        expect(b.bottom).toBeLessThanOrEqual(704);
        expect(b.left).toBeGreaterThanOrEqual(24);
        expect(b.right).toBeLessThanOrEqual(1256);
      }
      const edit = layout.texts["Sao chép & sửa"].bounds;
      expect(layout.texts["Đội hình xuất trận"].bounds.right + 8).toBeLessThan(edit.left);
      await page.screenshot({ path: testInfo.outputPath(`home-hierarchy-${viewport.width}x${viewport.height}.png`) });
    });
  }

  test("explicit edit opens the selected saved deck; starter edit creates a copy", async ({ page }) => {
    const account = await registerAccount();
    const name = "Đội hình Ánh Trăng";
    const id = await saveDeck(account, name);
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (text) => text === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (text, arg) => text.startsWith(arg), 15_000, name);
    await clickText(page, "deck-select", (text) => text === "Dùng bộ bài này");
    expect(await homeTexts(page)).toContain(name);
    await clickText(page, "deck-select", (text) => text === "Chỉnh sửa");
    await waitForScene(page, "deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe(id);
    await clickText(page, "deck-builder", (text) => text === "Trở về");
    await waitForScene(page, "deck-select");
    await clickText(page, "deck-select", (text) => text === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (text) => text.startsWith("Bộ cơ bản"));
    await clickText(page, "deck-select", (text) => text === "Dùng bộ bài này");
    const before = await page.evaluate(() => (window as any).__vn.session.profile.decks.length);
    await clickText(page, "deck-select", (text) => text === "Sao chép & sửa");
    await waitForScene(page, "deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe("");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.decks.length)).toBe(before);
  });
});

const HOME_MODES = ["arena", "run", "coop", "story"];
const HOME_TIERS = ["dong_sinh", "tu_tai", "cu_nhan", "tien_si", "trang_nguyen"];

/** Inspect displayed art, including images nested inside mode tiles. */
async function homeArt(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("deck-select");
    const images: { key: string; x: number; y: number; w: number; h: number }[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "Image") {
          const bounds = node.getBounds();
          images.push({ key: node.texture.key, x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height });
        }
        if (Array.isArray(node.list)) walk(node.list);
      }
    };
    walk(scene.children.list);
    const camera = scene.cameras.main;
    const w = camera.width / camera.zoom, h = camera.height / camera.zoom;
    return { images, view: { x: 640 - w / 2, y: 360 - h / 2, w, h } };
  });
}

test.describe("home art resolution", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  test("rounded Hero art preserves native pixel detail on a high density screen", async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem("vongnguyet.combatSettings.v1", JSON.stringify({ reducedMotion: true, volume: 0 })));
    await openSignedIn(page, await registerAccount(), { fastPlayback: false });
    await expect.poll(() => homeArt(page).then(({ images }) => images.filter(({ key }) => key.startsWith("heroes:")).length)).toBe(3);
    const point = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select");
      const walk = (nodes: any[]): any => {
        for (const node of nodes) {
          if (node.type === "Image" && node.texture.key.startsWith("heroes:")) return node;
          if (node.list) { const found = walk(node.list); if (found) return found; }
        }
      };
      const art = walk(scene.root.list);
      const probe = scene.textures.createCanvas("hero-detail-probe", 400, 576);
      const context = probe.context;
      for (let x = 0; x < 400; x++) { context.fillStyle = x % 2 ? "#ffffff" : "#000000"; context.fillRect(x, 0, 1, 576); }
      probe.refresh();
      const parent = art.parentContainer.getWorldTransformMatrix();
      art.setTexture("hero-detail-probe").setCrop().setDisplaySize(200 / parent.scaleX, 288 / parent.scaleY);
      const bounds = art.getBounds(), canvas = scene.game.canvas.getBoundingClientRect(), camera = scene.cameras.main;
      const width = camera.width / camera.zoom, height = camera.height / camera.zoom;
      return { x: Math.round((canvas.left + (bounds.x + 50 - (640 - width / 2)) * canvas.width / width) * devicePixelRatio), y: Math.round((canvas.top + (bounds.y + 50 - (360 - height / 2)) * canvas.height / height) * devicePixelRatio) };
    });
    const png = await page.screenshot({ path: testInfo.outputPath("hero-detail.png") });
    const contrast = await page.evaluate(async ({ png, point }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(point.x, point.y, 100, 1).data;
      return Array.from({ length: 99 }, (_, index) => Math.abs(pixels[index * 4]! - pixels[(index + 1) * 4]!)).reduce((sum, value) => sum + value, 0) / 99;
    }, { png: png.toString("base64"), point });
    expect(contrast, "one-pixel details must not be downsampled to gray").toBeGreaterThan(160);
  });
});

test.describe("home art", () => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }, { width: 1280, height: 720, canvas: true }]) {
    test(`hero art stays inside rounded corners at ${viewport.width}x${viewport.height}${"canvas" in viewport ? " using Canvas" : ""}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      if ("canvas" in viewport) await page.addInitScript(() => {
        const prototype = HTMLCanvasElement.prototype as any, original = prototype.getContext;
        prototype.getContext = function (type: string, ...options: any[]) {
          return type.includes("webgl") ? null : original.call(this, type, ...options);
        };
      });
      await page.addInitScript(() => localStorage.setItem("vongnguyet.combatSettings.v1", JSON.stringify({ reducedMotion: true, volume: 0 })));
      await openSignedIn(page, await registerAccount(), { fastPlayback: false });
      await expect.poll(() => homeArt(page).then(({ images }) => images.filter(({ key }) => key.startsWith("heroes:")).length)).toBe(3);
      await page.mouse.move(1, 1);
      const points: { corners: { x: number; y: number }[]; interior: { x: number; y: number }[] }[] = await page.evaluate(() => {
        const scene = (window as any).__vn.game.scene.getScene("deck-select");
        const hasHeroArt = (node: any): boolean => (node.type === "Image" && node.texture.key.startsWith("heroes:")) || !!node.list?.some(hasHeroArt);
        const cards = scene.root.list.filter(hasHeroArt);
        const canvas = scene.game.canvas.getBoundingClientRect(), camera = scene.cameras.main;
        const width = camera.width / camera.zoom, height = camera.height / camera.zoom;
        const point = (x: number, y: number) => ({ x: Math.floor(canvas.left + (x - (640 - width / 2)) * canvas.width / width), y: Math.floor(canvas.top + (y - (360 - height / 2)) * canvas.height / height) });
        return cards.map((card: any) => ({
          // Two pixels from the rectangle corners is outside the rounded frame's
          // antialiased border, so this detects art leakage rather than its stroke.
          corners: [[-98, -142], [98, -142], [-98, 142], [98, 142]].map(([dx, dy]) => point(card.x + dx!, card.y + dy!)),
          interior: [[0, -50], [-50, 0], [50, 20]].map(([dx, dy]) => point(card.x + dx!, card.y + dy!)),
        }));
      });
      expect(points).toHaveLength(3);
      const sample = async (png: Buffer) => page.evaluate(async ({ png, points }) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const pixel = ({ x, y }: { x: number; y: number }) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3);
        return points.map(({ corners, interior }) => ({ corners: corners.map(pixel), interior: interior.map(pixel) }));
      }, { png: png.toString("base64"), points });
      const shown = await sample(await page.screenshot({ path: testInfo.outputPath(`home-rounded-${viewport.width}x${viewport.height}.png`) }));
      await page.evaluate(() => {
        const scene = (window as any).__vn.game.scene.getScene("deck-select");
        const hasHeroArt = (node: any): boolean => (node.type === "Image" && node.texture.key.startsWith("heroes:")) || !!node.list?.some(hasHeroArt);
        scene.root.list.filter(hasHeroArt).forEach((card: any) => card.setVisible(false));
      });
      const background = await sample(await page.screenshot());
      const delta = (a: number[], b: number[]) => Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));
      shown.forEach((card, index) => {
        card.corners.forEach((pixel, corner) => expect(delta(pixel, background[index]!.corners[corner]!), `Hero ${index + 1}, corner ${corner + 1} leaks art`).toBeLessThanOrEqual(3));
        expect(Math.max(...card.interior.map((pixel, point) => delta(pixel, background[index]!.interior[point]!))), `Hero ${index + 1} art remains visible`).toBeGreaterThan(30);
      });
    });
  }

  for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`new art covers the viewport and keeps mode labels at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const account = await registerAccount();
      await openSignedIn(page, account);
      await expect.poll(() => homeArt(page).then(({ images }) => images.map((image) => image.key))).toEqual(expect.arrayContaining([
        "backgrounds:home", ...HOME_MODES.map((mode) => `ui:mode_${mode}`), "ui:rank_dong_sinh",
      ]));
      const { images, view } = await homeArt(page);
      const bg = images.find((image) => image.key === "backgrounds:home")!;
      expect(bg.x).toBeLessThanOrEqual(view.x + 0.01);
      expect(bg.y).toBeLessThanOrEqual(view.y + 0.01);
      expect(bg.x + bg.w).toBeGreaterThanOrEqual(view.x + view.w - 0.01);
      expect(bg.y + bg.h).toBeGreaterThanOrEqual(view.y + view.h - 0.01);
      expect(bg.w / bg.h).toBeCloseTo(16 / 9, 2);
      expect(await homeTexts(page)).toEqual(expect.arrayContaining(["Đấu Trường", "Tầm Nguyệt", "Liên Thủ", "Cốt Truyện"]));
      await page.screenshot({ path: testInfo.outputPath(`home-art-${viewport.width}x${viewport.height}.png`) });
    });
  }

  test("every rank tier uses its own delivered emblem", async ({ page }) => {
    const account = await registerAccount();
    let tier = HOME_TIERS[0]!;
    await page.route("**/api/arena/me", (route) => route.fulfill({
      json: { arena: { rating: 1600, wins: 0, losses: 0 }, tier: { id: tier, name: tier } },
    }));
    await openSignedIn(page, account);
    for (const id of HOME_TIERS) {
      tier = id;
      if (id !== HOME_TIERS[0]) {
        await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.restart());
        await waitForScene(page, "deck-select");
      }
      await expect.poll(() => homeArt(page).then(({ images }) => images.filter((image) => image.key.startsWith("ui:rank_")).map((image) => image.key))).toEqual([`ui:rank_${id}`]);
    }
  });

  test("blocked new files retain old background and glyph fallback without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/\/assets\/(?:backgrounds\/home|ui\/(?:mode_|rank_)[^/]+)\.webp(?:\?.*)?$/, (route) => route.abort());
    const account = await registerAccount();
    await openSignedIn(page, account);
    await expect.poll(() => homeArt(page).then(({ images }) => images.map((image) => image.key))).toEqual(expect.arrayContaining([
      "backgrounds:background", "ui:node_combat", "ui:moon_waxingCrescent", "ui:nav_exchange", "ui:nav_history", "ui:seal",
    ]));
    const { images } = await homeArt(page);
    expect(images.some((image) => /^(backgrounds:home|ui:mode_|ui:rank_)/.test(image.key))).toBe(false);
    expect(errors).toEqual([]);
    await clickSceneText(page, "deck-select", "Cốt Truyện");
    await waitForScene(page, "story");
  });
});

/** The id a lobby scene has picked (-1 = none; lobbies never auto-pick). */
function lobbyDeckId(page: Page, sceneKey: "arena" | "coop-lobby"): Promise<string | null> {
  return page.evaluate((key) => {
    const vn = (window as any).__vn;
    const scene = vn.game.scene.getScene(key) as any;
    return vn.session.profile.decks[scene.deckIndex]?.id ?? null;
  }, sceneKey);
}

test.describe("deck selection survives navigation", () => {
  test("chosen deck persists through Home, gacha and both lobbies", async ({ page }) => {
    const account = await registerAccount();
    const d2 = await saveDeck(account, "Núi Tuyết", ["m05", "f03", "f02"]);
    await openSignedIn(page, account);

    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Núi Tuyết"));
    await clickText(page, "deck-select", (t) => t === "Dùng bộ bài này");
    await expect.poll(() => selectedDeckId(page)).toBe(d2);

    // Away to gacha and back: the selection is session state, not scene state.
    await clickText(page, "deck-select", (t) => t === "Triệu Hồi");
    await waitForScene(page, "gacha", 15_000);
    await clickDesign(page, 52, 42); // gacha's back icon
    await waitForScene(page, "deck-select", 15_000);
    expect(await selectedDeckId(page)).toBe(d2);

    await clickSceneText(page, "deck-select", "Đấu Trường");
    await waitForScene(page, "arena", 15_000);
    expect(await lobbyDeckId(page, "arena")).toBe(d2);
    await expect.poll(() => sceneTexts(page, "arena").then((texts) => texts.some((t) => t === "Núi Tuyết"))).toBe(true);

    await clickArenaAction(page, "arena_back");
    await waitForScene(page, "deck-select", 15_000);
    await clickSceneText(page, "deck-select", "Liên Thủ");
    await waitForScene(page, "coop-lobby", 15_000);
    expect(await lobbyDeckId(page, "coop-lobby")).toBe(d2);
  });

  test("starter selection locks lobby match actions until a saved deck is picked", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    // Fresh session: nothing picked — Home resolves to the team's "Bộ cơ bản".
    expect(await selectedDeckId(page)).toBeNull();

    await clickSceneText(page, "deck-select", "Đấu Trường");
    await waitForScene(page, "arena", 15_000);
    expect(await lobbyDeckId(page, "arena")).toBeNull();
    await expect.poll(() => sceneTexts(page, "arena").then((texts) => texts.includes("Chọn bộ bài đã lưu để xuất trận"))).toBe(true);

    // Picking a row in the lobby writes back into the shared selection.
    await selectArenaDeck(page, "E2E");
    expect(await lobbyDeckId(page, "arena")).toBe("d1");
    expect(await selectedDeckId(page)).toBe("d1");
  });

  test("saving a copy selects the id the server returned", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t === "Sao chép & sửa");
    await waitForScene(page, "deck-builder", 15_000);
    await clickText(page, "deck-builder", (t) => t === "Lưu và dùng");
    await waitForScene(page, "deck-select", 15_000);
    const copyId = await page.evaluate(() => {
      const decks = (window as any).__vn.session.profile.decks as { id: string; name: string }[];
      return decks.find((deck) => deck.name.endsWith("(bản sao)"))?.id ?? null;
    });
    expect(copyId).not.toBeNull();
    expect(await selectedDeckId(page)).toBe(copyId);
  });

  test("logout and a new sign-in do not keep the old selection", async ({ page }) => {
    const account = await registerAccount();
    const d2 = await saveDeck(account, "Núi Tuyết");
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Núi Tuyết"));
    await clickText(page, "deck-select", (t) => t === "Dùng bộ bài này");
    await expect.poll(() => selectedDeckId(page)).toBe(d2);

    await clickDesign(page, 1240, 36); // Đăng xuất nav icon
    await waitForScene(page, "login", 15_000);
    expect(await selectedDeckId(page)).toBeNull();

    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(account.username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("trang-sang-8");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await waitForScene(page, "deck-select");
    expect(await selectedDeckId(page)).toBeNull();
    await expect.poll(() => activeSceneKey(page)).toBe("deck-select");
  });
});

test.describe("request lifecycle", () => {
  test("a held run request locks the board, and resolving it after shutdown goes nowhere", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await waitForScene(page, "deck-select");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    await page.route("**/api/runs", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      inFlight += 1;
      await gate;
      return route.continue();
    });
    try {
      await clickSceneText(page, "deck-select", "Tầm Nguyệt");
      // Task 3: the ticket POST only fires after the combat manifest has loaded.
      await expect.poll(() => inFlight, { timeout: 60_000 }).toBe(1);

      // Busy lockdown: every control is dead while the ticket request is out.
      await expect.poll(() => sceneTexts(page, "deck-select").then((texts) => texts.includes("Đang tạo lượt chơi…"))).toBe(true);
      await clickSceneText(page, "deck-select", "Đấu Trường");
      await clickSceneText(page, "deck-select", "Triệu Hồi");
      await clickSceneText(page, "deck-select", "Sao chép & sửa");
      await page.waitForTimeout(400);
      expect(await activeSceneKey(page)).toBe("deck-select");

      // Kill this run of the scene; the in-flight promise must die with it.
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.restart());
      await waitForScene(page, "deck-select");
      release();
      await page.waitForTimeout(800);
      expect(await activeSceneKey(page)).toBe("deck-select");
      expect(await page.evaluate(() => (window as any).__vn.session.ticket)).toBeNull();
      await expect.poll(() => sceneTexts(page, "deck-select").then((texts) => texts.some((t) => t.startsWith("Lỗi server")))).toBe(false);
    } finally {
      release();
      await page.unroute("**/api/runs");
    }
  });

  test("a rank response from a previous Home visit writes nothing", async ({ page }) => {
    const account = await registerAccount();
    let calls = 0;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    // Call 1 is the sign-in fetch inside `resumeSession` — holding it would
    // block the whole boot, so Home's own revalidation (call 2) is the held one.
    await page.route("**/api/arena/me", async (route) => {
      calls += 1;
      if (calls === 2) {
        await firstGate;
        return route.fulfill({
          status: 200,
          json: { arena: { rating: 7777, wins: 0, losses: 0 }, tier: { id: "trang_nguyen", name: "Trạng Nguyên" } },
        });
      }
      return route.continue();
    });
    try {
      await openSignedIn(page, account);
      await waitForScene(page, "deck-select");
      await expect.poll(() => calls).toBe(2);

      // Re-open Home: the third fetch is this run's; the held one belongs to a dead run.
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.restart());
      await waitForScene(page, "deck-select");
      await expect.poll(() => calls).toBe(3);
      await expect.poll(() => sceneTexts(page, "deck-select").then((texts) => texts.some((t) => t.includes("điểm")))).toBe(true);

      releaseFirst();
      await page.waitForTimeout(500);
      const texts = await sceneTexts(page, "deck-select");
      expect(texts.some((t) => t.includes("7777"))).toBe(false);
    } finally {
      releaseFirst();
      await page.unroute("**/api/arena/me");
    }
  });

  test("a save that resolves after logout does not select the old deck", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await waitForScene(page, "deck-select");
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t === "Sao chép & sửa");
    await waitForScene(page, "deck-builder");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    await page.route("**/api/profile/decks", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      inFlight += 1;
      await gate;
      return route.continue();
    });
    try {
      await clickText(page, "deck-builder", (t) => t === "Lưu và dùng");
      await expect.poll(() => inFlight).toBe(1);

      // External navigation invalidates the callback; normal Back is locked while saving.
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-builder").scene.start("deck-select"));
      await waitForScene(page, "deck-select");
      await clickDesign(page, 1240, 36);
      await waitForScene(page, "login", 15_000);
      expect(await selectedDeckId(page)).toBeNull();

      release();
      await page.waitForTimeout(800);
      expect(await selectedDeckId(page)).toBeNull();
    } finally {
      release();
      await page.unroute("**/api/profile/decks");
    }
  });

  test("a failed run request shows one error and the board unlocks for a retry", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await waitForScene(page, "deck-select");

    let calls = 0;
    await page.route("**/api/runs", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      calls += 1;
      if (calls === 1) return route.fulfill({ status: 500, json: { error: "boom" } });
      return route.continue();
    });
    try {
      await clickSceneText(page, "deck-select", "Tầm Nguyệt");
      // Task 3: the POST waits on the combat manifest — the error lands after the load.
      await expect
        .poll(() => sceneTexts(page, "deck-select").then((texts) => texts.filter((t) => t === "Lỗi server (boom)").length), { timeout: 60_000 })
        .toBe(1);
      await clickText(page, "deck-select", (t) => t === "Đóng");

      // Controls are back — a second click reaches the real server and enters the run map.
      await clickSceneText(page, "deck-select", "Tầm Nguyệt");
      await waitForScene(page, "run", 15_000);
    } finally {
      await page.unroute("**/api/runs");
    }
  });
});

const MATCH_START_TYPES = ["queue.join", "room.create", "room.join", "practice.start"];

/** Records every `net.send` type on the live session socket. */
async function spySends(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__sent = [] as string[];
    const net = w.__vn.session.net;
    const original = net.send.bind(net);
    net.send = (message: any) => {
      w.__sent.push(message.type);
      return original(message);
    };
  });
}

const sentTypes = (page: Page) => page.evaluate(() => ((window as any).__sent ?? []) as string[]);
const assetState = (page: Page, sceneKey: string) =>
  page.evaluate((key) => (window as any).__vn.game.scene.getScene(key)?.assetState, sceneKey);

test.describe("asset readiness", () => {
  for (const { scene, tile, queueLabel } of [
    { scene: "arena", tile: "Đấu Trường", queueLabel: "Tìm trận xếp hạng" },
    { scene: "coop-lobby", tile: "Liên Thủ", queueLabel: "Vào hàng chờ" },
  ] as const) {
    test(`${scene}: match-start sends wait for the combat manifest`, async ({ page }, testInfo) => {
      const account = await registerAccount();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let readySeen = false;
      let postReadyAssetRequests = 0;
      const assetBytes: Record<string, number> = {};
      page.on("request", (request) => {
        if (readySeen && request.url().includes("/assets/")) postReadyAssetRequests += 1;
      });
      page.on("response", (response) => {
        if (!response.url().includes("/assets/")) return;
        const length = Number(response.headers()["content-length"] ?? 0);
        if (length > 0) assetBytes[response.url().split("/").pop()!] = length;
      });
      await page.route("**/assets/cards/**", async (route) => {
        await gate;
        // A held request may already be settled when the gate opens.
        await route.continue().catch(() => {});
      });

      await openSignedIn(page, account);
      await clickSceneText(page, "deck-select", tile);
      await waitForScene(page, scene);
      await spySends(page);
      if (scene === "arena") await selectArenaDeck(page, "E2E");
      else await clickText(page, scene, (t) => t.startsWith("E2E")); // pick the seeded deck row

      // The gate is loading: every match-start control swallows its click.
      if (scene === "arena") {
        await clickArenaAction(page, "arena_ranked_start");
        await clickArenaAction(page, "arena_mode_private");
        await clickArenaAction(page, "arena_room_create");
        await page.fill("#vn-arena-room-code", "K7Q2MX");
        await clickArenaAction(page, "arena_room_join");
        await clickArenaAction(page, "arena_mode_practice");
        await clickArenaAction(page, "arena_practice_start");
        await clickArenaAction(page, "arena_mode_ranked");
      } else {
      await clickDesign(page, 400, 470); // queue button
      await clickDesign(page, 640, 470); // Tạo phòng riêng
      await clickDesign(page, 880, 470); // Vào phòng (mã)
      await clickDesign(page, 400, 518); // Đấu Tập
      }
      await page.waitForTimeout(400);
      const blocked = await sentTypes(page);
      expect(blocked.filter((type) => MATCH_START_TYPES.includes(type))).toHaveLength(0);

      const coldStart = Date.now();
      release();
      await expect.poll(() => assetState(page, scene), { timeout: 60_000 }).toBe("ready");
      const coldMs = Date.now() - coldStart;
      readySeen = true;

      // queue.join → Hủy tìm trận (queue.leave)
      await clickSceneText(page, scene, queueLabel);
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "queue.join").length).toBe(1);
      await clickSceneText(page, scene, "Hủy tìm trận");
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "queue.leave").length).toBe(1);

      // room.create → Rời phòng (room.leave)
      if (scene === "arena") { await clickArenaAction(page, "arena_mode_private"); await clickArenaAction(page, "arena_room_create"); }
      else await clickDesign(page, 640, 470);
      await expect.poll(() => page.evaluate(() => (window as any).__vn.session.roomCode)).not.toBeNull();
      if (scene === "arena") await clickArenaAction(page, "arena_room_leave");
      else await clickDesign(page, 880, 560);
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "room.leave").length).toBe(1);

      // room.join through the code modal (the code is wrong — the send is what counts).
      if (scene === "arena") {
        await page.fill("#vn-arena-room-code", "K7Q2MX");
        await page.press("#vn-arena-room-code", "Enter");
      } else {
        await clickDesign(page, 880, 470);
        await page.fill("#vn-modal-input", "K7Q2MX");
        await page.press("#vn-modal-input", "Enter");
      }
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "room.join").length).toBe(1);

      // practice.start → combat boots on already-cached textures.
      const warmStart = Date.now();
      if (scene === "arena") {
        await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").pending)).toBe(false);
        await clickArenaAction(page, "arena_mode_practice");
        await clickArenaAction(page, "arena_practice_start");
      } else await clickDesign(page, 400, 518);
      await waitForScene(page, "combat");
      const warmMs = Date.now() - warmStart;
      await page.waitForTimeout(800);
      const sent = await sentTypes(page);
      for (const type of MATCH_START_TYPES) {
        expect(sent.filter((t) => t === type)).toHaveLength(1);
      }
      expect(postReadyAssetRequests).toBe(0);
      const measurement = {
        scene,
        coldMs,
        warmMs,
        assetFiles: Object.keys(assetBytes).length,
        assetBytes: Object.values(assetBytes).reduce((sum, size) => sum + size, 0),
      };
      console.info("asset-readiness", measurement);
      await testInfo.attach("asset-readiness", { body: JSON.stringify(measurement) });
    });
  }

  test("arena: a failed texture blocks sends until retry succeeds", async ({ page }) => {
    const account = await registerAccount();
    let failCards = true;
    await page.route("**/assets/cards/**", async (route) => {
      if (failCards) return route.fulfill({ status: 404 });
      return route.continue();
    });
    await openSignedIn(page, account);
    await clickSceneText(page, "deck-select", "Đấu Trường");
    await waitForScene(page, "arena");
    await spySends(page);
    await selectArenaDeck(page, "E2E");

    await expect.poll(() => assetState(page, "arena"), { timeout: 60_000 }).toBe("error");
    await clickArenaAction(page, "arena_ranked_start"); // blocked by the error gate
    await page.waitForTimeout(300);
    expect((await sentTypes(page)).filter((type) => MATCH_START_TYPES.includes(type))).toHaveLength(0);

    failCards = false;
    await clickSceneText(page, "arena", "Thử lại");
    await expect.poll(() => assetState(page, "arena"), { timeout: 60_000 }).toBe("ready");
    await clickArenaAction(page, "arena_mode_practice");
    await clickArenaAction(page, "arena_practice_start");
    await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "practice.start").length).toBe(1);
    await waitForScene(page, "combat");
  });

  test("run and story ticket POSTs wait for the combat manifest", async ({ page }) => {
    const account = await registerAccount();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const posts: string[] = [];
    await page.route("**/assets/cards/**", async (route) => {
      await gate;
      await route.continue().catch(() => {});
    });
    await page.route("**/api/runs", async (route) => {
      if (route.request().method() === "POST") posts.push("runs");
      return route.continue();
    });
    await page.route("**/api/story/*/tickets", async (route) => {
      posts.push("story");
      return route.continue();
    });

    try {
      await openSignedIn(page, account);
      await clickSceneText(page, "deck-select", "Tầm Nguyệt");
      await page.waitForTimeout(600);
      expect(posts).toHaveLength(0);
      release();
      await expect.poll(() => posts, { timeout: 120_000 }).toEqual(["runs"]);
      await waitForScene(page, "run");
    } finally {
      release();
    }
  });

  test("story ticket POST waits for the combat manifest", async ({ page }) => {
    const account = await registerAccount();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let storyPosts = 0;
    await page.route("**/assets/cards/**", async (route) => {
      await gate;
      await route.continue().catch(() => {});
    });
    await page.route("**/api/story/*/tickets", async (route) => {
      storyPosts += 1;
      return route.continue();
    });
    try {
      await openSignedIn(page, account);
      await page.evaluate(() => {
        const handle = (window as any).__vn;
        handle.session.pendingStageId = "arc1_s01";
        handle.game.scene.getScene("deck-select").scene.restart();
      });
      await waitForScene(page, "deck-select");
      await clickSceneText(page, "deck-select", "Vào trận");
      await page.waitForTimeout(600);
      expect(storyPosts).toBe(0);
      release();
      await expect.poll(() => storyPosts, { timeout: 60_000 }).toBe(1);
      await waitForScene(page, "combat");
    } finally {
      release();
    }
  });
});

/** Bounds of the redesigned library's six portrait rows and primary footer. */
function overlayLayout(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("deck-select");
    if (!scene.deckOverlay) return null;
    const walk = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...(n.list ? walk(n.list) : [])]);
    const nodes = walk(scene.deckOverlay.list);
    const bounds = (n: any) => ({ top: n.getBounds().top, bottom: n.getBounds().bottom, left: n.getBounds().left, right: n.getBounds().right });
    return {
      rows: nodes.filter((n) => n.type === "Rectangle" && n.input && n.width === 424 && n.height === 60).map(bounds).sort((a, b) => a.top - b.top),
      arrows: nodes.filter((n) => n.type === "Rectangle" && n.input && n.width === 424 && n.height === 20).map(bounds),
      footer: bounds(nodes.find((n) => n.type === "Text" && n.text === "Dùng bộ bài này")),
      names: nodes.filter((n) => n.type === "Text" && n.style.fontSize === "16px").map((n) => ({ text: n.text, ...bounds(n) })),
    };
  });
}

test.describe("deck overlay layout", () => {
  const seedDecks = async () => {
    const account = await registerAccount();
    for (let i = 0; i < 29; i++) await saveDeck(account, `Deck Phụ ${i + 1}`);
    return account;
  };

  test("portrait rows, arrows and footer stay in separate regions", async ({ page }, testInfo) => {
    await openSignedIn(page, await seedDecks());
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await page.screenshot({ path: testInfo.outputPath("home-deck-overlay.png") });
    const snap = (await overlayLayout(page))!;
    expect(snap.rows).toHaveLength(6);
    const down = snap.arrows.find((a) => a.top > snap.rows.at(-1)!.bottom)!;
    expect(down.top - snap.rows.at(-1)!.bottom).toBeGreaterThanOrEqual(8);
    expect(snap.footer.top - down.bottom).toBeGreaterThanOrEqual(8);
    for (const name of snap.names) expect(name.right - name.left).toBeLessThanOrEqual(298);
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroller.scrollBy(99));
    const tail = (await overlayLayout(page))!;
    const up = tail.arrows.find((a) => a.top < tail.rows[0]!.top)!;
    expect(tail.rows[0]!.top - up.bottom).toBeGreaterThanOrEqual(8);
  });

  test("long row names reveal full content above the modal", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    const full = "WWWWWWWWWWWWWWWWWWWWWWWW";
    await page.evaluate((name) => { const h = (window as any).__vn; h.session.profile.decks[0].name = name; }, full);
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    const snap = (await overlayLayout(page))!;
    const name = snap.names.find((n) => n.text.startsWith("WWW"))!;
    expect(name.text).toMatch(/…$/);
    await moveDesign(page, (name.left + name.right) / 2, (name.top + name.bottom) / 2);
    await expect.poll(() => homeTexts(page).then((ts) => ts.some((text) => text.includes(full)))).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("deck-select");
      return s.navTooltip?.depth > s.deckOverlay.depth;
    })).toBe(true);
  });

  test("scrolling reaches the last row and deletion preserves the active deck", async ({ page }) => {
    await openSignedIn(page, await seedDecks());
    const before = await selectedDeckId(page);
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroller.scrollBy(99));
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(25);
    await clickText(page, "deck-select", (t) => t === "Deck Phụ 29");
    const lastId = await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").previewDeckId);
    expect(await selectedDeckId(page)).toBe(before);
    await clickText(page, "deck-select", (t) => t === "Thao tác khác");
    await clickText(page, "deck-select", (t) => t === "Xóa bộ bài…");
    await clickText(page, "deck-select", (t) => t === "Xóa bộ bài");
    await expect.poll(() => page.evaluate((id) => (window as any).__vn.session.profile.decks.some((d: any) => d.id === id), lastId)).toBe(false);
    expect(await selectedDeckId(page)).toBe(before);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(24);
  });

  test("Esc closes delete confirmation first; repeated opens retain one wheel listener", async ({ page }) => {
    await openSignedIn(page, await seedDecks());
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t === "Deck Phụ 1");
    await clickText(page, "deck-select", (t) => t === "Thao tác khác");
    await clickText(page, "deck-select", (t) => t === "Xóa bộ bài…");
    await expect.poll(() => homeTexts(page)).toContain("Xóa bộ bài");
    await page.keyboard.press("Escape");
    await expect.poll(() => homeTexts(page)).not.toContain("Xóa bộ bài");
    expect(await page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-select").deckOverlay)).toBe(true);
    await page.keyboard.press("Escape");
    for (let i = 0; i < 10; i++) { await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾"); await page.keyboard.press("Escape"); }
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await moveDesign(page, 300, 360);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(1);
    await moveDesign(page, 850, 360);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(1);
  });

  test("layout holds at the three target viewports", async ({ page }) => {
    await openSignedIn(page, await seedDecks());
    for (const size of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
      const snap = (await overlayLayout(page))!;
      expect(snap.rows).toHaveLength(6);
      expect(snap.footer.bottom).toBeLessThanOrEqual(720);
      expect(snap.rows[0]!.left).toBeGreaterThanOrEqual(100);
      expect(snap.rows.at(-1)!.bottom).toBeLessThan(snap.footer.top - 8);
      await page.keyboard.press("Escape");
    }
  });
});
test.describe("home acceptance", () => {
  /** Returns to Home from whichever scene a route landed on. */
  const backHome = async (page: Page) => {
    await page.evaluate(() => {
      (window as any).__vn.game.scene.getScenes(true)[0]!.scene.start("deck-select");
    });
    await waitForScene(page, "deck-select");
  };

  test("every mode tile and labeled footer route opens its scene", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);

    // Mode tiles by label — click lands inside the tile's hit rect.
    for (const [label, key] of [
      ["Đấu Trường", "arena"],
      ["Liên Thủ", "coop-lobby"],
      ["Cốt Truyện", "story"],
    ] as const) {
      await clickText(page, "deck-select", (t, arg) => t === arg, 15_000, label);
      await waitForScene(page, key);
      await backHome(page);
    }
    // Tầm Nguyệt goes through the asset gate before the run POST.
    await clickText(page, "deck-select", (t) => t === "Tầm Nguyệt");
    await waitForScene(page, "run", 90_000);
    await backHome(page);

    for (const [label, key] of [
      ["Triệu Hồi", "gacha"],
      ["Hero", "heroes"],
      ["Kho Đồ", "armory"],
      ["Nhiệm Vụ", "missions"],
      ["Tu Luyện", "mastery"],
    ] as const) {
      await clickText(page, "deck-select", (t, arg) => t === arg, 15_000, label);
      await waitForScene(page, key);
      await backHome(page);
    }
  });

  test("offline shows disabled reasons; an invalid deck locks Tầm Nguyệt", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);

    // Offline render: every action is gated with a visible reason.
    await page.evaluate(() => {
      const s = (window as any).__vn.session;
      s.online = false;
      (window as any).__vn.game.scene.getScene("deck-select").render();
    });
    await expect
      .poll(() => homeTexts(page).then((ts) => ts.includes("Offline — mọi chế độ cần kết nối server")))
      .toBe(true);
    await moveDesign(page, 234, 120); // Đấu Trường tile
    await expect
      .poll(() => homeTexts(page).then((ts) => ts.some((t) => t.includes("Cần đăng nhập và kết nối server"))))
      .toBe(true);

    // Back online, select an invalid deck: the run tile reports the deck error.
    await page.evaluate(() => {
      const s = (window as any).__vn.session;
      const team = s.profile.decks[0].heroIds;
      const foreign = Object.values(s.data.heroes)
        .filter((h: any) => !team.includes(h.id))
        .flatMap((h: any) => h.cardIds);
      s.online = true;
      s.profile.decks.push({
        id: "broken",
        name: "WWWWWWWWWWWWWWWWWWWWWWWW",
        heroIds: [...team],
        cardIds: foreign.slice(0, s.data.metaConfig.deckSize),
      });
      s.selectedDeckId = "broken";
      (window as any).__vn.game.scene.getScene("deck-select").render();
    });
    await moveDesign(page, 234, 338); // Tầm Nguyệt tile
    await expect
      .poll(() => homeTexts(page).then((ts) => ts.some((t) => t.includes("Lá không thuộc đội"))))
      .toBe(true);
    const bounds = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select");
      const flatten = (nodes: any[]): any[] => nodes.flatMap((node: any) => [node, ...(Array.isArray(node.list) ? flatten(node.list) : [])]);
      const nodes = flatten(scene.root.list);
      const find = (prefix: string) => nodes.find((node: any) => node.type === "Text" && node.text.startsWith(prefix));
      const name = find("WWW");
      const change = find("Đổi bộ bài");
      const error = nodes.find((node: any) => node.type === "Text" && node.text.startsWith("⚠") && node.text !== "⚠ Cần chỉnh sửa");
      return { name: name.text as string, nameRight: name.getBounds().right, changeLeft: change.getBounds().left, errorBottom: error.getBounds().bottom };
    });
    expect(bounds.name).toMatch(/…$/);
    expect(bounds.nameRight + 8).toBeLessThanOrEqual(bounds.changeLeft);
    expect(bounds.errorBottom).toBeLessThanOrEqual(606);
  });

  test("starter copy opens a fresh draft; the picker keeps pick order and skips locked heroes", async ({ page }, testInfo) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    const deckCount = await page.evaluate(() => (window as any).__vn.session.profile.decks.length);

    // "Bộ cơ bản" is virtual: Sao chép opens the editor on a new draft, not the starter.
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Bộ cơ bản"));
    await clickText(page, "deck-select", (t) => t === "Sao chép & sửa");
    await waitForScene(page, "deck-builder");
    const draft = await page.evaluate(() => (window as any).__vn.session.editingDeck);
    expect(draft.id).toBe("");
    expect(draft.name).toContain("bản sao");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.decks.length)).toBe(deckCount);
    await backHome(page);

    // Team picker: the current team is preseeded; pick order is slot order and
    // locked heroes never enter `picked`. Fresh accounts own only the starter
    // trio, so order is proven by deselect + re-pick landing at the tail.
    await clickText(page, "deck-select", (t) => t === "Đổi bộ bài ▾");
    await clickText(page, "deck-select", (t) => t === "Bộ bài mới");
    await expect.poll(() => homeTexts(page).then((ts) => ts.includes("Bộ bài mới — chọn 3 Hero"))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("home-hero-picker.png") });
    const picker = await page.evaluate(() => {
      const s = (window as any).__vn.session;
      const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
      const locked = (Object.values(s.data.heroes) as any[]).find((h) => s.profile.heroes[h.id] === undefined);
      return {
        picked: [...scene.picked] as string[],
        names: (scene.picked as string[]).map((id) => s.data.heroes[id]?.name),
        lockedName: locked?.name as string,
      };
    });
    const pickedIds = () => page.evaluate(() => [...(window as any).__vn.game.scene.getScene("deck-select").picked]);
    await clickText(page, "deck-select", (t, arg) => t === arg, 15_000, picker.lockedName);
    await page.waitForTimeout(150);
    expect(await pickedIds()).toEqual(picker.picked);
    await clickText(page, "deck-select", (t, arg) => t === arg, 15_000, picker.names[0]);
    await expect.poll(pickedIds).toEqual([picker.picked[1], picker.picked[2]]);
    await clickText(page, "deck-select", (t, arg) => t === arg, 15_000, picker.names[0]);
    const reordered = [picker.picked[1], picker.picked[2], picker.picked[0]];
    await expect.poll(pickedIds).toEqual(reordered);

    await clickText(page, "deck-select", (t) => t === "Tạo bộ bài");
    await waitForScene(page, "deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.heroIds)).toEqual(reordered);
  });

  test("a pending story stage overrides Home; Hủy returns to the story map", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    const stage = await page.evaluate(() => {
      const s = (window as any).__vn.session;
      const id = Object.keys(s.data.storyStages).sort()[0]!;
      s.pendingStageId = id;
      (window as any).__vn.game.scene.getScene("deck-select").render();
      return s.data.storyStages[id].name;
    });
    await expect.poll(() => homeTexts(page).then((ts) => ts.includes(stage))).toBe(true);
    await expect.poll(() => homeTexts(page).then((ts) => ts.includes("Vào trận"))).toBe(true);
    await clickText(page, "deck-select", (t) => t === "Hủy");
    await waitForScene(page, "story");
    expect(await page.evaluate(() => (window as any).__vn.session.pendingStageId)).toBeNull();
  });

  test("missing art falls back to glyphs; a rank failure retries instead of showing a fake rating", async ({ page }) => {
    const account = await registerAccount();
    let rankCalls = 0;
    // Calls 1–2 fail: the sign-in fetch inside `resumeSession` and Home's own
    // revalidation — the retry button then issues call 3 against the real server.
    await page.route("**/api/arena/me", (route) => {
      rankCalls += 1;
      if (rankCalls <= 2) void route.fulfill({ status: 500, body: "{}" });
      else void route.continue();
    });
    await page.route("**/assets/**", (route) => void route.abort());
    await openSignedIn(page, account);

    // No mode icon textures → the ▣ glyph on every tile; no hero art → ❖ plates.
    await expect.poll(() => homeTexts(page).then((ts) => ts.filter((t) => t === "▣").length)).toBeGreaterThanOrEqual(4);
    await expect.poll(() => homeTexts(page).then((ts) => ts.filter((t) => t === "❖").length)).toBeGreaterThanOrEqual(3);
    // Rank failed: the retry state shows, and no "0 điểm" masquerades as a rating.
    await expect.poll(() => homeTexts(page).then((ts) => ts.includes("Không tải được xếp hạng"))).toBe(true);
    expect((await homeTexts(page)).some((t) => /điểm$/.test(t))).toBe(false);

    await clickText(page, "deck-select", (t) => t === "Thử lại");
    await expect.poll(() => homeTexts(page).then((ts) => ts.some((t) => /điểm$/.test(t)))).toBe(true);
    expect(await activeSceneKey(page)).toBe("deck-select");
    expect(rankCalls).toBe(3);
  });
});
