import { expect, type Page } from "@playwright/test";

/**
 * Combat e2e helpers (`05` review U6): the canvas UI is not DOM-readable, so
 * tests drive Phaser through the `window.__vn` dev handle and read rendered
 * objects out of the live scene — never a parallel fixture of the rules.
 */
export const APP = "http://localhost:5173";

/** Scenario presets reachable through the debug harness + in-page state edits (e2e only). */
export type CombatScenario = "default" | "hand0" | "hand1" | "hand8" | "hand10" | "denseStatus" | "longChoice" | "summonRevive" | "multiHit" | "bloodMoon";

/** What `probeCombat` reports about the live combat scene. */
export interface CombatProbe {
  inputLocked: boolean;
  /** The playback queue still has batches in flight. */
  busy: boolean;
  units: { id: string; bounds: { x: number; y: number; w: number; h: number }; hp: number; armor: number }[];
  /** Every Text string rendered in the scene — names, labels, counts. */
  texts: string[];
  /** Depth≥90 scene objects left over after the queue idled (floating text, flashes). */
  temporaryFxCount: number;
  /** Rendered hand cards (`cardViews` size). */
  handCount: number;
}

interface VnHandle {
  session: {
    state: {
      status: string;
      players: {
        index: number;
        hand: string[];
        drawPile: string[];
        pendingChoice: { kind: string; options: unknown[] } | null;
      }[];
      heroes: { id: string; statuses: unknown[]; sealedBy?: string; alive: boolean; hp: number; maxHp: number }[];
      enemies: { id: string; alive: boolean }[];
      summons?: unknown[];
      cards: Record<string, unknown>;
      moonPower?: never;
    };
    heroIds: string[];
    deckCardIds: string[];
    encounterId: string;
    data: { heroes: Record<string, { cardIds: string[] }> };
    events: unknown[];
  };
  game: {
    scene: {
      getScenes(active: boolean): { scene: { key: string; start(key: string): void } }[];
      getScene(key: string): CombatSceneLike | undefined;
    };
  };
  debug: {
    debugDrawCards(count: number): void;
    debugAddMoonPower(amount?: number): void;
    debugSetBloodMoon(rounds: number): void;
  };
}

interface CombatSceneLike {
  inputLocked: boolean;
  playback?: { busy: boolean };
  unitViews: Map<string, { getBounds(): { x: number; y: number; width: number; height: number } }>;
  unitSpecs: Map<string, { hp: number; armor: number }>;
  cardViews: Map<string, unknown>;
  children: { list: { depth?: number }[] };
  root?: { list?: SceneNode[] };
  restart(): void;
  dispatch(action: unknown): void;
  requestRender(): void;
  scene: { key: string; start(key: string): void };
}

interface SceneNode {
  type?: string;
  text?: string;
  depth?: number;
  list?: SceneNode[];
}

/** Scene key of the active scene, "" while the game boots. */
export function activeSceneKey(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: VnHandle }).__vn?.game.scene.getScenes(true)[0]?.scene.key ?? "",
  );
}

/** Clicks a design-space (1280×720) coordinate on the EXPAND-fitted canvas. */
export async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  const s = Math.min(box!.width / 1280, box!.height / 720);
  const left = box!.x + (box!.width - 1280 * s) / 2;
  const top = box!.y + (box!.height - 720 * s) / 2;
  await page.mouse.click(left + x * s, top + y * s);
}

/** Waits for the rendered caption, since terminal network state can precede playback commit. */
export async function clickSceneText(page: Page, sceneKey: string, label: string): Promise<void> {
  const bounds = () => page.evaluate(({ sceneKey, label }) => {
    const scene = (window as any).__vn?.game.scene.getScene(sceneKey);
    const find = (nodes: any[]): any => {
      for (const node of nodes) {
        if (node.type === "Text" && node.text === label && node.scene) return node;
        if (node.list) { const found = find(node.list); if (found) return found; }
      }
      return null;
    };
    const text = find(scene?.root?.list ?? []);
    if (!text) return null;
    const b = text.getBounds();
    return {x:b.centerX,y:b.centerY};
  }, {sceneKey,label});
  await expect.poll(bounds, {timeout:60_000}).not.toBeNull();
  const point = (await bounds())!;
  await clickDesign(page, point.x, point.y);
}

/** Polls until the playback queue drains and input unlocks — never a fixed sleep. */
export async function waitIdle(page: Page, timeout = 15_000): Promise<void> {
  await expect
    .poll(async () => (await probeCombat(page)).inputLocked, { timeout })
    .toBe(false);
}

