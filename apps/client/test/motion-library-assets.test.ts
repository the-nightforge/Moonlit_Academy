import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { libraryMotion, libraryMotions } from "../src/ui/motion-library";
import combatSources from "../../../docs/assets/combat-motion-generated.json";
import awakeningSources from "../../../docs/assets/awakening-flipbooks-generated.json";
import exportedFiles from "../../../docs/assets/motion-library-files.json";
import audit from "../../../docs/assets/motion-library-audit.json";
import recovery from "../../../docs/assets/motion-source-recovery-audit.json";
import { ATTACK_MOTION } from "../src/ui/vfx";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";
import { libraryFramePosition } from "../src/ui/library-motion-clock";

describe("remaining illustrated animation library", () => {
  it("covers every remaining attack, support effect and hero without replacing approved samples", () => {
    const expected = [
      ...combatSources.assets.filter(source => /^(attack|effect)_/.test(source.id) && !["attack_bow", "attack_ribbon"].includes(source.id)),
      ...awakeningSources.assets.filter(source => source.heroId !== "f06"),
    ].map(source => `vfx:${source.stem}`).sort();
    expect(libraryMotions.map(item => item.sourceKey).sort()).toEqual(expected);
    expect(expected).toHaveLength(49);
    for (const key of ["vfx:combat_attack_bow", "vfx:combat_attack_ribbon", "vfx:awakening_f06_motion", "heroes:m12", "vfx:unknown"]) {
      expect(libraryMotion(key)).toBeUndefined();
    }
  });

  it("retains exact untrimmed rectangles, fixed presentation pivots and phase milestones", () => {
    for (const item of libraryMotions) {
      expect(libraryMotion(item.sourceKey)).toBe(item);
      expect(item.atlas.frames).toHaveLength(item.count);
      expect(item.count).toBe(8);
      const entry = audit.assets.find(asset => `vfx:${asset.sourceStem}` === item.sourceKey)!;
      expect(entry.reimportVerified).toBe(true);
      expect(entry.sourcePixelsPreserved).toBe(true);
      const frames = item.atlas.frames;
      const atlasPath = `../../../apps/client/public/assets/vfx/${item.textureKey.slice(4)}.json`;
      const exported = JSON.parse(readFileSync(new URL(atlasPath, import.meta.url), "utf8"));
      expect(frames).toEqual(exported.frames.map(({ frame, duration, rotated, trimmed, sourceSize, spriteSourceSize }: any) =>
        ({ frame, duration, rotated, trimmed, sourceSize, spriteSourceSize })));
      expect(item.atlas.meta.size).toEqual(exported.meta.size);
      const presentation = exported.meta.slices.find((slice: { name: string }) => slice.name === "presentation").keys[0];
      expect(item.anchor).toEqual({ x: presentation.bounds.x + presentation.pivot.x, y: presentation.bounds.y + presentation.pivot.y });
      expect(frames.reduce((sum, frame) => sum + frame.duration, 0)).toBe(entry.duration);
      expect(frames.slice(0, item.peak).reduce((sum, frame) => sum + frame.duration, 0)).toBe(entry.impactAt);
      let elapsed = 0;
      frames.forEach((frame, index) => {
        if (index > 0 && index < frames.length - 1) {
          // Quantized editor start time is within one physical millisecond of the game clock.
          const before = libraryFramePosition(Math.max(0, elapsed - 1), entry.duration, entry.impactAt, item.count, item.peak);
          const after = libraryFramePosition(elapsed + 1, entry.duration, entry.impactAt, item.count, item.peak);
          expect(before).toBeLessThanOrEqual(index);
          expect(after).toBeGreaterThanOrEqual(index);
        }
        elapsed += frame.duration;
      });
      if (item.sourceKey.startsWith("vfx:combat_attack_")) {
        const style = item.sourceKey.slice("vfx:combat_attack_".length);
        const motion = ATTACK_MOTION[style as keyof typeof ATTACK_MOTION]!;
        expect(entry.duration).toBe(Math.round(motion.duration * item.stretch));
        expect(entry.impactAt).toBe(Math.round(motion.impactAt * item.stretch));
      } else if (item.sourceKey.startsWith("vfx:awakening_")) {
        const hero = item.sourceKey.split("_")[1]!;
        expect(entry.duration).toBe(832);
        expect(entry.impactAt).toBe(Math.round(HERO_AWAKENINGS[hero]!.motion.charge * item.stretch));
      }
      const size = frames[0]!.sourceSize;
      expect(item.anchor.x).toBeGreaterThan(0);
      expect(item.anchor.y).toBeGreaterThan(0);
      expect(item.anchor.x).toBeLessThan(size.w);
      expect(item.anchor.y).toBeLessThan(size.h);
      expect(item.presentationSize).toEqual({ width: 384, height: 512 });
      for (const frame of frames) {
        expect(frame.rotated || frame.trimmed).toBe(false);
        expect(frame.sourceSize).toEqual(size);
        expect(frame.spriteSourceSize).toEqual({ x: 0, y: 0, w: size.w, h: size.h });
        expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(item.atlas.meta.size.w);
        expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(item.atlas.meta.size.h);
      }
    }
  });

  it("ships checked PNG, JSON and editable sources matching portable hashes", () => {
    expect(exportedFiles).toHaveLength(49 * 3);
    for (const file of exportedFiles) {
      const bytes = readFileSync(new URL(`../../../${file.path}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(file.sha256);
      if (file.path.endsWith(".png")) expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      if (file.path.endsWith(".aseprite")) expect(bytes.readUInt16LE(4)).toBe(0xa5e0);
    }
  });

  it("retains complete source provenance for every recovered animation", () => {
    expect(recovery.assets).toHaveLength(49);
    expect(new Set(recovery.assets.map(asset => asset.stem)).size).toBe(49);
    expect(recovery.recoveredSources).toBe(49);
    expect(recovery.recoveredFrames).toBe(392);
    expect(recovery.strongSourceOuterEdgeContactSources).toBe(0);
    for (const asset of recovery.assets) {
      expect(asset.recovered, asset.stem).toBe(true);
      expect(asset.provenanceVerified, asset.stem).toBe(true);
      expect(asset.frames, asset.stem).toHaveLength(8);
      expect(asset.nonzeroSourcePixelsVerified, asset.stem).toBeGreaterThan(0);
      const source = readFileSync(new URL(`../../../${asset.source}`, import.meta.url));
      expect(createHash("sha256").update(source).digest("hex"), asset.stem).toBe(asset.sourceSha256);
      const editable = readFileSync(new URL(`../../../${asset.editable}`, import.meta.url));
      expect(editable.readUInt16LE(4), asset.stem).toBe(0xa5e0);
    }
  });
});
