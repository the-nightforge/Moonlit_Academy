import type Phaser from "phaser";
import manifest from "virtual:assets-manifest";
import { queueTexture } from "./texture-queue";

/**
 * Combat art manifest (`home-ui-redesign` §7): every category a fight can
 * touch, nothing gacha/Home-only. Keyed `category:stem` like the loader.
 */
const COMBAT_CATEGORIES = ["cards", "heroes", "enemies", "summons", "weapons", "relics", "ui", "vfx"] as const;
const COMBAT_BACKGROUND_STEM = "background";

export interface CombatTextureEntry {
  key: string;
  url: string;
}

/** The combat texture list for a manifest — a pure function so tests can pass a fake. */
export function combatTextureEntries(files: Record<string, Record<string, string>>): CombatTextureEntry[] {
  const entries: CombatTextureEntry[] = [];
  for (const category of COMBAT_CATEGORIES) {
    for (const [stem, url] of Object.entries(files[category] ?? {})) {
      entries.push({ key: `${category}:${stem}`, url });
    }
  }
  const background = files.backgrounds?.[COMBAT_BACKGROUND_STEM];
  if (background) entries.push({ key: `backgrounds:${COMBAT_BACKGROUND_STEM}`, url: background });
  return entries;
}

export interface PrepareCombatAssetsOptions {
  /** Called as each texture settles — `done` counts successes and failures. */
  onProgress?: (done: number, total: number) => void;
  /** Defaults to the §7 list of the real manifest; tests pass their own. */
  files?: CombatTextureEntry[];
}

/**
 * Waits until every combat texture exists in the TextureManager. A rejection
 * from `queueTexture` (owner scene died, file error) is retried once on this
 * scene's own loader before landing in `failed`.
 */
export async function prepareCombatAssets(
  scene: Phaser.Scene,
  options: PrepareCombatAssetsOptions = {},
): Promise<{ loaded: number; failed: string[] }> {
  const files = options.files ?? combatTextureEntries(manifest);
  let done = 0;
  const total = files.length;
  const load = async (entry: CombatTextureEntry): Promise<string | null> => {
    try {
      await queueTexture(scene, entry.key, entry.url);
      return null;
    } catch {
      if (!scene.scene.isActive()) return entry.key;
      try {
        await queueTexture(scene, entry.key, entry.url);
        return null;
      } catch {
        return entry.key;
      }
    } finally {
      done += 1;
      options.onProgress?.(done, total);
    }
  };
  const results = await Promise.all(files.map(load));
  const failed = results.filter((key): key is string => key !== null);
  return { loaded: total - failed.length, failed };
}
