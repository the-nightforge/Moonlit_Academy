import { describe, expect, it } from "vitest";
import {
  applyAction,
  getEffectiveCost,
  type CombatState,
  type GameData,
  type LevelUpCounter,
  type LevelUpPassive,
} from "../src/index";
import { idleIntent, regenThreeCard, stealthOneCard, strike9Intent, testCard } from "./fixtures";
import {
  injectCard,
  instanceIdOf,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  playTestCard,
  setHand,
  setIntent,
  withLevelUp,
} from "./helpers";

describe("hero level up", () => {
  it("T46: damageTaken counter levels M05 up mid-card", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[0]!.levelUpCounter = 12;
        setHand(s, ["m05_tran_bac_huyet_tinh"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_tran_bac_huyet_tinh"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.levelUpCounter).toBe(15);
    expect(result.state.heroes[0]?.leveledUp).toBe(true);
    expect(
      result.events.some((e) => e.type === "heroLeveledUp" && e.heroId === "hero:m05"),
    ).toBe(true);
  });

  it("T47: leveled M05's attack cards gain +3 damage", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.heroes[0]!.leveledUp = true;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_liet_hoa_xung_phong"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 11 });
  });

  it("T48: damageTaken counts only real HP lost, not blocked damage", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[0]!.armor = 5;
    setIntent(state, 0, heavy, "hero:m05");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.hp).toBe(36);
    expect(result.state.heroes[0]?.levelUpCounter).toBe(4);
  });

  it("T49: turnsWithAllyRegen ticks once per player turn and levels F04", () => {
    const { data, state } = makeTestCombat({
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.heroes[0]!.statuses.push({ id: "regen", value: 5 });
      },
    });
    let current = state;
    for (const expected of [1, 2, 3]) {
      const result = applyAction(data, current, { type: "endTurn" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
      expect(current.heroes[1]?.levelUpCounter).toBe(expected);
    }
    expect(current.heroes[1]?.leveledUp).toBe(true);
  });

  it("T50: leveled F04 spreads regen to every living hero", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.leveledUp = true;
      },
    });
    const regen = injectCard(state, data, regenThreeCard);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: regen,
      targetId: "hero:m05",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const hero of result.state.heroes) {
      expect(hero.statuses).toContainEqual({ id: "regen", value: 3 });
    }
  });

  it("T51: killing with a card levels M06 but the discount starts next turn", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.enemies[0]!.hp = 5;
        setHand(s, ["m06_am_tien"]);
      },
    });
    const stealth = injectCard(state, data, { ...stealthOneCard, cost: 2 });
    const killed = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(killed.ok).toBe(true);
    if (!killed.ok) return;
    expect(killed.state.enemies[0]?.alive).toBe(false);
    expect(killed.state.heroes[2]?.levelUpCounter).toBe(1);
    expect(killed.state.heroes[2]?.leveledUp).toBe(true);

    const played = applyAction(data, killed.state, {
      type: "playCard",
      instanceId: stealth,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 2 });
    expect(p0(played.state).moonPower).toBe(7);
  });

  it("T52: first own card each turn costs 0 after M06 leveled", () => {
    const { data, state } = makeTestCombat({
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.heroes[2]!.leveledUp = true;
      },
    });
    const next = applyAction(data, state, { type: "endTurn" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    setHand(next.state, ["m06_am_tien"]);
    const stealth = injectCard(next.state, data, { ...stealthOneCard, cost: 2 });

    const free = applyAction(data, next.state, {
      type: "playCard",
      instanceId: stealth,
    });
    expect(free.ok).toBe(true);
    if (!free.ok) return;
    const fund =
      data.combatConfig.moonPower.start +
      data.combatConfig.moonPower.perRound +
      data.combatConfig.moonReserveMax;
    expect(free.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 0 });
    expect(p0(free.state).moonPower).toBe(fund);

    const paid = applyAction(data, free.state, {
      type: "playCard",
      instanceId: instanceIdOf(free.state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.events.find((e) => e.type === "cardPlayed")).toMatchObject({ cost: 2 });
    expect(p0(paid.state).moonPower).toBe(fund - 2);
  });

  it("T53: a kill by another hero does not raise M06's counter", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.enemies[0]!.hp = 5;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_liet_hoa_xung_phong"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.alive).toBe(false);
    expect(result.state.heroes[2]?.levelUpCounter).toBe(0);
    expect(result.state.heroes[2]?.leveledUp).toBe(false);
  });

  it("T54: a leveled hero never emits heroLeveledUp twice", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[0]!.leveledUp = true;
        s.heroes[0]!.levelUpCounter = 12;
        setHand(s, ["m05_tran_bac_huyet_tinh"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_tran_bac_huyet_tinh"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.levelUpCounter).toBe(15);
    expect(result.events.some((e) => e.type === "heroLeveledUp")).toBe(false);
  });
});


