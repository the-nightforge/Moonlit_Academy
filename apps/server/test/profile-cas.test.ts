import { expect, it, vi } from "vitest";
import { loadGameData } from "data";
import { createProfile } from "rules";
import { createContext, type AppDeps } from "../src/context";
import type { Db } from "../src/db";

it("refuses a profile mutation when another writer advances revision after its read", async () => {
  const data = loadGameData(), before = createProfile(data), concurrent = createProfile(data);
  concurrent.currencies.moonJade += 23;
  const get = vi.fn()
    .mockResolvedValueOnce({ profile_json: JSON.stringify(before), rev: 1 })
    .mockResolvedValueOnce({ profile_json: JSON.stringify(concurrent), rev: 2 });
  const run = vi.fn().mockResolvedValue({ changes: 0 });
  const db = {
    prepare: () => ({ get, run }),
    transaction: async (change: (db: Db) => Promise<unknown>) => change(db as unknown as Db),
  } as unknown as Db;
  const ctx = createContext({ db, data, clock: () => 100 } as AppDeps, "test");
  await expect(ctx.mutateProfile(1, { headers: { "if-match": "1" } } as never,
    profile => ({ ok: true, profile }),
  )).rejects.toMatchObject({ status: 409, code: "stale profile", extra: { rev: 2, profile: concurrent } });
  expect(run).toHaveBeenCalledOnce();
  expect(get).toHaveBeenCalledTimes(2);
});
