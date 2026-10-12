import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGameData } from "data";
import type { GameData } from "../../src/types/api";
import type { BalanceReport } from "./report";

/**
 * Buff/nerf workflow glue (`docs/playtest/buff-nerf-workflow.md`). A candidate
 * experiment is a *descriptor* — it declares the one changed parameter up
 * front; tooling copies the shipped data into a scratch dir, applies the
 * declared patch, parses the copy through `parseGameData`, and compares
 * manifests. `packages/data` is never written by this pipeline.
 */

export interface DeclaredPatch {
  /** Top-level key of the raw data input — exactly one file is touched. */
  file: string;
  /** `id` of the element inside a top-level array file (omit for object files). */
  selectId?: string;
  /** Path into the selected element, e.g. `["effects", 1, "amount"]`. */
  path: readonly (string | number)[];
  /** Declared current value — verified before patching so drift fails loudly. */
  from: unknown;
  /** The one parameter value this experiment changes. */
  to: unknown;
}

export interface CandidateExperiment {
  schemaVersion: 1;
  id: string;
  baselineDataPath: string;
  candidateDataPath: string;
  manifestPath: string;
  calibrationPath: string | null;
  /** Preregistered metric family — report modes outside it cannot promote. */
  declaredComparisons: readonly string[];
  declaredHypothesis: string;
  patch: DeclaredPatch;
}

export interface CandidateReview {
  status: "inconclusive" | "policy-sensitive" | "human-check-required" | "review-candidate";
  reasons: readonly string[];
}

const EXPERIMENT_KEYS = new Set([
  "schemaVersion", "id", "baselineDataPath", "candidateDataPath", "manifestPath",
  "calibrationPath", "declaredComparisons", "declaredHypothesis", "patch",
]);

export function parseCandidateExperiment(value: unknown): CandidateExperiment {
  if (value === null || typeof value !== "object") throw new Error("experiment: not an object");
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!EXPERIMENT_KEYS.has(key)) throw new Error(`experiment: unknown key "${key}"`);
  }
  if (raw.schemaVersion !== 1) throw new Error(`experiment: schemaVersion ${String(raw.schemaVersion)} ≠ 1`);
  for (const key of ["id", "baselineDataPath", "candidateDataPath", "manifestPath", "declaredHypothesis"] as const) {
    if (typeof raw[key] !== "string" || raw[key] === "") throw new Error(`experiment: ${key} required`);
  }
  if (raw.calibrationPath !== null && typeof raw.calibrationPath !== "string") {
    throw new Error("experiment: calibrationPath must be a path or null");
  }
  if (!Array.isArray(raw.declaredComparisons) || raw.declaredComparisons.length === 0) {
    throw new Error("experiment: declaredComparisons must be a non-empty array");
  }
  const patch = raw.patch as Record<string, unknown> | null;
  if (patch === null || typeof patch !== "object") throw new Error("experiment: patch required");
  if (typeof patch.file !== "string" || patch.file === "") throw new Error("experiment: patch.file required");
  if (!Array.isArray(patch.path) || patch.path.length === 0) throw new Error("experiment: patch.path must be a non-empty array");
  if (!("from" in patch) || !("to" in patch)) throw new Error("experiment: patch.from/patch.to required");
  return raw as unknown as CandidateExperiment;
}

// --- Data directory loading ----------------------------------------------------

/** `*.json` filename → `rawGameInput()` key for names that aren't already camelCase. */
const FILE_KEYS: Record<string, string> = {
  "moon-phases": "moonPhases",
  "run-relics": "runRelics",
  "run-augments": "runAugments",
  "run-config": "runConfig",
  "combat-config": "combatConfig",
  "meta-config": "metaConfig",
  "economy-config": "economyConfig",
  "pvp-config": "pvpConfig",
  "coop-config": "coopConfig",
  "coop-combos": "coopCombos",
};

export function dataFileKey(filename: string): string {
  const stem = filename.replace(/\.json$/, "");
  return FILE_KEYS[stem] ?? stem;
}

/** Reads a directory of data JSONs into the raw object `parseGameData` validates. */
export function readRawDataDir(dir: string): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    raw[dataFileKey(file)] = JSON.parse(readFileSync(join(dir, file), "utf8"));
  }
  return raw;
}

