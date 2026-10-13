import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { claimMission, createProfile, dayKey, weekKey } from "rules";
import { achievementRows, claimReadyMissions, missionRows } from "../src/ui/missions-presentation";
const data = loadGameData();
const now = Date.parse("2026-10-13T10:00:00Z");
function readyProfile() {
  const p = createProfile(data);
  p.missions.dayKey = dayKey(data, now); p.missions.weekKey = weekKey(data, now);
  p.missions.daily.runsFinished = 1; p.missions.daily.floorsReached = 10;
  return p;
}
describe("mission presentation", () => {
  it("prioritizes ready rewards and distinguishes claimed rewards from incomplete work", () => {
    const p = readyProfile(); p.missions.claimed = ["m_daily_run"];
    const rows = missionRows(data, p, "daily", now);
    expect(rows.map(r => [r.id, r.status])).toEqual([["m_daily_floors", "ready"], ["m_daily_heroes", "progress"], ["m_daily_run", "claimed"]]);
    expect(rows[0]?.progress).toEqual({ value: 10, goal: 10 });
  });
  it("rolls stale daily counters and claims at the Vietnam reset boundary without modifying the profile", () => {
    const p = readyProfile(); p.missions.claimed = ["m_daily_run"];
    const before = JSON.stringify(p);
    const rows = missionRows(data, p, "daily", Date.parse("2026-10-13T21:00:00Z"));
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.status === "progress" && r.progress.value === 0)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("derives collection progress and wording from the actual hero definitions", () => {
    const p = createProfile(data); p.heroes.unknown = { ...p.heroes.m05! };
    const row = achievementRows(data, p).find(r => r.id === "a_all_heroes")!;
    expect(row.progress).toEqual({ value: 3, goal: 20 });
    expect(row.text).toBe("Sở hữu toàn bộ 20 Hero.");
    const smaller = { ...data, heroes: { m05: data.heroes.m05!, f04: data.heroes.f04! } };
    expect(achievementRows(smaller, p).find(r => r.id === "a_all_heroes")?.progress).toEqual({ value: 2, goal: 2 });
  });
  it("counts only real distinct locked cards and never invents partial progress for bond conditions", () => {
    const p = createProfile(data); p.heroes = { m05: p.heroes.m05! };
    p.heroes.m05!.unlockedCardIds = [data.heroes.m05!.lockedCardIds[0]!, data.heroes.m05!.lockedCardIds[0]!, "unknown"];
    const rows = achievementRows(data, p);
    expect(rows.find(r => r.id === "a_all_unlocked")?.progress).toEqual({ value: 1, goal: data.heroes.m05!.lockedCardIds.length });
    expect(rows.find(r => r.id === "a_bond_bang_hoa")?.progress).toBeNull();
  });
  it("marks granted achievements as completed using the server result", () => {
    const p = createProfile(data); p.achievements = ["a_first_win"];
    expect(achievementRows(data, p).find(r => r.id === "a_first_win")?.status).toBe("claimed");
  });
});
describe("receiving multiple mission rewards", () => {
  it("uses each updated profile before the next request and never overlaps requests", async () => {
    let profile = readyProfile(), inFlight = 0, maxInFlight = 0;
    const sent: string[] = [];
    const result = await claimReadyMissions(data, ["m_daily_run", "m_daily_floors", "m_daily_heroes"], {
      profile: () => profile, now: () => now, valid: () => true,
      submit: async id => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await Promise.resolve(); const r = claimMission(data, profile, id, now); if (!r.ok) throw new Error(r.error); profile = r.profile; sent.push(id); inFlight--; },
    });
    expect(sent).toEqual(["m_daily_run", "m_daily_floors"]);
    expect(maxInFlight).toBe(1); expect(result.received).toBe(40); expect(profile.currencies.moonJade).toBe(40);
  });
  it("stops on failure and reports only rewards already received", async () => {
    let profile = readyProfile(); const error = new Error("connection lost");
    const result = await claimReadyMissions(data, ["m_daily_run", "m_daily_floors"], {
      profile: () => profile, now: () => now, valid: () => true,
      submit: async id => { if (id === "m_daily_floors") throw error; const r = claimMission(data, profile, id, now); if (r.ok) profile = r.profile; },
    });
    expect(result.received).toBe(20); expect(result.error).toBe(error);
    expect(profile.missions.claimed).toEqual(["m_daily_run"]);
  });
  it("does not submit another reward after the owner leaves or changes account", async () => {
    const profile = readyProfile(); let valid = true, requests = 0;
    const result = await claimReadyMissions(data, ["m_daily_run", "m_daily_floors"], {
      profile: () => profile, now: () => now, valid: () => valid,
      submit: async () => { requests++; valid = false; },
    });
    expect(requests).toBe(1); expect(result.cancelled).toBe(true);
  });
  it("rechecks eligibility when the period changes between claims", async () => {
    let profile = readyProfile(), clock = now; const sent: string[] = [];
    const result = await claimReadyMissions(data, ["m_daily_run", "m_daily_floors"], {
      profile: () => profile, now: () => clock, valid: () => true,
      submit: async id => { const r = claimMission(data, profile, id, clock); if (r.ok) profile = r.profile; sent.push(id); clock = Date.parse("2026-10-13T21:00:00Z"); },
    });
    expect(sent).toEqual(["m_daily_run"]); expect(result.received).toBe(20);
  });
});
