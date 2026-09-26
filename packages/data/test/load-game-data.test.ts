import { describe, expect, it } from "vitest";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runConfigJson from "../run-config.json";
import combatConfigJson from "../combat-config.json";
import keywordsJson from "../keywords.json";
import metaConfigJson from "../meta-config.json";
import { loadGameData, parseGameData } from "../src/index";

function rawData(): any {
  return JSON.parse(JSON.stringify({
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
    runRelics: runRelicsJson,
    runConfig: runConfigJson,
    combatConfig: combatConfigJson,
    keywords: keywordsJson,
    metaConfig: metaConfigJson,
  }));
}

describe("loadGameData", () => {
  it("loads the real data files into GameData keyed by id", () => {
    const data = loadGameData();

    expect(Object.keys(data.heroes)).toEqual(["m05", "f04", "m06", "f03", "f02"]);
    expect(Object.keys(data.cards)).toHaveLength(63);
    expect(Object.keys(data.enemies)).toEqual([
      "puppet_guard", "shadow_fox", "moon_ape", "book_wraith", "black_guard", "fox_king",
    ]);
    expect(Object.keys(data.encounters)).toEqual([
      "enc_01", "enc_02", "enc_03", "enc_04", "enc_05", "enc_06", "enc_elite_01", "enc_elite_02",
    ]);
    expect(Object.keys(data.runRelics)).toHaveLength(10);
    expect(data.runConfig.floors).toBe(8);
    expect(data.heroes["m05"]?.lockedCardIds).toEqual([
      "m05_huyet_chien",
      "m05_no_hoa_lien_hoan",
      "m05_liet_hoa_phan_thien",
      "m05_thiet_bich",
      "m05_huyet_thuan",
      "m05_lo_luyen",
    ]);
    expect(data.encounters["enc_elite_01"]).toMatchObject({ tier: "elite", minFloor: 5 });

    expect(data.moonPhases).toHaveLength(8);
    expect(data.moonPhases[0]?.id).toBe("new");
    expect(data.moonPhases[7]?.id).toBe("waningCrescent");

    expect(data.heroes["m05"]?.name).toBe("Hoắc Liệt");
    expect(data.cards["m05_ho_gam"]?.ownerId).toBe("m05");
    expect(data.enemies["shadow_fox"]?.moonOverrides?.[0]?.phase).toBe("full");
    expect(data.cards["bond_anh_dau"]?.bond?.owners).toEqual(["m06", "f02"]);
    expect(data.cards["f02_phe_hon"]?.requiresBloodMoon).toBe(true);
    expect(data.enemies["moon_ape"]?.bloodMoonOverride?.id).toBe("ape_blood_frenzy");
  });
});

