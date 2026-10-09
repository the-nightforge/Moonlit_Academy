import { waitForScene, clickDesign, sceneTexts } from "./helpers/combat";
import { expect, test, type Page } from "@playwright/test";
import { registerAccount, openSignedIn } from "./helpers/online";

/**
 * `18` §3 e2e — combat client features: Linh Thú panels and fallenAlly
 * targeting. The client runs signed-in against the pg-mem test server (`dev:test`)
 * through the Vite dev server on :5173.
 *
 * The canvas UI is not DOM-readable, so the test drives Phaser through
 * `window.__vn` ({ session, game, debug }) and reads the rendered Text
 * objects / unitAnchors out of the scene to confirm the panels are on screen.
 */

/** Serializable snapshot of the bits the spec asserts on. */
interface Probe {
  sceneKey: string;
  status: string;
  moonPower: number;
  summons: { id: string; summonId: string; hp: number; alive: boolean }[];
  heroes: { id: string; defId: string; alive: boolean; hp: number }[];
  hand: string[];
  inputLocked: boolean | null;
  anchors: string[];
  eventTypes: { type: string; targetId?: string }[];
}

function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: {
            state: {
              status: string;
              players: { moonPower: number; hand: string[] }[];
              summons?: { id: string; summonId: string; hp: number; alive: boolean }[];
              heroes: { id: string; defId: string; alive: boolean; hp: number }[];
            };
            events: { type: string; targetId?: string }[];
          };
          game: {
            scene: {
              getScenes(active: boolean): { scene: { key: string } }[];
              getScene(key: string):
                | { inputLocked: boolean; unitAnchors: Map<string, unknown> }
                | undefined;
            };
          };
        };
      }
    ).__vn;
    const state = handle.session.state;
    const scene = handle.game.scene.getScene("combat");
    return {
      sceneKey: handle.game.scene.getScenes(true)[0]?.scene.key ?? "",
      status: state.status,
      moonPower: state.players[0]?.moonPower ?? 0,
      summons: (state.summons ?? []).map((s) => ({
        id: s.id,
        summonId: s.summonId,
        hp: s.hp,
        alive: s.alive,
      })),
      heroes: state.heroes.map((h) => ({
        id: h.id,
        defId: h.defId,
        alive: h.alive,
        hp: h.hp,
      })),
      hand: state.players[0]?.hand ?? [],
      inputLocked: scene?.inputLocked ?? null,
      anchors: scene ? [...scene.unitAnchors.keys()] : [],
      eventTypes: handle.session.events.map((event) => ({
        type: event.type,
        targetId: event.targetId,
      })),
    };
  });
}


/** Waits until the event queue finished and the seat can act again. */
async function waitForPlayerTurn(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const shot = await probe(page);
        return shot.status === "playerTurn" && shot.inputLocked === false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}


