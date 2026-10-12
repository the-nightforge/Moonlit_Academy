import { expect, test, type Page } from "@playwright/test";
import { clickDesign, clickSceneText, waitForScene } from "./helpers/combat";
import { openScene } from "./helpers/online";

async function texts(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("heroes");
    const walk = (nodes: any[]): any[] => nodes.flatMap(n => [n, ...(n.list ? walk(n.list) : [])]);
    return walk(scene.root.list).filter(n => n.type === "Text").map(n => n.text as string);
  });
}

test.describe("hero collection", () => {
  test("redraws do not accumulate art-preview notes", async ({ page }) => {
    await openScene(page, "heroes");
    for (const name of ["Đã sở hữu", "Tất cả", "Chưa sở hữu", "Tất cả"]) await page.getByRole("button", { name, exact: true }).click();
    expect(await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("heroes");
      const walk = (nodes: any[]): any[] => nodes.flatMap(n => [n, ...(n.list ? walk(n.list) : [])]);
      return walk(s.children.list).filter(n => n.name === "art-preview-note").length;
    })).toBe(1);
  });

  test("a late failed form request does not show its error on a different hero", async ({ page }) => {
    await openScene(page, "heroes");
    await page.evaluate(() => {
      const h = (window as any).__vn; h.session.profile.heroes.m05.constellation = 5; h.game.scene.getScene("heroes").render();
    });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/profile/heroes/m05/level-up-form", async route => { await pending; await route.fulfill({ status: 500, json: { error: "review_failure" } }); });
    await clickSceneText(page, "heroes", "Tinh Hồn");
    await clickSceneText(page, "heroes", "Bất Diệt");
    await expect.poll(() => texts(page)).toContain("Đang lưu dạng thăng cấp…");
    await clickDesign(page, 232, 210);
    release();
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").busy)).toBe(false);
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").heroId)).toBe("f04");
    expect(await texts(page)).not.toContain("Lỗi server (review_failure)");
  });

  test("profile makes the trigger readable and form choices visible without scrolling", async ({ page }, testInfo) => {
    await openScene(page, "heroes");
    await expect.poll(() => texts(page)).toContain("Mất tổng 15 HP trong trận");
    await page.screenshot({ path: testInfo.outputPath("hero-roster-v2.png") });
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.profile.heroes.m05.constellation = 5;
      h.game.scene.getScene("heroes").render();
    });
    await clickSceneText(page, "heroes", "Tinh Hồn");
    const bounds = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("heroes");
      const label = s.detailContent.list.find((n: any) => n.text === "Bất Diệt");
      return label ? { top: label.getBounds().top, bottom: label.getBounds().bottom, area: s.detailArea } : null;
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.top).toBeGreaterThanOrEqual(bounds!.area.y);
    expect(bounds!.bottom).toBeLessThanOrEqual(bounds!.area.y + bounds!.area.height);
    await page.screenshot({ path: testInfo.outputPath("hero-forms-v2.png") });
  });

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => console.error("Hero UI browser error:", error.message));
    page.on("requestfailed", request => {
      if (request.resourceType() === "script") console.error("Hero UI script failed:", request.url(), request.failure()?.errorText);
    });
  });

  test("wrapped tile names stay complete and select their hero", async ({ page }) => {
    await openScene(page, "heroes");
    const tile = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("heroes");
      return s.root.list.find((n: any) => n.name === "hero-tile:f01").list.filter((n: any) => n.type === "Text").map((n: any) => n.text);
    });
    expect(tile).toContain("Thẩm Nguyệt Hoa");
    await clickDesign(page, 215, 594); // Second line of Thẩm Nguyệt Hoa's name.
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").heroId)).toBe("f01");
  });

  test("keyboard selects the focused hero and training has a full-size hit target", async ({ page }) => {
    await openScene(page, "heroes");
    await clickDesign(page, 90, 210);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").heroId)).toBe("f04");
    const buttonHeight = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("heroes");
      return s.root.list.find((n: any) => n.name === "hero-actions").list.find((n: any) => n.type === "Rectangle" && n.width === 202).height;
    });
    expect(buttonHeight).toBeGreaterThanOrEqual(40);
  });

  test("card popup keeps its close control inside the panel and dismisses outside", async ({ page }, testInfo) => {
    await openScene(page, "heroes");
    await clickSceneText(page, "heroes", "Lá chủ lực");
    await page.screenshot({ path: testInfo.outputPath("hero-cards-v2.png") });
    await clickDesign(page, 980, 390);
    const popup = await page.evaluate(() => {
      const layer = (window as any).__vn.game.scene.getScene("heroes").tooltip;
      const box = layer.list.find((n: any) => n.name === "card_tooltip").getBounds();
      const close = layer.list.find((n: any) => n.text === "×").getBounds();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, x: close.centerX, y: close.centerY };
    });
    expect(popup.x).toBeGreaterThan(popup.left); expect(popup.x).toBeLessThan(popup.right);
    expect(popup.y).toBeGreaterThan(popup.top); expect(popup.y).toBeLessThan(popup.bottom);
    await page.screenshot({ path: testInfo.outputPath("hero-popup-v2.png") });
    await clickDesign(page, popup.x, popup.y);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").tooltipPinned)).toBe(false);
    await clickDesign(page, 980, 390);
    await clickDesign(page, 30, 60);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").tooltipPinned)).toBe(false);
    await waitForScene(page, "heroes");
  });

  test("scrolled form hit areas leave the tabs clickable outside the mask", async ({ page }) => {
    await openScene(page, "heroes");
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.profile.heroes.m05.constellation = 5;
      h.session.data.heroes.m05.altLevelUp.description = h.session.data.heroes.m05.altLevelUp.description.repeat(20);
    });
    await clickSceneText(page, "heroes", "Tinh Hồn");
    await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").scrollDetail(70));
    await clickDesign(page, 958, 311);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").tab)).toBe("overview");
  });

  test("search without accents combines with ownership filters and clears an empty result", async ({ page }, testInfo) => {
    await openScene(page, "heroes");
    const search = page.getByRole("searchbox", { name: "Tìm tên Hero" });
    await expect(search).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath("hero-roster.png") });
    await search.fill("HOAC LIET");
    await expect.poll(() => texts(page)).toContain("1 Hero");
    await page.getByRole("button", { name: "Chưa sở hữu", exact: true }).click();
    await expect.poll(() => texts(page)).toContain("Không tìm thấy Hero phù hợp");
    await clickSceneText(page, "heroes", "Xóa bộ lọc");
    await expect(search).toHaveValue("");
    await expect(page.getByRole("button", { name: "Tất cả", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => texts(page)).toContain("20 Hero");
  });

  test("paging reaches locked heroes, preserves the selection, and routes mastery to the chosen hero", async ({ page }) => {
    await openScene(page, "heroes");
    await clickSceneText(page, "heroes", "›");
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").page)).toBe(1);
    await page.getByRole("button", { name: "Đã sở hữu", exact: true }).click();
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").page)).toBe(0);
    await clickDesign(page, 232, 210); // Second owned portrait (Ôn Như Ý).
    await clickSceneText(page, "heroes", "Tu Luyện");
    await waitForScene(page, "mastery");
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("mastery").heroId)).toBe("f04");
  });

  test("unknown ownership keeps the preview available and disables training with a visible reason", async ({ page }) => {
    await openScene(page, "heroes");
    await page.getByRole("button", { name: "Chưa sở hữu", exact: true }).click();
    await clickDesign(page, 90, 210);
    await expect.poll(() => texts(page)).toContain("Chưa sở hữu — nhận qua Triệu Hồi");
    await expect.poll(() => texts(page)).toContain("Cần sở hữu Hero để Tu Luyện");
    await clickSceneText(page, "heroes", "Lá chủ lực");
    await clickDesign(page, 1050, 390);
    await expect.poll(() => page.evaluate(() => !!(window as any).__vn.game.scene.getScene("heroes").tooltip)).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => !!(window as any).__vn.game.scene.getScene("heroes").tooltip)).toBe(false);
    await waitForScene(page, "heroes");
  });

  test("form changes send the selected hero to the API and render its returned progression", async ({ page }) => {
    await openScene(page, "heroes");
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.profile.heroes.m05.constellation = 5;
      h.game.scene.getScene("heroes").render();
    });
    await page.route("**/api/profile/heroes/m05/level-up-form", async route => {
      const body = route.request().postDataJSON();
      const reply = await page.evaluate((form) => {
        const h = (window as any).__vn;
        const profile = structuredClone(h.session.profile);
        profile.heroes.m05.levelUpForm = form;
        return { profile, rev: h.session.rev + 1 };
      }, body.form);
      await route.fulfill({ json: reply });
    });
    await clickSceneText(page, "heroes", "Tinh Hồn");
    const request = page.waitForRequest(r => r.url().endsWith("/profile/heroes/m05/level-up-form"));
    await clickSceneText(page, "heroes", "Bất Diệt");
    expect((await request).postDataJSON()).toEqual({ form: "alt" });
    await expect.poll(() => texts(page)).toContain("✓ Bất Diệt");
    await clickSceneText(page, "heroes", "Tổng quan");
    await expect.poll(() => texts(page)).toContain("Thăng cấp — Bất Diệt");
  });

  test("re-entering does not accumulate native fields or wheel listeners; missing art has a fallback", async ({ page }) => {
    await page.route("**/assets/heroes/**", route => void route.abort());
    await openScene(page, "heroes");
    await expect.poll(() => texts(page).then(ts => ts.filter(t => t === "❖").length)).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").scene.start("deck-select"));
      await waitForScene(page, "deck-select");
      await expect(page.locator("[data-hero-roster-field]")).toHaveCount(0);
      await page.evaluate(() => (window as any).__vn.game.scene.getScene("deck-select").scene.start("heroes"));
      await waitForScene(page, "heroes");
    }
    await expect(page.locator("[data-hero-roster-field]")).toHaveCount(6);
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").input.listenerCount("wheel"))).toBe(1);
  });

  test("a failed form change releases pending state and shows a recoverable error", async ({ page }) => {
    await openScene(page, "heroes");
    await page.evaluate(() => {
      const h = (window as any).__vn;
      h.session.profile.heroes.m05.constellation = 5;
      h.game.scene.getScene("heroes").render();
    });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route("**/api/profile/heroes/m05/level-up-form", async route => {
      requests++;
      await pending;
      await route.fulfill({ status: 500, json: { error: "review_failure" } });
    });
    await clickSceneText(page, "heroes", "Tinh Hồn");
    await clickSceneText(page, "heroes", "Bất Diệt");
    await expect.poll(() => texts(page)).toContain("Đang lưu dạng thăng cấp…");
    await clickSceneText(page, "heroes", "Bất Diệt");
    expect(requests).toBe(1);
    release();
    await expect.poll(() => texts(page)).toContain("Lỗi server (review_failure)");
    await expect(page.getByRole("searchbox", { name: "Tìm tên Hero" })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("heroes").busy)).toBe(false);
    await expect.poll(() => texts(page)).toContain("✓ Liệt Hỏa");
  });

  test("long descriptions scroll above the footer at all target viewports", async ({ page }, testInfo) => {
    await openScene(page, "heroes");
    const original = await page.evaluate(() => (window as any).__vn.session.data.heroes.m05.levelUp.description as string);
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      const box = (await page.locator("canvas").boundingBox())!;
      const scale = Math.min(box.width / 1280, box.height / 720);
      const clip = { x: box.x + box.width / 2 + 248 * scale, y: box.y + box.height / 2 + 280 * scale, width: 364 * scale, height: 72 * scale };
      await page.evaluate(description => {
        const h = (window as any).__vn;
        h.session.data.heroes.m05.levelUp.description = description;
        h.game.scene.getScene("heroes").render();
      }, original);
      const footer = await page.screenshot({ clip });
      await page.evaluate(() => {
        const h = (window as any).__vn;
        h.session.data.heroes.m05.levelUp.description = "Một mô tả dài để kiểm tra không tràn ra các nút phía dưới. ".repeat(30);
        h.game.scene.getScene("heroes").render();
      });
      const bounds = await page.evaluate(() => {
        const scene = (window as any).__vn.game.scene.getScene("heroes");
        return { scroll: scene.detailContent.y, contentHeight: scene.detailHeight,
          footer: scene.root.list.find((n: any) => n.name === "hero-actions").getBounds().top,
          maskBottom: scene.detailArea.y + scene.detailArea.height };
      });
      expect(bounds.contentHeight).toBeGreaterThan(280);
      expect(bounds.maskBottom).toBeLessThan(bounds.footer);
      expect((await page.screenshot({ clip })).equals(footer), "long content must not paint over the footer").toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`heroes-${viewport.width}x${viewport.height}.png`) });
    }
  });
});