/** Reads a directory of data JSONs and validates through the shipped schema. */
export function loadDataDir(dir: string): GameData {
  return parseGameData(readRawDataDir(dir));
}

/** sha256 over sorted filenames + bytes — the byte-identity check for shipped data. */
export function dataDirHash(dir: string): string {
  const hash = createHash("sha256");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    hash.update(file);
    hash.update(readFileSync(join(dir, file)));
  }
  return hash.digest("hex");
}

// --- Declared patch -----------------------------------------------------------

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Applies the one declared parameter change to a *clone* of the raw input.
 * Throws when the current value differs from `patch.from` — a stale or
 * hand-edited copy can never silently become a different experiment.
 */
export function applyDeclaredPatch(raw: unknown, patch: DeclaredPatch): unknown {
  if (raw === null || typeof raw !== "object") throw new Error("patch: raw input is not an object");
  const clone = structuredClone(raw) as Record<string, unknown>;
  let node: unknown = clone[patch.file];
  if (node === undefined) throw new Error(`patch: file "${patch.file}" not in raw input`);
  if (Array.isArray(node)) {
    if (patch.selectId === undefined) throw new Error(`patch: "${patch.file}" is an array — selectId required`);
    node = (node as { id?: string }[]).find((el) => el.id === patch.selectId);
    if (node === undefined) throw new Error(`patch: no element with id "${patch.selectId}" in "${patch.file}"`);
  }
  const path = [...patch.path];
  const last = path.pop()!;
  for (const key of path) {
    node = (node as Record<string | number, unknown>)[key];
    if (node === undefined || node === null) throw new Error(`patch: path ${JSON.stringify(patch.path)} not found`);
  }
  const current = (node as Record<string | number, unknown>)[last];
  if (!deepEqual(current, patch.from)) {
    throw new Error(
      `patch: declared "from" ${JSON.stringify(patch.from)} ≠ actual ${JSON.stringify(current)} at "${patch.file}"${patch.selectId ? `/${patch.selectId}` : ""}/${patch.path.join("/")}`,
    );
  }
  (node as Record<string | number, unknown>)[last] = patch.to;
  return clone;
}

// --- Review -------------------------------------------------------------------

/**
 * Maps a finished balance report to the workflow decision. The report's own
 * gates decide quality/coverage/significance; this layer adds the last two
 * human-facing gates: synthetic-only evidence and scope coverage.
 */
export function reviewCandidate(
  report: BalanceReport,
  declaredComparisons?: readonly string[],
): CandidateReview {
  switch (report.status) {
    case "invalid-quality":
    case "insufficient-data":
      return { status: "inconclusive", reasons: report.statusReasons };
    case "policy-sensitive":
      return { status: "policy-sensitive", reasons: report.statusReasons };
    case "human-check-required":
      return { status: "human-check-required", reasons: report.statusReasons };
    case "ok": {
      if (report.comparison === null) {
        return { status: "inconclusive", reasons: ["no candidate comparison — descriptive report only"] };
      }
      if (!report.comparison.promote) {
        return { status: "inconclusive", reasons: report.comparison.promoteReasons };
      }
      const reasons: string[] = [];
      // Simulated evidence is always synthetic; a *passed human* calibration
      // artifact is the only thing that lifts the human-check requirement.
      const calibratedHuman =
        report.calibration !== null && report.calibration.passed && report.calibration.evidenceKind === "human";
      if (report.evidence.kind === "synthetic" && !calibratedHuman) {
        reasons.push("evidence is synthetic — human confirmation run required before acting");
      }
      const calibratedModes = new Set(
        (report.calibration?.scope ?? []).map((scope) => scope.split(":")[0]!),
      );
      for (const mode of Object.keys(report.coverage.perMode)) {
        if (!calibratedModes.has(mode)) {
          reasons.push(`no calibrated scope covers mode "${mode}" — held-out validation needed`);
        }
      }
      if (declaredComparisons !== undefined) {
        const declared = new Set(declaredComparisons);
        for (const mode of Object.keys(report.coverage.perMode)) {
          if (!declared.has(mode)) {
            reasons.push(`mode "${mode}" outside declared comparisons — preregistered family only`);
          }
        }
      }
      return reasons.length > 0
        ? { status: "human-check-required", reasons }
        : { status: "review-candidate", reasons: ["all gates passed — decision packet ready for manual review"] };
    }
  }
}
