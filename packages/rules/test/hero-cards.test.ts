import {
  cardsInHand as hand,
  heroByDefId,
  injectCard,
  makeEnemiesIdle,
  makeTestCombat,
  ownAllHeroes,
  p0,
  playCardById,
  playCardState,
  setHand,
  setIntent,
  setPlan,
  takeCards,
  testData,
} from "./helpers";
import { buffedStrike, rabbit, stealOneCard, strike6, twoHitCard } from "./fixtures";
import { describe, expect, it } from "vitest";
import {
  applyAction,
  buildPvpLoadout,
  createProfile,
  starterDeck,
  type CardDef,
  type CombatState,
  validateDeck,
} from "../src/index";

const TEAM: [string, string, string] = ["m05", "f03", "f02"];

describe("F02 Diệp Linh Lung", () => {
  it("T69: a leveled-up F02 gets +1 on each buff she steals", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM });
    injectCard(state, data, stealOneCard);
    heroByDefId(state, "f02").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = playCardById(data, state, stealOneCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f02").statuses).toEqual([{ id: "strength", value: 3 }]);
  });

  it("stealBonus does not apply to the bond card Ảnh Đấu", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "m06", "f02"],
      setup: (s) => {
        p0(s).moonPower = 10;
        s.enemies[0]!.moonPower = 3;
        setHand(s, ["bond_anh_dau"]);
      },
    });
    heroByDefId(state, "f02").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "strength", value: 2 });

    const result = playCardById(data, state, "bond_anh_dau", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f02").statuses).toEqual([{ id: "strength", value: 2 }]);
    expect(result.state.enemies[0]?.moonPower).toBe(2);
    expect(p0(result.state).moonPower).toBe(9);
  });
});

describe("F03 Tần Sương", () => {
  it("T88: a leveled-up F03 deals double damage to a frozen target", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM });
    injectCard(state, data, twoHitCard);
    heroByDefId(state, "f03").leveledUp = true;
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });

    const result = playCardById(data, state, twoHitCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits = result.events.filter((e) => e.type === "damageDealt");
    expect(hits.map((e) => e.type === "damageDealt" && e.amount)).toEqual([8, 8]);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 16);
  });

  it("T89: freezing an already frozen target does not count", () => {
    const { data, state } = makeTestCombat({
      heroIds: TEAM,
      setup: (s) => setHand(s, ["f03_han_an"]),
    });
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });

    const result = playCardById(data, state, "f03_han_an", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(heroByDefId(result.state, "f03").levelUpCounter).toBe(0);
  });

  it("T90: F03 levels up after freezing 3 different enemies", () => {
    const { data, state } = makeTestCombat({ heroIds: TEAM, encounterId: "enc_02" });
    let current = state;
    for (const [index, targetId] of ["enemy:0", "enemy:1", "enemy:2"].entries()) {
      setHand(current, ["f03_han_an"]);
      p0(current).moonPower = 3;
      const result = playCardById(data, current, "f03_han_an", targetId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const leveled = result.events.some((e) => e.type === "heroLeveledUp" && e.heroId === "hero:f03");
      expect(leveled).toBe(index === 2);
      current = result.state;
    }
    expect(heroByDefId(current, "f03").leveledUp).toBe(true);
  });
});

const CORE_HERO_IDS = ["m01", "m02", "m03", "m04", "f01"] as const;
const LUNAR_HERO_IDS = ["m07", "m08", "m10", "f08"] as const;
const HERO_BOND_PAIRS: [string, string][] = [["m01", "f01"], ["m02", "m01"], ["m03", "m10"], ["m08", "f08"]];

