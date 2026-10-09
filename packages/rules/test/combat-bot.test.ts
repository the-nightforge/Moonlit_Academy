import { buffedStrike } from "./fixtures";
import { chooseCombatAction, type IntentDef } from "../src/index";
import { cardsInHand as hand, injectCard, makeEnemiesIdle, makeTestCombat, p0, setHand, setPlan } from "./helpers";
import { describe, expect, it } from "vitest";

describe("guard and lunar bot decisions", () => {
  it("bot: guard targets the weakest other ally", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m02", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["m02_ho_ve"]);
        // Owner is the weakest — the guard must go to f04, not to m02 itself.
        s.heroes[0]!.hp = 5;
        s.heroes[1]!.hp = 10;
      },
    });
    const action = chooseCombatAction(data, state, 0);
    expect(action).toEqual({
      type: "playCard",
      instanceId: p0(state).hand[0]!,
      targetId: state.heroes[1]!.id,
    });
  });

  it("bot: guard is skipped when the owner is the only living ally", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m02", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["m02_ho_ve"]);
        s.heroes[1]!.alive = false;
        s.heroes[2]!.alive = false;
      },
    });
    expect(chooseCombatAction(data, state, 0).type).toBe("endTurn");
  });

  it("bot: pure shiftMoon cards wait for a useful landing phase unless leveling moonShifts", () => {
    // Waxing crescent (index 1) has no modifiers — a +1 shift from `new` helps nobody.
    // Nguyệt Quang Dẫn only shifts and digs (Chiêm Bài 3), so it is held.
    const dead = makeTestCombat({
      heroIds: ["m05", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["f04_nguyet_quang_dan"]);
        s.moonIndex = 0;
      },
    });
    expect(chooseCombatAction(dead.data, dead.state, 0).type).toBe("endTurn");

    // The same card played at waning gibbous lands on last quarter, whose pinned
    // Huyền Giáp decree (untagged modifier) helps every hand.
    const live = makeTestCombat({
      heroIds: ["m05", "f04", "m06"],
      decrees: "real",
      start: { moonIndex: 1, decrees: { lastQuarter: "huyen_giap" } },
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["f04_nguyet_quang_dan"]);
        s.moonIndex = 5;
      },
    });
    expect(chooseCombatAction(live.data, live.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(live.state).hand[0]!,
    });

    // A shift card with another real effect (Suy Vận: Suy Yếu) is played anyway.
    const mixed = makeTestCombat({
      heroIds: ["m08", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["m08_suy_van"]);
        s.heroes[0]!.leveledUp = true;
        s.moonIndex = 0;
      },
    });
    expect(chooseCombatAction(mixed.data, mixed.state, 0)).toMatchObject({
      type: "playCard",
      instanceId: p0(mixed.state).hand[0]!,
    });

    // M08 still wants the shift: its moonShifts counter is not leveled yet.
    const feed = makeTestCombat({
      heroIds: ["m08", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["m08_doi_van"]);
        s.moonIndex = 0;
      },
    });
    expect(chooseCombatAction(feed.data, feed.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(feed.state).hand[0]!,
    });
  });

  it("bot: forbidden self-loss respects the +5 HP buffer", () => {
    const make = (hp: number) =>
      makeTestCombat({
        heroIds: ["f08", "f04", "m06"],
        setup: (s) => {
          p0(s).moonPower = 9;
          setHand(s, ["f08_huyet_trieu"]);
          s.heroes[0]!.hp = hp;
        },
      });
    // f08_huyet_trieu costs 3 own HP: at 8 HP (≤ 3+5) the bot holds it.
    const low = make(8);
    expect(chooseCombatAction(low.data, low.state, 0).type).toBe("endTurn");
    const safe = make(20);
    expect(chooseCombatAction(safe.data, safe.state, 0)).toEqual({
      type: "playCard",
      instanceId: p0(safe.state).hand[0]!,
    });
  });
});

describe("spirit and status bot decisions", () => {
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
