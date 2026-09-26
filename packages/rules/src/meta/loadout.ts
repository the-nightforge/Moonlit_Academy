import type { GameData, Loadout, Profile } from "../types/index";
import { deckWeapons } from "./deck";

/**
 * The team's constellations, second level-up forms and gear from the profile
 * (`14` §12). Takes a deck (with its gear) or bare hero ids (no gear).
 */
export function buildLoadout(
  data: GameData,
  profile: Profile,
  deck: readonly string[] | { heroIds: readonly string[]; weapons?: Record<string, string | null>; relicIds?: readonly string[] },
): { ok: true; loadout: Loadout } | { ok: false; error: string } {
  const gear = Array.isArray(deck) ? { heroIds: deck as readonly string[] } : (deck as Exclude<typeof deck, readonly string[]>);
  const weapons = new Map(deckWeapons(gear));
  const heroes: Loadout["heroes"] = {};
  for (const heroId of gear.heroIds) {
    const hero = profile.heroes[heroId];
    if (!hero || !data.heroes[heroId]) return { ok: false, error: "hero not owned" };
    const weaponId = weapons.get(heroId) ?? null;
    const weapon = weaponId !== null ? profile.weapons[weaponId] : undefined;
    if (weaponId !== null && (!weapon || !data.weapons[weaponId])) return { ok: false, error: "weapon not owned" };
    heroes[heroId] = {
      constellation: hero.constellation,
      // The second form needs Tinh Hồn 5 (`14` §10.1).
      levelUpForm: hero.levelUpForm === "alt" && hero.constellation >= 5 ? "alt" : "base",
      weaponId,
      refinement: weapon?.refinement ?? 0,
    };
  }
  const relics: NonNullable<Loadout["relics"]> = [];
  for (const relicId of "relicIds" in gear ? (gear.relicIds ?? []) : []) {
    const relic = profile.relics[relicId];
    if (!relic || !data.relics[relicId]) return { ok: false, error: "relic not owned" };
    relics.push({ id: relicId, resonance: relic.resonance });
  }
  return { ok: true, loadout: { heroes, relics } };
}