describe("core hero cards", () => {
  it("T276a: wave-1 heroes load with full pools, PvP stats and banner slots", () => {
    const data = testData();
    for (const id of CORE_HERO_IDS) {
      const hero = data.heroes[id]!;
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(data.pvpConfig.heroStats[id]).toBeDefined();
      // Legendary wave heroes are either base pool or weekly rotating slots.
      const rotation = data.banners.banner_nguyet_tuong!.featured!.rotation.map((entry) => entry.heroId);
      const inPool = data.banners.banner_heroes!.pool[hero.rarity].includes(id) || rotation.includes(id);
      expect(inPool).toBe(true);
    }
    expect(data.cards.f01_nguyet_hoa_chieu_the!.token).toBe(true);
  });

  it("T276b: every wave-1 hero plays a starter combat and a validated starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of CORE_HERO_IDS) {
      const team = [id, "f04", "m06"] as [string, string, string];
      expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([]);
      const { state } = makeTestCombat({ heroIds: team });
      expect(p0(state).hand.length).toBe(data.combatConfig.handSize);
      expect(buildPvpLoadout(data, profile, { heroIds: team }).ok).toBe(true);
    }
  });

  it("T276c: F01 levels on the full moon and gets Nguyệt Hoa Chiếu Thế", () => {
    const { data, state } = makeTestCombat({ heroIds: ["f01", "f04", "m06"], setup: (s) => { s.moonIndex = 3; for (const e of s.enemies) e.plannedIntents = []; p0(s).discardPile.push(p0(s).hand.pop()!); } });
    const result = applyAction(data, state, { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.heroes[0]!.leveledUp).toBe(true);
    expect(Object.values(result.state.cards).some((c) => c.cardId === "f01_nguyet_hoa_chieu_the")).toBe(true);
  });

  it("T276d: M01 levels after the team plays seven scheme cards", () => {
    const played: string[] = [];
    const { data, state } = makeTestCombat({
      heroIds: ["m01", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 99;
        const wanted = ["m01_thao_luoc", "m01_mat_thu", "m01_toa_nguyet_phu"];
        for (const cardId of wanted) takeCards(s, cardId, 3);
        played.push(...p0(s).hand.filter((id) => wanted.includes(s.cards[id]!.cardId)));
      },
    });
    let current = state;
    for (const instanceId of played.slice(0, 7)) {
      const target = data.cards[state.cards[instanceId]!.cardId]!.target === "enemy" ? "enemy:0" : undefined;
      current = playCardState(data, current, instanceId, target);
    }
    expect(played).toHaveLength(8);
    expect(current.heroes[0]!.levelUpCounter).toBe(7);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // The counter keeps counting past the threshold.
    const last = played[7]!;
    const lastTarget = data.cards[state.cards[last]!.cardId]!.target === "enemy" ? "enemy:0" : undefined;
    current = playCardState(data, current, last, lastTarget);
    expect(current.heroes[0]!.levelUpCounter).toBe(8);
  });

  it("T276e: M02 levels after intercepting three hits for a guarded ally", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m02", "f04", "m06"],
      encounterId: "enc_02",
      setup: (s) => {
        takeCards(s, "m02_ho_ve", 1);
        for (const index of s.enemies.keys()) setIntent(s, index, strike6, "hero:f04");
      },
    });
    const hoVe = p0(state).hand.find((id) => state.cards[id]!.cardId === "m02_ho_ve")!;
    const played = applyAction(data, state, { type: "playCard", instanceId: hoVe, targetId: "hero:f04" });
    if (!played.ok) throw new Error(played.error);
    const result = applyAction(data, played.state, { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.heroes[0]!.levelUpCounter).toBe(3);
    expect(result.state.heroes[0]!.leveledUp).toBe(true);
    expect(result.state.heroes[1]!.hp).toBe(result.state.heroes[1]!.maxHp);
  });

  it("T276f: M03 levels after four Chiêm Bài picks", () => {
    const played: string[] = [];
    const { data, state } = makeTestCombat({
      heroIds: ["m03", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 99;
        played.push(...takeCards(s, "m03_tham_bao", 3), ...takeCards(s, "m03_mau_dich", 2));
      },
    });
    let current = state;
    for (const [index, instanceId] of played.entries()) {
      // Thám Báo targets an enemy (signature damage); Mậu Dịch has no target.
      const target = current.cards[instanceId]!.cardId === "m03_tham_bao" ? current.enemies.find((e) => e.alive)!.id : undefined;
      current = playCardState(data, current, instanceId, target);
      const pending = p0(current).pendingChoice;
      if (pending?.kind === "chooseCard") {
        const picked = applyAction(data, current, { type: "chooseCard", instanceId: pending.options[0] as string });
        if (!picked.ok) throw new Error(picked.error);
        current = picked.state;
      }
      // Threshold 4: already leveled after the fourth pick; the fifth still counts.
      if (index === 3) expect(current.heroes[0]!.leveledUp).toBe(true);
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(5);
    expect(current.heroes[0]!.leveledUp).toBe(true);
  });

  it("T276g: M04 levels after its cards heal twenty HP", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m04", "f04", "m06"],
      setup: (s) => {
        for (const hero of s.heroes) hero.hp -= 20;
        p0(s).moonPower = 99;
        takeCards(s, "m04_duong_mach", 2);
        for (const cardId of ["m04_cam_lo", "m04_tu_duoc", "m04_cham_cu", "m04_ho_mach"]) {
          takeCards(s, cardId, 1);
        }
      },
    });
    const byCard = (st: CombatState, cardId: string) => st.players[0]!.hand.find((id) => st.cards[id]!.cardId === cardId)!;
    let current = state;
    current = playCardState(data, current, byCard(current, "m04_duong_mach"));
    current = playCardState(data, current, byCard(current, "m04_cam_lo"), "hero:f04");
    current = playCardState(data, current, byCard(current, "m04_tu_duoc"), "hero:f04");
    current = playCardState(data, current, byCard(current, "m04_cham_cu"), "hero:m06");
    current = playCardState(data, current, byCard(current, "m04_ho_mach"), "hero:m06");
    current = playCardState(data, current, byCard(current, "m04_duong_mach"));
    expect(current.heroes[0]!.levelUpCounter).toBeGreaterThanOrEqual(20);
    expect(current.heroes[0]!.leveledUp).toBe(true);
  });
});

