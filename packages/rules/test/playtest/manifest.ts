import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { GameData, Loadout } from "../../src/index";
import { starterDeck } from "../../src/index";
import type { BotProfile } from "../../src/bot/policy";
import type {
  ExperimentConfig,
  ExperimentManifest,
  Scenario,
  ScenarioLeg,
  ScenarioMode,
} from "./types";

/** Deterministic sha256 — canonical JSON (sorted keys) or raw strings. */
export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`)
    .join(",")}}`;
}

import { ENGINE_FINGERPRINT } from "../../src/version";
/** Re-exported for callers that only know the playtest module. */
export { ENGINE_FINGERPRINT };

/** Hash of every .ts under the rules sources — the real engine fingerprint. */
export function computeEngineHash(rulesSrcDir: string): string {
  const files: string[] = [];
  let hasDir = false;
  try {
    hasDir = statSync(rulesSrcDir).isDirectory();
  } catch {
    hasDir = false;
  }
  if (!hasDir) return sha256Hex({ engineFingerprint: ENGINE_FINGERPRINT });
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".ts")) files.push(path);
    }
  };
  walk(rulesSrcDir);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

// --- Pool -------------------------------------------------------------------

/** A roster pool entry — one legal team (heroes + deck + gear) for scenarios. */
export interface PoolEntry {
  id: string;
  label: string;
  tags: readonly string[];
  heroIds: [string, string, string];
  /** Resolved at load: explicit list, or `starterDeck` when deck = "starter". */
  deckCardIds: readonly string[];
  /** Weapon/relic loadout for geared tiers; missing = bare. `pvp` set by the mode. */
  loadout?: Loadout;
}

interface PoolFile {
  schemaVersion: number;
  id: string;
  entries: {
    id: string;
    label: string;
    tags?: string[];
    heroIds: string[];
    deck: "starter" | string[];
    loadout?: PoolEntry["loadout"];
  }[];
}

export function loadPool(data: GameData, path: string): PoolEntry[] {
  const file = JSON.parse(readFileSync(path, "utf8")) as PoolFile;
  if (file.schemaVersion !== 1) throw new Error(`pool: schemaVersion ${file.schemaVersion} ≠ 1`);
  const seen = new Set<string>();
  return file.entries.map((entry) => {
    if (seen.has(entry.id)) throw new Error(`pool: duplicate id "${entry.id}"`);
    seen.add(entry.id);
    if (!Array.isArray(entry.heroIds) || entry.heroIds.length !== 3) {
      throw new Error(`pool "${entry.id}": heroIds must have 3 heroes`);
    }
    const heroIds = entry.heroIds as [string, string, string];
    for (const heroId of heroIds) {
      if (!data.heroes[heroId]) throw new Error(`pool "${entry.id}": unknown hero "${heroId}"`);
    }
    const deckCardIds = entry.deck === "starter" ? starterDeck(data, heroIds) : entry.deck;
    for (const cardId of deckCardIds) {
      const card = data.cards[cardId];
      if (!card) throw new Error(`pool "${entry.id}": unknown card "${cardId}"`);
      // Same ownership rule createCombat enforces: every card's owner is in the team.
      if (card.ownerId !== undefined && !heroIds.includes(card.ownerId)) {
        throw new Error(`pool "${entry.id}": card "${cardId}" belongs to "${card.ownerId}", not in team`);
      }
    }
    return {
      id: entry.id,
      label: entry.label,
      tags: entry.tags ?? [],
      heroIds,
      deckCardIds,
      ...(entry.loadout ? { loadout: entry.loadout } : {}),
    };
  });
}

/** Profiles file: strict structural check — bad budgets are a manifest error. */
export function loadProfilePool(path: string): BotProfile[] {
  const file = JSON.parse(readFileSync(path, "utf8")) as { profiles?: BotProfile[] };
  if (!Array.isArray(file.profiles) || file.profiles.length === 0) {
    throw new Error(`profiles at ${path}: expected non-empty "profiles" array`);
  }
  for (const profile of file.profiles) {
    if (typeof profile.id !== "string" || profile.id === "") throw new Error("profile without id");
    const { search } = profile;
    for (const field of ["maxExpansions", "depth", "beamWidth", "samples"] as const) {
      if (!Number.isInteger(search?.[field]) || search[field] < 0) {
        throw new Error(`profile "${profile.id}": search.${field} must be a non-negative integer`);
      }
    }
    if (profile.mistakeRate < 0 || profile.mistakeRate > 1) {
      throw new Error(`profile "${profile.id}": mistakeRate must be in [0,1]`);
    }
    if (profile.temperature < 0) throw new Error(`profile "${profile.id}": temperature must be ≥ 0`);
  }
  return file.profiles;
}

