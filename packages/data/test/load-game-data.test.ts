import { describe, expect, it } from "vitest";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import { loadGameData, parseGameData } from "../src/index";

function rawData(): any {
  return JSON.parse(JSON.stringify({
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
  }));
}

describe("loadGameData", () => {
  it("loads the real data files into GameData keyed by id", () => {
    const data = loadGameData();

    expect(Object.keys(data.heroes)).toEqual(["m05", "f04", "m06"]);
    expect(Object.keys(data.cards)).toHaveLength(15);
    expect(Object.keys(data.enemies)).toEqual(["puppet_guard", "shadow_fox"]);
    expect(Object.keys(data.encounters)).toEqual(["enc_01", "enc_02", "enc_03"]);

    expect(data.moonPhases).toHaveLength(8);
    expect(data.moonPhases[0]?.id).toBe("new");
    expect(data.moonPhases[7]?.id).toBe("waningCrescent");

    expect(data.heroes["m05"]?.name).toBe("Hoắc Liệt");
    expect(data.cards["m05_ho_gam"]?.ownerId).toBe("m05");
    expect(data.enemies["shadow_fox"]?.moonOverrides?.[0]?.phase).toBe("full");
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
});
