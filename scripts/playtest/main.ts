import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { dataVersion, loadGameData } from "data";
import { buildManifest, loadProfilePool, parseExperimentConfig, sha256Hex } from "../../packages/rules/test/playtest/manifest";
import { recordKey, runExperiment } from "../../packages/rules/test/playtest/runner";
import { buildBalanceReport, loadGates, reportCsv, reportMarkdown } from "../../packages/rules/test/playtest/report";
import type { BalanceReport } from "../../packages/rules/test/playtest/report";
import { parseCandidateExperiment, reviewCandidate } from "../../packages/rules/test/playtest/workflow";
import type { ExperimentManifest, MatchRecord } from "../../packages/rules/test/playtest/types";
import type { CalibrationArtifact } from "../../packages/rules/test/playtest/calibration";
import { splitHumanCorpus, validateCorpus, type HumanReplay } from "../../packages/rules/test/playtest/human";
import { calibrateProfiles, loadCalibrationConfig, validateCalibration } from "../../packages/rules/test/playtest/calibration";

/**
 * Playtest CLI (`output/playtest-tool/main.mjs`).
 *   --command simulate --config <json> --output <dir> [--workers n] [--resume]
 *
 * --workers N partitions scenarios by index (worker = index % N). Partitions
 * are deterministic: a 1-worker run and merged N-worker runs produce identical
 * records in identical order — verified by playtest-runner tests.
 */
function readRunDir(dir: string): { manifest: ExperimentManifest; records: MatchRecord[] } {
  const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8")) as ExperimentManifest;
  const records = readFileSync(resolve(dir, "records.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as MatchRecord);
  return { manifest, records };
}

function commandReport(args: { base?: string; candidate?: string; gates?: string; output?: string; calibration?: string }): void {
  if (!args.base) throw new Error("playtest report: --base <run directory> required");
  const base = readRunDir(args.base);
  const candidate = args.candidate ? readRunDir(args.candidate) : null;
  const gates = args.gates
    ? loadGates(resolve(args.gates))
    : loadGates(resolve("docs/playtest/balance-gates.v1.json"));
  const calibration = args.calibration
    ? (JSON.parse(readFileSync(resolve(args.calibration), "utf8")) as CalibrationArtifact)
    : null;
  const report = buildBalanceReport(
    base.manifest,
    base.records,
    candidate?.manifest ?? null,
    candidate?.records ?? null,
    calibration,
    gates,
  );
  const outputDir = resolve(args.output ?? joinOutput(args.base));
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "report.md"), reportMarkdown(report));
  writeFileSync(resolve(outputDir, "report.csv"), reportCsv(report));
  console.log(`playtest report: ${report.status} → ${outputDir} (json + md + csv)`);
}

const joinOutput = (base: string) => `${base.replace(/[/\\]$/, "")}-report`;

/**
 * `review --input <report.json> [--experiment <candidate.json>]` — maps a
 * finished report to the workflow decision (inconclusive / policy-sensitive /
 * human-check-required / review-candidate). With `--experiment`, the
 * descriptor's `declaredComparisons` bound which modes may promote.
 */
function commandReview(args: { input?: string; experiment?: string }): void {
  if (!args.input) throw new Error("playtest review: --input <report.json> required");
  const report = JSON.parse(readFileSync(resolve(args.input), "utf8")) as BalanceReport;
  const declared = args.experiment
    ? parseCandidateExperiment(JSON.parse(readFileSync(resolve(args.experiment), "utf8"))).declaredComparisons
    : undefined;
  const review = reviewCandidate(report, declared);
  console.log(`playtest review: ${review.status}`);
  for (const reason of review.reasons) console.log(`  - ${reason}`);
}

// --- Human replay commands (`20` §7–§8) ---------------------------------------

interface ReplayExportFile {
  cohort?: string;
  quality?: unknown;
  replays: HumanReplay[];
}

const readReplays = (path: string): ReplayExportFile =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as ReplayExportFile;

/**
 * `prepare-human --input <export.json> --output <dir> --salt <s>` — schema +
 * version checks the raw export, counts every drop, then splits by
 * participant component into train.json / test.json (75/25 by salted hash).
 */
