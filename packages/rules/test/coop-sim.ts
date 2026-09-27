import type { CombatState, CoopSide, GameData, Loadout } from "../src/index";
import { applyAction, coopBot, createCoopCombat } from "../src/index";
import { allTeams } from "./pvp-sim";

const bareLoadout: Loadout = { heroes: {} };

function bareSide(heroIds: [string, string, string]): CoopSide {
  return { heroIds, loadout: bareLoadout };
}

/** Gear pass: every hero carries a distinct weapon at `refinement`, plus `constellation`. */
function gearedSide(
  data: GameData,
  heroIds: [string, string, string],
  offset: number,
  refinement: number,
  constellation: number,
): CoopSide {
  const weaponIds = Object.keys(data.weapons);
  const heroes: Loadout["heroes"] = {};
  heroIds.forEach((heroId, index) => {
    heroes[heroId] = {
      constellation,
      levelUpForm: constellation >= 5 ? "alt" : "base",
      weaponId: weaponIds[(offset + index) % weaponIds.length]!,
      refinement,
    };
  });
  return { heroIds, loadout: { heroes } };
}

export interface CoopMatchOutcome {
  state: CombatState;
  /** Combo ids fired during the match (each counted once). */
  combosFired: string[];
  /** The boss reached phase 4 at least once. */
  phase4Seen: boolean;
  /** The boss revived during the match. */
  revived: boolean;
}

/** Two bots share the turn until the match ends or the step cap hits. */
function playMatch(data: GameData, seed: number, sides: [CoopSide, CoopSide]): CoopMatchOutcome {
  let { state } = createCoopCombat(data, { seed, players: sides, encounterId: "enc_coop_01" });
  const combos = new Set<string>();
  let phase4 = false;
  let revived = false;
  for (let step = 0; step < 3000 && state.status !== "won" && state.status !== "lost"; step++) {
    const seat =
      state.status === "mulligan"
        ? state.players.find((entry) => !entry.mulliganDone)!.index
        : (state.players.find((entry) => !entry.done) ?? state.players[0]!).index;
    const action = coopBot(data, state, seat);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(`sim: action ${action.type} rejected: ${result.error}`);
    for (const event of result.events) {
      if (event.type === "coopComboTriggered") combos.add(event.comboId);
      if (event.type === "bossPhaseChanged" && event.phase === 4) phase4 = true;
    }
    state = result.state;
    revived = revived || state.boss?.revived === true;
  }
  return { state, combosFired: [...combos], phase4Seen: phase4, revived };
}

export interface CoopSimOptions {
  seedsPerPair: number;
  /** Gear pass: weapon refinement and constellation level per hero. */
  gear?: { refinement: number; constellation: number };
}

export interface CoopSimResult {
  matches: number;
  wins: number;
  rounds: number[];
  /** Matches where each combo fired at least once. */
  comboFires: Record<string, number>;
  /** Wins where the boss reached phase 4. */
  winsViaPhase4: number;
  /** Matches where the boss revived. */
  revives: number;
  /** Wins / matches for every side containing the hero (either seat). */
  heroWins: Record<string, { wins: number; matches: number }>;
}

export function runCoopSim(data: GameData, options: CoopSimOptions): CoopSimResult {
  const teams = allTeams(data);
  const heroWins: CoopSimResult["heroWins"] = {};
  const result: CoopSimResult = {
    matches: 0,
    wins: 0,
    rounds: [],
    comboFires: {},
    winsViaPhase4: 0,
    revives: 0,
    heroWins,
  };
  for (let a = 0; a < teams.length; a++) {
    for (let b = 0; b < teams.length; b++) {
      for (let s = 0; s < options.seedsPerPair; s++) {
        const seed = a * 1_000_003 + b * 10_007 + s * 97 + (options.gear ? 5_000_009 : 0);
        const gear = options.gear;
        const sides: [CoopSide, CoopSide] = gear
          ? [
              gearedSide(data, teams[a]!, 0, gear.refinement, gear.constellation),
              gearedSide(data, teams[b]!, 5, gear.refinement, gear.constellation),
            ]
          : [bareSide(teams[a]!), bareSide(teams[b]!)];
        const outcome = playMatch(data, seed, sides);
        result.matches += 1;
        result.rounds.push(outcome.state.round);
        for (const comboId of outcome.combosFired) {
          result.comboFires[comboId] = (result.comboFires[comboId] ?? 0) + 1;
        }
        if (outcome.revived) result.revives += 1;
        if (outcome.state.status === "won") {
          result.wins += 1;
          if (outcome.phase4Seen) result.winsViaPhase4 += 1;
          for (const side of sides) {
            for (const heroId of side.heroIds) {
              (heroWins[heroId] ??= { wins: 0, matches: 0 }).wins += 1;
            }
          }
        }
        for (const side of sides) {
          for (const heroId of side.heroIds) (heroWins[heroId] ??= { wins: 0, matches: 0 }).matches += 1;
        }
      }
    }
  }
  return result;
}

const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`);

const COMBO_NAMES: Record<string, string> = {
  combo_bang_nguyet_ke: "Băng Nguyệt Kế",
  combo_am_anh_tuyet_sat: "Ám Ảnh Tuyệt Sát",
  combo_nguyet_quang_pho_chieu: "Nguyệt Quang Phổ Chiếu",
};

export function printCoopSim(label: string, result: CoopSimResult): void {
  console.log(`\n=== coop-sim · ${label} ===`);
  console.table({
    trận: result.matches,
    "tỉ lệ thắng": pct(result.wins, result.matches),
    "vòng trung vị": median(result.rounds),
    "vòng min/max": `${Math.min(...result.rounds)}/${Math.max(...result.rounds)}`,
    "thắng qua giai đoạn 4": pct(result.winsViaPhase4, result.wins),
    "boss hồi sinh": pct(result.revives, result.matches),
  });
  console.log("=== tần suất Hợp Kích (% trận kích) ===");
  console.table(
    Object.fromEntries(
      Object.entries(result.comboFires).map(([id, count]) => [
        COMBO_NAMES[id] ?? id,
        { "kích%": pct(count, result.matches), trận: count },
      ]),
    ),
  );
  console.log("=== tỉ lệ thắng theo Hero ===");
  console.table(
    Object.fromEntries(
      Object.entries(result.heroWins).map(([id, e]) => [id, { "thắng%": pct(e.wins, e.matches), trận: e.matches }]),
    ),
  );
}