test("Linh Thú renders beside the hero row and a fallen Hero can be picked for Hồi Hồn", async ({ page }) => {
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

  // Team F09 + F10 + F06 (the plan's manual check), straight into a signed-in synthetic combat.
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
    handle.session.heroIds = ["f09", "f10", "f06"];
    handle.session.deckCardIds = handle.session.heroIds.flatMap(
      (id) => handle.session.data.heroes[id]!.cardIds,
    );
    handle.session.encounterId = "enc_01";
    handle.game.scene.getScenes(true)[0]!.scene.start("combat");
  });
  await waitForScene(page, "combat");

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

  // Keep the opening hand.
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

  // Deal Triệu Hồi into hand with plenty of Nguyệt Lực, then play it.
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: {
            state: {
              cards: Record<string, unknown>;
              players: { hand: string[]; moonPower: number }[];
            };
          };
          game: { scene: { getScene(key: string): { dispatch(a: unknown): void } | undefined } };
        };
      }
    ).__vn;
    const state = handle.session.state;
    state.cards["e2e_trieu_hoi"] = {
      instanceId: "e2e_trieu_hoi",
      cardId: "f09_trieu_hoi",
      ownerIds: ["f09"],
      player: 0,
      heldTurns: 0,
    };
    state.players[0]!.hand.push("e2e_trieu_hoi");
    state.players[0]!.moonPower = 9;
    handle.game.scene.getScene("combat")!.dispatch({ type: "playCard", instanceId: "e2e_trieu_hoi" });
  });

  // Thỏ Ngọc enters `state.summons`, gets a panel (its name renders) and an
  // anchor for animations/targeting.
  await expect
    .poll(async () => (await probe(page)).summons.length, { timeout: 15_000 })
    .toBe(1);
  const summonShot = await probe(page);
  expect(summonShot.summons[0]!.summonId).toBe("tho_ngoc");
  expect(summonShot.summons[0]!.alive).toBe(true);
  expect(summonShot.eventTypes.some((e) => e.type === "summoned")).toBe(true);
  await expect
    .poll(async () => (await sceneTexts(page, "combat")).includes("Thỏ Ngọc"), {
      timeout: 15_000,
    })
    .toBe(true);
  expect((await probe(page)).anchors).toContain("summon:f09");
  await waitForPlayerTurn(page);

  // Linh Thú is an `ally` target (`01` §17.3): Ngọc Đảo can click its panel.
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: {
            state: {
              cards: Record<string, unknown>;
              players: { hand: string[]; moonPower: number }[];
            };
          };
        };
      }
    ).__vn;
    const state = handle.session.state;
    state.cards["e2e_ngoc_dao"] = {
      instanceId: "e2e_ngoc_dao",
      cardId: "f09_ngoc_dao",
      ownerIds: ["f09"],
      player: 0,
      heldTurns: 0,
    };
    state.players[0]!.hand.push("e2e_ngoc_dao");
    state.players[0]!.moonPower = 9;
  });
  await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { onCardClicked(id: string): void } } } };
      }
    ).__vn.game.scene.getScene("combat")!;
    scene.onCardClicked("e2e_ngoc_dao");
  });
  const validTargets = await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { validTargetIds: Set<string> } } } };
      }
    ).__vn.game.scene.getScene("combat")!;
    return [...scene.validTargetIds];
  });
  expect(validTargets).toContain("summon:f09");
  const summonAnchor = await page.evaluate(() => (window as any).__vn.game.scene.getScene("combat").unitAnchors.get("summon:f09"));
  await clickDesign(page, summonAnchor.x, summonAnchor.y);
  await expect
    .poll(
      async () =>
        (await probe(page)).eventTypes.some(
          (e) => e.type === "cardPlayed" && e.targetId === "summon:f09",
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await waitForPlayerTurn(page);

  // F06 falls (debug hook), then Hồi Hồn must offer and accept its panel.
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: {
          session: { state: { heroes: { defId: string }[]; cards: Record<string, unknown>; players: { hand: string[]; moonPower: number }[] } };
          debug: { debugAdjustHeroHp(index: number, delta: number): void };
        };
      }
    ).__vn;
    const index = handle.session.state.heroes.findIndex((hero) => hero.defId === "f06");
    handle.debug.debugAdjustHeroHp(index, -999);
    handle.session.state.cards["e2e_hoi_hon"] = {
      instanceId: "e2e_hoi_hon",
      cardId: "f10_hoi_hon",
      ownerIds: ["f10"],
      player: 0,
      heldTurns: 0,
    };
    handle.session.state.players[0]!.hand.push("e2e_hoi_hon");
    handle.session.state.players[0]!.moonPower = 9;
  });
  await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { onCardClicked(id: string): void } } } };
      }
    ).__vn.game.scene.getScene("combat")!;
    scene.onCardClicked("e2e_hoi_hon");
  });
  const fallenTargets = await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { validTargetIds: Set<string> } } } };
      }
    ).__vn.game.scene.getScene("combat")!;
    return [...scene.validTargetIds];
  });
  expect(fallenTargets).toEqual(["hero:f06"]);
  // The "Ngã" overlay is not interactive — the dead panel takes the click.
  // F06 is the rightmost hero (810, 400).
  await clickDesign(page, 810, 400);
  await expect
    .poll(async () => (await probe(page)).heroes.find((h) => h.defId === "f06")?.alive, {
      timeout: 15_000,
    })
    .toBe(true);
  expect((await probe(page)).eventTypes.some((e) => e.type === "heroRevived")).toBe(true);
  await waitForPlayerTurn(page);

  // Ending the player turn lets Thỏ Ngọc act before the enemies.
  await page.evaluate(() => {
    const handle = (
      window as unknown as {
        __vn: { game: { scene: { getScene(key: string): { dispatch(a: unknown): void } | undefined } } };
      }
    ).__vn;
    handle.game.scene.getScene("combat")!.dispatch({ type: "endTurn" });
  });
  await expect
    .poll(
      async () => (await probe(page)).eventTypes.some((e) => e.type === "summonActed"),
      { timeout: 15_000 },
    )
    .toBe(true);

  expect(errors).toEqual([]);
});