describe("lunar hero cards and bonds", () => {
  it("T276h: 20 heroes load; each bond pair adds its bond card to the deck", () => {
    const data = testData();
    expect(Object.keys(data.heroes)).toHaveLength(20);
    for (const id of LUNAR_HERO_IDS) expect(data.pvpConfig.heroStats[id]).toBeDefined();
    for (const [a, b] of HERO_BOND_PAIRS) {
      const third = ["m06", "f04", "m05"].find((id) => id !== a && id !== b)!;
      const { state } = makeTestCombat({ heroIds: [a, b, third] });
      const bondIds = Object.values(state.cards).filter((c) => c.ownerIds.length === 2).map((c) => c.ownerIds.slice().sort().join("+"));
      expect(bondIds).toContain([a, b].sort().join("+"));
    }
  });

  it("T276i: M08 levels after three Đổi Vận cards and opens Chọn Pha at turn start", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m08", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "m08_doi_van", 3);
      },
    });
    let current = state;
    for (const instanceId of p0(state).hand.filter((id) => state.cards[id]!.cardId === "m08_doi_van")) {
      current = playCardState(data, current, instanceId);
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(3);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    const turn = applyAction(data, current, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.status).toBe("choosing");
    expect(p0(turn.state).pendingChoice).toEqual({ kind: "chooseMoon", options: [0, 1, 2] });
  });

  it("T276j: F08 levels after losing 12 HP to forbidden cards, then pays no more HP", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f08", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "f08_huyet_vu", 3);
        takeCards(s, "f08_huyet_trieu", 3);
        takeCards(s, "f08_phe_mac", 1);
      },
    });
    let current = state;
    const playAll = (cardId: string, targetId?: string) => {
      for (const instanceId of p0(current).hand.filter((id) => current.cards[id]!.cardId === cardId)) {
        current = playCardState(data, current, instanceId, targetId);
      }
    };
    playAll("f08_huyet_vu"); // 3 × 2 HP = 6
    playAll("f08_huyet_trieu"); // +3 → 9, +3 → 12 (levels); the third card pays nothing
    expect(current.heroes[0]!.hp).toBe(current.heroes[0]!.maxHp - 12);
    expect(current.heroes[0]!.levelUpCounter).toBe(12);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    const hpBefore = current.heroes[0]!.hp;
    current = playCardState(data, current, p0(current).hand.find((id) => current.cards[id]!.cardId === "f08_phe_mac")!, "enemy:0");
    expect(current.heroes[0]!.hp).toBe(hpBefore);
    expect(current.heroes[0]!.levelUpCounter).toBe(12);
  });

  it("T276k: M10 levels at five Khổ Học points; the first scheme card of the next turn resolves twice", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m10", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "m10_kho_hoc", 3);
        takeCards(s, "m10_han_mon", 2);
      },
    });
    let current = state;
    for (const instanceId of p0(current).hand.filter((id) => current.cards[id]!.cardId === "m10_kho_hoc")) {
      current = playCardState(data, current, instanceId);
    }
    // Ungated studyPoints: 1 at first turn start + 3 scheme plays = 4.
    expect(current.heroes[0]!.levelUpCounter).toBe(4);
    const turn = applyAction(data, current, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.heroes[0]!.levelUpCounter).toBe(5);
    expect(turn.state.heroes[0]!.leveledUp).toBe(true);
    const hpBefore = turn.state.enemies[0]!.hp;
    const next = applyAction(data, turn.state, {
      type: "playCard",
      instanceId: p0(turn.state).hand.find((id) => turn.state.cards[id]!.cardId === "m10_han_mon")!,
      targetId: "enemy:0",
    });
    if (!next.ok) throw new Error(next.error);
    expect(next.events.filter((e) => e.type === "damageDealt")).toHaveLength(2);
    expect(next.state.enemies[0]!.hp).toBe(hpBefore - 6);
  });

  it("T276l: M07 levels after four turns survived, then gains a random buff each turn start", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m07", "f04", "m06"],
      mutateData: makeEnemiesIdle,
    });
    let current = state;
    for (let i = 0; i < 4; i++) {
      const turn = applyAction(data, current, { type: "endTurn" });
      if (!turn.ok) throw new Error(turn.error);
      current = turn.state;
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(4);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    const next = applyAction(data, current, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    const buffIds = data.combatConfig.levelUpRandomBuffs.map((buff) => buff.status);
    const buffs = next.state.heroes[0]!.statuses.filter((status) => buffIds.includes(status.id));
    expect(buffs).toHaveLength(1);
  });
});

