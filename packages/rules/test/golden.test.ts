import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

import type { Loadout, RunState } from "../src/index";
import { replayRun, starterDeck } from "../src/index";
import type { GoldenCombatRecord, GoldenRunRecord } from "./golden";
import { combatProjection, recordCombat, recordRun, replayCombatRecord, replayRunRecord, sha256 } from "./golden";
import { recordCombatMatrix, recordRunMatrix } from "./golden-record";

const data = loadGameData();
const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(here, "golden");
const TICKETS_DIR = join(here, "fixtures", "tickets");
const SIZE_CAP = 2 * 1024 * 1024;

/** Run tickets of the 4c/4d/4e shapes: plain run, Tinh Hồn, gear (T214). */
const TICKETS: { name: string; heroIds: [string, string, string]; seed: number; loadout?: Loadout }[] = [
  { name: "4c-plain", heroIds: ["m05", "f04", "m06"], seed: 4001 },
  {
    name: "4d-constellation",
    heroIds: ["m05", "f03", "f02"],
    seed: 4002,
    loadout: {
      heroes: {
        m05: { constellation: 3, levelUpForm: "base" },
        f03: { constellation: 1, levelUpForm: "base" },
        f02: { constellation: 5, levelUpForm: "base" },
      },
    },
  },
  {
    name: "4e-gear",
    heroIds: ["m05", "f04", "f03"],
    seed: 4003,
    loadout: {
      heroes: {
        m05: { constellation: 2, levelUpForm: "base", weaponId: "w_xich_diem_thuong", refinement: 3 },
        f04: { constellation: 0, levelUpForm: "base", weaponId: "w_bach_hoa_tram", refinement: 1 },
        f03: { constellation: 0, levelUpForm: "base", weaponId: "w_han_tuyet_song_kiem", refinement: 5 },
      },
      relics: [
        { id: "r_bach_lo_huong_nang", resonance: 2 },
        { id: "r_huyen_vu_giap_phu", resonance: 1 },
      ],
    },
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function capCombatRecords(records: GoldenCombatRecord[]): GoldenCombatRecord[] {
  // Size cap (spec `17` §2.3): full events + projection for the first 10 records,
  // SHA-256 for the rest, when the file would exceed 2 MB.
  const full = JSON.stringify(records);
  if (full.length <= SIZE_CAP) return records;
  return records.map((record, index) =>
    index < 10
      ? record
      : { ...record, events: { sha256: sha256(record.events) }, final: { sha256: sha256(record.final) } },
  );
}

function expectedEvents(record: GoldenCombatRecord) {
  return Array.isArray(record.events) ? record.events : null;
}

if (process.env.GOLDEN_RECORD === "1") {
  describe("golden record", () => {
    it("records 100 combats + 100 runs + 3 tickets", { timeout: 1_200_000 }, () => {
      writeJson(join(GOLDEN_DIR, "combats.json"), capCombatRecords(recordCombatMatrix(data)));
      writeJson(join(GOLDEN_DIR, "runs.json"), recordRunMatrix(data));
      for (const ticket of TICKETS) {
        const record = recordRun(
          data,
          { heroIds: ticket.heroIds, seed: ticket.seed, deckCardIds: starterDeck(data, ticket.heroIds) },
          ticket.loadout,
          ticket.name,
        );
        const result = replayRun(data, record.setup, record.actions, record.loadout);
        writeJson(join(TICKETS_DIR, `${ticket.name}.json`), {
          setup: record.setup,
          loadout: record.loadout,
          actions: record.actions,
          result,
        });
      }
    });
  });
} else {
  const combats = readJson<GoldenCombatRecord[]>(join(GOLDEN_DIR, "combats.json"));
  const runs = readJson<GoldenRunRecord[]>(join(GOLDEN_DIR, "runs.json"));

  describe("T213: golden PvE records replay identically after the state rework", () => {
    it.each(combats.map((r) => [r.label, r] as const))("combat %s", { timeout: 120_000 }, (_label, record) => {
      const { events, state } = replayCombatRecord(data, record);
      const full = expectedEvents(record);
      if (full) expect(events).toEqual(full);
      else expect(sha256(events)).toBe((record.events as { sha256: string }).sha256);
      const final = record.final;
      if ("sha256" in (final as object)) expect(sha256(combatProjection(state))).toBe((final as { sha256: string }).sha256);
      else expect(combatProjection(state)).toEqual(final);
    });

    it.each(runs.map((r) => [r.label, r] as const))("run %s", { timeout: 120_000 }, (_label, record) => {
      const { events, run } = replayRunRecord(data, record);
      expect(sha256(events)).toBe(record.eventsHash);
      expect(run).toEqual(record.final as RunState);
    });
  });

  describe("T214: run tickets of older phases replay to the stored result", () => {
    for (const ticket of TICKETS) {
      it(ticket.name, { timeout: 120_000 }, () => {
        const stored = readJson<{ setup: Parameters<typeof replayRun>[1]; loadout?: Loadout; actions: Parameters<typeof replayRun>[2]; result: unknown }>(
          join(TICKETS_DIR, `${ticket.name}.json`),
        );
        expect(replayRun(data, stored.setup, stored.actions, stored.loadout)).toEqual(stored.result);
      });
    }
  });
}