describe("bộ đếm", () => {
  const counterOn = (counter: LevelUpCounter) => withLevelUp("m05", { counter, threshold: 99 });

  it("T272: every new counter bumps on its trigger", () => {
    // schemeCardsPlayed: a scheme card by any teammate
    let t = makeTestCombat({ mutateData: counterOn("schemeCardsPlayed") });
    expect(playTestCard(t.data, t.state, testCard({ id: "s1", ownerId: "f04", tags: ["scheme"] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // studyPoints: +1 per own scheme card, +1 per player turn start alive — no
    // round gate (`18` §2.1 gives the gate to turnsSurvived only)
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("studyPoints")(d); } });
    expect(t.state.heroes[0]!.levelUpCounter).toBe(1);
    const s = playTestCard(t.data, t.state, testCard({ id: "s2", tags: ["scheme"] }));
    expect(s.state.heroes[0]!.levelUpCounter).toBe(2);
    const turn = applyAction(t.data, s.state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.heroes[0]!.levelUpCounter).toBe(3);

    // turnsSurvived: from round 2 on
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("turnsSurvived")(d); } });
    expect(t.state.heroes[0]!.levelUpCounter).toBe(0);
    const r2 = applyAction(t.data, t.state, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.heroes[0]!.levelUpCounter).toBe(1);

    // fullMoonsSeen: turn start on the full moon
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("fullMoonsSeen")(d); }, setup: (st) => { st.moonIndex = 3; } });
    const full = applyAction(t.data, t.state, { type: "endTurn" });
    if (!full.ok) throw new Error(full.error);
    expect(full.state.moonIndex).toBe(4);
    expect(full.state.heroes[0]!.levelUpCounter).toBe(1);

    // moonShifts: shiftMoon from the hero's card
    t = makeTestCombat({ mutateData: counterOn("moonShifts") });
    expect(playTestCard(t.data, t.state, testCard({ id: "s3", effects: [{ type: "shiftMoon", amount: 1 }] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // hpHealed: real HP healed by the hero's card
    t = makeTestCombat({ mutateData: counterOn("hpHealed"), setup: (st) => { st.heroes[1]!.hp -= 4; } });
    expect(playTestCard(t.data, t.state, testCard({ id: "s4", target: "ally", effects: [{ type: "heal", amount: 10, to: "chosen" }] }), "hero:f04").state.heroes[0]!.levelUpCounter).toBe(4);

    // forbiddenHpLost: self loseHp from the hero's forbidden card
    t = makeTestCombat({ mutateData: counterOn("forbiddenHpLost") });
    expect(playTestCard(t.data, t.state, testCard({ id: "s5", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }] })).state.heroes[0]!.levelUpCounter).toBe(3);

    // cardsChosen: a Chiêm Bài pick by the seat
    t = makeTestCombat({ mutateData: counterOn("cardsChosen") });
    const opened = playTestCard(t.data, t.state, testCard({ id: "s6", effects: [{ type: "chooseCard", look: 3 }] }));
    const pending = p0(opened.state).pendingChoice!;
    const picked = applyAction(t.data, opened.state, { type: "chooseCard", instanceId: pending.options[0] as string });
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.heroes[0]!.levelUpCounter).toBe(1);
  });
});

