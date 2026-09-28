import type { CombatState, GameData, Loadout, PvpSide } from "../src/index";
import { applyAction, createPvpCombat, pvpBot, viewFor } from "../src/index";
import { nextRandom } from "../src/index";

/** All 3-hero teams from the hero roster, in data order. */
export function allTeams(data: GameData): [string, string, string][] {
  const ids = Object.keys(data.heroes);
  const teams: [string, string, string][] = [];
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++)
      for (let c = b + 1; c < ids.length; c++) teams.push([ids[a]!, ids[b]!, ids[c]!]);
  return teams;
}

const bareLoadout: Loadout = { heroes: {}, pvp: true };

function bareSide(heroIds: [string, string, string]): PvpSide {
  return { heroIds, loadout: bareLoadout };
}

/**
 * A side with a random "basic PvP" loadout: each hero gets a random free weapon
 * at refinement 1, plus 0–1 random free relics (`17` §4.9, second pass).
 */
function gearedSide(data: GameData, heroIds: [string, string, string], rng: { state: number }): PvpSide {
  const pick = <T,>(items: T[]): T => {
    const roll = nextRandom(rng.state);
    rng.state = roll.rngState;
    return items[Math.floor(roll.value * items.length)]!;
  };
  const heroes: Loadout["heroes"] = {};
  for (const heroId of heroIds) heroes[heroId] = { constellation: 0, levelUpForm: "base", weaponId: pick(data.pvpConfig.freeWeaponIds), refinement: 1 };
  const relics = nextRandom(rng.state);
  rng.state = relics.rngState;
  const relicList = relics.value < 0.5 ? [] : [{ id: pick(data.pvpConfig.freeRelicIds), resonance: 1 }];
  return { heroIds, loadout: { heroes, relics: relicList, pvp: true } };
}

/** Plays one bot-vs-bot match to its end; returns the final state and played card ids. */
function playMatch(data: GameData, seed: number, sides: [PvpSide, PvpSide]): { state: CombatState; playedCardIds: string[] } {
  let { state } = createPvpCombat(data, { seed, players: sides });
  const playedCardIds: string[] = [];
  for (let step = 0; step < 2000 && state.status !== "won" && state.status !== "lost"; step++) {
    const seat =
      state.status === "mulligan"
        ? state.players.find((s) => !s.mulliganDone)!.index
        : state.activePlayer;
    const action = pvpBot(data, viewFor(state, seat), seat);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(`sim: action ${action.type} rejected: ${result.error}`);
    for (const event of result.events) {
      if (event.type === "cardPlayed") playedCardIds.push(state.cards[event.instanceId]?.cardId ?? event.instanceId);
    }
    state = result.state;
  }
  return { state, playedCardIds };
}

export interface PvpSimOptions {
  seedsPerPair: number;
  /** Second pass assigns random free PvP gear. */
  geared?: boolean;
  /**
   * Sampled mode (7a.6): with 14 heroes C(14,3) = 364 teams, the exhaustive
   * team×team sweep is too slow. Draw this many random pairings with the file's
   * fixed mulberry32 seed instead; `seedsPerPair` is ignored.
   */
  sampleMatches?: number;
}

/** Fixed seed for the sampled pairing stream — reproducible runs. */
const SAMPLE_SEED = 0x7a060001;

/** mulberry32 stream (`02` §5 — same generator as `nextRandom`) for pairing picks. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const roll = nextRandom(state);
    state = roll.rngState;
    return roll.value;
  };
}

export interface PvpSimResult {
  matches: number;
  firstPlayerWins: number;
  draws: number;
  rounds: number[];
  /** Wins / matches for every team containing the hero. */
  heroWins: Record<string, { wins: number; matches: number }>;
  /** Card ids never played in any match. */
  unplayedCardIds: string[];
}

export function runPvpSim(data: GameData, options: PvpSimOptions): PvpSimResult {
  const teams = allTeams(data);
  const heroWins: PvpSimResult["heroWins"] = {};
  const played = new Set<string>();
  const result: PvpSimResult = { matches: 0, firstPlayerWins: 0, draws: 0, rounds: [], heroWins, unplayedCardIds: [] };
  const runMatch = (a: number, b: number, seed: number) => {
    const rng = { state: seed ^ 0x9e3779b9 };
    const sides: [PvpSide, PvpSide] = options.geared
      ? [gearedSide(data, teams[a]!, rng), gearedSide(data, teams[b]!, rng)]
      : [bareSide(teams[a]!), bareSide(teams[b]!)];
    const { state, playedCardIds } = playMatch(data, seed, sides);
    for (const id of playedCardIds) played.add(id);
    result.matches += 1;
    result.rounds.push(state.round);
    if (state.winner === "draw") {
      result.draws += 1;
    } else if (state.winner !== undefined) {
      if (state.winner === state.firstPlayer) result.firstPlayerWins += 1;
      for (const heroId of sides[state.winner]!.heroIds) {
        const entry = (heroWins[heroId] ??= { wins: 0, matches: 0 });
        entry.wins += 1;
      }
    }
    for (const side of sides) for (const heroId of side.heroIds) (heroWins[heroId] ??= { wins: 0, matches: 0 }).matches += 1;
  };
  if (options.sampleMatches !== undefined) {
    const rand = mulberry32(SAMPLE_SEED + (options.geared ? 5_000_009 : 0));
    for (let i = 0; i < options.sampleMatches; i++) {
      const a = Math.floor(rand() * teams.length);
      const b = Math.floor(rand() * teams.length);
      const seed = Math.floor(rand() * 2_000_000_000);
      runMatch(a, b, seed);
    }
  } else {
    for (let a = 0; a < teams.length; a++) {
      for (let b = 0; b < teams.length; b++) {
        for (let s = 0; s < options.seedsPerPair; s++) {
          runMatch(a, b, a * 1_000_003 + b * 10_007 + s * 97 + (options.geared ? 5_000_009 : 0));
        }
      }
    }
  }
  result.unplayedCardIds = Object.keys(data.cards).filter((id) => !played.has(id));
  return result;
}

const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((sum, x) => sum + x, 0) / xs.length);
const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`);

export function printPvpSim(label: string, result: PvpSimResult): void {
  const decisive = result.matches - result.draws;
  console.log(`\n=== pvp-sim · ${label} ===`);
  console.table({
    trận: result.matches,
    "người đi trước thắng": pct(result.firstPlayerWins, decisive),
    "hòa (roundCap)": pct(result.draws, result.matches),
    "vòng TB": mean(result.rounds).toFixed(1),
    "vòng trung vị": median(result.rounds),
    "vòng min/max": `${Math.min(...result.rounds)}/${Math.max(...result.rounds)}`,
  });
  console.log("=== tỉ lệ thắng theo Hero ===");
  console.table(
    Object.fromEntries(
      Object.entries(result.heroWins).map(([id, e]) => [id, { "thắng%": pct(e.wins, e.matches), trận: e.matches }]),
    ),
  );
  console.log(`=== lá chưa từng đánh (${result.unplayedCardIds.length}) ===`);
  console.log(result.unplayedCardIds.join(", ") || "— không có —");
}
