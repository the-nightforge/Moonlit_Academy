import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfile, starterDeck, validateDeck } from "rules";
import type { SavedDeck } from "rules";

// Rendering needs a browser/canvas; only that boundary is replaced. Scene
// callbacks, profile validation and session writes below remain production code.
vi.mock("phaser", () => ({ default: { Scene: class {}, GameObjects: { Events: { DESTROY: "destroy" } }, Scenes: { Events: { SHUTDOWN: "shutdown" } } } }));
vi.mock("virtual:assets-manifest", () => ({ default: {} }));
vi.stubGlobal("window", { devicePixelRatio: 1, screen: { width: 1280, height: 720 } });

const { DeckSelectScene } = await import("../src/scenes/deck-select-scene");
const { session } = await import("../src/session");

class Node {
  list: Node[] = [];
  text = "";
  width = 0;
  height = 0;
  displayWidth = 0;
  displayHeight = 0;
  x = 0;
  y = 0;
  scene = {};
  parentContainer: Node | null = null;
  add(value: Node | Node[]) { for (const child of Array.isArray(value) ? value : [value]) { child.parentContainer = this; this.list.push(child); } return this; }
  removeAll() { this.list = []; return this; }
  setText(value: string) { this.text = value; this.width = value.length * 7; return this; }
  setOrigin() { return this; } setSize(w: number, h: number) { this.width = w; this.height = h; return this; }
  setInteractive() { return this; } setStrokeStyle() { return this; } setStroke() { return this; }
  setDisplaySize(w: number, h: number) { this.displayWidth = w; this.displayHeight = h; return this; }
  setScale(scale: number) { this.displayWidth = this.width * scale; this.displayHeight = this.height * scale; return this; }
  setAlpha() { return this; } setDepth() { return this; } setVisible() { return this; }
  fillStyle() { return this; } fillRoundedRect() { return this; } lineStyle() { return this; } strokeRoundedRect() { return this; }
  on() { return this; } once() { return this; } destroy() { return this; }
}

type HarnessScene = {
  renderDeckList(panel: Node): void; closeDeckOverlay(): void;
  deckGearTile(parent: Node, x: number, y: number, width: number, key: string, name: string, detail: string): void;
  previewDeckId: string | null; overlayPanel: Node | null; root: Node;
  overlayScroller: { first: number; range(total: number, visible: number): number[]; scrollBy(): void };
  [key: string]: unknown;
};

function harness() {
  const scene = new DeckSelectScene() as unknown as HarnessScene;
  const buttons = new Map<string, { run: () => void; enabled: boolean }>();
  const rows: { panel: Node; run: () => void }[] = [];
  const panel = new Node();
  const images: Node[] = [];
  scene.root = new Node();
  scene.overlayPanel = panel;
  scene.previewDeckId = "d1";
  scene.reducedMotion = true;
  scene.add = {
    graphics: () => new Node(), rectangle: () => new Node(), circle: () => new Node(),
    container: (x = 0, y = 0, list: Node[] = []) => Object.assign(new Node().add(list), { x, y }),
    text: (_x: number, _y: number, value: string) => new Node().setText(value),
    image: () => { const image = Object.assign(new Node(), { width: 100, height: 200 }); images.push(image); return image; },
  };
  scene.textures = { exists: () => false };
  scene.controls = { bind: (_hit: Node, row: Node, options: { activate: () => void }) => rows.push({ panel: row, run: options.activate }), setLayer: () => undefined, info: () => undefined };
  scene.overlayScroller = { first: 0, range: (total: number, visible: number) => [0, Math.min(total, visible)], scrollBy: () => undefined };
  const captureControl = (_panel: Node, _x: number, _y: number, _sizeOrIcon: number | string, label: string, run: () => void, enabled = true) => buttons.set(label, { run, enabled });
  scene.button = captureControl;
  scene.iconButton = captureControl;
  scene.render = () => undefined;
  scene.queueHeroArt = () => undefined;
  scene.scene = { isActive: () => true, start: () => undefined };
  const render = () => { rows.length = 0; buttons.clear(); scene.renderDeckList(panel); };
  const preview = (name: string) => {
    const row = rows.find((entry) => entry.panel.list.some((node) => node.text.startsWith(name)));
    expect(row, `row ${name}`).toBeDefined(); row!.run();
  };
  const click = (label: string) => {
    const control = [...buttons].find(([name]) => name.includes(label))?.[1];
    expect(control, `control ${label}`).toBeDefined(); if (control!.enabled) control!.run();
  };
  render();
  return { scene, preview, click, buttons, images };
}