describe("nội tại", () => {
  const leveled = (heroId: string, passive: LevelUpPassive, extra?: (d: GameData) => void) => ({
    mutateData: (d: GameData) => { makeEnemiesIdle(d); withLevelUp(heroId, { passive })(d); extra?.(d); },
    setup: (s: CombatState) => { s.heroes.find((h) => h.defId === heroId)!.leveledUp = true; },
  });

  it("T273: cost passives — cheapest card discount, own-tag discount, extra Chiêm Bài look", () => {
    const thienCo = makeTestCombat(leveled("m05", { type: "cheapestCardDiscount", amount: 1 }));
    const turn = applyAction(thienCo.data, thienCo.state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    const hand = p0(turn.state).hand;
    const discounted = hand.filter((id) => turn.state.cards[id]!.turnDiscount === 1);
    expect(discounted).toHaveLength(1);
    const cost = (id: string) => getEffectiveCost(thienCo.data, turn.state, id);
    for (const id of hand) expect(cost(id)).toBeGreaterThanOrEqual(cost(discounted[0]!));
    const ended = applyAction(thienCo.data, turn.state, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    // Cleared at turn end, then set anew: never stacks across turns.
    const after = Object.values(ended.state.cards).filter((c) => c.turnDiscount !== undefined);
    expect(after).toHaveLength(1);
    expect(after[0]!.turnDiscount).toBe(1);

    const tuDo = makeTestCombat(leveled("m05", { type: "tagDiscountOwnCards", tag: "moon", amount: 1 }));
    const moonCard = injectCard(tuDo.state, tuDo.data, testCard({ id: "mc", cost: 2, tags: ["moon"] }));
    expect(getEffectiveCost(tuDo.data, tuDo.state, moonCard)).toBe(1);

    const dinhCuc = makeTestCombat(leveled("m05", { type: "chooseCardExtraLook", amount: 1 }));
    const opened = playTestCard(dinhCuc.data, dinhCuc.state, testCard({ id: "look", ownerId: "f04", effects: [{ type: "chooseCard", look: 3 }] }));
    expect(p0(opened.state).pendingChoice!.options).toHaveLength(4);
  });

  it("T274: damage/heal passives — combo bonus, blood moon bonus, heal bonus, no forbidden self-loss, moon shift weakens", () => {
    const combo = makeTestCombat(leveled("m05", { type: "comboAttackBonus", amount: 1 }));
    const first = playTestCard(combo.data, combo.state, testCard({ id: "a2" }));
    const hit = playTestCard(combo.data, first.state, testCard({ id: "a3", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 6 });

    const phanSu = makeTestCombat(leveled("m05", { type: "bloodMoonAttackBonus", amount: 3 }, undefined));
    phanSu.state.bloodMoonRounds = 1;
    const bm = playTestCard(phanSu.data, phanSu.state, testCard({ id: "a4", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(bm.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const tamNhan = makeTestCombat(leveled("m05", { type: "healBonusOwnCards", amount: 2 }));
    tamNhan.state.heroes[1]!.hp -= 10;
    const healed = playTestCard(tamNhan.data, tamNhan.state, testCard({ id: "h1", target: "ally", effects: [{ type: "heal", amount: 3, to: "chosen" }] }), "hero:f04");
    expect(healed.events).toContainEqual({ type: "healed", targetId: "hero:f04", amount: 5 });

    const huyetPhuong = makeTestCombat(leveled("m05", { type: "forbiddenNoSelfHpLoss" }));
    const f = playTestCard(huyetPhuong.data, huyetPhuong.state, testCard({ id: "f1", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }, { type: "gainArmor", amount: 1, to: "self" }] }));
    expect(f.state.heroes[0]!.hp).toBe(huyetPhuong.state.heroes[0]!.hp);

    const tinhMenh = makeTestCombat(leveled("m05", { type: "moonShiftWeakensEnemies", amount: 1 }));
    const shifted = playTestCard(tinhMenh.data, tinhMenh.state, testCard({ id: "sh", effects: [{ type: "shiftMoon", amount: 1 }] }));
    for (const enemy of shifted.state.enemies.filter((e) => e.alive)) {
      expect(enemy.statuses).toContainEqual({ id: "weak", value: 1 });
    }
  });

  it("T275: turn-start passives — random buff from config (seeded), blood moon immunity, first scheme card resolves twice", () => {
    const huyetMach = makeTestCombat(leveled("m05", { type: "randomBuffPerTurn" }));
    const a = applyAction(huyetMach.data, huyetMach.state, { type: "endTurn" });
    const b = applyAction(huyetMach.data, huyetMach.state, { type: "endTurn" });
    if (!a.ok || !b.ok) throw new Error("endTurn failed");
    const buffIds = huyetMach.data.combatConfig.levelUpRandomBuffs.map((x) => x.status);
    const got = a.state.heroes[0]!.statuses.filter((st) => buffIds.includes(st.id));
    expect(got).toHaveLength(1);
    expect(b.state.heroes[0]!.statuses).toEqual(a.state.heroes[0]!.statuses);

    const immune = makeTestCombat(leveled("m05", { type: "bloodMoonImmune" }));
    immune.state.bloodMoonRounds = 2;
    const bmTurn = applyAction(immune.data, immune.state, { type: "endTurn" });
    if (!bmTurn.ok) throw new Error(bmTurn.error);
    expect(bmTurn.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon" && e.targetId === "hero:m05")).toBe(false);
    expect(bmTurn.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon" && e.targetId === "hero:f04")).toBe(true);

    const bacHoc = makeTestCombat(leveled("m05", { type: "firstSchemeRepeats" }));
    const once = playTestCard(bacHoc.data, bacHoc.state, testCard({ id: "sc1", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(once.state.heroes[0]!.armor).toBe(4);
    const twice = playTestCard(bacHoc.data, once.state, testCard({ id: "sc2", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(twice.state.heroes[0]!.armor).toBe(6);
    const withChoice = makeTestCombat(leveled("m05", { type: "firstSchemeRepeats" }));
    const chooser = playTestCard(withChoice.data, withChoice.state, testCard({ id: "sc3", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 1, to: "self" }, { type: "chooseCard", look: 3 }] }));
    expect(chooser.state.heroes[0]!.armor).toBe(2);
    expect(p0(chooser.state).pendingChoice!.options).toHaveLength(3);
  });
});