describe("parseGameData validation", () => {
  it("rejects a hero cardIds entry pointing at a missing card", () => {
    const raw = rawData();
    raw.heroes[0].cardIds[0] = "no_such_card";
    expect(() => parseGameData(raw)).toThrowError(/no_such_card/);
  });

  it("rejects a hero cardIds entry whose card has a different ownerId", () => {
    const raw = rawData();
    raw.heroes[1].cardIds[0] = "m05_ho_gam";
    expect(() => parseGameData(raw)).toThrowError(/m05_ho_gam/);
  });

  it("rejects a card with target enemy but no effect to chosen", () => {
    const raw = rawData();
    const card = raw.cards.find((c: any) => c.id === "m05_thuong_pha");
    card.effects = [{ type: "gainArmor", amount: 5, to: "self" }];
    expect(() => parseGameData(raw)).toThrowError(/m05_thuong_pha/);
  });

  it("rejects a card with target none that has an effect to chosen", () => {
    const raw = rawData();
    const card = raw.cards.find((c: any) => c.id === "m05_ho_gam");
    card.effects.push({ type: "damage", amount: 1, to: "chosen" });
    expect(() => parseGameData(raw)).toThrowError(/m05_ho_gam/);
  });

  it("detects to:chosen nested inside conditional effects", () => {
    const raw = rawData();
    const card = raw.cards.find((c: any) => c.id === "m05_liet_hoa_xung_phong");
    card.target = "none";
    expect(() => parseGameData(raw)).toThrowError(/m05_liet_hoa_xung_phong/);
  });

  it("rejects an intent with to:chosen but no targeting", () => {
    const raw = rawData();
    delete raw.enemies[0].intents[1].targeting;
    expect(() => parseGameData(raw)).toThrowError(/heavy_strike/);
  });

  it("rejects moonPhases with a duplicated index", () => {
    const raw = rawData();
    raw.moonPhases[7].index = 0;
    expect(() => parseGameData(raw)).toThrowError(/index/);
  });

  it("rejects moonPhases with the wrong number of phases", () => {
    const raw = rawData();
    raw.moonPhases = raw.moonPhases.slice(0, 7);
    expect(() => parseGameData(raw)).toThrowError(/8/);
  });

  it("rejects an encounter pointing at a missing enemy", () => {
    const raw = rawData();
    raw.encounters[0].enemyIds[0] = "no_such_enemy";
    expect(() => parseGameData(raw)).toThrowError(/no_such_enemy/);
  });

  it("T94: rejects a card with both ownerId and bond", () => {
    const raw = rawData();
    raw.cards.find((c: any) => c.id === "bond_anh_dau").ownerId = "m06";
    expect(() => parseGameData(raw)).toThrowError(/bond_anh_dau.*exactly one of ownerId or bond/);
  });

  it("T94: rejects a card with neither ownerId nor bond", () => {
    const raw = rawData();
    delete raw.cards.find((c: any) => c.id === "m05_ho_gam").ownerId;
    expect(() => parseGameData(raw)).toThrowError(/m05_ho_gam.*exactly one of ownerId or bond/);
  });

  it("T94: rejects actor on a regular card, including inside a conditional", () => {
    const raw = rawData();
    const card = raw.cards.find((c: any) => c.id === "m05_liet_hoa_xung_phong");
    card.effects[0].else[0].actor = 1;
    expect(() => parseGameData(raw)).toThrowError(/m05_liet_hoa_xung_phong.*actor/);
  });

  it("T94: rejects actor on an enemy intent", () => {
    const raw = rawData();
    raw.enemies[0].intents[1].effects[0].actor = 0;
    expect(() => parseGameData(raw)).toThrowError(/heavy_strike.*actor/);
  });

  it("T94: rejects requiresBloodMoon on a card without the forbidden tag", () => {
    const raw = rawData();
    raw.cards.find((c: any) => c.id === "m05_thuong_pha").requiresBloodMoon = true;
    expect(() => parseGameData(raw)).toThrowError(/m05_thuong_pha.*forbidden/);
  });

  it("T94: rejects a bond with a missing or duplicated owner", () => {
    const missing = rawData();
    missing.cards.find((c: any) => c.id === "bond_anh_dau").bond.owners[1] = "no_such_hero";
    expect(() => parseGameData(missing)).toThrowError(/no_such_hero/);

    const duplicated = rawData();
    duplicated.cards.find((c: any) => c.id === "bond_anh_dau").bond.owners = ["m06", "m06"];
    expect(() => parseGameData(duplicated)).toThrowError(/bond_anh_dau.*different/);
  });

  it("rejects a locked card owned by another hero", () => {
    const raw = rawData();
    raw.heroes[0].lockedCardIds[0] = "f04_thao_duoc";
    expect(() => parseGameData(raw)).toThrowError(/locked card/);
  });

  it("rejects encounters without exactly one boss", () => {
    const raw = rawData();
    raw.encounters.find((e: any) => e.id === "enc_04").tier = "normal";
    expect(() => parseGameData(raw)).toThrowError(/boss/);
  });

  it("rejects a runConfig floor without a rule", () => {
    const raw = rawData();
    raw.runConfig.floorRules = raw.runConfig.floorRules.filter((r: any) => !r.floors.includes(7));
    expect(() => parseGameData(raw)).toThrowError(/floor 7/);
  });

  it("T127: rejects run relic effects that target a chosen unit", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "nguyet_giap_phu").hooks[0].effects[0].to = "chosen";
    expect(() => parseGameData(raw)).toThrowError(/nguyet_giap_phu.*chosen/);
  });

  it("T127: rejects stealBuff in run relic effects", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "huyet_an").hooks[0].effects = [{ type: "stealBuff", count: 1 }];
    expect(() => parseGameData(raw)).toThrowError(/huyet_an.*stealBuff/);
  });

  it("T127: rejects actor in run relic effects", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "han_ngoc").hooks[0].effects[0].actor = 1;
    expect(() => parseGameData(raw)).toThrowError(/han_ngoc.*actor/);
  });

  it("T127: rejects heroDied hooks with actor trigger", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "tan_hon_dang").hooks[0].actor = "trigger";
    expect(() => parseGameData(raw)).toThrowError(/tan_hon_dang.*heroDied/);
  });

  it("T148: rejects a combatConfig moon power start above its cap", () => {
    const raw = rawData();
    raw.combatConfig.moonPower.start = 9;
    expect(() => parseGameData(raw)).toThrowError(/moonPower start must be <= cap/);
  });

  it("T148: rejects a card with copies outside 1..3", () => {
    const raw = rawData();
    raw.cards[0].copies = 4;
    expect(() => parseGameData(raw)).toThrowError(/copies/);
  });

  it("T148: rejects an enemy without intents or with start above cap", () => {
    const empty = rawData();
    empty.enemies[0].intents = [];
    expect(() => parseGameData(empty)).toThrowError();
    const inverted = rawData();
    inverted.enemies[0].moonPower = { start: 4, cap: 2 };
    expect(() => parseGameData(inverted)).toThrowError(/moonPower start must be <= cap/);
  });

  it("T148: rejects chooseCard that is not the last top-level card effect", () => {
    const raw = rawData();
    const guide = raw.cards.find((card: any) => card.id === "f04_nguyet_quang_dan");
    guide.effects.reverse();
    expect(() => parseGameData(raw)).toThrowError(/chooseCard must be the last/);
  });

  it("T158: every hero has 6 free + 6 locked unique own cards, 2 branches of 6 and cheap free cards", () => {
    const data = loadGameData();
    for (const hero of Object.values(data.heroes)) {
      const pool = [...hero.cardIds, ...hero.lockedCardIds];
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(new Set(pool).size).toBe(12);
      for (const id of pool) {
        expect(data.cards[id]?.ownerId).toBe(hero.id);
        expect([1, 2, 3]).toContain(data.cards[id]!.copies);
      }
      expect(hero.branches.flatMap((b) => b.cardIds).sort()).toEqual([...pool].sort());
      expect(hero.cardIds.filter((id) => data.cards[id]!.cost <= 3).length).toBeGreaterThanOrEqual(2);
    }
    const bad = rawData();
    bad.heroes[0].branches[0].cardIds[0] = bad.heroes[0].branches[1].cardIds[0];
    expect(() => parseGameData(bad)).toThrowError(/branches must split/);
  });

  it("T157: rejects card-only keywords in enemy intents and relic hooks, and unknown card keywords", () => {
    const intent = rawData();
    intent.enemies[0].intents[0].effects.push({ type: "drainMoonPower", amount: 1, to: "chosen" });
    expect(() => parseGameData(intent)).toThrowError(/card-only keyword/);

    const hook = rawData();
    hook.runRelics[0].hooks[0].effects.push({ type: "missingHpDamage", ratio: 1, to: "allEnemies" });
    expect(() => parseGameData(hook)).toThrowError(/card-only keyword/);

    const keyword = rawData();
    keyword.cards[0].keywords = ["no_such_keyword"];
    expect(() => parseGameData(keyword)).toThrowError(/unknown keyword/);
  });
});
