import { describe, expect, it } from "vitest";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runAugmentsJson from "../run-augments.json";
import runConfigJson from "../run-config.json";
import combatConfigJson from "../combat-config.json";
import keywordsJson from "../keywords.json";
import metaConfigJson from "../meta-config.json";
import economyConfigJson from "../economy-config.json";
import missionsJson from "../missions.json";
import achievementsJson from "../achievements.json";
import bannersJson from "../banners.json";
import weaponsJson from "../weapons.json";
import relicsJson from "../relics.json";
import pvpConfigJson from "../pvp-config.json";
import coopConfigJson from "../coop-config.json";
import coopCombosJson from "../coop-combos.json";
import { loadGameData, parseGameData } from "../src/index";

function rawData(): any {
  return JSON.parse(JSON.stringify({
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
    runRelics: runRelicsJson,
    runAugments: runAugmentsJson,
    runConfig: runConfigJson,
    combatConfig: combatConfigJson,
    keywords: keywordsJson,
    metaConfig: metaConfigJson,
    economyConfig: economyConfigJson,
    missions: missionsJson,
    achievements: achievementsJson,
    banners: bannersJson,
    weapons: weaponsJson,
    relics: relicsJson,
    pvpConfig: pvpConfigJson,
    coopConfig: coopConfigJson,
    coopCombos: coopCombosJson,
  }));
}

