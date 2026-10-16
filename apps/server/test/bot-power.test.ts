import { loadGameData } from "data";
import { describe, expect, it } from "vitest";
import { createProfile, measurePvpPower, starterDeck, validateDeck, type PvpSide } from "rules";
import type { AppContext } from "../src/context";
import { botMatchedPvpSide, botPvpSide } from "../src/realtime/bot-player";

describe("matched arena bot", () => {
  it("is seeded, uses the entire roster and builds valid distinct teams close to low and high power", () => {
    const data = loadGameData();
    const ctx = { data } as AppContext;
    const heroIds: PvpSide["heroIds"] = ["m05", "f04", "m06"];
    const target: PvpSide = { heroIds, deckCardIds: starterDeck(data, heroIds), loadout: { heroes: {}, relics: [] } };
    const profile = createProfile(data);
    for (const id of Object.keys(data.heroes)) profile.heroes[id] = { xp: 0, constellation: 6, levelUpForm: "alt", bonusUnlocks: 0, unlockedCardIds: data.heroes[id]!.lockedCardIds };
    for (const id of Object.keys(data.weapons)) profile.weapons[id] = { refinement: 5 };
    for (const id of Object.keys(data.relics)) profile.relics[id] = { resonance: 5 };
    const seen = new Set<string>();
    const teams = new Set<string>();
    for (const high of [false, true]) {
      if (high) {
        heroIds.forEach((id, i) => target.loadout.heroes[id] = { constellation: 6, levelUpForm: "alt", weaponId: Object.keys(data.weapons)[i]!, refinement: 5 });
        target.loadout.relics = Object.keys(data.relics).slice(0, data.metaConfig.maxRelics).map((id) => ({ id, resonance: 5 }));
      }
      for (let seed = 1; seed <= 16; seed++) {
        const bot = botMatchedPvpSide(ctx, seed, target);
        expect(botMatchedPvpSide(ctx, seed, target)).toEqual(bot);
        expect(new Set(bot.heroIds).size).toBe(3);
        expect(Math.abs(measurePvpPower(data, bot) / measurePvpPower(data, target) - 1)).toBeLessThanOrEqual(0.1);
        expect(validateDeck(data, profile, { heroIds: bot.heroIds, cardIds: bot.deckCardIds!, weapons: Object.fromEntries(bot.heroIds.map((id) => [id, bot.loadout.heroes[id]?.weaponId ?? null])), relicIds: bot.loadout.relics?.map((r) => r.id) })).toEqual([]);
        bot.heroIds.forEach((id) => seen.add(id));
        teams.add(bot.heroIds.join(","));
      }
    }
    expect(teams.size).toBeGreaterThan(8);
    expect([...seen].some((id) => !data.pvpConfig.trialHeroIds.includes(id))).toBe(true);
    expect(botPvpSide(ctx, 1).heroIds.every((id) => data.pvpConfig.trialHeroIds.includes(id))).toBe(true);
  }, 20_000);

  it("matches varied roster, card and gear extremes without changing the target", () => {
    const data = loadGameData();
    const ctx = { data } as AppContext;
    const roster = Object.keys(data.heroes);
    let worst = 0;
    for (let offset = 0; offset < roster.length; offset += 3) {
      const heroIds = [0, 1, 2].map((i) => roster[(offset + i) % roster.length]!) as PvpSide["heroIds"];
      for (const constellation of [0, 2, 4, 6]) {
        const weapons = Object.keys(data.weapons);
        const relics = Object.keys(data.relics);
        const target: PvpSide = {
          heroIds,
          deckCardIds: heroIds.flatMap((id) => constellation === 4 ? data.heroes[id]!.lockedCardIds : data.heroes[id]!.cardIds),
          loadout: {
            heroes: Object.fromEntries(heroIds.map((id, i) => [id, {
              constellation,
              levelUpForm: constellation === 6 ? "alt" : "base",
              ...(constellation >= 2 ? { weaponId: weapons[(offset + i) % weapons.length]!, refinement: constellation === 6 ? 5 : 1 } : {}),
            }])),
            relics: constellation >= 4 ? relics.slice(-data.metaConfig.maxRelics).map((id) => ({ id, resonance: constellation === 6 ? 5 : 1 })) : [],
          },
        };
        const before = structuredClone(target);
        for (const seed of [7, 103, 999]) {
          const bot = botMatchedPvpSide(ctx, seed, target);
          worst = Math.max(worst, Math.abs(measurePvpPower(data, bot) / measurePvpPower(data, target) - 1));
          expect(target).toEqual(before);
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(0.1);
  }, 20_000);
});
