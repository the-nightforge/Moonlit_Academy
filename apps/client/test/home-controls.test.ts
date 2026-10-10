import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Geom: { Rectangle: class { contains() { return true; } } },
  Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
} }));
vi.mock("../src/ui/theme", () => ({ COLORS: {}, TEXT_BASE: {} }));
vi.mock("../src/ui/rounded-panel", () => ({ roundedPanel: vi.fn() }));
import { HomeControls } from "../src/ui/home-controls";
import { RowScroller } from "../src/ui/widgets";

afterEach(() => vi.unstubAllGlobals());
describe("menu keyboard controls", () => {
  it("keeps a covered list still while a pinned preview owns interaction", () => {
    let wheel!: (pointer: any, over: unknown, dx: number, dy: number) => void;
    const scene = { input: { on: (_: string, handler: typeof wheel) => { wheel = handler; } }, events: { once: vi.fn() }, cameras: { main: { getWorldPoint: (x: number, y: number) => ({ x, y }) } } };
    const changed = vi.fn();
    let enabled = false;
    const list = new RowScroller(scene as any, { x: 0, y: 0, width: 100, height: 200 }, changed, () => enabled);
    list.range(12, 6);
    wheel({ x: 10, y: 10 }, [], 0, 100);
    list.scrollBy(1);
    expect(list.first).toBe(0);
    expect(changed).not.toHaveBeenCalled();
    enabled = true;
    wheel({ x: 10, y: 10 }, [], 0, 100);
    expect(list.first).toBe(1);
    expect(changed).toHaveBeenCalledOnce();
  });
  it.each(["INPUT", "TEXTAREA", "SELECT"])("lets %s retain typing and native navigation", (tagName) => {
    vi.stubGlobal("document", { activeElement: { tagName, isContentEditable: false } });
    const scene = { input: { keyboard: { on: vi.fn() } }, events: { once: vi.fn() } };
    const controls = new HomeControls(scene as any, true, () => false) as any;
    const activate = vi.fn();
    const preventDefault = vi.fn();
    controls.layer = {};
    controls.targets = [{ hit: { scene: {} }, panel: controls.layer, activate, focus: vi.fn(), blur: vi.fn() }];
    controls.focused = controls.targets[0];
    controls.onKey({ key: " ", preventDefault });
    expect(activate).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
