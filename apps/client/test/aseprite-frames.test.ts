import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type Phaser from "phaser";
import { expect, it } from "vitest";
import { registerFlowFrames } from "../src/ui/illustrated-flow";

const require = createRequire(import.meta.url);
const Frame = require(join(dirname(require.resolve("phaser/package.json")), "src/textures/Frame"));
const sheets = [
  ["combat_attack_bow_flow", 5, 4, 20, 1024, 496, 9],
  ["combat_attack_ribbon_flow", 4, 6, 24, 1328, 544, 10],
  ["awakening_f06_flow", 4, 4, 16, 832, 208, 7],
] as const;

it.each(sheets)("%s uses Aseprite export rectangles and one native frame size/anchor", (stem, columns, rows, count, duration, impact, peak) => {
  const atlas = JSON.parse(readFileSync(join(__dirname, `../public/assets/vfx/${stem}.json`), "utf8"));
  const { w: width, h: height } = atlas.meta.size;
  const frames = new Map<string, any>();
  const texture: any = {
    source: [{ width, height }], getSourceImage: () => ({ width, height }), has: (key: string) => frames.has(key),
    add(key: string, index: number, x: number, y: number, w: number, h: number) {
      const frame = new Frame(texture, key, index, x, y, w, h); frames.set(key, frame); return frame;
    },
  };
  const scene = { textures: { exists: () => true, get: () => texture } } as unknown as Phaser.Scene;
  // Deliberately wrong legacy offsets: the exported rectangles must take precedence.
  const grid = { columns, rows, count, offsetX: 50, offsetY: 30, atlas };
  const bounds = registerFlowFrames(scene, `vfx:${stem}`, "test", grid);
  expect(bounds).toEqual({ width: atlas.frames[0].sourceSize.w, height: atlas.frames[0].sourceSize.h });
  expect(frames.size).toBe(count);
  atlas.frames.forEach((entry: any, index: number) => {
    const frame = frames.get(`test-${index}`)!;
    expect([frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight]).toEqual([entry.frame.x, entry.frame.y, entry.frame.w, entry.frame.h]);
    expect([frame.realWidth, frame.realHeight, frame.x, frame.y]).toEqual([bounds!.width, bounds!.height, 0, 0]);
  });
  expect(atlas.frames.reduce((sum: number, frame: any) => sum + frame.duration, 0)).toBe(duration);
  expect(atlas.frames.slice(0, peak).reduce((sum: number, frame: any) => sum + frame.duration, 0)).toBe(impact);
});

it("rejects stale or out-of-bounds Aseprite metadata without partially registering frames", () => {
  const atlas = JSON.parse(readFileSync(join(__dirname, "../public/assets/vfx/combat_attack_bow_flow.json"), "utf8"));
  atlas.frames[19].frame.x = atlas.meta.size.w;
  const add = () => { throw new Error("Invalid metadata must be validated before adding any frames"); };
  const scene = { textures: { exists: () => true, get: () => ({ getSourceImage: () => ({ width: atlas.meta.size.w, height: atlas.meta.size.h }), has: () => false, add }) } } as unknown as Phaser.Scene;
  expect(registerFlowFrames(scene, "vfx:combat_attack_bow_flow", "test", { columns: 5, rows: 4, count: 20, atlas } as any)).toBeNull();
});

it("ships the verified Aseprite documents and matching PNG/JSON exports with intact anchors and timing", () => {
  const root = join(__dirname, "../../..");
  const audit = JSON.parse(readFileSync(join(root, "docs/assets/aseprite-motion-audit.json"), "utf8"));
  const files = JSON.parse(readFileSync(join(root, "docs/assets/aseprite-motion-files.json"), "utf8"));
  expect(audit.tool).toBe("Aseprite");
  expect(audit.assets).toHaveLength(3);
  expect(files).toHaveLength(9);
  for (const entry of files) {
    expect(createHash("sha256").update(readFileSync(join(root, entry.path))).digest("hex")).toBe(entry.sha256);
  }
  for (const entry of audit.assets) {
    const atlas = JSON.parse(readFileSync(join(root, entry.metadata), "utf8"));
    const png = readFileSync(join(root, entry.sheet));
    const editable = readFileSync(join(root, entry.editable));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([atlas.meta.size.w, atlas.meta.size.h]);
    expect(editable.readUInt16LE(4)).toBe(0xa5e0);
    expect([editable.readUInt16LE(6), editable.readUInt16LE(8), editable.readUInt16LE(10)]).toEqual([atlas.frames.length, entry.width, entry.height]);
    const bow=entry.stem==="combat_attack_bow_flow";
    if(bow)expect(entry.rigidCoreVerified).toBe(true);
    else {expect(entry.landmarkAligned).toBe(true);expect(entry.sourcePixelsPreserved).toBe(true);}
    expect(entry.alignment.alignment).toBe(bow?"arrowhead":"flower");
    const {bounds,pivot}=atlas.meta.slices.find((slice:any)=>slice.name===(bow?"arrowhead":"presentation")).keys[0];
    expect(entry.anchor).toEqual({x:bounds.x+pivot.x,y:bounds.y+pivot.y});
    expect(entry.reimportVerified).toBe(true);
    expect(entry.frames.every((frame: any) => frame.maxEdgeAlpha < 16 && frame.visiblePixels > 0)).toBe(true);
    expect(entry.frames.map((frame: any) => frame.duration)).toEqual(atlas.frames.map((frame: any) => frame.duration));
  }
});
