import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
it("ships the three accepted motion sheets and four full illustrated layers", () => {
  const meta = JSON.parse(readFileSync(resolve(root, "docs/assets/layered-motion-generated.json"), "utf8"));
  expect(meta.assets).toHaveLength(7);
  const expected: Record<string, [number, number, number, number, number]> = {
    combat_attack_bow_flow: [5, 4, 20, -20, 0],
    combat_attack_ribbon_flow: [4, 6, 24, 10, 32],
    awakening_f06_flow: [4, 4, 16, 0, 0],
  };
  let frames = 0;
  for (const asset of meta.assets) {
    const file = readFileSync(resolve(root, asset.path));
    expect(createHash("sha256").update(file).digest("hex")).toBe(asset.sha256);
    expect(file.subarray(8, 12).toString()).toBe("WEBP");
    expect(asset.alphaRange[0]).toBe(0);
    expect(asset.refs.length).toBeGreaterThan(0);
    if (!asset.layout) {
      expect(asset.stem).toMatch(/^combat_layer_(bow_(air|leaves)|ribbon_(silk|petals))$/);
      expect([asset.width, asset.height]).toEqual([768, 512]);
      continue;
    }
    const grid = asset.layout;
    expect([grid.columns, grid.rows, grid.count, grid.offsetX, grid.offsetY]).toEqual(expected[asset.stem]);
    expect(asset.frames).toHaveLength(grid.count);
    expect(new Set(asset.frames.map((frame: any) => frame.sha256)).size).toBe(grid.count);
    expect(asset.frames.every((frame: any) => frame.maxEdgeAlpha < 16 && frame.alphaRange[0] === 0 && frame.alphaRange[1] > 128)).toBe(true);
    frames += grid.count;
  }
  expect(frames).toBe(60);
});
