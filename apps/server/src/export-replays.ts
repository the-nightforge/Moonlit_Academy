import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { openDb } from "./db";
import { exportTesterReplays, type CohortConfig } from "./playtest/export";

/**
 * Offline tester-replay export (`20` §7). Runs against the real database —
 * it is an SSR-bundled operator entry, not a request route. Output carries
 * salted pseudonyms only; the salt comes from `PLAYTEST_EXPORT_SALT` or
 * `--salt` and is never stored next to the export.
 *
 *   node dist/export-replays.js --group pilot-2026-10 --data-hash <hash> \
 *     --out output/playtest/human-replays.json [--modes pvp,run] \
 *     [--since <ms>] [--until <ms>]
 */
const { values } = parseArgs({
  options: {
    group: { type: "string" },
    salt: { type: "string" },
    "data-hash": { type: "string" },
    modes: { type: "string" },
    since: { type: "string" },
    until: { type: "string" },
    out: { type: "string" },
  },
  strict: true,
});

const salt = values.salt ?? process.env.PLAYTEST_EXPORT_SALT;
if (!values.group) throw new Error("missing --group (cohort label)");
if (!salt) throw new Error("missing --salt or PLAYTEST_EXPORT_SALT");
if (!values["data-hash"]) throw new Error("missing --data-hash (exports only this data version)");
if (!values.out) throw new Error("missing --out (output file path)");

const cohort: CohortConfig = {
  groupId: values.group,
  salt,
  ...(values.modes ? { modes: values.modes.split(",") as CohortConfig["modes"] } : {}),
  ...(values.since ? { since: Number(values.since) } : {}),
  ...(values.until ? { until: Number(values.until) } : {}),
};

const config = loadConfig();
const db = await openDb(config.databaseUrl);
try {
  const { replays, quality } = await exportTesterReplays(db, cohort, values["data-hash"]);
  const file = resolve(values.out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ cohort: cohort.groupId, quality, replays }, null, 2)}\n`);
  console.log(`exported ${quality.exported} replay(s) → ${file}`);
  console.log(`quality: ${JSON.stringify(quality)}`);
} finally {
  await db.close();
}
