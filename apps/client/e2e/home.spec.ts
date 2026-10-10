import { expect, test, type Page } from "@playwright/test";
import { activeSceneKey, clickDesign, clickSceneText, sceneTexts, waitForScene } from "./helpers/combat";
import { openSignedIn, registerAccount, saveDeck } from "./helpers/online";

/**
 * Home (`deck-select`) acceptance specs for the home-ui-redesign plan. Canvas
 * UI is not DOM-readable: canvas texts are found by walking the live scene's
 * display list through `window.__vn`, like the combat helpers do.
 */

const selectedDeckId = (page: Page) => page.evaluate(() => (window as any).__vn.session.selectedDeckId);

/** Finds a Text anywhere under the scene (root, overlay layers, modals) and clicks it. `arg` reaches the predicate as its second parameter. */
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
          if (node.type === "Text" && typeof node.text === "string" && matches(node.text, predicateArg)) found = node;
          else if (Array.isArray(node.list)) walk(node.list);
        }
      };
      walk(scene.children.list);
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

test.describe("home hierarchy", () => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`mode, rank, deck and labeled footer fit at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const account = await registerAccount();
      await openSignedIn(page, account);
      await expect.poll(() => homeTexts(page)).toEqual(expect.arrayContaining([
        "Triệu Hồi", "Hero", "Kho Đồ", "Nhiệm Vụ", "Tu Luyện", "Đội hình xuất trận", "Chỉnh sửa",
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
      const edit = layout.texts["Chỉnh sửa"].bounds;
      expect(layout.texts["Đội hình xuất trận"].bounds.right + 8).toBeLessThan(edit.left);
      await page.screenshot({ path: testInfo.outputPath(`home-hierarchy-${viewport.width}x${viewport.height}.png`) });
    });
  }

  test("explicit edit opens the selected saved deck; starter edit creates a copy", async ({ page }) => {
    const account = await registerAccount();
    const name = "Đội hình Ánh Trăng";
    const id = await saveDeck(account, name);
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (text) => text === "Đổi deck ▾");
    await clickText(page, "deck-select", (text, arg) => text.startsWith(arg), 15_000, name);
    await clickText(page, "deck-select", (text) => text === "Chọn deck này ▸");
    expect(await homeTexts(page)).toContain(name);
    await clickText(page, "deck-select", (text) => text === "Chỉnh sửa");
    await waitForScene(page, "deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe(id);
    await clickText(page, "deck-builder", (text) => text === "◂ Chọn deck");
    await waitForScene(page, "deck-select");
    await clickText(page, "deck-select", (text) => text === "Đổi deck ▾");
    await clickText(page, "deck-select", (text) => text.startsWith("Bộ cơ bản"));
    await clickText(page, "deck-select", (text) => text === "Chọn deck này ▸");
    const before = await page.evaluate(() => (window as any).__vn.session.profile.decks.length);
    await clickText(page, "deck-select", (text) => text === "Chỉnh sửa");
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

test.describe("home art", () => {
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
    const d2 = await saveDeck(account, "Núi Tuyết", ["m07", "f01", "m02"]);
    await openSignedIn(page, account);

    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Núi Tuyết"));
    await expect.poll(() => selectedDeckId(page)).toBe(d2);
    await clickText(page, "deck-select", (t) => t === "Chọn deck này ▸");

    // Away to gacha and back: the selection is session state, not scene state.
    await clickText(page, "deck-select", (t) => t === "Triệu Hồi");
    await waitForScene(page, "gacha", 15_000);
    await clickDesign(page, 52, 42); // gacha's back icon
    await waitForScene(page, "deck-select", 15_000);
    expect(await selectedDeckId(page)).toBe(d2);

    await clickSceneText(page, "deck-select", "Đấu Trường");
    await waitForScene(page, "arena", 15_000);
    expect(await lobbyDeckId(page, "arena")).toBe(d2);
    await expect.poll(() => sceneTexts(page, "arena").then((texts) => texts.some((t) => t.startsWith("◉ Núi Tuyết")))).toBe(true);

    await clickDesign(page, 90, 30);
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
    await expect.poll(() => sceneTexts(page, "arena").then((texts) => texts.includes("Chọn deck đã lưu để xuất trận"))).toBe(true);

    // Picking a row in the lobby writes back into the shared selection.
    await clickText(page, "arena", (t) => t.startsWith("E2E"));
    expect(await lobbyDeckId(page, "arena")).toBe("d1");
    expect(await selectedDeckId(page)).toBe("d1");
  });

  test("saving a copy selects the id the server returned", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t === "Sao chép");
    await waitForScene(page, "deck-builder", 15_000);
    await clickText(page, "deck-builder", (t) => t === "Lưu");
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
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Núi Tuyết"));
    await expect.poll(() => selectedDeckId(page)).toBe(d2);
    await clickText(page, "deck-select", (t) => t === "Chọn deck này ▸");

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
      await expect.poll(() => sceneTexts(page, "deck-select").then((texts) => texts.includes("Đang chuẩn bị…"))).toBe(true);
      await clickSceneText(page, "deck-select", "Đấu Trường");
      await clickSceneText(page, "deck-select", "Triệu Hồi");
      await clickSceneText(page, "deck-select", "Chỉnh sửa");
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
    await page.route("**/api/arena/me", async (route) => {
      calls += 1;
      if (calls === 1) {
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
      await expect.poll(() => calls).toBe(1);

      // Re-open Home: the second fetch is this run's; the held one belongs to a dead run.
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.restart());
      await waitForScene(page, "deck-select");
      await expect.poll(() => calls).toBe(2);
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
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t === "Sao chép");
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
      await clickText(page, "deck-builder", (t) => t === "Lưu");
      await expect.poll(() => inFlight).toBe(1);

      // Leave the editor, then sign out: both the scene run and the account die.
      await clickText(page, "deck-builder", (t) => t === "◂ Chọn deck");
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
    { scene: "arena", tile: "Đấu Trường", queueLabel: "Xếp hạng" },
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
      await clickText(page, scene, (t) => t.startsWith("E2E")); // pick the seeded deck row

      // The gate is loading: every match-start control swallows its click.
      await clickDesign(page, 400, 470); // queue button
      await clickDesign(page, 640, 470); // Tạo phòng riêng
      await clickDesign(page, 880, 470); // Vào phòng (mã)
      await clickDesign(page, 400, 518); // Đấu Tập
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
      await clickDesign(page, 640, 470);
      await expect.poll(() => page.evaluate(() => (window as any).__vn.session.roomCode)).not.toBeNull();
      await clickDesign(page, 880, 560);
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "room.leave").length).toBe(1);

      // room.join through the code modal (the code is wrong — the send is what counts).
      await clickDesign(page, 880, 470);
      await page.fill("#vn-modal-input", "K7Q2MX");
      await page.press("#vn-modal-input", "Enter");
      await expect.poll(async () => (await sentTypes(page)).filter((type) => type === "room.join").length).toBe(1);

      // practice.start → combat boots on already-cached textures.
      const warmStart = Date.now();
      await clickDesign(page, 400, 518);
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
    await clickText(page, "arena", (t) => t.startsWith("E2E"));

    await expect.poll(() => assetState(page, "arena"), { timeout: 60_000 }).toBe("error");
    await clickDesign(page, 400, 470); // Xếp hạng — blocked by the error gate
    await page.waitForTimeout(300);
    expect((await sentTypes(page)).filter((type) => MATCH_START_TYPES.includes(type))).toHaveLength(0);

    failCards = false;
    await clickSceneText(page, "arena", "Thử lại");
    await expect.poll(() => assetState(page, "arena"), { timeout: 60_000 }).toBe("ready");
    await clickDesign(page, 400, 518); // Đấu Tập (máy)
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
      await expect.poll(() => posts, { timeout: 60_000 }).toEqual(["runs"]);
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

/** Layout snapshot of the deck overlay: bounds of arrows, rows, footer and text columns (design coords). */
function overlayLayout(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
    const layer = scene?.deckOverlay;
    if (!layer) return null;
    const arrows: { top: number; bottom: number }[] = [];
    const rows: { top: number; bottom: number }[] = [];
    const footers: { top: number }[] = [];
    const descs: { text: string; left: number; right: number; centerY: number }[] = [];
    const statuses: { text: string; left: number; right: number; centerY: number }[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes ?? []) {
        const b = node.getBounds?.();
        if (node.type === "Rectangle" && node.width === 920 && node.height === 24) arrows.push({ top: b.top, bottom: b.bottom });
        else if (node.type === "Rectangle" && node.width === 920 && node.height === 32) rows.push({ top: b.top, bottom: b.bottom });
        else if (node.type === "Rectangle" && node.height === 34) footers.push({ top: b.top });
        else if (node.type === "Text" && typeof node.text === "string" && node.originX === 0) {
          const cell = { text: node.text, left: b.left, right: b.right, centerY: b.centerY };
          if (node.text.startsWith("⚠") || node.text === "✓") statuses.push(cell);
          else descs.push(cell);
        }
        if (Array.isArray(node.list)) walk(node.list);
      }
    };
    walk(layer.list ? [layer] : []);
    return {
      scroll: scene.overlayScroll,
      arrows: arrows.sort((a, b) => a.top - b.top),
      rows: rows.sort((a, b) => a.top - b.top),
      footerTop: footers.length ? Math.min(...footers.map((f) => f.top)) : null,
      descs,
      statuses,
    };
  });
}

test.describe("deck overlay layout", () => {
  const seedDecks = async () => {
    const account = await registerAccount();
    for (let i = 0; i < 11; i++) await saveDeck(account, `Deck Phụ ${i + 1}`);
    return account;
  };

  /** Opens the overlay after pushing one fake broken deck (the server never ships invalid decks). */
  const openOverlayWithBrokenDeck = async (page: Page, account: { token: string }) => {
    await openSignedIn(page, account);
    await page.evaluate(() => {
      const s = (window as any).__vn.session;
      const team = s.profile.decks[0].heroIds;
      const foreign = Object.values(s.data.heroes)
        .filter((h: any) => !team.includes(h.id))
        .flatMap((h: any) => h.cardIds);
      // An unknown card id renders as-is in "Lá không thuộc đội: …" — a long id
      // makes the error deterministically wider than the status column.
      const fakeId = `la_gia_khong_ton_tai_${"x".repeat(60)}`;
      s.profile.decks.push({
        id: "broken",
        name: "Deck Lỗi Với Tên Siêu Dài Để Kiểm Tra Cột Chữ",
        heroIds: [...team],
        cardIds: [fakeId, ...foreign.slice(0, s.data.metaConfig.deckSize - 1)],
      });
    });
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
  };

  test("columns, arrows and footer keep ≥8px gaps; long text stays in its column", async ({ page }) => {
    const account = await seedDecks();
    await openOverlayWithBrokenDeck(page, account);

    const layout = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
      return { scroll: scene.overlayScroll };
    });
    expect(layout.scroll).toBe(0);
    const snap = (await overlayLayout(page))!;
    expect(snap).not.toBeNull();

    // ▼ below the last row, footer below ▼ — every seam ≥8px.
    expect(snap.rows).toHaveLength(11);
    const down = snap.arrows.find((a) => a.top > snap.rows[0]!.top)!;
    expect(down).toBeDefined();
    expect(down.top - snap.rows.at(-1)!.bottom).toBeGreaterThanOrEqual(8);
    expect(snap.footerTop! - down.bottom).toBeGreaterThanOrEqual(8);

    // Text columns: description ≤600 wide, status ≤276, and no overlap within a row.
    for (const desc of snap.descs) {
      expect(desc.right - desc.left).toBeLessThanOrEqual(602);
      const status = snap.statuses.find((s) => Math.abs(s.centerY - desc.centerY) < 4);
      if (status) expect(desc.right).toBeLessThanOrEqual(status.left);
    }
    for (const status of snap.statuses) {
      expect(status.right - status.left).toBeLessThanOrEqual(278);
    }

    // At max scroll: ▲ sits ≥8px above the first row, and the broken deck's
    // long error is truncated in its column (the tooltip holds the full text).
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroller?.scrollBy?.(99));
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBeGreaterThan(0);
    const tail = (await overlayLayout(page))!;
    const up = tail.arrows.find((a) => a.top < tail.rows[0]!.top)!;
    expect(up).toBeDefined();
    expect(tail.rows[0]!.top - up.bottom).toBeGreaterThanOrEqual(8);
    const broken = tail.statuses.find((s) => s.text.startsWith("⚠"))!;
    expect(broken.text).toContain("…");
  });

  test("long texts reveal their full content in the tooltip", async ({ page }) => {
    const account = await seedDecks();
    await openOverlayWithBrokenDeck(page, account);

    // Hover the broken row (last row needs scrolling to the end first).
    await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
      scene.overlayScroller?.scrollBy?.(99);
    });
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select")?.overlayScroll)).toBeGreaterThan(0);
    const snap = (await overlayLayout(page))!;
    const lastRow = snap.rows.at(-1)!;
    await page.mouse.move(0, 0);
    // Move to the status column of the last row.
    const statusCol = await page.evaluate((top) => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
      const world = scene.cameras.main.getWorldPoint(0, 0);
      return { y: (top + 16), width: world.x };
    }, lastRow.top);
    const box = await page.locator("canvas").boundingBox();
    const scale = Math.min(box!.width / 1280, box!.height / 720);
    const left = box!.x + (box!.width - 1280 * scale) / 2;
    const top = box!.y + (box!.height - 720 * scale) / 2;
    await page.mouse.move(left + 300 * scale, top + statusCol.y * scale);
    await expect.poll(() => sceneTexts(page, "deck-select").then((ts) => ts.some((t) => t.includes("Lá không thuộc đội") && !t.endsWith("…")))).toBe(true);
    // Text-node presence is not enough — the tooltip must outdraw the overlay
    // scrim (depth 900) or the player sees nothing under the dimmed screen.
    const depths = await page.evaluate(() => {
      const scene = (window as any).__vn.game.scene.getScene("deck-select") as any;
      return { tooltip: scene.navTooltip?.depth ?? -1, overlay: scene.deckOverlay?.depth ?? -1 };
    });
    expect(depths.overlay).toBeGreaterThanOrEqual(0);
    expect(depths.tooltip).toBeGreaterThan(depths.overlay);
  });

  test("scrolling reaches the last row; deleting it clamps the scroll", async ({ page }) => {
    const account = await seedDecks();
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    // 13 rows (1 starter + 12 saved) → 2 hidden.
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroller?.scrollBy?.(99));
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(2);
    // The last row is the newest saved deck — select then delete it.
    await clickText(page, "deck-select", (t) => t === "Deck Phụ 11  ·  " || t.startsWith("Deck Phụ 11"), 15_000);
    const lastId = await page.evaluate(() => (window as any).__vn.session.selectedDeckId);
    expect(lastId).not.toBeNull();
    await clickText(page, "deck-select", (t) => t === "Xóa");
    await clickText(page, "deck-select", (t) => t === "Xóa deck");
    // Deleting the selected deck resolves selection to the first starter row.
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.session.selectedDeckId)).toMatch(/^starter:/);
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.session.selectedDeckId)).not.toBe(lastId);
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(1);
  });

  test("Esc closes the delete modal before the overlay; one wheel event scrolls once", async ({ page }) => {
    const account = await seedDecks();
    await openSignedIn(page, account);
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    // The default selection is the starter row — pick a saved deck so "Xóa" is enabled.
    await clickText(page, "deck-select", (t) => t.startsWith("Deck Phụ 1  ·"));
    await clickText(page, "deck-select", (t) => t === "Xóa");
    await expect.poll(() => sceneTexts(page, "deck-select").then((ts) => ts.includes("Xóa deck"))).toBe(true);
    await page.keyboard.press("Escape");
    // Modal closed, overlay survives.
    await expect.poll(() => sceneTexts(page, "deck-select").then((ts) => ts.includes("Xóa deck"))).toBe(false);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").deckOverlay !== null)).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").deckOverlay)).toBeNull();

    // Ten open/close cycles — then exactly one row of scroll per wheel event.
    for (let i = 0; i < 10; i++) {
      await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
      await page.keyboard.press("Escape");
    }
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    const box = await page.locator("canvas").boundingBox();
    const scale = Math.min(box!.width / 1280, box!.height / 720);
    const left = box!.x + (box!.width - 1280 * scale) / 2;
    const top = box!.y + (box!.height - 720 * scale) / 2;
    await page.mouse.move(left + 640 * scale, top + 360 * scale); // inside the list region
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(1);
    // Outside the list region — the wheel must not scroll.
    await page.mouse.move(left + 640 * scale, top + 60 * scale);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").overlayScroll)).toBe(1);
  });

  test("layout holds at 1280x720, 1280x900 and 1920x1080", async ({ page }) => {
    const account = await seedDecks();
    await openSignedIn(page, account);
    for (const size of [{ w: 1280, h: 720 }, { w: 1280, h: 900 }, { w: 1920, h: 1080 }]) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
      const snap = (await overlayLayout(page))!;
      expect(snap.rows).toHaveLength(11);
      const down = snap.arrows.find((a) => a.top > snap.rows[0]!.top)!;
      expect(down.top - snap.rows.at(-1)!.bottom).toBeGreaterThanOrEqual(8);
      expect(snap.footerTop! - down.bottom).toBeGreaterThanOrEqual(8);
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
      const nodes = scene.root.list;
      const find = (prefix: string) => nodes.find((node: any) => node.type === "Text" && node.text.startsWith(prefix));
      const name = find("WWW");
      const change = find("Đổi deck");
      const error = find("⚠");
      return { name: name.text as string, nameRight: name.getBounds().right, changeLeft: change.getBounds().left, errorBottom: error.getBounds().bottom };
    });
    expect(bounds.name).toMatch(/…$/);
    expect(bounds.nameRight + 8).toBeLessThanOrEqual(bounds.changeLeft);
    expect(bounds.errorBottom).toBeLessThanOrEqual(606);
  });

  test("starter copy opens a fresh draft; the picker keeps pick order and skips locked heroes", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    const deckCount = await page.evaluate(() => (window as any).__vn.session.profile.decks.length);

    // "Bộ cơ bản" is virtual: Sao chép opens the editor on a new draft, not the starter.
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t.startsWith("Bộ cơ bản"));
    await clickText(page, "deck-select", (t) => t === "Sao chép");
    await waitForScene(page, "deck-builder");
    const draft = await page.evaluate(() => (window as any).__vn.session.editingDeck);
    expect(draft.id).toBe("");
    expect(draft.name).toContain("bản sao");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.decks.length)).toBe(deckCount);
    await backHome(page);

    // Team picker: the current team is preseeded; pick order is slot order and
    // locked heroes never enter `picked`. Fresh accounts own only the starter
    // trio, so order is proven by deselect + re-pick landing at the tail.
    await clickText(page, "deck-select", (t) => t === "Đổi deck ▾");
    await clickText(page, "deck-select", (t) => t === "Deck mới");
    await expect.poll(() => homeTexts(page).then((ts) => ts.includes("Deck mới — chọn 3 Hero"))).toBe(true);
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

    await clickText(page, "deck-select", (t) => t === "Tạo deck");
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
    await page.route("**/api/arena/me", (route) => {
      rankCalls += 1;
      if (rankCalls === 1) void route.fulfill({ status: 500, body: "{}" });
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
    expect(rankCalls).toBe(2);
  });
});
