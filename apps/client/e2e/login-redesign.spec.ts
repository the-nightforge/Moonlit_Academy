import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
const app = "http://127.0.0.1:5173";
const previews = fileURLToPath(new URL("../../../output/login-redesign/", import.meta.url));

async function openLogin(page: Page, online = true) {
  await page.route("**/api/health", route => route.fulfill({ status: online ? 200 : 503, json: { ok: online } }));
  await page.goto(app);
  await expect(page.getByRole("button", { name: online ? "Đăng nhập" : "Chơi offline", exact: true })).toBeVisible();
}

async function credentials(page: Page) {
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("nguyet_thu");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("moon-secret-123");
}

test("password visibility and keyboard submission retain login credentials", async ({ page }) => {
  let body: unknown;
  await page.route("**/api/auth/login", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 401, json: { error: "invalid credentials" } });
  });
  await openLogin(page);
  await credentials(page);
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ẩn mật khẩu" }).click();
  await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("Sai tên đăng nhập hoặc mật khẩu");
  expect(body).toEqual({ username: "nguyet_thu", password: "moon-secret-123" });
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue("moon-secret-123");
});

test("register tab sends register endpoint and enters the library with the authoritative profile", async ({ page }) => {
  let body: unknown;
  let profile: unknown;
  await page.route("**/api/auth/register", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { token: "login-test-token", profile, rev: 7 } });
  });
  await openLogin(page);
  profile = await page.evaluate(() => (window as any).__vn.session.profile);
  await page.getByRole("tab", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await credentials(page);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("deck-select"));
  expect(body).toEqual({ username: "nguyet_thu", password: "moon-secret-123" });
  expect(await page.evaluate(() => (window as any).__vn.session.rev)).toBe(7);
  await expect(page.locator(".vn-login")).toHaveCount(0);
});

test("pending sign-in prevents duplicate requests and recovers after a server error", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route("**/api/auth/login", async route => {
    requests++;
    await pending;
    await route.fulfill({ status: 429, json: { error: "too many attempts" } });
  });
  await openLogin(page);
  await credentials(page);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Đăng ký", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Tên đăng nhập", { exact: true })).toBeDisabled();
  await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole("alert")).toContainText("thử lại sau 5 phút");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeEnabled();
});

test("offline recovery retries health and the offline action opens deck selection", async ({ page }) => {
  await openLogin(page, false);
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true } }));
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.route("**/api/auth/login", route => route.abort());
  await credentials(page);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: "Chơi offline" }).click();
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("deck-select"));
  expect(await page.evaluate(() => (window as any).__vn.session.online)).toBe(false);
  await expect(page.locator(".vn-login")).toHaveCount(0);
});

test("late health response after scene shutdown cannot recreate the login form", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/health", async route => { await pending; await route.fulfill({ json: { ok: true } }); });
  await page.goto(app);
  await page.waitForFunction(() => (window as any).__vn?.game.scene.isActive("login"));
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("login").scene.start("deck-select"));
  release();
  await page.waitForResponse("**/api/health");
  await expect(page.locator(".vn-login")).toHaveCount(0);
  await expect(page.getByPlaceholder("Tên đăng nhập")).toHaveCount(0);
});

test("supplementary Unicode passwords are submitted intact for existing accounts", async ({ page }) => {
  let body: unknown;
  await page.route("**/api/auth/login", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 401, json: { error: "invalid credentials" } });
  });
  await openLogin(page);
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("nguyet_thu");
  const password = "🌙".repeat(40);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sai tên đăng nhập hoặc mật khẩu");
  expect(body).toEqual({ username: "nguyet_thu", password });
});

test("registration allows the server to normalize username whitespace and case", async ({ page }) => {
  let body: unknown;
  await page.route("**/api/auth/register", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 409, json: { error: "username taken" } });
  });
  await openLogin(page);
  await page.getByRole("tab", { name: "Đăng ký", exact: true }).click();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("  Linh_Lung ");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("moon-secret-123");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("alert")).toContainText("Tên đăng nhập đã có người dùng");
  expect(body).toEqual({ username: "  Linh_Lung ", password: "moon-secret-123" });
});

