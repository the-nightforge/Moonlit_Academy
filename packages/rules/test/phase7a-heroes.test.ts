import { describe, expect, it } from "vitest";
import type { CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, buildPvpLoadout, chooseCombatAction, createProfile, starterDeck, validateDeck } from "../src/index";
import { makeEnemiesIdle, makeTestCombat, ownAllHeroes, p0, setHand, setIntent, testData } from "./helpers";

const WAVE1 = ["m01", "m02", "m03", "m04", "f01"] as const;
const WAVE2 = ["m07", "m08", "m10", "f08"] as const;
const BONDS: [string, string][] = [["m01", "f01"], ["m02", "m01"], ["m03", "m10"], ["m08", "f08"]];

const strike6: IntentDef = {
  id: "t_strike6", name: "Đánh", kind: "attack", targeting: "front",
  effects: [{ type: "damage", amount: 6, to: "chosen" }],
};

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

describe("phase 7a heroes — wave 1", () => {
  it("T276a: wave-1 heroes load with full pools, PvP stats and banner slots", () => {
    const data = testData();
    for (const id of WAVE1) {
      const hero = data.heroes[id]!;
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(data.pvpConfig.heroStats[id]).toBeDefined();
      expect(data.banners.banner_heroes!.pool[hero.rarity]).toContain(id);
    }
    expect(data.cards.f01_nguyet_hoa_chieu_the!.token).toBe(true);
  });

  it("T276b: every wave-1 hero plays a starter combat and a validated starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of WAVE1) {
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
      current = play(data, current, instanceId, target);
    }
    expect(played).toHaveLength(8);
    expect(current.heroes[0]!.levelUpCounter).toBe(7);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    // The counter keeps counting past the threshold.
    const last = played[7]!;
    const lastTarget = data.cards[state.cards[last]!.cardId]!.target === "enemy" ? "enemy:0" : undefined;
    current = play(data, current, last, lastTarget);
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
      current = play(data, current, instanceId);
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
    current = play(data, current, byCard(current, "m04_duong_mach"));
    current = play(data, current, byCard(current, "m04_cam_lo"), "hero:f04");
    current = play(data, current, byCard(current, "m04_tu_duoc"), "hero:f04");
    current = play(data, current, byCard(current, "m04_cham_cu"), "hero:m06");
    current = play(data, current, byCard(current, "m04_ho_mach"), "hero:m06");
    current = play(data, current, byCard(current, "m04_duong_mach"));
    expect(current.heroes[0]!.levelUpCounter).toBeGreaterThanOrEqual(20);
    expect(current.heroes[0]!.leveledUp).toBe(true);
  });
});

describe("phase 7a heroes — wave 2 and bonds", () => {
  it("T276h: 14 heroes load; each bond pair adds its bond card to the deck", () => {
    const data = testData();
    expect(Object.keys(data.heroes)).toHaveLength(14);
    for (const id of WAVE2) expect(data.pvpConfig.heroStats[id]).toBeDefined();
    for (const [a, b] of BONDS) {
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
      current = play(data, current, instanceId);
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
        current = play(data, current, instanceId, targetId);
      }
    };
    playAll("f08_huyet_vu"); // 3 × 2 HP = 6
    playAll("f08_huyet_trieu"); // +3 → 9, +3 → 12 (levels); the third card pays nothing
    expect(current.heroes[0]!.hp).toBe(current.heroes[0]!.maxHp - 12);
    expect(current.heroes[0]!.levelUpCounter).toBe(12);
    expect(current.heroes[0]!.leveledUp).toBe(true);
    const hpBefore = current.heroes[0]!.hp;
    current = play(data, current, p0(current).hand.find((id) => current.cards[id]!.cardId === "f08_phe_mac")!, "enemy:0");
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
      current = play(data, current, instanceId);
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

describe("phase 7a — bot heuristics (7a.6)", () => {
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

  it("bot: shiftMoon cards wait for a useful landing phase unless leveling moonShifts", () => {
    // Waxing crescent (index 1) has no modifiers — a +1 shift from `new` helps nobody.
    const dead = makeTestCombat({
      heroIds: ["m05", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 9;
        setHand(s, ["f04_nguyet_quang_dan"]);
        s.moonIndex = 0;
      },
    });
    expect(chooseCombatAction(dead.data, dead.state, 0).type).toBe("endTurn");

    // The same card played at waning gibbous lands on last quarter (armor modifier).
    const live = makeTestCombat({
      heroIds: ["m05", "f04", "m06"],
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
