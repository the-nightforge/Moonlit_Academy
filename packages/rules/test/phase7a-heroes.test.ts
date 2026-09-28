import { describe, expect, it } from "vitest";
import type { CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, buildPvpLoadout, createProfile, starterDeck, validateDeck } from "../src/index";
import { makeTestCombat, ownAllHeroes, p0, setIntent, testData } from "./helpers";

const WAVE1 = ["m01", "m02", "m03", "m04", "f01"] as const;

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

  it("T276d: M01 levels after the team plays eight scheme cards", () => {
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
    for (const instanceId of played) {
      const target = data.cards[state.cards[instanceId]!.cardId]!.target === "enemy" ? "enemy:0" : undefined;
      current = play(data, current, instanceId, target);
    }
    expect(played).toHaveLength(8);
    expect(current.heroes[0]!.levelUpCounter).toBe(8);
    expect(current.heroes[0]!.leveledUp).toBe(true);
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

  it("T276f: M03 levels after five Chiêm Bài picks", () => {
    const played: string[] = [];
    const { data, state } = makeTestCombat({
      heroIds: ["m03", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 99;
        played.push(...takeCards(s, "m03_tham_bao", 3), ...takeCards(s, "m03_mau_dich", 2));
      },
    });
    let current = state;
    for (const instanceId of played) {
      current = play(data, current, instanceId);
      const pending = p0(current).pendingChoice;
      if (pending?.kind === "chooseCard") {
        const picked = applyAction(data, current, { type: "chooseCard", instanceId: pending.options[0] as string });
        if (!picked.ok) throw new Error(picked.error);
        current = picked.state;
      }
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
