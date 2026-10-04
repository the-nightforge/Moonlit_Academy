import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "data";

/**
 * Art inventory regression (`05` review U5): every hero normal, every Thức
 * Tỉnh `_up`, every enemy and every summon has a file under `public/assets`
 * so `coverImage` never has to fall back to the silhouette. The manifest
 * plugin keys textures by stem — two extensions under one stem would
 * silently overwrite each other, so stems must stay unique.
 */
const ASSETS = join(__dirname, "..", "public", "assets");

function stems(dir: string): Set<string> {
  try {
    return new Set(
      readdirSync(join(ASSETS, dir))
        .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
        .map((name) => name.replace(/\.[^.]+$/, "")),
    );
  } catch {
    return new Set();
  }
}

function duplicateStems(dir: string): string[] {
  try {
    const seen = new Map<string, number>();
    for (const name of readdirSync(join(ASSETS, dir))) {
      if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
      const stem = name.replace(/\.[^.]+$/, "");
      seen.set(stem, (seen.get(stem) ?? 0) + 1);
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([stem]) => stem);
  } catch {
    return [];
  }
}

const data = loadGameData();
const heroIds = Object.keys(data.heroes).sort();
const enemyIds = Object.keys(data.enemies).sort();
const summonIds = Object.keys(data.summons).sort();
const heroes = stems("heroes");
const enemies = stems("enemies");
const summons = stems("summons");

describe("combat art inventory (`05` review U5)", () => {
  it("every hero has a normal portrait", () => {
    const missingNormalHeroes = heroIds.filter((id) => !heroes.has(id));
    expect(missingNormalHeroes).toEqual([]);
  });

  it("every hero has a Thức Tỉnh `_up` portrait", () => {
    const missingUpHeroes = heroIds.filter((id) => !heroes.has(`${id}_up`));
    expect(missingUpHeroes).toEqual([]);
  });

  it("every enemy has a portrait", () => {
    const missingEnemies = enemyIds.filter((id) => !enemies.has(id));
    expect(missingEnemies).toEqual([]);
  });

  it("every summon has a portrait", () => {
    const missingSummons = summonIds.filter((id) => !summons.has(id));
    expect(missingSummons).toEqual([]);
  });

  it("no texture-key collisions across extensions", () => {
    const duplicateTextureKeys = ["heroes", "enemies", "summons", "cards", "hud"].flatMap((dir) =>
      duplicateStems(dir).map((stem) => `${dir}:${stem}`),
    );
    expect(duplicateTextureKeys).toEqual([]);
  });

  it("inventory covers every definition — no id may fall back silently", () => {
    // The four asserts above reject missing ids; this one keeps the list
    // honest: the count is 20 heroes ×2 forms + 15 enemies + 2 summons = 57.
    const expected = heroIds.length * 2 + enemyIds.length + summonIds.length;
    expect(expected).toBe(57);
  });
});
