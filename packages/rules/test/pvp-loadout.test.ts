import { describe, expect, it } from "vitest";
import type { Profile } from "../src/index";
import {
  applyAction, buildPvpLoadout, createPvpCombat, createProfile, starterDeck, validateDeck,
} from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
import { makeTestCombat, ownAllHeroes, setIntent, testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const PVP = { mode: "pvp" } as const;

describe("PvP loadout and deck rules", () => {
  it("T226: arena keeps owned progression and activates signature+ and even bonuses", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    profile.heroes["m05"]!.constellation = 6;
    profile.heroes["f04"]!.constellation = 4;
    profile.heroes["m06"]!.constellation = 5;
    profile.heroes["m06"]!.levelUpForm = "alt";
    const weapon = data.pvpConfig.freeWeaponIds[0]!;
    const relic = data.pvpConfig.freeRelicIds[0]!;
    profile.weapons[weapon] = { refinement: 5 };
    profile.relics[relic] = { resonance: 4 };

    const built = buildPvpLoadout(data, profile, {
      heroIds: TEAM,
      weapons: { m05: weapon },
      relicIds: [relic],
    });
    expect(built).toEqual({
      ok: true,
      loadout: {
        heroes: {
          m05: { constellation: 6, levelUpForm: "base", weaponId: weapon, refinement: 5 },
          f04: { constellation: 4, levelUpForm: "base", weaponId: null, refinement: 1 },
          m06: { constellation: 5, levelUpForm: "alt", weaponId: null, refinement: 1 },
        },
        relics: [{ id: relic, resonance: 4 }],
      },
    });

    // Use the real arena constructor so both seats receive the full loadout.
    const { cardId, plusCardId } = data.heroes["m05"]!.signature;
    const deck = starterDeck(data, TEAM);
    expect(deck).toContain(cardId);
    if (built.ok) {
      const side = { heroIds: TEAM, deckCardIds: deck, loadout: built.loadout };
      const { state } = createPvpCombat(data, { seed: 3, players: [side, side] });
      const ids = Object.values(state.cards).map((card) => card.cardId);
      expect(ids).not.toContain(cardId);
      expect(ids).toContain(plusCardId);
      expect(state.heroes.every((hero) => hero.pvp !== true)).toBe(true);
      expect(state.players.every((player) => player.weapons[0]?.refinement === 5 && player.relics[0]?.resonance === 4)).toBe(true);
      const hero = state.heroes.find((hero) => hero.player === state.activePlayer && hero.defId === "m05")!;
      hero.levelUpCounter = data.heroes.m05!.levelUp.constellationThreshold;
      let current = state;
      for (const player of [0, 1]) {
        const result = applyAction(data, current, { type: "mulligan", player, instanceIds: [] });
        if (!result.ok) throw new Error(result.error);
        current = result.state;
      }
      expect(current.heroes.find((h) => h.id === hero.id)!.leveledUp).toBe(true);
    }

    // Explicit old replay flags still reproduce historical normalized bonuses.
    const { data: game, state } = makeTestCombat();
    const m05 = state.heroes.find((hero) => hero.defId === "m05")!;
    m05.constellation = 5;
    m05.pvp = true;
    m05.levelUpCounter = data.heroes["m05"]!.levelUp.constellationThreshold; // 11 < threshold 15
    const ended = applyAction(game, state, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    const after = ended.state.heroes.find((hero) => hero.defId === "m05")!;
    expect(after.leveledUp).toBe(false); // pvp: constellation-2 threshold is off
    const pve = makeTestCombat();
    const pveM05 = pve.state.heroes.find((hero) => hero.defId === "m05")!;
    pveM05.constellation = 5;
    pveM05.levelUpCounter = pve.data.heroes["m05"]!.levelUp.constellationThreshold;
    const pveEnded = applyAction(pve.data, pve.state, { type: "endTurn" });
    if (!pveEnded.ok) throw new Error(pveEnded.error);
    expect(pveEnded.state.heroes.find((hero) => hero.defId === "m05")!.leveledUp).toBe(true);

    // Reflect kills only count toward enemiesKilled when the even bonus applies.
    const reflectKill = (pvp: boolean) => {
      const { data: g, state: s } = makeTestCombat();
      const m06 = s.heroes.find((hero) => hero.defId === "m06")!;
      m06.constellation = 5;
      if (pvp) m06.pvp = true;
      m06.statuses.push({ id: "reflect", value: 5 });
      s.enemies[0]!.hp = 3;
      setIntent(s, 0, strike9Intent, "hero:m06");
      setIntent(s, 1, idleIntent, null);
      const result = applyAction(g, s, { type: "endTurn" });
      if (!result.ok) throw new Error(result.error);
      return result.state.heroes.find((hero) => hero.defId === "m06")!.levelUpCounter;
    };
    expect(reflectKill(false)).toBe(1);
    expect(reflectKill(true)).toBe(0);

    // Errors: hero neither owned nor trial; weapon/relic neither owned nor free.
    const noTrial = testData();
    noTrial.pvpConfig.trialHeroIds = [];
    const stripped: Profile = { ...profile, heroes: { ...profile.heroes } };
    delete stripped.heroes["f04"];
    expect(buildPvpLoadout(noTrial, stripped, { heroIds: ["m05", "f04", "f03"] })).toEqual({ ok: false, error: "hero not owned" });
    const noGear: Profile = { ...profile, weapons: {}, relics: {} };
    const badWeapon = buildPvpLoadout(data, noGear, { heroIds: TEAM, weapons: { m05: "w_xich_diem_thuong" } });
    expect(badWeapon).toEqual({ ok: false, error: "weapon not owned" });
    const badRelic = buildPvpLoadout(data, noGear, { heroIds: TEAM, relicIds: ["r_thien_sach"] });
    expect(badRelic).toEqual({ ok: false, error: "relic not owned" });
  });

  it("unowned trial heroes and free equipment remain at base progression", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.heroes = {};
    profile.weapons = {};
    profile.relics = {};
    const team = data.pvpConfig.trialHeroIds.slice(0, 3);
    const weapon = data.pvpConfig.freeWeaponIds[0]!;
    const relic = data.pvpConfig.freeRelicIds[0]!;
    const result = buildPvpLoadout(data, profile, { heroIds: team, weapons: { [team[0]!]: weapon }, relicIds: [relic] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.values(result.loadout.heroes).every((hero) => hero.constellation === 0 && hero.levelUpForm === "base" && hero.refinement === 1)).toBe(true);
    expect(result.loadout.relics).toEqual([{ id: relic, resonance: 1 }]);
    expect(result.loadout.pvp).toBeUndefined();
  });

  it("retains every owned constellation from zero through six", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (let constellation = 0; constellation <= 6; constellation++) {
      profile.heroes.m05!.constellation = constellation;
      const result = buildPvpLoadout(data, profile, { heroIds: TEAM });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.loadout.heroes.m05!.constellation).toBe(constellation);
    }
  });

  it("T227: validateDeck mode pvp accepts trial heroes and free gear", () => {
    const data = testData();
    const profile = createProfile(data); // starters m05, f04, m06 — f03/f02 unowned
    const team: [string, string, string] = ["m05", "f04", "f03"];
    const cards = starterDeck(data, team);
    const freeWeapon = data.pvpConfig.freeWeaponIds[0]!;

    // Trial hero f03: unowned is fine in pvp, an error in pve mode.
    expect(validateDeck(data, profile, { heroIds: team, cardIds: cards })).toContainEqual({ code: "unownedHero", heroId: "f03" });
    expect(validateDeck(data, profile, { heroIds: team, cardIds: cards }, PVP)).toEqual([]);
    // A trial hero only brings its six starters: a locked card is still locked.
    const lockedF03 = data.heroes["f03"]!.lockedCardIds[0]!;
    const withLocked = [lockedF03, ...cards.slice(1)];
    expect(validateDeck(data, profile, { heroIds: team, cardIds: withLocked }, PVP)).toContainEqual({ code: "lockedCard", cardId: lockedF03 });
    // A hero neither owned nor trial stays an error.
    const noTrial = testData();
    noTrial.pvpConfig.trialHeroIds = noTrial.pvpConfig.trialHeroIds.filter((id) => id !== "f03");
    expect(validateDeck(data, profile, { heroIds: team, cardIds: cards }, PVP)).toEqual([]);
    expect(validateDeck(noTrial, profile, { heroIds: team, cardIds: cards }, PVP)).toContainEqual({ code: "unownedHero", heroId: "f03" });

    // Free weapon on an unowned-trial hero's slot: fine in pvp, unownedWeapon in pve.
    const geared = { heroIds: team, cardIds: cards, weapons: { m05: freeWeapon } };
    expect(validateDeck(data, profile, geared, PVP)).toEqual([]);
    expect(validateDeck(data, profile, geared)).toContainEqual({ code: "unownedWeapon", weaponId: freeWeapon });
    // A non-free unowned weapon stays an error in pvp too.
    const paidWeapon = Object.keys(data.weapons).find((id) => !data.pvpConfig.freeWeaponIds.includes(id))!;
    expect(
      validateDeck(data, profile, { ...geared, weapons: { m05: paidWeapon } }, PVP),
    ).toContainEqual({ code: "unownedWeapon", weaponId: paidWeapon });

    // Free relic / paid relic.
    const freeRelic = data.pvpConfig.freeRelicIds[0]!;
    const paidRelic = Object.keys(data.relics).find((id) => !data.pvpConfig.freeRelicIds.includes(id))!;
    expect(validateDeck(data, profile, { heroIds: team, cardIds: cards, relicIds: [freeRelic] }, PVP)).toEqual([]);
    expect(validateDeck(data, profile, { heroIds: team, cardIds: cards, relicIds: [paidRelic] }, PVP)).toContainEqual({ code: "unownedRelic", relicId: paidRelic });
  });
});
