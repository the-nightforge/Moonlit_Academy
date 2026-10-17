import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "data";

vi.mock("../src/ui/theme", () => ({ RENDER_SCALE: 2 }));

import { battleAssetSelection, deckAssetSelection, combatTextureEntries, prepareCombatAssets } from "../src/ui/combat-assets";

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
    // honest: the count is 25 heroes ×2 forms + 15 enemies + 2 summons = 67.
    const expected = heroIds.length * 2 + enemyIds.length + summonIds.length;
    expect(expected).toBe(67);
  });
});

/**
 * §7 manifest for combat (`home-ui-redesign` Task 3): every art category a
 * fight can touch — and nothing from gacha or the Home background.
 */
describe("combatTextureEntries (`home-ui-redesign` Task 3)", () => {
  const manifest = {
    cards: { c1: "/assets/cards/c1.webp" },
    heroes: { m05: "/assets/heroes/m05.webp" },
    enemies: { e1: "/assets/enemies/e1.webp" },
    summons: { s1: "/assets/summons/s1.webp" },
    weapons: { w1: "/assets/weapons/w1.webp" },
    relics: { r1: "/assets/relics/r1.webp" },
    ui: { seal: "/assets/ui/seal.svg" },
    vfx: { hit: "/assets/vfx/hit.webp" },
    backgrounds: { background: "/assets/backgrounds/background.webp", home: "/assets/backgrounds/home.webp" },
    gacha: { banner: "/assets/gacha/banner.webp" },
  };

  it("lists the combat categories and nothing else", () => {
    const keys = combatTextureEntries(manifest, {heroIds:["m05"],enemyIds:["e1"],weaponIds:["w1"],relicIds:["r1"]}).map((entry) => entry.key);
    for (const expected of [
      "cards:c1", "heroes:m05", "enemies:e1", "summons:s1", "weapons:w1", "relics:r1", "ui:seal", "vfx:hit", "backgrounds:background",
    ]) {
      expect(keys).toContain(expected);
    }
    expect(keys).not.toContain("gacha:banner");
    expect(keys).not.toContain("backgrounds:home");
  });
});

describe("prepareCombatAssets (`home-ui-redesign` Task 3)", () => {
  class Loader extends EventEmitter {
    files: string[] = [];
    loading = false;
    constructor(private textures: Set<string>) {
      super();
    }
    isLoading() {
      return this.loading;
    }
    image(key: string, url: string) {
      this.files.push(`${key}=${url}`);
    }
    svg(key: string, url: string) {
      this.files.push(`${key}=${url}`);
    }
    start() {
      this.loading = true;
      queueMicrotask(() => {
        for (const file of this.files.splice(0)) {
          const key = file.split("=")[0]!;
          if (key === "cards:broken") {
            this.emit("loaderror", { key });
            continue;
          }
          this.textures.add(key);
          this.emit("filecomplete", key);
        }
        this.loading = false;
        this.emit("complete");
      });
    }
  }

  function scene() {
    const textures = new Set<string>();
    const events = new EventEmitter();
    const instance = {
      active: true,
      textures: { exists: (key: string) => textures.has(key) },
      load: new Loader(textures),
      events,
      scene: { isActive: () => instance.active },
      loader: null as Loader | null,
    };
    instance.loader = instance.load;
    return instance as any;
  }

  const files = [
    { key: "cards:c1", url: "/assets/cards/c1.webp" },
    { key: "cards:broken", url: "/assets/cards/broken.webp" },
    { key: "ui:seal", url: "/assets/ui/seal.svg" },
  ];

  it("loads every entry, reports the failed keys and progresses to done", async () => {
    const target = scene();
    const progress: string[] = [];
    const result = await prepareCombatAssets(target, {
      files,
      onProgress: (done, total) => progress.push(`${done}/${total}`),
    });
    expect(result.loaded).toBe(2);
    expect(result.failed).toEqual(["cards:broken"]);
    expect(progress.at(-1)).toBe("3/3");
  });

  it("waits for synchronous Phaser create to return before checking scene activity", async () => {
    const target = scene(); target.active = false;
    const result = prepareCombatAssets(target, { files: [files[0]!] });
    target.active = true; // SceneManager marks RUNNING after calling create().
    expect(await result).toEqual({ loaded: 1, failed: [] });
  });

  it("bounds scheduling and stops new jobs when a gate becomes stale", async () => {
    const target=scene(); const queued:string[]=[];
    target.load.start=()=>{target.load.loading=true;};
    target.load.image=(key:string)=>queued.push(key);
    let current=true;
    const result=prepareCombatAssets(target,{files:Array.from({length:12},(_,i)=>({key:`cards:${i}`,url:"/test.webp"})),concurrency:2,isCurrent:()=>current});
    await Promise.resolve();
    expect(queued).toHaveLength(2); current=false;
    for(const key of queued) target.load.emit("filecomplete",key);
    expect((await result).failed).toHaveLength(10);
    expect(queued).toHaveLength(2);
  });

  it("two gates share a pending texture and the surviving scene retries after owner shutdown", async () => {
    const owner=scene(), waiter=scene();
    waiter.textures=owner.textures;
    owner.load.start=()=>{owner.load.loading=true;};
    const one=[{key:"heroes:m05",url:"/m05.webp"}];
    const first=prepareCombatAssets(owner,{files:one});
    const second=prepareCombatAssets(waiter,{files:one});
    await Promise.resolve();
    expect(owner.load.files).toHaveLength(1);expect(waiter.load.files).toHaveLength(0);
    owner.active=false;owner.events.emit("shutdown");
    expect(await first).toEqual({loaded:0,failed:["heroes:m05"]});
    expect(await second).toEqual({loaded:1,failed:[]});
  });

  it("counts cached textures as loaded without touching the loader", async () => {
    const target = scene();
    target.textures.exists = () => true;
    const result = await prepareCombatAssets(target, { files });
    expect(result).toEqual({ loaded: 3, failed: [] });
    expect(target.loader!.files).toHaveLength(0);
  });
});