const SPIRIT_HERO_IDS = ["f05", "f06", "f07", "f09", "f10", "m09"] as const;

describe("spirit hero cards", () => {
  it("T296: the six wave-2 heroes load with full pools, PvP stats, banner slots, a starter combat and a valid starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of SPIRIT_HERO_IDS) {
      const hero = data.heroes[id]!;
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(data.pvpConfig.heroStats[id]).toBeDefined();
      expect(data.banners.banner_heroes!.pool[hero.rarity]).toContain(id);
      const team = [id, "f04", "m06"] as [string, string, string];
      expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([]);
      expect(buildPvpLoadout(data, profile, { heroIds: team }).ok).toBe(true);
      const { state } = makeTestCombat({ heroIds: team });
      expect(p0(state).hand.length).toBeGreaterThan(0);
    }
    expect(data.summons.tho_ngoc!.awakenedId).toBe("tho_ngoc_thuc_tinh");
  });

  it("T297: 20 heroes load; each wave-2 bond pair adds its bond card", () => {
    const data = testData();
    expect(Object.keys(data.heroes)).toHaveLength(20);
    for (const [a, b] of [["m09", "f06"], ["f09", "f10"]] as const) {
      const { state } = makeTestCombat({ heroIds: [a, b, "m05"] });
      const pairs = Object.values(state.cards).filter((c) => c.ownerIds.length === 2).map((c) => [...c.ownerIds].sort().join("+"));
      expect(pairs).toContain([a, b].sort().join("+"));
    }
  });

  it("T297b: wave-2 bond cards resolve with the right actor attribution", () => {
    // Khúc Vũ Tri Âm [m09, f06]: charm credits m09 (actor 0), extendDebuffs resolves for f06 (actor 1).
    const { data, state } = makeTestCombat({
      heroIds: ["m09", "f06", "m05"],
      mutateData: makeEnemiesIdle,
      setup: (s) => { p0(s).moonPower = 99; },
    });
    const bondId = p0(state).drawPile.find((id) => state.cards[id]!.cardId === "bond_khuc_vu_tri_am")!;
    p0(state).drawPile = p0(state).drawPile.filter((id) => id !== bondId);
    p0(state).hand.push(bondId);
    state.enemies[0]!.statuses.push({ id: "weak", value: 2 });
    const struck = playCardState(data, state, bondId, "enemy:0");
    expect(struck.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 1, sourceId: "hero:m09" });
    expect(struck.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 3 });
    expect(struck.heroes[0]!.levelUpCounter).toBe(1);

    // Nguyệt Thố Hộ Mệnh [f09, f10]: summons the rabbit for f09 (actor 0), then taunt + armor land on it.
    const coop = makeTestCombat({
      heroIds: ["f09", "f10", "m05"],
      mutateData: makeEnemiesIdle,
      setup: (s) => { p0(s).moonPower = 99; },
    });
    const bondId2 = p0(coop.state).drawPile.find((id) => coop.state.cards[id]!.cardId === "bond_nguyet_tho_ho_menh")!;
    p0(coop.state).drawPile = p0(coop.state).drawPile.filter((id) => id !== bondId2);
    p0(coop.state).hand.push(bondId2);
    const shielded = playCardState(coop.data, coop.state, bondId2);
    expect(shielded.summons).toHaveLength(1);
    expect(shielded.summons![0]).toMatchObject({ summonId: "tho_ngoc", ownerHeroId: "hero:f09", armor: 6 });
    expect(shielded.summons![0]!.statuses).toContainEqual({ id: "taunt", value: 1 });
    expect(shielded.heroes[0]!.levelUpCounter).toBe(1);
  });
});

