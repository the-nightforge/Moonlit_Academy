import { describe, expect, it } from "vitest";
import { applyRunRewards, createProfile, upgradeCost, upgradeItem } from "../src/index";
import type { RunResult } from "../src/index";
import { testData } from "./helpers";

const NOW = Date.UTC(2026, 8, 30, 12);
const TEAM: [string, string, string] = ["m05", "f04", "m06"];

describe("gear upgrades", () => {
  it("T308: upgrading a weapon spends dark iron and adds one refinement; the input profile is untouched", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.weapons = { w_anh_nguyet_chuy: { refinement: 1 } }; // epic
    profile.currencies.darkIron = 10;
    const result = upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy");
    expect(result).toMatchObject({ ok: true, level: 2, spent: 3 });
    if (!result.ok) return;
    expect(result.profile.weapons["w_anh_nguyet_chuy"]).toEqual({ refinement: 2 });
    expect(result.profile.currencies.darkIron).toBe(7);
    expect(profile.weapons["w_anh_nguyet_chuy"]).toEqual({ refinement: 1 });
    expect(profile.currencies.darkIron).toBe(10);
  });

  it("T309: not owned, maxed and not enough leave the profile unchanged", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.currencies.darkIron = 2;
    expect(upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy")).toEqual({ ok: false, error: "not owned" });
    expect(upgradeItem(data, profile, "weapon", "nope")).toEqual({ ok: false, error: "not owned" });
    profile.weapons = { w_anh_nguyet_chuy: { refinement: 1 }, w_thiet_thuan: { refinement: 5 }, nope: { refinement: 5 } };
    expect(upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy")).toEqual({ ok: false, error: "not enough" });
    expect(upgradeItem(data, profile, "weapon", "w_thiet_thuan")).toEqual({ ok: false, error: "maxed" });
    // Stale profile id absent from data reads as "not owned" before "maxed" (`14` §13.3 step 1).
    expect(upgradeItem(data, profile, "weapon", "nope")).toEqual({ ok: false, error: "not owned" });
    expect(profile.currencies.darkIron).toBe(2);
  });

  it("T310: cost follows rarity and level; relics spend moon dust; common uses the rare row", () => {
    const data = testData();
    const cost = data.economyConfig.upgradeCost;
    expect([1, 2, 3, 4].map((level) => upgradeCost(data, "weapon", "w_xich_diem_thuong", level))).toEqual(cost.weapon.legendary);
    expect([1, 2, 3, 4].map((level) => upgradeCost(data, "relic", "r_bach_lo_huong_nang", level))).toEqual(cost.relic.rare);
    expect(upgradeCost(data, "weapon", "w_xich_diem_thuong", 5)).toBeNull();
    expect(upgradeCost(data, "weapon", "nope", 1)).toBeNull();
    data.relics["r_bach_lo_huong_nang"]!.rarity = "common";
    expect(upgradeCost(data, "relic", "r_bach_lo_huong_nang", 1)).toBe(cost.relic.rare[0]);

    const profile = createProfile(data);
    profile.relics = { r_huyet_ngoc_boi: { resonance: 4 } }; // epic
    profile.currencies.moonDust = 9;
    profile.currencies.darkIron = 0;
    const result = upgradeItem(data, profile, "relic", "r_huyet_ngoc_boi");
    expect(result).toMatchObject({ ok: true, level: 5, spent: cost.relic.epic[3] });
    if (result.ok) expect(result.profile.currencies.moonDust).toBe(9 - cost.relic.epic[3]!);
  });

  it("T312: runs pay dark iron — 3 on a win, 1 on a loss from floor 2, none earlier; starter decks too", () => {
    const data = testData();
    const run = (won: boolean, floorReached: number): RunResult => ({ heroIds: TEAM, floorReached, won, heroLevelUps: {} });
    const pay = (result: RunResult, starterDeck: boolean) =>
      applyRunRewards(data, createProfile(data), result, { now: NOW, starterDeck });
    expect(pay(run(true, 8), false).rewards.darkIron).toBe(3);
    expect(pay(run(true, 8), false).profile.currencies.darkIron).toBe(3);
    expect(pay(run(false, 2), false).rewards.darkIron).toBe(1);
    expect(pay(run(false, 1), false).rewards.darkIron).toBe(0);
    expect(pay(run(false, 5), true).rewards.darkIron).toBe(1);
  });
});