describe("combat selection uses visible roster and equipment", () => {
  it("loads only common and roster-specific awakening artwork, including the remote seat", () => {
    const vfx = Object.fromEntries(["hit", "awakening_m05_fire_spear", "awakening_m05_motion", "awakening_m12_motion", "awakening_f13_motion", "awakening_bronze_gate", "awakening_omen_pages", "awakening_lunar_aura"].map(stem => [stem, `/${stem}.webp`]));
    const keys = (heroIds: string[]) => combatTextureEntries({vfx}, {heroIds}).map(entry => entry.key);
    expect(keys(["m05"])).toEqual(["vfx:hit", "vfx:awakening_m05_fire_spear", "vfx:awakening_m05_motion"]);
    expect(keys(["m12"])).toContain("vfx:awakening_bronze_gate");
    expect(keys(["m12"])).not.toContain("vfx:awakening_omen_pages");
    expect(keys(["m05", "f13"])).toContain("vfx:awakening_omen_pages");
    expect(keys(["m05", "f13"])).toContain("vfx:awakening_f13_motion");
    expect(keys(["m05", "f13"])).not.toContain("vfx:awakening_m12_motion");
    expect(keys([])).toEqual(["vfx:hit"]);
  });
  it("does not queue unrelated gear or roster at a lobby gate", () => {
    const files = { heroes:{m05:"/m05.webp",m05_up:"/m05_up.webp",m01:"/m01.webp"}, weapons:{w1:"/w1.webp",w2:"/w2.webp"}, relics:{r1:"/r1.webp",r2:"/r2.webp"}, cards:{art_attack:"/attack.webp"}, summons:{s1:"/summon.webp"} };
    const selection=deckAssetSelection({heroIds:["m05","f04","m06"],weapons:{m05:"w1",m06:null},relicIds:["r1"]});
    expect(combatTextureEntries(files,selection).map(entry=>entry.key)).toEqual(["cards:art_attack","heroes:m05","heroes:m05_up","summons:s1","weapons:w1","relics:r1"]);
    expect(combatTextureEntries(files).map(entry=>entry.key)).toEqual(["cards:art_attack","summons:s1"]);
  });
  it("prepares both public sides and alternate forms without reading private cards", () => {
    const state = {heroes:[{defId:"m05"},{defId:"f09"}],enemies:[{defId:"boss"}],players:[{weapons:[{weaponId:"w1"}],relics:[]},{weapons:[{weaponId:"w2"}],relics:[{id:"r2"}]}],get cards(){throw new Error("private data accessed");}};
    const selection=battleAssetSelection(state as any);
    const files={heroes:{m05:"a",m05_up:"b",f09:"c",f09_up:"d",m01:"e"},weapons:{w1:"f",w2:"g",w3:"h"}};
    expect(combatTextureEntries(files,selection).map(entry=>entry.key)).toEqual(["heroes:m05","heroes:m05_up","heroes:f09","heroes:f09_up","weapons:w1","weapons:w2"]);
  });
});