let snapshot: Pick<typeof session, "profile" | "selectedDeckId" | "editingDeck" | "online">;
beforeEach(() => {
  snapshot = { profile: session.profile, selectedDeckId: session.selectedDeckId, editingDeck: session.editingDeck, online: session.online };
  const team = [...session.heroIds] as SavedDeck["heroIds"];
  const makeDeck = (id: string, name: string): SavedDeck => ({ id, name, heroIds: team, cardIds: starterDeck(session.data, team) });
  session.profile = createProfile(session.data);
  session.profile.decks = [makeDeck("d1", "Đang xuất trận"), makeDeck("d2", "Đội đang xem")];
  session.selectedDeckId = "d1";
  session.online = true;
  session.editingDeck = null;
});
afterEach(() => Object.assign(session, snapshot));

describe("deck modal transaction", () => {
  it("preview then close preserves the active deck", () => {
    const modal = harness(); modal.preview("Đội đang xem");
    expect(session.selectedDeckId).toBe("d1");
    modal.scene.closeDeckOverlay(); expect(session.selectedDeckId).toBe("d1");
  });
  it("confirmation alone applies the preview deck", () => {
    const modal = harness(); modal.preview("Đội đang xem"); modal.click("Dùng bộ bài này");
    expect(session.selectedDeckId).toBe("d2");
  });
  it("copy uses the preview and leaves the original and active deck intact", () => {
    const modal = harness(); modal.preview("Đội đang xem"); modal.click("Sao chép");
    expect(session.editingDeck?.id).toBe("");
    expect(session.editingDeck?.name).toBe("Đội đang xem (bản sao)");
    expect(session.selectedDeckId).toBe("d1");
    expect(session.profile.decks[1]?.name).toBe("Đội đang xem");
  });
  it("a deck valid only for PvP can be confirmed", () => {
    const deck = session.profile.decks[1]!;
    session.profile.heroes = {};
    deck.heroIds = [...session.data.pvpConfig.trialHeroIds.slice(0, 3)] as SavedDeck["heroIds"];
    deck.cardIds = starterDeck(session.data, deck.heroIds);
    expect(validateDeck(session.data, session.profile, deck).length).toBeGreaterThan(0);
    expect(validateDeck(session.data, session.profile, deck, { mode: "pvp" })).toEqual([]);
    const modal = harness(); modal.preview("Đội đang xem"); modal.click("Dùng bộ bài này");
    expect(session.selectedDeckId).toBe("d2");
  });
  it("an invalid preview cannot be confirmed", () => {
    session.profile.decks[1]!.cardIds = [];
    const modal = harness(); modal.preview("Đội đang xem"); modal.click("Dùng bộ bài này");
    expect(session.selectedDeckId).toBe("d1");
  });
  it("portrait equipment art keeps its aspect ratio inside the thumbnail", () => {
    const modal = harness();
    modal.scene.textures = { exists: () => true };
    modal.scene.deckGearTile(new Node(), 0, 0, 168, "weapons:w1", "Vũ khí", "Tinh Luyện 1");
    expect(modal.images[0]?.displayWidth).toBeCloseTo(28);
    expect(modal.images[0]?.displayHeight).toBeCloseTo(56);
  });
});
