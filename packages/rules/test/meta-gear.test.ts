import { describe, expect, it } from "vitest";
import type { GameData, Loadout, Profile, RunAction, RunState } from "../src/index";
import {
  applyRunAction, buildLoadout, createProfile, createRun, pullMany, replayRun, setLevelUpForm, starterDeck, validateDeck,
} from "../src/index";
import { runAction } from "./playtest-bot";
import { testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const NOW = Date.UTC(2026, 8, 28, 12);

function withGear(data: GameData): Profile {
  const profile = createProfile(data);
  profile.weapons = { w_thiet_thuan: { refinement: 3 }, w_liet_cung: { refinement: 1 } };
  profile.relics = { r_huyen_vu_giap_phu: { resonance: 2 }, r_tran_hon_linh: { resonance: 1 }, r_loan_linh_an: { resonance: 1 } };
  return profile;
}

/** Starter deck minus one M06 card, so one weapon fills the 18th slot. */
function gearDeck(data: GameData) {
  return { heroIds: TEAM, cardIds: starterDeck(data, TEAM).slice(0, 17) };
}

describe("gear in decks, gacha and loadouts", () => {
  it("T197: validateDeck checks weapon slots, ownership and relic limits; a weapon takes one of the 18 slots", () => {
    const data = testData();
    const profile = withGear(data);
    const deck = gearDeck(data);
    expect(validateDeck(data, profile, { ...deck, weapons: { m05: "w_thiet_thuan" }, relicIds: ["r_huyen_vu_giap_phu"] })).toEqual([]);
    expect(validateDeck(data, profile, deck)).toEqual([{ code: "wrongSize", size: 17 }]);
    expect(validateDeck(data, profile, { ...deck, weapons: { m05: null } })).toEqual([{ code: "wrongSize", size: 17 }]);
    // Five M06 cards is still at least minCardsPerHero; the weapon card is not counted per hero.
    expect(validateDeck(data, profile, { ...deck, weapons: { m06: "w_thiet_thuan" } })).toEqual([]);

    const base = { heroIds: TEAM, cardIds: starterDeck(data, TEAM).slice(0, 16) };
    expect(validateDeck(data, profile, { ...base, weapons: { m05: "w_thiet_thuan", f04: "w_thiet_thuan" } })).toEqual([{ code: "weaponTwice", weaponId: "w_thiet_thuan" }]);
    expect(validateDeck(data, profile, { ...deck, weapons: { f03: "w_thiet_thuan" } })).toEqual([{ code: "weaponSlot", heroId: "f03" }]);
    expect(validateDeck(data, profile, { ...deck, weapons: { m05: "w_tinh_ban" } })).toEqual([{ code: "unownedWeapon", weaponId: "w_tinh_ban" }]);
    expect(validateDeck(data, profile, { ...deck, weapons: { m05: "no_such_weapon" } })).toEqual([{ code: "unownedWeapon", weaponId: "no_such_weapon" }]);

    const full = { ...deck, weapons: { m05: "w_thiet_thuan" } };
    expect(validateDeck(data, profile, { ...full, relicIds: ["r_thien_sach"] })).toEqual([{ code: "unownedRelic", relicId: "r_thien_sach" }]);
    expect(validateDeck(data, profile, { ...full, relicIds: ["r_tran_hon_linh", "r_tran_hon_linh"] })).toEqual([{ code: "duplicateRelic", relicId: "r_tran_hon_linh" }]);
    expect(validateDeck(data, profile, { ...full, relicIds: ["r_tran_hon_linh", "r_huyen_vu_giap_phu", "r_loan_linh_an"] })).toEqual([{ code: "tooManyRelics", count: 3 }]);
  });

  it("T203: weapon cards stay out of the run deck, join every combat and replay with the loadout", () => {
    const data = testData();
    const loadout = (buildLoadout(data, withGear(data), { ...gearDeck(data), weapons: { m05: "w_thiet_thuan" } }) as { ok: true; loadout: Loadout }).loadout;
    const setup = { heroIds: TEAM, seed: 11, deckCardIds: gearDeck(data).cardIds };
    let run: RunState = createRun(data, setup, loadout).run;
    expect(run.deck).toHaveLength(17);
    expect(run.deck).not.toContain("w_thiet_thuan");

    const actions: RunAction[] = [];
    let combats = 0;
    let restChecked = false;
    for (let step = 0; step < 20000 && run.status !== "won" && run.status !== "lost"; step++) {
      if (run.status === "rest" && !restChecked) {
        restChecked = true;
        expect(applyRunAction(data, run, { type: "rest", choice: "removeCard", cardId: "w_thiet_thuan" })).toEqual({ ok: false, error: "card is not in deck" });
      }
      const action = runAction(data, run);
      const result = applyRunAction(data, run, action);
      if (!result.ok) throw new Error(result.error);
      if (run.combat === null && result.run.combat !== null) {
        combats += 1;
        expect(Object.values(result.run.combat.cards).filter((card) => card.cardId === "w_thiet_thuan")).toHaveLength(2);
      }
      actions.push(action);
      run = result.run;
    }
    expect(combats).toBeGreaterThan(0);
    expect(replayRun(data, setup, actions, loadout)).toEqual({ ok: true, run });
  });

  it("T204: gear pulls give level 1, then +1 per duplicate; at level 5 materials and moon stars; pity per banner", () => {
    const data = testData();
    data.economyConfig.gacha.rates = { legendary: 0, epic: 0 };
    data.economyConfig.gacha.epicPity = 1000;
    data.banners["banner_weapons"]!.pool = { legendary: [], epic: [], rare: ["w_thiet_thuan"], common: [] };
    data.banners["banner_relics"]!.pool = { legendary: [], epic: [], rare: ["r_tran_hon_linh"], common: [] };
    const start = { ...createProfile(data), currencies: { moonJade: 10_000, moonStar: 0, darkIron: 0, moonDust: 0 } };

    const weapons = pullMany(data, start, "banner_weapons", 10, 5, NOW);
    if (!weapons.ok) throw new Error(weapons.error);
    expect(weapons.results.map((result) => result.outcome)).toEqual(["newWeapon", "refinement", "refinement", "refinement", "refinement", "maxed", "maxed", "maxed", "maxed", "maxed"]);
    expect(weapons.results[4]).toMatchObject({ refinement: 5 });
    expect(weapons.results[5]).toEqual({ itemId: "w_thiet_thuan", rarity: "rare", outcome: "maxed", moonStar: data.economyConfig.gearDupeMoonStar.rare, darkIron: 1 });
    expect(weapons.profile.weapons).toEqual({ w_thiet_thuan: { refinement: 5 } });
    expect(weapons.profile.currencies).toMatchObject({ darkIron: 5, moonStar: 5 * data.economyConfig.gearDupeMoonStar.rare });
    expect(weapons.profile.pity).toEqual({ banner_weapons: { sinceEpic: 10, sinceLegendary: 10 } });
    expect(Object.keys(weapons.profile.heroes)).toEqual(Object.keys(start.heroes));

    const relics = pullMany(data, weapons.profile, "banner_relics", 10, 6, NOW);
    if (!relics.ok) throw new Error(relics.error);
    expect(relics.results.slice(0, 2).map((result) => result.outcome)).toEqual(["newRelic", "resonance"]);
    expect(relics.results[9]).toMatchObject({ outcome: "maxed", moonDust: 1 });
    expect(relics.profile.relics).toEqual({ r_tran_hon_linh: { resonance: 5 } });
    expect(relics.profile.currencies.moonDust).toBe(5);
    expect(relics.profile.pity["banner_relics"]).toEqual({ sinceEpic: 10, sinceLegendary: 10 });
    expect(relics.profile.pity["banner_weapons"]).toEqual({ sinceEpic: 10, sinceLegendary: 10 });

    // No new-player protection on gear banners: epic pulls may repeat an owned weapon.
    const epic = testData();
    epic.economyConfig.gacha.rates = { legendary: 0, epic: 1 };
    const owned = { ...createProfile(epic), currencies: { moonJade: 10_000, moonStar: 0, darkIron: 0, moonDust: 0 } };
    owned.weapons = { w_anh_nguyet_chuy: { refinement: 1 } };
    const results = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) => {
      const pulled = pullMany(epic, owned, "banner_weapons", 1, seed, NOW);
      return pulled.ok ? pulled.results.map((result) => result.itemId) : [];
    });
    expect(results).toContain("w_anh_nguyet_chuy");
  });

  it("T205: buildLoadout takes gear levels from the profile and refuses gear not owned", () => {
    const data = testData();
    const profile = withGear(data);
    const deck = { ...gearDeck(data), weapons: { f04: "w_thiet_thuan", m05: null }, relicIds: ["r_huyen_vu_giap_phu"] };
    const built = buildLoadout(data, profile, deck);
    expect(built.ok && built.loadout.heroes["f04"]).toEqual({ constellation: 0, levelUpForm: "base", weaponId: "w_thiet_thuan", refinement: 3 });
    expect(built.ok && built.loadout.heroes["m05"]).toMatchObject({ weaponId: null, refinement: 0 });
    expect(built.ok && built.loadout.relics).toEqual([{ id: "r_huyen_vu_giap_phu", resonance: 2 }]);
    expect(buildLoadout(data, profile, { ...deck, weapons: { f04: "w_tinh_ban" } })).toEqual({ ok: false, error: "weapon not owned" });
    expect(buildLoadout(data, profile, { ...deck, relicIds: ["r_thien_sach"] })).toEqual({ ok: false, error: "relic not owned" });
  });

  it("T206: setLevelUpForm needs an owned hero at Tinh Hồn 5 for the second form", () => {
    const data = testData();
    const profile = createProfile(data);
    expect(setLevelUpForm(data, profile, "f03", "alt")).toEqual({ ok: false, error: "hero not owned" });
    expect(setLevelUpForm(data, profile, "m05", "alt")).toEqual({ ok: false, error: "constellation too low" });
    profile.heroes["m05"]!.constellation = 5;
    const chosen = setLevelUpForm(data, profile, "m05", "alt");
    expect(chosen.ok && chosen.profile.heroes["m05"]!.levelUpForm).toBe("alt");
    expect(profile.heroes["m05"]!.levelUpForm).toBe("base"); // input untouched
    const back = setLevelUpForm(data, chosen.ok ? chosen.profile : profile, "m05", "base");
    expect(back.ok && back.profile.heroes["m05"]!.levelUpForm).toBe("base");
  });
});
