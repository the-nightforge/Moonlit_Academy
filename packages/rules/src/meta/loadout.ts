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

/** Largest odd constellation ≤ the real one (0→0, 1–2→1, 3–4→3, 5–6→5). */
function pvpConstellation(real: number): number {
  if (real <= 0) return 0;
  return Math.min(5, real % 2 === 1 ? real : real - 1);
}

/**
 * Fair Arena loadout (`17` §3.2): constellations to the odd cap of 5, all gear to
 * level 1, trial heroes allowed at constellation 0. Sets `pvp: true` so combat
 * keeps even-threshold bonuses off (`01` §15).
 */
export function buildPvpLoadout(
  data: GameData,
  profile: Profile,
  deck: { heroIds: readonly string[]; weapons?: Record<string, string | null>; relicIds?: readonly string[] },
): { ok: true; loadout: Loadout } | { ok: false; error: string } {
  const weapons = new Map(deckWeapons(deck));
  const heroes: Loadout["heroes"] = {};
  for (const heroId of deck.heroIds) {
    const hero = profile.heroes[heroId];
    const isTrial = data.pvpConfig.trialHeroIds.includes(heroId);
    if (!hero && !isTrial) return { ok: false, error: "hero not owned" };
    if (!data.heroes[heroId]) return { ok: false, error: "hero not owned" };
    const weaponId = weapons.get(heroId) ?? null;
    if (weaponId !== null) {
      const owned = profile.weapons[weaponId] !== undefined;
      if (!data.weapons[weaponId] || (!owned && !data.pvpConfig.freeWeaponIds.includes(weaponId))) {
        return { ok: false, error: "weapon not owned" };
      }
    }
    heroes[heroId] = {
      constellation: pvpConstellation(hero?.constellation ?? 0),
      levelUpForm: hero?.levelUpForm === "alt" && hero.constellation >= 5 ? "alt" : "base",
      weaponId,
      refinement: 1,
    };
  }
  const relics: NonNullable<Loadout["relics"]> = [];
  for (const relicId of deck.relicIds ?? []) {
    const owned = profile.relics[relicId] !== undefined;
    if (!data.relics[relicId] || (!owned && !data.pvpConfig.freeRelicIds.includes(relicId))) {
      return { ok: false, error: "relic not owned" };
    }
    relics.push({ id: relicId, resonance: 1 });
  }
  return { ok: true, loadout: { heroes, relics, pvp: true } };
}