function commandPrepareHuman(args: { input?: string; output?: string; salt?: string }): void {
  if (!args.input) throw new Error("playtest prepare-human: --input <export.json> required");
  if (!args.salt) throw new Error("playtest prepare-human: --salt <s> required (same salt as the export)");
  const file = readReplays(args.input);
  if (!Array.isArray(file.replays)) throw new Error("playtest prepare-human: input has no \"replays\" array");
  const data = loadGameData();
  const { accepted, quality } = validateCorpus(file.replays, dataVersion(data));
  const { train, test } = splitHumanCorpus(accepted, args.salt);
  const outputDir = resolve(args.output ?? "output/playtest/human");
  mkdirSync(outputDir, { recursive: true });
  const cohort = file.cohort ?? "unknown";
  writeFileSync(resolve(outputDir, "train.json"), `${JSON.stringify({ cohort, split: "train", replays: train }, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "test.json"), `${JSON.stringify({ cohort, split: "test", replays: test }, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "quality.json"), `${JSON.stringify({ dataHash: dataVersion(data), ...quality }, null, 2)}\n`);
  console.log(
    `playtest prepare-human: ${accepted.length}/${file.replays.length} accepted → train ${train.length} / test ${test.length} → ${outputDir}`,
  );
  if (accepted.length === 0) console.log("  note: empty corpus — downstream artifacts will report evidence \"synthetic\"");
}

/**
 * `calibrate --input <train.json> --profiles <file> [--calibration <json>] --output <dir>`
 * — seeded bounded grid fit on the train split only. Writes the tuned
 * profiles plus every candidate's training loss for audit.
 */
function commandCalibrate(args: { input?: string; profiles?: string; calibration?: string; output?: string }): void {
  if (!args.input) throw new Error("playtest calibrate: --input <train.json> required");
  if (!args.profiles) throw new Error("playtest calibrate: --profiles <file> required");
  const data = loadGameData();
  const train = readReplays(args.input).replays;
  const profiles = loadProfilePool(resolve(args.profiles));
  const config = loadCalibrationConfig(resolve(args.calibration ?? "docs/playtest/calibration.v1.json"));
  const { profiles: tuned, candidates } = calibrateProfiles(data, train, profiles, config);
  const outputDir = resolve(args.output ?? "output/playtest/calibrate");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "profiles.json"), `${JSON.stringify({ schemaVersion: 1, profiles: tuned }, null, 2)}\n`);
  writeFileSync(
    resolve(outputDir, "training.json"),
    `${JSON.stringify({ policyHash: sha256Hex(tuned), trainReplays: train.length, candidates }, null, 2)}\n`,
  );
  console.log(`playtest calibrate: ${candidates.length} candidates on ${train.length} train replays → ${outputDir}`);
}

/**
 * `validate-human --input <test.json> --profiles <file> [--calibration <json>] [--output <file>]`
 * — held-out validation; prints per-scope pass/fail and writes the artifact.
 */