describe("spirit hero leveling with real cards", () => {
  it("F05 Hạ Chi levels after four back-row hits; its single-target shots then pierce", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f05", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "f05_lien_chau", 2);
        takeCards(s, "f05_liet_nham", 1);
      },
    });
    let current = state;
    // enc_01: enemy:0 is the front; enemy:1 is the back row. Liên Châu hits twice.
    for (const instanceId of hand(current, "f05_lien_chau")) {
      current = playCardState(data, current, instanceId, "enemy:1");
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(4);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // Xuyên Vân Tiễn: the next single-target attack also hits the enemy right behind.
    const before = current.enemies.map((e) => e.hp);
    const result = applyAction(data, current, {
      type: "playCard",
      instanceId: hand(current, "f05_liet_nham")[0]!,
      targetId: "enemy:0",
    });
    if (!result.ok) throw new Error(result.error);
    const hits = result.events.filter((e) => e.type === "damageDealt").map((e) => (e as { targetId: string }).targetId);
    expect(hits).toEqual(["enemy:0", "enemy:1"]);
    expect(result.state.enemies[0]!.hp).toBe(before[0]! - 3);
    expect(result.state.enemies[1]!.hp).toBe(before[1]! - 3);
  });

  it("F06 Lam Khê levels after two charms; Kinh Hồng Vũ then adds a charge", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f06", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "f06_me_vu", 3);
      },
    });
    let current = state;
    current = playCardState(data, current, hand(current, "f06_me_vu")[0]!, "enemy:0");
    current = playCardState(data, current, hand(current, "f06_me_vu")[0]!, "enemy:1");
    expect(current.heroes[0]!.levelUpCounter).toBe(2);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // Kinh Hồng Vũ: the next charm carries +1 charge (1 + 1 extra on top of the first).
    current = playCardState(data, current, hand(current, "f06_me_vu")[0]!, "enemy:0");
    expect(current.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 3, sourceId: "hero:f06" });
  });

  it("F07 Cố Uyển levels when its Phong Ấn strips three enemy intents", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f07", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "f07_phong_an", 2);
        setPlan(s, 0, [
          { intent: buffedStrike, targetId: "hero:f07" },
          { intent: buffedStrike, targetId: "hero:f07" },
        ]);
        setPlan(s, 1, [{ intent: buffedStrike, targetId: "hero:f07" }]);
      },
    });
    let current = state;
    current = playCardState(data, current, hand(current, "f07_phong_an")[0]!, "enemy:0");
    current = playCardState(data, current, hand(current, "f07_phong_an")[0]!, "enemy:1");
    expect(current.enemies[0]!.sealedBy).toBe("hero:f07");
    expect(current.enemies[1]!.sealedBy).toBe("hero:f07");
    // Nothing is stripped at cast time — the counter bumps when intents execute.
    expect(current.heroes[0]!.levelUpCounter).toBe(0);
    const next = applyAction(data, current, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    expect(next.events.filter((e) => e.type === "sealStripped")).toHaveLength(3);
    expect(next.state.heroes[0]!.levelUpCounter).toBe(3);
    expect(next.state.heroes[0]!.leveledUp).toBe(true);
  });

  it("F09 Tiểu Mãn levels after seven summon cards; Thỏ Ngọc awakens", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f09", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "f09_trieu_hoi", 3);
        takeCards(s, "f09_ngoc_anh", 2);
        takeCards(s, "f09_moi_duong", 2);
      },
    });
    let current = state;
    const summons = p0(current).hand.filter((id) => ["f09_trieu_hoi", "f09_ngoc_anh", "f09_moi_duong"].includes(current.cards[id]!.cardId));
    for (const instanceId of summons) {
      current = playCardState(data, current, instanceId);
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(7);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    expect(current.summons).toHaveLength(1);
    expect(current.summons![0]).toMatchObject({ summonId: "tho_ngoc_thuc_tinh", maxHp: 18, hp: 18 });
  });

  it("F10 Liễu Tịnh Nhan levels when an ally falls and Nguyệt Hồn revives it at 30%", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f10", "f04", "m06"],
      mutateData: makeEnemiesIdle,
    });
    const cut: CardDef = {
      id: "test_cut", name: "Cắt", ownerId: "m06", cost: 0, copies: 1, type: "attack", tags: ["attack"],
      target: "ally", effects: [{ type: "loseHp", amount: 99, to: "chosen" }], text: "",
    };
    const cutId = injectCard(state, data, cut);
    const result = applyAction(data, state, { type: "playCard", instanceId: cutId, targetId: "hero:f04" });
    if (!result.ok) throw new Error(result.error);
    const f10 = result.state.heroes[0]!;
    const f04 = result.state.heroes[1]!;
    expect(f10.leveledUp).toBe(true);
    expect(f04.alive).toBe(true);
    expect(f04.hp).toBe(Math.max(1, Math.floor(0.3 * f04.maxHp)));
    expect(f04.revived).toBe(true);
    expect(result.events).toContainEqual({ type: "heroRevived", heroId: "hero:f04", hp: f04.hp });
  });

  it("M09 Đoàn Lạc levels after six debuffs; Vong Quốc Khúc lengthens the next debuff", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m09", "f04", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        takeCards(s, "m09_khuc_sau", 3);
        takeCards(s, "m09_sau_cam", 2);
        takeCards(s, "m09_tri_ky", 1);
      },
    });
    let current = state;
    // Khúc Sầu: weak 1 (+1 each). Sầu Cầm: weak 1 + vulnerable 1 (+2 each). Total 7.
    for (const instanceId of hand(current, "m09_khuc_sau")) {
      current = playCardState(data, current, instanceId, "enemy:0");
    }
    for (const instanceId of hand(current, "m09_sau_cam")) {
      current = playCardState(data, current, instanceId, "enemy:0");
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(7);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // Vong Quốc Khúc: duration debuffs M09 applies last +1 round; charm is not a duration status.
    current = playCardState(data, current, hand(current, "m09_tri_ky")[0]!, "enemy:1");
    expect(current.enemies[1]!.statuses).toContainEqual({ id: "weak", value: 2 });
    expect(current.enemies[1]!.statuses).toContainEqual({ id: "charm", value: 1, sourceId: "hero:m09" });
  });
});
