import type { GameData, Loadout, Profile } from "../types/index";

/** The team's constellations from the profile (`14` §12); every hero must be owned. */
export function buildLoadout(
  data: GameData,
  profile: Profile,
  heroIds: readonly string[],
): { ok: true; loadout: Loadout } | { ok: false; error: string } {
  const heroes: Loadout["heroes"] = {};
  for (const heroId of heroIds) {
    const hero = profile.heroes[heroId];
    if (!hero || !data.heroes[heroId]) return { ok: false, error: "hero not owned" };
    // Tinh Hồn 5 (second level-up form) comes with phase 4e; until then the base form.
    heroes[heroId] = { constellation: hero.constellation, levelUpForm: "base" };
  }
  return { ok: true, loadout: { heroes } };
}
