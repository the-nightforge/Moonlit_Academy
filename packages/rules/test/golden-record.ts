import type { GameData, Loadout } from "../src/index";
import { shuffle, starterDeck } from "../src/index";
import type { GoldenCombatRecord, GoldenRunRecord } from "./golden";
import { recordCombat, recordRun } from "./golden";

/** All 10 teams of 3 from the 5 heroes, in a fixed order. */
export const ALL_TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"],
  ["m05", "f04", "f03"],
  ["m05", "f04", "f02"],
  ["m05", "m06", "f03"],
  ["m05", "m06", "f02"],
  ["m05", "f03", "f02"],
  ["f04", "m06", "f03"],
  ["f04", "m06", "f02"],
  ["f04", "f03", "f02"],
  ["m06", "f03", "f02"],
];

function weaponFor(data: GameData, heroId: string, index: number): string {
  const signature = Object.values(data.weapons).find((w) => w.signatureHeroId === heroId);
  if (signature) return signature.id;
  const generic = Object.values(data.weapons).filter((w) => w.signatureHeroId == null);
  return generic[index % generic.length]!.id;
}

function gearLoadout(
  data: GameData,
  heroIds: readonly string[],
  tier: number,
  constellation: (heroId: string) => number,
): Loadout {
  return {
    heroes: Object.fromEntries(
      heroIds.map((heroId, i) => [
        heroId,
        {
          constellation: constellation(heroId),
          levelUpForm: constellation(heroId) >= 5 ? ("alt" as const) : ("base" as const),
          weaponId: weaponFor(data, heroId, i),
          refinement: tier,
        },
      ]),
    ),
    relics: Object.values(data.relics)
      .slice(0, 2)
      .map((relic) => ({ id: relic.id, resonance: tier })),
  };
}

/** Loadout variants cycled across the combat matrix: none / gear R1 / gear R5 / Tinh Hồn 6 + alt. */
export function combatLoadout(data: GameData, heroIds: readonly string[], index: number): Loadout | undefined {
  switch (index % 4) {
    case 0:
      return undefined;
    case 1:
      return gearLoadout(data, heroIds, 1, () => 0);
    case 2:
      return gearLoadout(data, heroIds, 5, () => 0);
    default:
      return gearLoadout(data, heroIds, 5, () => 6);
  }
}

export function recordCombatMatrix(data: GameData): GoldenCombatRecord[] {
  const encounterIds = Object.keys(data.encounters);
  const records: GoldenCombatRecord[] = [];
  for (let i = 0; i < 100; i++) {
    const seed = i + 1;
    const heroIds = ALL_TEAMS[i % ALL_TEAMS.length]!;
    const encounterId = encounterIds[i % encounterIds.length]!;
    const loadout = combatLoadout(data, heroIds, i);
    records.push(
      recordCombat(data, { heroIds, encounterId, seed }, loadout, `c${seed}`),
    );
  }
  return records;
}

function randomDeck(data: GameData, team: [string, string, string], seed: number): string[] {
  let rng = seed;
  const pick = (ids: string[], n: number) => {
    const shuffled = shuffle(ids, rng);
    rng = shuffled.rngState;
    return shuffled.items.slice(0, n);
  };
  const pools = team.map((id) => [...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds]);
  const base = pools.flatMap((pool) => pick(pool, 4));
  const rest = pick(
    pools.flat().filter((id) => !base.includes(id)),
    data.metaConfig.deckSize - base.length,
  );
  return [...base, ...rest];
}

export function recordRunMatrix(data: GameData): GoldenRunRecord[] {
  const records: GoldenRunRecord[] = [];
  for (let i = 0; i < 100; i++) {
    const seed = 1001 + i;
    const heroIds = ALL_TEAMS[i % ALL_TEAMS.length]!;
    const deckCardIds = i % 2 === 0 ? starterDeck(data, heroIds) : randomDeck(data, heroIds, seed * 7919);
    const loadout = i % 3 === 0 ? undefined : gearLoadout(data, heroIds, i % 3 === 1 ? 1 : 5, () => (i % 3 === 2 ? 3 : 0));
    records.push(recordRun(data, { heroIds, seed, deckCardIds }, loadout, `r${seed}`));
  }
  return records;
}
