import { expect, test, type Page } from "@playwright/test";
import { activeSceneKey, clickDesign, sceneTexts, waitForScene } from "./helpers/combat";
import { openSignedIn, registerAccount, saveDeck } from "./helpers/online";

async function clickText(page: Page, key: string, label: string) {
  const bounds = () => page.evaluate(({ key, label }) => {
    const scene = (window as any).__vn.game.scene.getScene(key);
    const walk = (nodes: any[]): any => {
      for (const node of nodes ?? []) {
        if ((node.type === "Text" && node.text === label) || node.getData?.("actionLabel") === label) return node.getBounds();
        if (node.list) { const found = walk(node.list); if (found) return found; }
      }
      return null;
    };
    const b = (scene.deckOverlay ? walk([scene.deckOverlay]) : null) ?? walk(scene.children.list);
    return b ? { x: b.centerX, y: b.centerY } : null;
  }, { key, label });
  await expect.poll(bounds, { timeout: 10000 }).not.toBeNull();
  const b = (await bounds())!;
  await clickDesign(page, b.x, b.y);
}
const selected = (page: Page) => page.evaluate(() => (window as any).__vn.session.selectedDeckId);
const texts = (page: Page, key = "deck-builder") => sceneTexts(page, key);
async function copyStarter(page: Page) {
  await clickText(page, "deck-select", "Sao chép & sửa");
  await waitForScene(page, "deck-builder");
}

async function clickNamed(page: Page, key: string, name: string) {
  const point = await page.evaluate(({ key, name }) => {
    const s = (window as any).__vn.game.scene.getScene(key);
    const walk = (nodes: any[]): any => { for (const n of nodes ?? []) { if (n.name === name) return n; if (n.list) { const child = walk(n.list); if (child) return child; } } };
    const b = walk(s.children.list).getBounds(); return { x: b.centerX, y: b.centerY };
  }, { key, name });
  await clickDesign(page, point.x, point.y);
}

