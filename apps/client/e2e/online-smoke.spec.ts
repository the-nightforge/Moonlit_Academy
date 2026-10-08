import { test, expect } from "@playwright/test";
import { activeSceneKey, probeCombat } from "./helpers/combat";
import { registerAccount, openSignedIn, setupOnlineCombat } from "./helpers/online";

test.describe("online e2e harness", () => {
  test("register → sign in → deck-select", async ({ page }) => {
    const account = await registerAccount();
    await openSignedIn(page, account);
    await expect.poll(async () => activeSceneKey(page), { timeout: 15_000 }).toBe("deck-select");
  });

  test("practice match reaches combat over the wire", async ({ page }) => {
    await setupOnlineCombat(page);
    await expect.poll(async () => activeSceneKey(page)).toBe("combat");
    const probe = await probeCombat(page);
    expect(probe.handCount).toBeGreaterThan(0);
    expect(probe.units.length).toBeGreaterThan(0);
  });
});