// --- Config parse ------------------------------------------------------------

const MODES: readonly ScenarioMode[] = ["pve", "pvp", "coop", "run", "story"];
const CONFIG_KEYS = new Set([
  "schemaVersion", "id", "stage", "seedStart", "blockCount", "mode",
  "poolPath", "profilePath", "encounterIds", "stageIds",
]);

export function parseExperimentConfig(value: unknown): ExperimentConfig {
  if (value === null || typeof value !== "object") throw new Error("config: not an object");
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`config: unknown key "${key}"`);
  }
  if (raw.schemaVersion !== 1) throw new Error(`config: schemaVersion ${String(raw.schemaVersion)} ≠ 1`);
  if (typeof raw.id !== "string" || raw.id === "") throw new Error("config: id required");
  if (raw.stage !== "screen" && raw.stage !== "confirm") throw new Error(`config: stage "${String(raw.stage)}"`);
  if (!Number.isInteger(raw.seedStart)) throw new Error("config: seedStart must be an integer");
  if (!Number.isInteger(raw.blockCount) || (raw.blockCount as number) <= 0) {
    throw new Error("config: blockCount must be a positive integer");
  }
  if (!MODES.includes(raw.mode as ScenarioMode)) throw new Error(`config: mode "${String(raw.mode)}"`);
  for (const key of ["poolPath", "profilePath"] as const) {
    if (typeof raw[key] !== "string" || raw[key] === "") throw new Error(`config: ${key} required`);
  }
  for (const key of ["encounterIds", "stageIds"] as const) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new Error(`config: ${key} must be an array`);
  }
  return raw as unknown as ExperimentConfig;
}

// --- Scenario generation -----------------------------------------------------

const SEAT_SEED_STRIDE = 104729;

function seatSeeds(seed: number, seats: number, salt: number): number[] {
  return Array.from({ length: seats }, (_, seat) => seed * 7919 + seat * SEAT_SEED_STRIDE + salt);
}

function encounterIdsFor(data: GameData, config: ExperimentConfig): readonly string[] {
  if (config.encounterIds !== undefined) return config.encounterIds;
  if (config.mode === "coop") {
    return Object.values(data.encounters).filter((enc) => enc.tier === "coop").map((enc) => enc.id);
  }
  return Object.values(data.encounters)
    .filter((enc) => enc.tier === "normal" || enc.tier === "elite" || enc.tier === "boss")
    .map((enc) => enc.id);
}

/**
 * Coverage-aware generation: pool entries rotate so every entry appears and
 * pairs cycle; two-seat modes get AB/BA legs (teams+profiles swapped together,
 * engine still draws `firstPlayer` itself). Single-seat modes are "single".
 */
