import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, buildPvpLoadout, chooseCombatAction, createProfile, starterDeck, validateDeck } from "../src/index";
import { injectCard, makeEnemiesIdle, makeTestCombat, ownAllHeroes, p0, setHand, setPlan, testData } from "./helpers";

const WAVE = ["f05", "f06", "f07", "f09", "f10", "m09"] as const;

/** Moves up to `count` copies of `cardId` from the draw pile into the hand. */
function takeCards(state: CombatState, cardId: string, count: number): string[] {
  const ids = p0(state)
    .drawPile.filter((id) => state.cards[id]!.cardId === cardId)
    .slice(0, count);
  p0(state).drawPile = p0(state).drawPile.filter((id) => !ids.includes(id));
  p0(state).hand.push(...ids);
  return ids;
}

const play = (data: GameData, state: CombatState, instanceId: string, targetId?: string): CombatState => {
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const hand = (state: CombatState, cardId: string): string[] =>
  p0(state).hand.filter((id) => state.cards[id]!.cardId === cardId);

/** An intent with one damage effect plus a buff — exactly what Phong Ấn strips. */
const buffedStrike: IntentDef = {
  id: "t_blade",
  name: "Múa Kiếm",
  kind: "attack",
  targeting: "front",
  effects: [
    { type: "damage", amount: 4, to: "chosen" },
    { type: "applyStatus", status: "strength", amount: 1, to: "self" },
  ],
};

describe("phase 7b heroes", () => {
  it("T296: the six wave-2 heroes load with full pools, PvP stats, banner slots, a starter combat and a valid starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of WAVE) {
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
    const struck = play(data, state, bondId, "enemy:0");
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
    const shielded = play(coop.data, coop.state, bondId2);
    expect(shielded.summons).toHaveLength(1);
    expect(shielded.summons![0]).toMatchObject({ summonId: "tho_ngoc", ownerHeroId: "hero:f09", armor: 6 });
    expect(shielded.summons![0]!.statuses).toContainEqual({ id: "taunt", value: 1 });
    expect(shielded.heroes[0]!.levelUpCounter).toBe(1);
  });
});

describe("phase 7b heroes — level-ups with real cards", () => {
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
      current = play(data, current, instanceId, "enemy:1");
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
    current = play(data, current, hand(current, "f06_me_vu")[0]!, "enemy:0");
    current = play(data, current, hand(current, "f06_me_vu")[0]!, "enemy:1");
    expect(current.heroes[0]!.levelUpCounter).toBe(2);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // Kinh Hồng Vũ: the next charm carries +1 charge (1 + 1 extra on top of the first).
    current = play(data, current, hand(current, "f06_me_vu")[0]!, "enemy:0");
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
    current = play(data, current, hand(current, "f07_phong_an")[0]!, "enemy:0");
    current = play(data, current, hand(current, "f07_phong_an")[0]!, "enemy:1");
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
      current = play(data, current, instanceId);
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
      current = play(data, current, instanceId, "enemy:0");
    }
    for (const instanceId of hand(current, "m09_sau_cam")) {
      current = play(data, current, instanceId, "enemy:0");
    }
    expect(current.heroes[0]!.levelUpCounter).toBe(7);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // Vong Quốc Khúc: duration debuffs M09 applies last +1 round; charm is not a duration status.
    current = play(data, current, hand(current, "m09_tri_ky")[0]!, "enemy:1");
    expect(current.enemies[1]!.statuses).toContainEqual({ id: "weak", value: 2 });
    expect(current.enemies[1]!.statuses).toContainEqual({ id: "charm", value: 1, sourceId: "hero:m09" });
  });
});