test.describe("deck interactions", () => {
  test("reduced motion keeps modal static and supports keyboard confirmation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSignedIn(page, await registerAccount(), { fastPlayback: false });
    await clickText(page, "deck-select", "Đổi bộ bài ▾");
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").reducedMotion)).toBe(true);
    let focused = false;
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").controls.focused?.panel.list.some((n: any) => n.type === "Text" && n.text === "Dùng bộ bài này") ?? false);
    }
    expect(focused).toBe(true);
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").deckOverlay)).toBeNull();
  });
  test("native name typing preserves the draft", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    const before = await page.evaluate(() => [...(window as any).__vn.session.editingDeck.cardIds]);
    await page.locator("#vn-deck-name").fill("Đội mới 12");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.name)).toBe("Đội mới 12");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.cardIds)).toEqual(before);
    await clickNamed(page, "deck-builder", "deck_editor_back");
    await expect.poll(() => texts(page)).toContain("Bỏ thay đổi");
    await page.keyboard.press("Escape");
    expect(await activeSceneKey(page)).toBe("deck-builder");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.name)).toBe("Đội mới 12");
    await clickNamed(page, "deck-builder", "deck_editor_back");
    await clickText(page, "deck-builder", "Bỏ thay đổi");
    await waitForScene(page, "deck-select");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.decks[0].name)).toBe("E2E");
    await expect(page.locator("#vn-deck-name")).toHaveCount(0);
  });

  test("equipment preview retains refinement details and equip updates slots", async ({ page }, testInfo) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    await page.evaluate(() => { (window as any).__vn.session.profile.weapons.w_xich_diem_thuong = { refinement: 3 }; });
    await clickNamed(page, "deck-builder", "deck_weapon_m05");
    await expect(page.locator("#vn-deck-name")).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("gear-picker.png") });
    await clickText(page, "deck-builder", "ⓘ Lá vũ khí: Liệt Diệm");
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain("Liệt Diệm còn 3 Nguyệt Lực.");
    await page.keyboard.press("Escape");
    await clickNamed(page, "deck-builder", "deck_gear_equip");
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain("19/18 ô bộ bài");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.weapons.m05)).toBe("w_xich_diem_thuong");
    await page.screenshot({ path: testInfo.outputPath("editor-weapon.png") });
  });

  test("offline save remains disabled and missing art retains readable controls", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/assets/**", (route) => route.abort());
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    await page.evaluate(() => { const h = (window as any).__vn; h.session.online = false; h.game.scene.getScene("deck-builder").render(); });
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain("Cần kết nối để lưu bộ bài");
    let saves = 0;
    await page.route("**/api/profile/decks", (route) => { saves++; return route.abort(); });
    await clickNamed(page, "deck-builder", "deck_editor_save");
    expect(saves).toBe(0);
    expect(await activeSceneKey(page)).toBe("deck-builder");
    expect(errors).toEqual([]);
  });

  test("tap information pins a readable preview until Escape", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    const id = await page.evaluate(() => {
      const h = (window as any).__vn;
      return h.session.data.heroes[h.session.editingDeck.heroIds[0]].branches[0].cardIds[0];
    });
    await clickNamed(page, "deck-builder", `deck_card_info_${id}`);
    await expect.poll(() => page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-builder").tooltip)).toBe(true);
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * 0.85, canvas.y + canvas.height * 0.55);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-builder").tooltip)).toBe(true);
    // Clicking a visible preview must not activate the sidebar beneath it.
    await clickDesign(page, 1104, 654);
    await page.waitForTimeout(200);
    expect(await activeSceneKey(page)).toBe("deck-builder");
    expect(await page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-builder").tooltip)).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-builder").tooltip)).toBe(false);
    expect(await activeSceneKey(page)).toBe("deck-builder");
  });

  test("initial artwork requests exclude offscreen cards", async ({ page }) => {
    const requested: string[] = [];
    await page.route("**/assets/cards/**", async (route) => { requested.push(new URL(route.request().url()).pathname); await route.continue(); });
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    await expect.poll(() => requested.length).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const offscreen = await page.evaluate(() => {
      const h = (window as any).__vn, s = h.game.scene.getScene("deck-builder");
      const allowed = new Set<string>();
      for (const heroId of h.session.editingDeck.heroIds) {
        for (const row of s.catalog(heroId).slice(0, 9)) {
          if (!row.cardId) continue;
          const card = h.session.data.cards[row.cardId];
          if (card.art) allowed.add(`cards:art_${card.art}`);
          allowed.add(`cards:${row.cardId}`);
          if (card.keywords?.[0]) allowed.add(`cards:art_${card.keywords[0]}`);
          allowed.add(`cards:art_${card.type === "attack" ? "attack" : "skill"}`);
        }
      }
      return [...s.artJobs].filter((key: any) => key.startsWith("cards:") && !allowed.has(key));
    });
    expect(offscreen).toEqual([]);
  });

  test("preview and cancel preserve active deck; confirm applies once", async ({ page }) => {
    const account = await registerAccount();
    const id = await saveDeck(account, "Nguyệt Đao");
    await openSignedIn(page, account);
    const before = await selected(page);
    await clickText(page, "deck-select", "Đổi bộ bài ▾");
    await clickText(page, "deck-select", "Nguyệt Đao");
    expect(await selected(page)).toBe(before);
    await page.keyboard.press("Escape");
    expect(await selected(page)).toBe(before);
    await clickText(page, "deck-select", "Đổi bộ bài ▾");
    await clickText(page, "deck-select", "Nguyệt Đao");
    await clickText(page, "deck-select", "Dùng bộ bài này");
    await expect.poll(() => selected(page)).toBe(id);
  });

  test("search handles accents and empty results without changing active deck", async ({ page }) => {
    const account = await registerAccount();
    await saveDeck(account, "Nguyệt Đao");
    await openSignedIn(page, account);
    const before = await selected(page);
    await clickText(page, "deck-select", "Đổi bộ bài ▾");
    const input = page.locator("#vn-deck-search");
    await input.fill("nguyet dao");
    await expect.poll(() => texts(page, "deck-select")).toContain("Nguyệt Đao");
    await input.fill("khong co ket qua");
    expect(await selected(page)).toBe(before);
    await input.fill("");
    await page.keyboard.press("Escape");
    await expect(input).toHaveCount(0);
  });

  test("copy acts on preview and leaves original and active deck unchanged", async ({ page }) => {
    const account = await registerAccount();
    const id = await saveDeck(account, "Đội mới");
    await openSignedIn(page, account);
    const before = await selected(page);
    await clickText(page, "deck-select", "Đổi bộ bài ▾");
    await clickText(page, "deck-select", "Đội mới");
    await clickText(page, "deck-select", "Sao chép & sửa");
    await waitForScene(page, "deck-builder");
    const draft = await page.evaluate(() => (window as any).__vn.session.editingDeck);
    expect(draft.id).toBe("");
    expect(draft.name).toContain("Đội mới");
    expect(await selected(page)).toBe(before);
    expect(await page.evaluate((deckId) => (window as any).__vn.session.profile.decks.find((d: any) => d.id === deckId).name, id)).toBe("Đội mới");
  });

  test("valid copy saves a new id then selects it", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    const before = await page.evaluate(() => (window as any).__vn.session.profile.decks.length);
    await clickText(page, "deck-builder", "Lưu và dùng");
    await waitForScene(page, "deck-select");
    expect(await page.evaluate(() => (window as any).__vn.session.profile.decks.length)).toBe(before + 1);
    expect(await selected(page)).toBe("d2");
  });

  test("invalid draft stays in editor, saves once, preserves active selection", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await page.evaluate(() => { (window as any).__vn.session.selectedDeckId = "d1"; (window as any).__vn.game.scene.getScene("deck-select").render(); });
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.editingDeck = JSON.parse(JSON.stringify(h.session.profile.decks[0]));
      h.session.editingDeck.id = "";
      h.session.editingDeck.name = "Bản nháp";
      h.session.editingDeck.cardIds.splice(0, 3);
      h.game.scene.getScene("deck-select").scene.start("deck-builder");
    });
    await waitForScene(page, "deck-builder");
    await clickText(page, "deck-builder", "Lưu bản nháp");
    await expect.poll(() => texts(page)).toContain("Đã lưu bản nháp");
    expect(await activeSceneKey(page)).toBe("deck-builder");
    expect(await selected(page)).toBe("d1");
    expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe("d2");
    await clickText(page, "deck-builder", "Lưu bản nháp");
    await expect.poll(() => page.evaluate(() => (window as any).__vn.session.profile.decks.length)).toBe(2);
  });

  test("pending save blocks duplicate submission and failed save keeps draft for retry", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await page.route("**/api/profile/decks", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      calls++;
      if (calls === 1) { await gate; return route.fulfill({ status: 500, json: { error: "save-failed" } }); }
      return route.continue();
    });
    try {
      await clickText(page, "deck-builder", "Lưu và dùng");
      await expect.poll(() => calls).toBe(1);
      await clickText(page, "deck-builder", "Đang lưu…");
      expect(calls).toBe(1);
      release();
      await expect.poll(() => texts(page).then((t) => t.some((s) => s.includes("save-failed")))).toBe(true);
      expect(await activeSceneKey(page)).toBe("deck-builder");
      expect(await page.evaluate(() => (window as any).__vn.session.editingDeck.id)).toBe("");
      // Error can be an inline message or the existing alert modal.
      if ((await texts(page)).includes("Đóng")) await clickText(page, "deck-builder", "Đóng");
      await clickText(page, "deck-builder", "Lưu và dùng");
      await waitForScene(page, "deck-select");
      expect(calls).toBe(2);
    } finally { release(); }
  });

  test("weapon takes a slot and its battle copies appear in stats", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    const expected = await page.evaluate(() => {
      const h = (window as any).__vn;
      const d = h.session.editingDeck;
      const id = Object.keys(h.session.data.weapons)[0]!;
      const weapon = h.session.data.weapons[id];
      h.session.profile.weapons[id] = { resonance: 1 };
      d.weapons = { [d.heroIds[0]]: id };
      h.game.scene.getScene("deck-builder").render();
      return {
        cards: d.cardIds.reduce((n: number, cid: string) => n + h.session.data.cards[cid].copies, 0),
        weapon: weapon.card.copies as number,
      };
    });
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain("19/18");
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain(`${expected.cards} bản trong chồng bài · +${expected.weapon} binh khí`);
    await expect.poll(() => texts(page)).toContain("Lưu bản nháp");
  });

  test("relic tile tooltip lists every Cộng Minh level and highlights the current one", async ({ page }) => {
    await openSignedIn(page, await registerAccount());
    await copyStarter(page);
    const relic = await page.evaluate(() => {
      const h = (window as any).__vn;
      const id = Object.keys(h.session.data.relics)[0]!;
      h.session.profile.relics[id] = { resonance: 3 };
      h.session.editingDeck.relicIds = [id];
      h.game.scene.getScene("deck-builder").render();
      return { name: h.session.data.relics[id].name as string };
    });
    await expect.poll(() => texts(page).then((t) => t.join("\n"))).toContain("Nguyệt Lực trung bình");
    await expect.poll(() => texts(page)).toContain("Cộng Minh 3");
    const canvas = (await page.locator("canvas").boundingBox())!;
    const s = Math.min(canvas.width / 1280, canvas.height / 720);
    const cx = canvas.x + (canvas.width - 1280 * s) / 2 + 1040 * s, cy = canvas.y + (canvas.height - 720 * s) / 2 + 258 * s;
    await expect.poll(async () => {
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 40);
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(400);
      return page.evaluate(() => !!(window as any).__vn.game.scene.getScene("deck-builder").tooltip);
    }, { timeout: 15_000 }).toBe(true);
    const tip = await page.evaluate(() => {
      const tooltip = (window as any).__vn.game.scene.getScene("deck-builder").tooltip;
      const out: { text: string; color: string }[] = [];
      const walk = (nodes: any[] | undefined) => nodes?.forEach((node) => {
        if (node.type === "Text") out.push({ text: node.text, color: node.style?.color ?? "" });
        if (node.list) walk(node.list);
      });
      walk(tooltip?.list);
      return out;
    });
    expect(tip[0]?.text).toBe(relic.name);
    expect(tip.filter((line) => /^▶ Cộng Minh 3\./.test(line.text))).toHaveLength(1);
    expect(tip.filter((line) => /^★ Cộng Minh [12]\./.test(line.text))).toHaveLength(2);
    expect(tip.filter((line) => /^☆ Cộng Minh [45]\./.test(line.text))).toHaveLength(2);
    expect(tip.find((line) => line.text.startsWith("▶"))?.color).toBe("#f4d35e");
  });

  for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`modal and editor remain contained at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openSignedIn(page, await registerAccount());
      await clickText(page, "deck-select", "Đổi bộ bài ▾");
      await expect(page.locator("#vn-deck-search")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`modal-${viewport.width}x${viewport.height}.png`) });
      await page.keyboard.press("Escape");
      await copyStarter(page);
      await expect.poll(() => texts(page)).toContain("Lưu và dùng");
      await page.screenshot({ path: testInfo.outputPath(`editor-${viewport.width}x${viewport.height}.png`) });
      const bounds = await page.evaluate(() => {
        const s = (window as any).__vn.game.scene.getScene("deck-builder");
        const walk = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...(n.list ? walk(n.list) : [])]);
        return walk(s.root.list).filter((n) => n.type === "Text").map((n) => {
          const b = n.getBounds();
          return { text: n.text, b: { left: b.left, right: b.right, bottom: b.bottom } };
        }).filter((n) => !n.text.includes("\n"));
      });
      for (const { b } of bounds) { expect(b.left).toBeGreaterThanOrEqual(-1); expect(b.right).toBeLessThanOrEqual(1281); expect(b.bottom).toBeLessThanOrEqual(721); }
      expect(errors).toEqual([]);
    });
  }
});