export function generateScenarios(
  data: GameData,
  config: ExperimentConfig,
  pool: readonly PoolEntry[],
  profiles: readonly BotProfile[],
): Scenario[] {
  if (pool.length === 0) throw new Error("generateScenarios: empty pool");
  const scenarios: Scenario[] = [];
  const pair = (i: number): [number, number] => [
    i % pool.length,
    pool.length > 1 ? (i + 1 + Math.floor(i / pool.length)) % pool.length : 0,
  ];
  const stageIds =
    config.mode === "story"
      ? (config.stageIds ?? Object.keys(data.storyStages))
      : undefined;
  const encounterIds =
    config.mode === "pve" || config.mode === "coop" ? encounterIdsFor(data, config) : undefined;

  for (let block = 0; block < config.blockCount; block++) {
    const seed = config.seedStart + block;
    const blockId = `blk${seed}`;
    const [a, b] = pair(block);
    // Decorrelate entry ↔ content: a bare `block % n` pairs each pool entry
    // with one encounter/stage whenever |pool| shares a factor with |content|
    // (8×8 locked every team to a single boss). +poolLap spreads each entry
    // across all content ids over its share of blocks.
    const lap = Math.floor(block / pool.length);
    const content = (n: number) => (block + lap) % n;
    // Same decorrelation for profiles: `k % n` alone pins each entry to one
    // profile whenever gcd(pool, profiles) > 1 (single-seat modes always
    // drove m03 with one style). +lap cycles every entry through all profiles.
    const prof = (k: number) => profiles[(k + lap) % profiles.length]!;

    const push = (suffix: string, leg: ScenarioLeg, setup: Scenario["setup"], seatProfiles: BotProfile[], seats: number) => {
      scenarios.push({
        id: `${config.id}-${blockId}-${suffix}`,
        mode: config.mode,
        setup,
        profiles: seatProfiles,
        policySeeds: seatSeeds(seed, seats, 3),
        beliefSeeds: seatSeeds(seed, seats, 5),
        blockId,
        leg,
      });
    };

    switch (config.mode) {
      case "pvp": {
        const side = (entry: PoolEntry) => ({
          heroIds: entry.heroIds,
          deckCardIds: [...entry.deckCardIds],
          loadout: { ...(entry.loadout ?? { heroes: {} }), pvp: true as const },
        });
        push("AB", "AB", { seed, players: [side(pool[a]!), side(pool[b]!)] }, [prof(block * 2), prof(block * 2 + 1)], 2);
        push("BA", "BA", { seed, players: [side(pool[b]!), side(pool[a]!)] }, [prof(block * 2 + 1), prof(block * 2)], 2);
        break;
      }
      case "coop": {
        const side = (entry: PoolEntry) => ({
          heroIds: entry.heroIds,
          deckCardIds: [...entry.deckCardIds],
          loadout: entry.loadout ?? { heroes: {} },
        });
        const encounterId = encounterIds![content(encounterIds!.length)]!;
        push("AB", "AB", { seed, players: [side(pool[a]!), side(pool[b]!)], encounterId }, [prof(block * 2), prof(block * 2 + 1)], 2);
        push("BA", "BA", { seed, players: [side(pool[b]!), side(pool[a]!)], encounterId }, [prof(block * 2 + 1), prof(block * 2)], 2);
        break;
      }
      case "pve": {
        const entry = pool[a]!;
        push("single", "single", {
          heroIds: entry.heroIds,
          encounterId: encounterIds![content(encounterIds!.length)]!,
          seed,
          deckCardIds: [...entry.deckCardIds],
        }, [prof(block)], 1);
        break;
      }
      case "story": {
        const entry = pool[a]!;
        push("single", "single", {
          stageId: stageIds![content(stageIds!.length)]!,
          seed,
          heroIds: entry.heroIds,
          deckCardIds: [...entry.deckCardIds],
        }, [prof(block)], 1);
        break;
      }
      case "run": {
        const entry = pool[a]!;
        push("single", "single", { heroIds: entry.heroIds, seed, deckCardIds: [...entry.deckCardIds] }, [prof(block)], 1);
        break;
      }
    }
  }
  return scenarios;
}

// --- Manifest -----------------------------------------------------------------

export interface ManifestOptions {
  /** Directory of `packages/rules/src`; engine hash hashes the sources. */
  rulesSrcDir: string;
  sourceRevision?: string;
}

export function buildManifest(
  data: GameData,
  config: ExperimentConfig,
  options: ManifestOptions,
): ExperimentManifest {
  const pool = loadPool(data, config.poolPath);
  const profiles = loadProfilePool(config.profilePath);
  const scenarios = generateScenarios(data, config, pool, profiles);
  return {
    schemaVersion: 1,
    id: config.id,
    sourceRevision: options.sourceRevision ?? "worktree",
    engineHash: computeEngineHash(options.rulesSrcDir),
    dataHash: sha256Hex(data),
    policyHash: sha256Hex(profiles),
    poolHash: sha256Hex(pool),
    stage: config.stage,
    evidence: { kind: "synthetic" },
    scenarios,
  };
}

/** Hero usage counts — per side appearance, not per match (`17` §12 note). */
export function heroAppearances(scenarios: readonly Scenario[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const collect = (heroIds: readonly string[]) => {
    for (const id of heroIds) counts[id] = (counts[id] ?? 0) + 1;
  };
  for (const scenario of scenarios) {
    const setup = scenario.setup;
    if ("players" in setup) {
      for (const side of setup.players) collect(side.heroIds);
    } else if ("heroIds" in setup) {
      collect(setup.heroIds);
    }
  }
  return counts;
}
