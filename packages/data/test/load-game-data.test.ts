import { describe, expect, it } from "vitest";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runConfigJson from "../run-config.json";
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
  }));
}

describe("loadGameData", () => {
  it("loads the real data files into GameData keyed by id", () => {
    const data = loadGameData();

    expect(Object.keys(data.heroes)).toEqual(["m05", "f04", "m06", "f03", "f02"]);
    expect(Object.keys(data.cards)).toHaveLength(48);
    expect(Object.keys(data.enemies)).toEqual([
      "puppet_guard", "shadow_fox", "moon_ape", "book_wraith", "black_guard", "fox_king",
    ]);
    expect(Object.keys(data.encounters)).toEqual([
      "enc_01", "enc_02", "enc_03", "enc_04", "enc_05", "enc_06", "enc_elite_01", "enc_elite_02",
    ]);
    expect(Object.keys(data.runRelics)).toHaveLength(10);
    expect(data.runConfig.floors).toBe(8);
    expect(data.heroes["m05"]?.rewardCardIds).toEqual([
      "m05_thiet_bich", "m05_no_hoa_lien_hoan", "m05_bat_dong_nhu_son", "m05_huyet_chien",
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
    delete raw.enemies[0].intentPattern[0].targeting;
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
    raw.enemies[0].intentPattern[0].effects[0].actor = 0;
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

  it("rejects a reward card owned by another hero", () => {
    const raw = rawData();
    raw.heroes[0].rewardCardIds[0] = "f04_thao_duoc";
    expect(() => parseGameData(raw)).toThrowError(/m05.*f04_thao_duoc/);
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
});