function commandValidateHuman(args: { input?: string; profiles?: string; calibration?: string; output?: string }): void {
  if (!args.input) throw new Error("playtest validate-human: --input <test.json> required");
  if (!args.profiles) throw new Error("playtest validate-human: --profiles <file> required");
  const data = loadGameData();
  const test = readReplays(args.input).replays;
  const profiles = loadProfilePool(resolve(args.profiles));
  const config = loadCalibrationConfig(resolve(args.calibration ?? "docs/playtest/calibration.v1.json"));
  const artifact = validateCalibration(data, test, profiles, config, dataVersion(data));
  const out = resolve(args.output ?? "output/playtest/calibration-artifact.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`playtest validate-human: passed=${artifact.passed} evidence=${artifact.evidence.kind} → ${out}`);
  for (const scope of artifact.scopeResults) {
    console.log(`  ${scope.passed ? "PASS" : "FAIL"} ${scope.scope}${scope.reasons.length ? ` — ${scope.reasons.join("; ")}` : ""}`);
  }
}

function main(): void {
  const args = parseArgs({
    strict: true,
    options: {
      command: { type: "string" },
      config: { type: "string" },
      output: { type: "string" },
      workers: { type: "string", default: "1" },
      resume: { type: "boolean", default: false },
      base: { type: "string" },
      candidate: { type: "string" },
      gates: { type: "string" },
      input: { type: "string" },
      profiles: { type: "string" },
      calibration: { type: "string" },
      experiment: { type: "string" },
      salt: { type: "string" },
    },
  });
  if (args.values.command === "prepare-human") {
    commandPrepareHuman({ input: args.values.input, output: args.values.output, salt: args.values.salt });
    return;
  }
  if (args.values.command === "calibrate") {
    commandCalibrate({
      input: args.values.input,
      profiles: args.values.profiles,
      calibration: args.values.calibration,
      output: args.values.output,
    });
    return;
  }
  if (args.values.command === "validate-human") {
    commandValidateHuman({
      input: args.values.input,
      profiles: args.values.profiles,
      calibration: args.values.calibration,
      output: args.values.output,
    });
    return;
  }
  if (args.values.command === "report") {
    commandReport({
      base: args.values.base,
      candidate: args.values.candidate,
      gates: args.values.gates,
      output: args.values.output,
      calibration: args.values.calibration,
    });
    return;
  }
  if (args.values.command === "review") {
    commandReview({ input: args.values.input, experiment: args.values.experiment });
    return;
  }
  if (args.values.command !== "simulate") {
    throw new Error(`playtest: --command "${args.values.command ?? "?"}" unknown (expected "simulate", "report", "review", "prepare-human", "calibrate" or "validate-human")`);
  }
  if (!args.values.config) throw new Error("playtest: --config <json> required");
  const configPath = resolve(args.values.config);
  const outputDir = resolve(args.values.output ?? "output/playtest/run");
  const workers = Number.parseInt(args.values.workers ?? "1", 10);
  if (!Number.isInteger(workers) || workers < 1) throw new Error("playtest: --workers must be ≥ 1");

  // Paths inside the experiment config resolve relative to the config file.
  const configDir = dirname(configPath);
  const rawConfig = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  for (const key of ["poolPath", "profilePath"]) {
    if (typeof rawConfig[key] === "string") rawConfig[key] = resolve(configDir, rawConfig[key] as string);
  }
  const config = parseExperimentConfig(rawConfig);

  const data = loadGameData();
  // Rules sources for the engine hash — resolved from CWD; the bundle falls
  // back to ENGINE_FINGERPRINT when sources aren't on disk.
  const rulesSrc = resolve("packages/rules/src");
  const sourceRevision = (() => {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "worktree";
    }
  })();
  const manifest = buildManifest(data, config, { rulesSrcDir: rulesSrc, sourceRevision });

  mkdirSync(outputDir, { recursive: true });
  const recordsPath = resolve(outputDir, "records.jsonl");
  const skip = new Set<string>();
  if (args.values.resume && existsSync(recordsPath)) {
    for (const line of readFileSync(recordsPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as MatchRecord;
      skip.add(recordKey(record));
    }
  }

  // Logical workers partition in-process; merge order is index-sorted already.
  const records = [];
  for (let worker = 0; worker < workers; worker++) {
    records.push(...runExperiment(data, manifest, { workerIndex: worker, workerCount: workers, skip }));
  }
  records.sort((a, b) => a.blockId.localeCompare(b.blockId) || a.leg.localeCompare(b.leg) || a.scenarioId.localeCompare(b.scenarioId));

  writeFileSync(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const tracesPath = resolve(outputDir, "traces.jsonl");
  for (const record of records) {
    const { traceKeys, ...row } = record;
    appendFileSync(recordsPath, `${JSON.stringify(row)}\n`);
    appendFileSync(tracesPath, `${JSON.stringify({ key: recordKey(record), traceKeys })}\n`);
  }

  const counts: Record<string, number> = {};
  for (const record of records) counts[record.outcome] = (counts[record.outcome] ?? 0) + 1;
  console.log(
    `playtest ${manifest.id}: ${records.length} records (${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ")}) → ${outputDir}`,
  );
}

main();
