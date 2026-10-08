import { expect, test, type Page } from "@playwright/test";
import { registerAccount, openSignedIn } from "./helpers/online";

/**
 * `18` §2.2 e2e — phase 7a client features: the Chọn Pha overlay. Offline
 * (no API server): only the Vite dev server on :5173 is needed — the client
 * runs signed-in on the pg-mem test server (`dev:test`).
 *
 * The canvas UI is not DOM-readable, so the test drives Phaser through
 * `window.__vn` ({ session, game, debug }) and reads the rendered Text
 * objects out of the scene graph to confirm the overlay is on screen.
 */
const APP = "http://localhost:5173";

/** Serializable snapshot of the bits the spec asserts on. */
interface Probe {
  sceneKey: string;
  status: string;
  moonIndex: number;
  pendingKind: string | null;
  inputLocked: boolean | null;
  eventTypes: { type: string; cause?: string }[];
}

function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: {
            state: {
              status: string;
              moonIndex: number;
              players: { pendingChoice: { kind: string } | null }[];
            };
            events: { type: string; cause?: string }[];
          };
          game: {
            scene: {
              getScenes(active: boolean): { scene: { key: string } }[];
              getScene(key: string): { inputLocked: boolean } | undefined;
            };
          };
        };
      }
    ).__vn;
    const state = handle.session.state;
    return {
      sceneKey: handle.game.scene.getScenes(true)[0]?.scene.key ?? "",
      status: state.status,
      moonIndex: state.moonIndex,
      pendingKind: state.players[0]?.pendingChoice?.kind ?? null,
      inputLocked: handle.game.scene.getScene("combat")?.inputLocked ?? null,
      eventTypes: handle.session.events.map((event) => ({ type: event.type, cause: event.cause })),
    };
  });
}

/** Clicks a design-space coordinate on the fitted canvas. */
async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  // EXPAND scale mode: the 1280×720 design area is centered at the smaller fit scale.
  const s = Math.min(box!.width / 1280, box!.height / 720);
  const left = box!.x + (box!.width - 1280 * s) / 2;
  const top = box!.y + (box!.height - 720 * s) / 2;
  await page.mouse.click(left + x * s, top + y * s);
}

/** Every Text object inside the active scene's (nested) display containers. */
function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((sceneKey_) => {
    interface Node {
      type?: string;
      text?: string;
      list?: Node[];
    }
    const handle = (
      window as unknown as {
        __vn: { game: { scene: { getScenes(active: boolean): ({ scene: { key: string } } & Node)[] } } };
      }
    ).__vn;
    const scene = handle.game.scene.getScenes(true)[0];
    if (!scene || scene.scene.key !== sceneKey_) return [];
    const texts: string[] = [];
    const walk = (list: Node[] | undefined) => {
      list?.forEach((node) => {
        if (node.type === "Text" && typeof node.text === "string") texts.push(node.text);
        if (Array.isArray(node.list)) walk(node.list);
      });
    };
    walk((scene as Node & { root?: Node }).root?.list ?? scene.list ?? (scene as Node & { children: Node }).children.list);
    return texts;
  }, key);
}

test("7a: Chọn Pha mở khi M08 thăng cấp, chọn +2 đẩy Nguyệt Luân 2 pha", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    // Resource-load failures tolerated (fonts, optional assets).
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
      errors.push(message.text());
    }
  });

  const account = await registerAccount({ deck: false });
  await openSignedIn(page, account);

  // Team M08 + M02 + F01 (the plan's manual check), straight into a signed-in synthetic combat.
  await page.evaluate(() => {
    interface Session {
      heroIds: string[];
      deckCardIds: string[];
      encounterId: string;
      data: { heroes: Record<string, { cardIds: string[] }> };
    }
    const handle = (
      window as unknown as {
        __vn: {
          session: Session;
          game: { scene: { getScenes(active: boolean): { scene: { start(key: string): void } }[] } };
        };
      }
    ).__vn;
    handle.session.heroIds = ["m08", "m02", "f01"];
    handle.session.deckCardIds = handle.session.heroIds.flatMap(
      (id) => handle.session.data.heroes[id]!.cardIds,
    );
    handle.session.encounterId = "enc_01";
    handle.game.scene.getScenes(true)[0]!.scene.start("combat");
  });
  await expect.poll(async () => (await probe(page)).sceneKey, { timeout: 15_000 }).toBe("combat");

  // Rebuild the combat for the new team (same call as the debug "Chơi lại").
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { restart(): void } | undefined } } };
      }
    ).__vn;
    handle.game.scene.getScene("combat")!.restart();
  });
  await expect.poll(async () => (await probe(page)).status, { timeout: 15_000 }).toBe("mulligan");
  await expect.poll(async () => (await probe(page)).inputLocked, { timeout: 15_000 }).toBe(false);

  // Keep the opening hand, then force M08 leveled up (debug hook) and end the turn.
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { dispatch(a: unknown): void } | undefined } } };
      }
    ).__vn;
    handle.game.scene.getScene("combat")!.dispatch({ type: "mulligan", instanceIds: [] });
  });
  await expect
    .poll(
      async () => {
        const shot = await probe(page);
        return shot.status === "playerTurn" && shot.inputLocked === false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: { state: { heroes: { defId: string }[] } };
          game: { scene: { getScene(key: string): { dispatch(a: unknown): void } | undefined } };
          debug: { debugSetLeveledUp(index: number): void };
        };
      }
    ).__vn;
    const index = handle.session.state.heroes.findIndex((hero) => hero.defId === "m08");
    handle.debug.debugSetLeveledUp(index);
    handle.game.scene.getScene("combat")!.dispatch({ type: "endTurn" });
  });

  // The enemy turn + next player turn start resolve synchronously; the overlay
  // shows once the event queue finishes animating — serialized playback means
  // the choice state commits only after every earlier beat has played.
  await expect
    .poll(
      async () => {
        const shot = await probe(page);
        return shot.status === "choosing" && shot.pendingKind === "chooseMoon";
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await expect
    .poll(async () => (await sceneTexts(page, "combat")).some((t) => t.includes("Chọn Pha")), {
      timeout: 60_000,
    })
    .toBe(true);
  expect((await probe(page)).eventTypes.some((e) => e.type === "moonChoiceOpened")).toBe(true);

  // The choice rows use measured text heights; click the real +2 label bounds.
  const before = (await probe(page)).moonIndex;
  const choiceAt = await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("combat");
    const find = (nodes: any[]): any => {
      for (const node of nodes) {
        if (node.type === "Text" && node.text.startsWith("+2 —")) return node;
        if (node.list) { const found = find(node.list); if (found) return found; }
      }
    };
    const bounds = find(scene.root.list).getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await clickDesign(page, choiceAt.x, choiceAt.y);
  await expect
    .poll(async () => (await probe(page)).moonIndex, { timeout: 15_000 })
    .toBe((before + 2) % 8);
  await expect
    .poll(async () => (await probe(page)).status, { timeout: 15_000 })
    .toBe("playerTurn");
  expect(
    (await probe(page)).eventTypes.some((e) => e.type === "moonShifted" && e.cause === "card"),
  ).toBe(true);

  expect(errors).toEqual([]);
});
