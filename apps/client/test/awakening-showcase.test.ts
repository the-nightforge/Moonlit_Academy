import { expect, it, vi } from "vitest";
import { FakeRuntime, runToEnd } from "./helpers/fake-runtime";
import { playAwakening, awakeningTheme } from "../src/ui/awakening-showcase";

vi.mock("../src/ui/theme", () => ({ TEXT_BASE: { fontFamily: "serif" } }));

const details = { heroId: "m12", heroName: "Cừ Trấn Nam", formName: "Cổng Đồng", style: "slash" as const };

it("keeps new heroes' identities in their own awakening motifs", () => {
  expect(awakeningTheme("m12", "slash").motif).toBe("gate");
  expect(awakeningTheme("f13", "moon").motif).toBe("pages");
  expect(awakeningTheme("m06", "moon").motif).toBe("moon");
});

it.each([1, 2] as const)("shows hero and form names within a bounded beat at speed %s", async speed => {
  const rt = new FakeRuntime({ speed });
  await runToEnd(rt, playAwakening(rt, details));
  await rt.drain();
  expect(rt.texts).toContain(details.heroName);
  expect(rt.texts).toContain(details.formName);
  expect(rt.clock).toBeLessThanOrEqual(700 / speed);
  expect(rt.shakes).toHaveLength(0);
  expect(rt.rects.some(args => args[2] === 1280 && args[3] === 720)).toBe(true);
});

it("reduced motion uses fades without travel, scale or spinning", async () => {
  const rt = new FakeRuntime({ reducedMotion: true });
  await runToEnd(rt, playAwakening(rt, details));
  expect(rt.tweenConfigs.every(config => config.x === undefined && config.y === undefined && config.scale === undefined && config.rotation === undefined)).toBe(true);
  expect(rt.clock).toBeLessThanOrEqual(500);
});

it("missing portraits still show a complete textual awakening without an empty image frame", async () => {
  const rt = new FakeRuntime();
  rt.scene.textures.exists = () => false;
  await runToEnd(rt, playAwakening(rt, details));
  expect(rt.texts).toContain(details.formName);
  expect(rt.rects).toHaveLength(2); // backdrop and decorative panel only
});

it("abort removes the showcase and cannot resume another beat", async () => {
  const rt = new FakeRuntime();
  const result = playAwakening(rt, details);
  rt.dispose();
  await expect(result).rejects.toThrow("animation aborted");
  expect(rt.pendingCount).toBe(0);
});
