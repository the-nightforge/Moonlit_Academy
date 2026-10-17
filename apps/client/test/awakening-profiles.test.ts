import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadGameData } from "data";
import { HERO_AWAKENINGS, awakeningEffectsFor } from "../src/ui/awakening-profiles";

const ids = Object.keys(loadGameData().heroes);
it("assigns a dedicated illustration and distinct motion to every hero, with no generic fallback", () => {
  expect(Object.keys(HERO_AWAKENINGS).sort()).toEqual(ids.sort());
  expect(new Set(ids.map(id=>HERO_AWAKENINGS[id]!.texture)).size).toBe(25);
  expect(new Set(ids.map(id=>JSON.stringify(HERO_AWAKENINGS[id]!.motion))).size).toBe(25);
  expect(awakeningEffectsFor("unknown")).toEqual([]);
  for (const id of ids) {
    const p=HERO_AWAKENINGS[id]!;
    expect(awakeningEffectsFor(id)).toEqual([p.texture]);
    expect(p.motion.charge + p.motion.blend + p.motion.release).toBe(520);
    expect(p.motion.charge % 2).toBe(0);
  }
});

it("ships 25 different image contents rather than aliases or renamed copies", () => {
  const hashes=ids.map(id=>{
    const bytes=readFileSync(join(__dirname,"../public/assets/vfx",`${HERO_AWAKENINGS[id]!.texture}.webp`));
    return createHash("sha256").update(bytes).digest("hex");
  });
  expect(new Set(hashes).size).toBe(25);
});
