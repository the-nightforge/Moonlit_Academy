import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import type { PvpSide } from "rules";
import { measurePvpPower } from "rules";
import type { AppContext } from "../src/context";
import { RankedQueue, type QueueEntry } from "../src/realtime/queue";
import { fakeScheduler } from "./helpers";

const data = loadGameData();
const side: PvpSide = { heroIds: ["m05", "f04", "m06"], loadout: { heroes: {}, relics: [] } };
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function setup(recent: (id: number) => Promise<{ opponent: number }[]> = async () => []) {
  const time = { now: 0 };
  const scheduler = fakeScheduler();
  const humans: [QueueEntry, QueueEntry][] = [];
  const bots: QueueEntry[] = [];
  const ctx = { data, clock: () => time.now, scheduler,
    db: { prepare: () => ({ all: recent }) } } as unknown as AppContext;
  const queue = new RankedQueue(ctx, () => {}, (a, b) => { humans.push([a, b]); }, (a) => { bots.push(a); });
  function join(id: number, rating = 1000, team = side) {
    const entry = { accountId: id, username: `p${id}`, deckId: "d1", side: team, rating, joinedAt: time.now };
    queue.join(entry);
    return entry;
  }
  async function tick(at: number) { time.now = at; scheduler.advance(1000); await flush(); }
  return { queue, time, scheduler, humans, bots, join, tick };
}

describe("ranked team power queue", () => {
  it("pairs comparable power regardless of Elo and tries humans before 60s fallback", async () => {
    const f = setup();
    f.join(1, 100);
    await f.tick(59_000);
    expect(f.bots).toEqual([]);
    f.join(2, 2500);
    await f.tick(60_000);
    expect(f.humans.map(pair => pair.map(e => e.accountId))).toEqual([[1, 2]]);
    expect(f.bots).toEqual([]);
    await f.tick(61_000);
    expect(f.humans).toHaveLength(1);
  });
  it("falls back exactly at 60s and never matches wildly different power", async () => {
    const f = setup();
    const strong = structuredClone(side);
    strong.loadout.heroes = Object.fromEntries(strong.heroIds.map(id => [id, { constellation: 6, levelUpForm: "alt", weaponId: data.pvpConfig.freeWeaponIds[0]!, refinement: 5 }]));
    strong.loadout.relics = [{ id: data.pvpConfig.freeRelicIds[0]!, resonance: 5 }];
    expect(measurePvpPower(data, strong)).toBeGreaterThan(measurePvpPower(data, side) * 1.25);
    f.join(1);
    f.join(2, 1000, strong);
    await f.tick(59_000);
    expect(f.humans).toEqual([]);
    expect(f.bots).toEqual([]);
    await f.tick(60_000);
    expect(f.humans).toEqual([]);
    expect(f.bots.map(e => e.accountId)).toEqual([1, 2]);
    await f.tick(61_000);
    expect(f.bots).toHaveLength(2);
  });
  it("rejects a recent opponent in either direction", async () => {
    const f = setup(async id => id === 2 ? [{ opponent: 1 }] : []);
    f.join(1); f.join(2);
    await f.tick(1000);
    expect(f.humans).toEqual([]);
  });
  it("widens the power tolerance by 2% at ten seconds", async () => {
    const candidates: PvpSide[] = [];
    for (const weaponId of Object.keys(data.weapons)) {
      for (let refinement = 1; refinement <= 5; refinement++) {
        const candidate = structuredClone(side);
        candidate.loadout.heroes.m05 = { constellation: 0, levelUpForm: "base", weaponId, refinement };
        candidates.push(candidate);
      }
    }
    const power = measurePvpPower(data, side);
    const medium = candidates.find(candidate => {
      const other = measurePvpPower(data, candidate);
      const gap = Math.abs(power - other) / Math.max(power, other);
      return gap > 0.10 && gap <= 0.12;
    });
    expect(medium).toBeDefined();
    const f = setup();
    f.join(1); f.join(2, 1000, medium!);
    await f.tick(9999);
    expect(f.humans).toEqual([]);
    await f.tick(10_000);
    expect(f.humans).toHaveLength(1);
  });
  it.each([1, 2])("rechecks entry identity after lookup %i and never overlaps ticks", async (gateAt) => {
    let resolve!: (rows: { opponent: number }[]) => void;
    let calls = 0;
    const f = setup(async () => { calls++; return calls === gateAt ? await new Promise(r => { resolve = r; }) : []; });
    f.join(1); f.join(2);
    f.time.now = 1000;
    f.scheduler.advance(1000);
    await flush();
    f.scheduler.advance(5000);
    expect(calls).toBe(gateAt);
    f.queue.leave(1);
    const replacement = f.join(1);
    f.queue.leave(2);
    resolve([]);
    await flush();
    expect(f.humans).toEqual([]);
    expect(f.queue.entryOf(1)).toBe(replacement);
    f.join(3);
    await f.tick(2000);
    expect(f.humans.map(pair => pair.map(e => e.accountId))).toEqual([[1, 3]]);
    expect(f.humans[0]![0]).toBe(replacement);
    expect(f.bots).toEqual([]);
  });
});