describe("loadGameData", () => {
  it("loads the real data files into GameData keyed by id", () => {
    const data = loadGameData();

    expect(Object.keys(data.heroes)).toEqual(["m05", "f04", "m06", "f03", "f02", "m01", "m02", "m03", "m04", "f01", "m07", "m08", "m10", "f08"]);
    expect(Object.keys(data.cards)).toHaveLength(190); // 168 hero + 7 bond + 14 constellation-4 plus cards + 1 token
    expect(Object.keys(data.enemies)).toEqual([
      "puppet_guard", "shadow_fox", "moon_ape", "book_wraith", "black_guard", "fox_king", "eclipse_lord",
    ]);
    expect(Object.keys(data.encounters)).toEqual([
      "enc_01", "enc_02", "enc_03", "enc_04", "enc_05", "enc_06", "enc_elite_01", "enc_elite_02",
      "enc_coop_01",
    ]);
    expect(Object.keys(data.runRelics)).toHaveLength(10);
    expect(Object.keys(data.augments)).toHaveLength(16);
    expect(data.augments["aug_loan_dao"]?.modifiers?.[0]).toMatchObject({
      type: "damageMultiplierForTag",
      tag: "assassin",
    });
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

  it("rejects an augment id colliding with a run relic id", () => {
    const raw = rawData();
    raw.runAugments[0].id = "nguyet_giap_phu";
    expect(() => parseGameData(raw)).toThrowError(/collides with a runRelic/);
  });

  it("augments allow card-only keywords but still reject chosen/stealBuff", () => {
    const raw = rawData();
    raw.runAugments[0].hooks[0].effects = [{ type: "drainMoonPower", amount: 1, to: "allEnemies" }];
    expect(() => parseGameData(raw)).not.toThrowError();

    const chosen = rawData();
    chosen.runAugments[0].hooks[0].effects = [{ type: "damage", amount: 1, to: "chosen" }];
    expect(() => parseGameData(chosen)).toThrowError(/aug_nguyet_trieu.*chosen/);
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

  it("T271: createCard must point at a token card owned by the creating hero; tokens stay out of pools", () => {
    const raw = rawData();
    raw.cards.push({ id: "tok_x", name: "X", ownerId: "m05", cost: 0, copies: 1, type: "skill", tags: [], target: "none", effects: [{ type: "gainMoonPower", amount: 1 }], text: "", token: true });
    raw.heroes.find((h: any) => h.id === "f04").levelUp.onLevelUp = [{ type: "createCard", cardId: "tok_x" }];
    expect(() => parseGameData(raw)).toThrow(/createCard .*tok_x.* owned by "f04"/);

    const pooled = rawData();
    pooled.cards.find((c: any) => c.id === pooled.heroes[0].cardIds[0]).token = true;
    expect(() => parseGameData(pooled)).toThrow(/token card .* must not be in a hero pool/);

    const notToken = rawData();
    notToken.heroes[0].levelUp.onLevelUp = [{ type: "createCard", cardId: notToken.heroes[0].cardIds[0] }];
    expect(() => parseGameData(notToken)).toThrow(/createCard .* must be a token card/);
  });

  it("T271b: rejects createCard hidden inside execute.elseEffects of levelUp.onLevelUp, and banned effects there", () => {
    const nested = rawData();
    nested.heroes.find((h: any) => h.id === "f04").levelUp.onLevelUp = [
      { type: "execute", threshold: 0.5, to: "allEnemies", elseEffects: [{ type: "createCard", cardId: "m05_ho_gam" }] },
    ];
    expect(() => parseGameData(nested)).toThrow(/must be a token card/);

    const chosen = rawData();
    chosen.heroes[0].levelUp.onLevelUp = [{ type: "damage", amount: 3, to: "chosen" }];
    expect(() => parseGameData(chosen)).toThrow(/levelUp\.onLevelUp: effects must not use to "chosen"/);
  });
});

describe("economyConfig", () => {
  it("rejects unknown or repeated starter heroes", () => {
    const unknown = rawData();
    unknown.economyConfig = { ...unknown.economyConfig, starterHeroIds: ["m05", "f04", "ghost"] };
    expect(() => parseGameData(unknown)).toThrow(/unknown starter hero "ghost"/);
    const repeated = rawData();
    repeated.economyConfig = { ...repeated.economyConfig, starterHeroIds: ["m05", "m05", "f04"] };
    expect(() => parseGameData(repeated)).toThrow(/starterHeroIds must be distinct/);
  });

  it("rejects gacha rates without room for rare, soft pity past hard pity, and a bond achievement on a normal card", () => {
    const rates = rawData();
    rates.economyConfig = { ...rates.economyConfig, gacha: { ...rates.economyConfig.gacha, rates: { legendary: 0.5, epic: 0.5 } } };
    expect(() => parseGameData(rates)).toThrow(/gacha rates must leave room for rare/);
    const pity = rawData();
    pity.economyConfig = { ...pity.economyConfig, gacha: { ...pity.economyConfig.gacha, legendarySoftPityStart: 70 } };
    expect(() => parseGameData(pity)).toThrow(/legendarySoftPityStart must be below legendaryPity/);
    const bond = rawData();
    bond.achievements = [{ ...bond.achievements[1], goal: { type: "bossKillWithBond", bondCardId: "m05_bat_khuat" } }];
    expect(() => parseGameData(bond)).toThrow(/needs a bond card/);
  });

  it("rejects banners with unknown heroes or heroes under the wrong rarity", () => {
    const unknown = rawData();
    unknown.banners = [{ ...unknown.banners[0], pool: { ...unknown.banners[0].pool, rare: ["ghost"] } }];
    expect(() => parseGameData(unknown)).toThrow(/unknown hero "ghost"/);
    const wrong = rawData();
    wrong.banners = [{ ...wrong.banners[0], pool: { ...wrong.banners[0].pool, rare: ["f04", "m05"] } }];
    expect(() => parseGameData(wrong)).toThrow(/lists legendary hero "m05" as rare|lists "m05" twice/);
  });
});


describe("weapons, moon relics and second level-up forms", () => {
  it("loads 10 weapons with 4 refinements and 8 relics with 5 resonance levels; every hero has a second form", () => {
    const data = loadGameData();
    expect(Object.keys(data.weapons)).toHaveLength(10);
    expect(Object.keys(data.relics)).toHaveLength(8);
    expect(Object.values(data.weapons).every((weapon) => weapon.refinement.length === 4)).toBe(true);
    expect(Object.values(data.relics).every((relic) => relic.resonance.length === 5)).toBe(true);
    expect(Object.values(data.heroes).every((hero) => hero.altLevelUp.name.length > 0)).toBe(true);
    expect(data.metaConfig.maxRelics).toBe(2);
    expect(data.economyConfig.gearDupeMoonStar).toEqual({ legendary: 10, epic: 4, rare: 1, common: 1 });
    const count = (rarity: string) => Object.values(data.weapons).filter((weapon) => weapon.rarity === rarity).length;
    expect([count("legendary"), count("epic"), count("rare")]).toEqual([2, 4, 4]);
  });

  it("T212: rejects wearer outside weapon hooks, forbidden hook effects, wrong level counts and colliding ids", () => {
    const wearerInRelic = rawData();
    wearerInRelic.runRelics[0].hooks = [{ on: { type: "enemyKilled", killer: "wearer" }, actor: "front", effects: [{ type: "gainMoonPower", amount: 1 }] }];
    expect(() => parseGameData(wearerInRelic)).toThrow(/"wearer" is only allowed in weapon hooks/);

    const wearerInMoonRelic = rawData();
    wearerInMoonRelic.relics[0].resonance[2].hooks = [{ on: { type: "combatStart" }, actor: "wearer", effects: [{ type: "gainMoonPower", amount: 1 }] }];
    // actor "wearer" is not even in the relic hook schema; the owner filter reaches the cross-check.
    expect(() => parseGameData(wearerInMoonRelic)).toThrow(/Invalid game data/);
    const ownerInMoonRelic = rawData();
    ownerInMoonRelic.relics[0].resonance[2].hooks = [{ on: { type: "cardPlayed", owner: "wearer" }, actor: "front", effects: [{ type: "gainMoonPower", amount: 1 }] }];
    expect(() => parseGameData(ownerInMoonRelic)).toThrow(/relic "r_thien_sach" resonance 3 hook 0: "wearer" is only allowed/);

    const chosen = rawData();
    chosen.weapons[0].refinement[3].hooks = [{ on: { type: "combatStart" }, actor: "wearer", effects: [{ type: "damage", amount: 3, to: "chosen" }] }];
    expect(() => parseGameData(chosen)).toThrow(/weapon "w_xich_diem_thuong" R5 hook 0: effects must not use to "chosen"/);

    const badCard = rawData();
    badCard.weapons[5].refinement[1].card = { target: "enemy" };
    expect(() => parseGameData(badCard)).toThrow(/weapon "w_thiet_thuan" R3: target "enemy" requires/);

    const noSignatureHero = rawData();
    delete noSignatureHero.weapons[0].signatureHeroId;
    expect(() => parseGameData(noSignatureHero)).toThrow(/signatureHooks need signatureHeroId/);

    const refinements = rawData();
    refinements.weapons[0].refinement.pop();
    expect(() => parseGameData(refinements)).toThrow(/Invalid game data/);
    const resonance = rawData();
    resonance.relics[0].resonance.push(resonance.relics[0].resonance[4]);
    expect(() => parseGameData(resonance)).toThrow(/Invalid game data/);

    const collide = rawData();
    collide.relics[0].id = "m05";
    expect(() => parseGameData(collide)).toThrow(/gear: id "m05" collides/);

    const onLevelUp = rawData();
    onLevelUp.heroes[0].altLevelUp.onLevelUp = [{ type: "damage", amount: 3, to: "chosen" }];
    expect(() => parseGameData(onLevelUp)).toThrow(/altLevelUp.onLevelUp: effects must not use to "chosen"/);
  });

  it("T271c: rejects createCard in a weapon card's effects", () => {
    const raw = rawData();
    raw.weapons[0].card.effects.push({ type: "createCard", cardId: "m05_ho_gam" });
    expect(() => parseGameData(raw)).toThrow(/weapon "w_xich_diem_thuong" R1: createCard is not allowed/);
  });

  it("pvpConfig: arena stats cover every hero and every referenced id exists", () => {
    const data = loadGameData();
    expect(Object.keys(data.pvpConfig.heroStats).sort()).toEqual(Object.keys(data.heroes).sort());
    // Wave-1 heroes are not trial heroes — the trial list stays at the original five.
    expect(data.pvpConfig.trialHeroIds).toEqual(["m05", "f04", "m06", "f03", "f02"]);
    for (const id of data.pvpConfig.freeWeaponIds) expect(data.weapons[id]).toBeDefined();
    for (const id of data.pvpConfig.freeRelicIds) expect(data.relics[id]).toBeDefined();
    expect(data.pvpConfig.secondPlayerBonus.moonPower).toBeGreaterThan(0);
    expect(data.pvpConfig.roundCap).toBeGreaterThan(0);

    const missing = rawData();
    delete missing.pvpConfig.heroStats.m05;
    expect(() => parseGameData(missing)).toThrow(/pvpConfig: heroStats missing "m05"/);
    const unknown = rawData();
    unknown.pvpConfig.trialHeroIds.push("x99");
    expect(() => parseGameData(unknown)).toThrow(/pvpConfig: unknown trial hero "x99"/);
    const free = rawData();
    free.pvpConfig.freeWeaponIds.push("w_nope");
    expect(() => parseGameData(free)).toThrow(/pvpConfig: unknown free weapon "w_nope"/);
    const badNumber = rawData();
    badNumber.pvpConfig.turnSeconds = 0;
    expect(() => parseGameData(badNumber)).toThrow(/Invalid game data/);
  });
});

describe("co-op data", () => {
  it("loads the eclipse boss, its co-op encounter and the three combos", () => {
    const data = loadGameData();
    expect(data.coopConfig).toMatchObject({
      turnSeconds: 45,
      reconnectSeconds: 60,
      encounterId: "enc_coop_01",
      rewardedMatchesPerDay: 3,
    });
    expect(Object.keys(data.coopCombos)).toEqual([
      "combo_bang_nguyet_ke", "combo_am_anh_tuyet_sat", "combo_nguyet_quang_pho_chieu",
    ]);
    const boss = data.enemies["eclipse_lord"]!;
    expect(boss.maxHp).toBe(210);
    expect(boss.moonPower).toEqual({ start: 4, cap: 12 });
    expect(boss.phases).toHaveLength(4);
    expect(boss.phases!.map((phase) => phase.hpBelow)).toEqual([1, 0.75, 0.5, 0.25]);
    expect(boss.phases!.every((phase) => phase.maxIntentsPerRound === 4)).toBe(true);
    expect(boss.phases![1]).toMatchObject({ bloodMoonWhileActive: true });
    expect(boss.phases![2]!.intents.find((i) => i.id === "ecl_thuc_nguyet_tram")).toMatchObject({ alwaysPlan: true });
    expect(boss.phases![3]).toMatchObject({ reviveAfterRounds: 2 });
    expect(data.encounters["enc_coop_01"]).toMatchObject({ enemyIds: ["eclipse_lord"], tier: "coop" });
    expect(data.coopCombos["combo_am_anh_tuyet_sat"]!.effects[0]).toMatchObject({
      type: "execute", threshold: 0.25,
    });
  });

  it("rejects execute outside co-op combos", () => {
    const card = rawData();
    card.cards[0].effects.push({ type: "execute", threshold: 0.5, to: "allEnemies" });
    expect(() => parseGameData(card)).toThrow(/execute is only allowed in co-op combos/);

    const intent = rawData();
    intent.enemies[0].intents[0].effects.push({ type: "execute", threshold: 0.5, to: "allEnemies" });
    expect(() => parseGameData(intent)).toThrow(/execute is only allowed in co-op combos/);

    const hook = rawData();
    hook.runRelics[0].hooks[0].effects.push({ type: "execute", threshold: 0.5, to: "allEnemies" });
    expect(() => parseGameData(hook)).toThrow(/execute is only allowed in co-op combos/);
  });

  it("rejects phases without hpBelow 1 first, non-decreasing thresholds and early reviveAfterRounds", () => {
    const notOne = rawData();
    notOne.enemies.find((e: any) => e.id === "eclipse_lord").phases[0].hpBelow = 0.9;
    expect(() => parseGameData(notOne)).toThrow(/phases\[0\].hpBelow must be 1/);

    const flat = rawData();
    flat.enemies.find((e: any) => e.id === "eclipse_lord").phases[2].hpBelow = 0.75;
    expect(() => parseGameData(flat)).toThrow(/hpBelow must strictly decrease/);

    const earlyRevive = rawData();
    earlyRevive.enemies.find((e: any) => e.id === "eclipse_lord").phases[0].reviveAfterRounds = 2;
    expect(() => parseGameData(earlyRevive)).toThrow(/reviveAfterRounds only on the last phase/);
  });

  it("rejects a combo matcher naming a missing hero and a co-op encounter without phased enemies", () => {
    const badOwner = rawData();
    badOwner.coopCombos[0].parts[0].ownerId = "ghost";
    expect(() => parseGameData(badOwner)).toThrow(/ownerId references missing hero "ghost"/);

    const badEncounter = rawData();
    badEncounter.encounters.find((e: any) => e.id === "enc_coop_01").enemyIds = ["puppet_guard"];
    expect(() => parseGameData(badEncounter)).toThrow(/co-op enemies need phases/);

    const chosen = rawData();
    chosen.coopCombos[0].effects.push({ type: "damage", amount: 1, to: "chosen" });
    expect(() => parseGameData(chosen)).toThrow(/must not use to "chosen"/);
  });

  it("rejects a coopConfig encounterId that is missing or not tier coop", () => {
    const missing = rawData();
    missing.coopConfig.encounterId = "enc_nope";
    expect(() => parseGameData(missing)).toThrow(/encounterId references missing encounter "enc_nope"/);

    const wrongTier = rawData();
    wrongTier.coopConfig.encounterId = "enc_01";
    expect(() => parseGameData(wrongTier)).toThrow(/is not tier "coop"/);
  });
});