/** A serializable snapshot of the live combat scene. */
export function probeCombat(page: Page): Promise<CombatProbe> {
  return page.evaluate(() => {
    const handle = (window as unknown as { __vn: VnHandle }).__vn;
    const scene = handle.game.scene.getScene("combat");
    const units: CombatProbe["units"] = [];
    scene?.unitViews?.forEach((view, id) => {
      const b = view.getBounds();
      const spec = scene.unitSpecs.get(id);
      units.push({ id, bounds: { x: b.x, y: b.y, w: b.width, h: b.height }, hp: spec?.hp ?? -1, armor: spec?.armor ?? -1 });
    });
    const texts: string[] = [];
    const walk = (list: SceneNode[] | undefined) => {
      list?.forEach((node) => {
        if (node.type === "Text" && typeof node.text === "string") texts.push(node.text);
        if (Array.isArray(node.list)) walk(node.list);
      });
    };
    // Walk every top-level display object — the board lives under `root` but
    // the inspector modal, FX floats and tooltips are scene-level children.
    walk(scene?.children.list as SceneNode[] | undefined);
    // FX live at scene depth ≥90 (floats/flashes); the inspector sits at 1600.
    const temporaryFxCount = (scene?.children.list ?? []).filter(
      (node) => (node.depth ?? 0) >= 90 && (node.depth ?? 0) < 1600,
    ).length;
    return {
      inputLocked: scene?.inputLocked ?? true,
      busy: scene?.playback?.busy ?? false,
      units,
      texts,
      temporaryFxCount,
      handCount: scene?.cardViews?.size ?? 0,
    };
  });
}

export async function applyScenario(page: Page, scenario: CombatScenario): Promise<void> {
  if (scenario === "default") return;
  await page.evaluate((sc) => {
    const handle = (window as unknown as { __vn: VnHandle }).__vn;
    const scene = handle.game.scene.getScene("combat")!;
    // Online matches render `match.view` (the server-redacted snapshot), not
    // `session.state` — the scene's `this.state` is whichever source is live.
    const session = handle.session as unknown as { match?: { view: VnHandle["session"]["state"] } };
    const state = session.match?.view ?? handle.session.state;
    const seat = state.players[0]!;
    if (sc === "hand0" || sc === "hand1" || sc === "hand8" || sc === "hand10") {
      const target = sc === "hand0" ? 0 : sc === "hand1" ? 1 : sc === "hand8" ? 8 : 10;
      while (seat.hand.length > target) seat.drawPile.unshift(seat.hand.pop()!);
      // Push past the rules' handLimit on purpose — the layout must squeeze a
      // 10-card hand even though play can never hold one (e2e-only fixture).
      while (seat.hand.length < target && seat.drawPile.length > 0) seat.hand.push(seat.drawPile.shift()!);
    } else if (sc === "denseStatus") {
      const hero = state.heroes[0]!;
      const statuses: { id: string; value: number; sourceId: string }[] = [
        "strength", "weak", "vulnerable", "mark", "burn", "regen", "empower",
        "freeze", "reflect", "guard", "charm", "stealth", "taunt",
      ].map((id, i) => ({ id, value: (i % 4) + 1, sourceId: state.enemies[0]?.id ?? "debug" }));
      hero.statuses.push(...statuses);
      hero.sealedBy = state.enemies[0]?.id;
    } else if (sc === "longChoice") {
      // Chọn Pha panel — the decree text is the long one (`18` §2.2).
      seat.pendingChoice = { kind: "chooseMoon", options: [0, 1, 2] };
      state.status = "choosing";
    } else if (sc === "summonRevive") {
      const hero = state.heroes[0]!;
      state.summons = [
        ...(state.summons ?? []),
        {
          id: "e2e_summon_1",
          defId: "tho_ngoc",
          side: "hero",
          position: 0,
          hp: 12,
          maxHp: 12,
          armor: 0,
          statuses: [],
          alive: true,
          player: 0,
          ownerHeroId: hero.id,
          summonId: "tho_ngoc",
        },
      ];
      // A fallen ally beside the summon — the revive-context layout case.
      const fallen = state.heroes[2];
      if (fallen !== undefined) {
        fallen.alive = false;
        fallen.hp = 0;
        fallen.statuses = [];
      }
    } else if (sc === "multiHit") {
      handle.debug.debugAddMoonPower(9);
    } else if (sc === "bloodMoon") {
      handle.debug.debugSetBloodMoon(2);
    }
    scene.requestRender();
  }, scenario);
  await waitIdle(page);
}

/** Every Text object inside the active scene's (nested) display containers. */
export function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((sceneKey) => {
    const handle = (window as unknown as { __vn: { game: VnHandle["game"] } }).__vn;
    const scene = handle.game.scene.getScenes(true)[0];
    if (!scene || scene.scene.key !== sceneKey) return [];
    const texts: string[] = [];
    const walk = (list: SceneNode[] | undefined) => {
      list?.forEach((node) => {
        if (node.type === "Text" && typeof node.text === "string") texts.push(node.text);
        if (Array.isArray(node.list)) walk(node.list);
      });
    };
    walk(scene.children.list as SceneNode[] | undefined);
    return texts;
  }, key);
}

/** Saves a scenario screenshot under `test-results/combat-visual/<viewport>/<scenario>.png`. */
export async function captureCombat(page: Page, viewport: string, scenario: string): Promise<void> {
  await page.screenshot({ path: `test-results/combat-visual/${viewport}/${scenario}.png` });
}
