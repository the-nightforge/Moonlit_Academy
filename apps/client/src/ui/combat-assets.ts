import type Phaser from "phaser";
import type { CombatState, SavedDeck } from "rules";
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
export interface CombatAssetSelection {
  heroIds?: readonly string[];
  enemyIds?: readonly string[];
  weaponIds?: readonly string[];
  relicIds?: readonly string[];
}

export function deckAssetSelection(deck: Pick<SavedDeck, "heroIds" | "weapons" | "relicIds">): CombatAssetSelection {
  return { heroIds: deck.heroIds, weaponIds: Object.values(deck.weapons ?? {}).filter((id): id is string => !!id), relicIds: deck.relicIds ?? [] };
}

/** Public roster and equipped gear suffice even when opponent hands/decks are redacted. */
export function battleAssetSelection(state: CombatState): CombatAssetSelection {
  return {
    heroIds: state.heroes.map(hero => hero.defId), enemyIds: state.enemies.map(enemy => enemy.defId),
    weaponIds: state.players.flatMap(player => player.weapons.map(weapon => weapon.weaponId)),
    relicIds: state.players.flatMap(player => player.relics.map(relic => relic.id)),
  };
}

export function combatTextureEntries(files: Record<string, Record<string, string>>, selection: CombatAssetSelection = {}): CombatTextureEntry[] {
  const entries: CombatTextureEntry[] = [];
  const selected: Record<string, Set<string>> = {
    heroes: new Set((selection.heroIds ?? []).flatMap(id => [id, `${id}_up`])),
    enemies: new Set(selection.enemyIds ?? []), weapons: new Set(selection.weaponIds ?? []), relics: new Set(selection.relicIds ?? []),
  };
  for (const category of COMBAT_CATEGORIES) {
    for (const [stem, url] of Object.entries(files[category] ?? {})) {
      if (selected[category] && !selected[category].has(stem)) continue;
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
  selection?: CombatAssetSelection;
  /** Stops scheduling when this particular scene/account/request has gone away. */
  isCurrent?: () => boolean;
  concurrency?: number;
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
  // Phaser sets RUNNING only after synchronous create() returns. Callers attach
  // shutdown/request guards before entering this gate, including on restart.
  await Promise.resolve();
  const files = options.files ?? combatTextureEntries(manifest, options.selection);
  const current = () => scene.scene.isActive() && (options.isCurrent?.() ?? true);
  let done = 0;
  const total = files.length;
  const load = async (entry: CombatTextureEntry): Promise<string | null> => {
    try {
      await queueTexture(scene, entry.key, entry.url);
      return null;
    } catch {
      if (!current()) return entry.key;
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
  const results: (string | null)[] = new Array(files.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      if (!current()) { results[index] = files[index]!.key; continue; }
      results[index] = await load(files[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(total, options.concurrency ?? 6)) }, worker));
  const failed = results.filter((key): key is string => key !== null);
  return { loaded: total - failed.length, failed };
}