describe("phase 7b bot heuristics", () => {
  const pureStrike: IntentDef = {
    id: "t_cut",
    name: "Chém",
    kind: "attack",
    targeting: "front",
    effects: [{ type: "damage", amount: 4, to: "chosen" }],
  };

  it("bot: summon cards hold while a healthy Linh Thú stands, unless still leveling summonsMade", () => {
    const board = (summonHp: number | null, leveledUp: boolean) =>
      makeTestCombat({
        heroIds: ["f09", "f04", "m06"],
        mutateData: makeEnemiesIdle,
        setup: (s) => {
          p0(s).moonPower = 99;
          setHand(s, ["f09_trieu_hoi"]);
          s.heroes[0]!.leveledUp = leveledUp;
          if (summonHp !== null) {
            s.summons = [
              {
                id: "summon:f09",
                defId: "tho_ngoc",
                summonId: "tho_ngoc",
                side: "hero",
                player: 0,
                ownerHeroId: "hero:f09",
                position: 0,
                hp: summonHp,
                maxHp: 12,
                armor: 0,
                statuses: [],
                alive: true,
              },
            ];
          }
        },
      });
    // Leveled + healthy summon — a recast would only heal/buff: hold the card.
    const healthy = board(12, true);
    expect(chooseCombatAction(healthy.data, healthy.state, 0).type).toBe("endTurn");
    // Leveled + summon under half HP — recast heals it to full.
    const hurt = board(5, true);
    expect(chooseCombatAction(hurt.data, hurt.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(hurt.state).hand[0]!,
    });
    // Leveled + no summon at all — always cast.
    const empty = board(null, true);
    expect(chooseCombatAction(empty.data, empty.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(empty.state).hand[0]!,
    });
    // Still leveling via summonsMade — cast even with a healthy summon up.
    const leveling = board(12, false);
    expect(chooseCombatAction(leveling.data, leveling.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(leveling.state).hand[0]!,
    });
  });

  it("bot: charm aims at the heaviest-hitting known kit, not the hidden chain, and is skipped with a lone enemy", () => {
    const heavy: IntentDef = {
      id: "t_heavy",
      name: "Trọng Kích",
      kind: "attack",
      targeting: "front",
      effects: [{ type: "damage", amount: 9, to: "chosen" }],
    };
    const light: IntentDef = {
      id: "t_light",
      name: "Chạm",
      kind: "attack",
      targeting: "front",
      effects: [{ type: "damage", amount: 1, to: "chosen" }],
    };
    // Kits are public, chains are not (`01` §9.2): the misleading hidden plans
    // (heavy on enemy 0) must not steer the bot.
    const { data, state } = makeTestCombat({
      heroIds: ["f06", "f04", "m06"],
      mutateData: (d) => {
        d.enemies["puppet_guard"]!.intents = [{ ...light, cost: 0 }];
        d.enemies["shadow_fox"]!.intents = [{ ...heavy, cost: 0 }];
      },
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f06_me_vu"]);
        setPlan(s, 0, [{ intent: heavy, targetId: "hero:f04" }]);
        setPlan(s, 1, [{ intent: light, targetId: "hero:f04" }]);
      },
    });
    expect(chooseCombatAction(data, state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(state).hand[0]!,
      targetId: "enemy:1",
    });

    // A lone enemy leaves no other unit for the turned hit — the card is held,
    // and so is an allEnemies charm (Kinh Hồng Chiêu, injected: it is a locked card).
    const alone = makeTestCombat({
      heroIds: ["f06", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f06_me_vu"]);
        s.enemies[1]!.alive = false;
      },
    });
    injectCard(alone.state, alone.data, { ...alone.data.cards["f06_kinh_hong_chieu"]!, id: "test_kinh_hong_chieu" });
    expect(chooseCombatAction(alone.data, alone.state, 0).type).toBe("endTurn");
  });

  it("bot: seal marks the most effect-heavy known kit, not the hidden chain, and skips pure-damage boards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f07", "f04", "m06"],
      mutateData: (d) => {
        d.enemies["puppet_guard"]!.intents = [{ ...pureStrike, cost: 0 }];
        d.enemies["shadow_fox"]!.intents = [{ ...buffedStrike, cost: 0 }];
      },
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f07_phong_an"]);
        setPlan(s, 0, [{ intent: buffedStrike, targetId: "hero:f04" }]);
        setPlan(s, 1, [{ intent: pureStrike, targetId: "hero:f04" }]);
      },
    });
    expect(chooseCombatAction(data, state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(state).hand[0]!,
      targetId: "enemy:1",
    });

    // Pure damage on every living enemy — nothing to strip, even for the
    // allEnemies Đoán Sử (locked card, injected).
    const dry = makeTestCombat({
      heroIds: ["f07", "f04", "m06"],
      mutateData: (d) => {
        d.enemies["puppet_guard"]!.intents = [{ ...pureStrike, cost: 0 }];
        d.enemies["shadow_fox"]!.intents = [{ ...pureStrike, cost: 0 }];
      },
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f07_phong_an"]);
      },
    });
    injectCard(dry.state, dry.data, { ...dry.data.cards["f07_doan_su"]!, id: "test_doan_su" });
    expect(chooseCombatAction(dry.data, dry.state, 0).type).toBe("endTurn");
  });

  it("bot: fallenAlly picks the fallen hero with the highest maxHp", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f10", "m05", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f10_hoi_hon"]);
        s.heroes[1]!.alive = false;
        s.heroes[1]!.hp = 0;
        s.heroes[2]!.alive = false;
        s.heroes[2]!.hp = 0;
      },
    });
    // m05 (40 maxHp) over m06 (28).
    expect(chooseCombatAction(data, state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(state).hand[0]!,
      targetId: "hero:m05",
    });

    // Nobody has fallen — Hồi Hồn is unplayable and the bot passes.
    const standing = makeTestCombat({
      heroIds: ["f10", "m05", "m06"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        p0(s).moonPower = 99;
        setHand(s, ["f10_hoi_hon"]);
      },
    });
    expect(chooseCombatAction(standing.data, standing.state, 0).type).toBe("endTurn");
  });
});