test("saved token resumes its profile without displaying credential fields", async ({ page }) => {
  await openLogin(page);
  const profile = await page.evaluate(() => (window as any).__vn.session.profile);
  await page.route("**/api/profile", route => route.fulfill({ json: { profile, rev: 12 } }));
  await page.evaluate(() => localStorage.setItem("vong-nguyet.token", "saved-token"));
  await page.reload();
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("deck-select"));
  expect(await page.evaluate(() => (window as any).__vn.session.rev)).toBe(12);
  await expect(page.locator(".vn-login")).toHaveCount(0);
});

for (const choice of ["Nhập", "Bỏ qua", "Lỗi nhập"] as const) {
  test(`legacy progress prompt preserves ${choice} flow`, async ({ page }) => {
    await openLogin(page);
    const profile = await page.evaluate(() => (window as any).__vn.session.profile);
    await page.evaluate(() => localStorage.setItem("vong-nguyet.profile", JSON.stringify({ mastery: {}, decks: [] })));
    await page.route("**/api/auth/login", route => route.fulfill({ json: { token: "import-token", profile, rev: 1 } }));
    let body: unknown;
    await page.route("**/api/profile/import", async route => {
      body = route.request().postDataJSON();
      await route.fulfill(choice === "Lỗi nhập" ? { status: 400, json: { error: "invalid profile" } } : { json: { profile, rev: 2 } });
    });
    await credentials(page);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("button", { name: choice === "Bỏ qua" ? "Bỏ qua" : "Nhập", exact: true }).click();
    if (choice === "Lỗi nhập") {
      await expect(page.getByText("Tiến độ trên máy bị hỏng, không nhập được", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    }
    await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("deck-select"));
    expect(await page.evaluate(() => localStorage.getItem("vong-nguyet.profile") !== null)).toBe(choice === "Lỗi nhập");
    expect(body).toEqual(choice === "Bỏ qua" ? undefined : { local: { mastery: {}, decks: [] } });
  });
}

for (const choice of ["Chơi tiếp", "Bỏ lượt này"] as const) {
  test(`saved run prompt preserves ${choice} flow`, async ({ page }) => {
    await openLogin(page);
    const profile = await page.evaluate(() => (window as any).__vn.session.profile);
    await page.evaluate(() => {
      const s = (window as any).__vn.session;
      localStorage.setItem("vong-nguyet.run", JSON.stringify({ runId: "saved-login-run", setup: { heroIds: s.heroIds, seed: 42, deckCardIds: s.deckCardIds }, actions: [] }));
    });
    await page.route("**/api/auth/login", route => route.fulfill({ json: { token: "run-token", profile, rev: 1 } }));
    let abandoned = false;
    await page.route("**/api/runs/saved-login-run/abandon", async route => { abandoned = true; await route.fulfill({ status: 204 }); });
    await credentials(page);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("button", { name: choice, exact: true }).click();
    const scene = choice === "Chơi tiếp" ? "run" : "deck-select";
    await page.waitForFunction(scene => (window as any).__vn.game.scene.isActive(scene), scene);
    expect(abandoned).toBe(choice === "Bỏ lượt này");
    expect(await page.evaluate(() => localStorage.getItem("vong-nguyet.run") !== null)).toBe(choice === "Chơi tiếp");
    await expect(page.locator(".vn-login")).toHaveCount(0);
  });
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`login controls remain visible without horizontal overflow ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openLogin(page);
    const layout = await page.locator(".vn-login").evaluate(element => {
      const panel = element.querySelector(".vn-login-card")!.getBoundingClientRect();
      const shell = element.getBoundingClientRect();
      return { panel: { left: panel.left, right: panel.right }, width: innerWidth, overflow: element.scrollWidth > shell.width + 1 };
    });
    expect(layout.panel.left).toBeGreaterThanOrEqual(0);
    expect(layout.panel.right).toBeLessThanOrEqual(layout.width);
    expect(layout.overflow).toBe(false);
    await page.screenshot({ path: `${previews}/login-${viewport.width}x${viewport.height}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("tab", { name: "Đăng ký", exact: true }).click();
    await page.getByRole("button", { name: "Tạo tài khoản" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toBeInViewport();
    await page.screenshot({ path: `${previews}/register-${viewport.width}x${viewport.height}.png`, fullPage: true, animations: "disabled" });
  });
}

test("reduced-motion preference stops decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLogin(page);
  const animations = await page.locator(".vn-login").evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length);
  expect(animations).toBe(0);
});
