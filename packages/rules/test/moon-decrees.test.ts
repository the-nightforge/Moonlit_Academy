import { describe, expect, it } from "vitest";
import {
  applyAction,
  createCombat,
  createPvpCombat,
  getEffectiveCost,
  phaseModifiers,
  starterDeck,
} from "../src/index";
import type { CardDef, CombatEvent, CombatState, GameData, IntentDef } from "../src/index";
import { aoeFiveCard, healFiveCard, idleIntent, stealthOneCard, strike9Intent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, rawTestInput, setHand, setIntent, setPlan, testData, withLevelUp } from "./helpers";
import { parseGameData } from "data";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

const testCard = (
  id: string,
  ownerId: string,
  type: CardDef["type"],
  target: CardDef["target"],
  effects: CardDef["effects"],
): CardDef => ({ id, name: id, ownerId, cost: 0, copies: 1, type, tags: [], target, effects, text: "" });

const strikeCard = (id: string, ownerId: string, amount: number, hits?: number): CardDef =>
  testCard(id, ownerId, "attack", "enemy", [
    { type: "damage", amount, to: "chosen", ...(hits !== undefined ? { hits } : {}) },
  ]);

const healTenCard = testCard("test_heal_10", "f04", "skill", "ally", [
  { type: "heal", amount: 10, to: "chosen" },
]);
const armorTenCard = testCard("test_armor_10", "f04", "skill", "ally", [
  { type: "gainArmor", amount: 10, to: "chosen" },
]);
const weakOneCard = testCard("test_weak_1", "m06", "skill", "enemy", [
  { type: "applyStatus", status: "weak", amount: 1, to: "chosen" },
]);
const strengthOneCard = testCard("test_strength_1", "m05", "skill", "none", [
  { type: "applyStatus", status: "strength", amount: 1, to: "self" },
]);
const shiftUpCard = testCard("test_shift_up", "f04", "skill", "none", [
  { type: "shiftMoon", amount: 1 },
]);

const strike4Intent: IntentDef = {
  id: "test_strike_4",
  name: "Test Strike 4",
  kind: "attack",
  targeting: "front",
  effects: [{ type: "damage", amount: 4, to: "chosen" }],
};

const play = (
  data: GameData,
  state: CombatState,
  instanceId: string,
  targetId?: string,
) =>
  applyAction(data, state, {
    type: "playCard",
    instanceId,
    ...(targetId !== undefined ? { targetId } : {}),
  });

/** `damageDealt.amount` values in event order, optionally for one source. */
const dealtAmounts = (events: CombatEvent[], sourceId?: string): number[] =>
  events
    .filter(
      (e): e is Extract<CombatEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && (sourceId === undefined || e.sourceId === sourceId),
    )
    .map((e) => e.amount);

describe("Nguyệt Luân — dữ liệu và bốc lệnh", () => {
  it("T314: every phase has exactly 3 decrees with unique ids; decree-only modifiers stay out of relics", () => {
    const data = testData();
    const ids = data.moonPhases.flatMap((phase) => phase.decrees.map((d) => d.id));
    expect(data.moonPhases.every((phase) => phase.decrees.length === 3)).toBe(true);
    expect(new Set(ids).size).toBe(24);
    const raw = rawTestInput();
    raw.runRelics[0].modifiers = [{ type: "keepArmor" }];
    expect(() => parseGameData(raw)).toThrow(/decree-only/);
  });

  it("T315: start phase and decrees are rolled from the seed without moving the combat RNG; start overrides after the roll", () => {
    const data = testData();
    const make = (seed: number, start?: object) =>
      createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed, deckCardIds: starterDeck(data, TEAM), ...(start ? { start } : {}) });
    const a = make(42).state;
    expect(make(42).state.moonDecrees).toEqual(a.moonDecrees);
    expect(a.moonDecrees).toHaveLength(8);
    a.moonDecrees.forEach((id, i) => expect(data.moonPhases[i]!.decrees.map((d) => d.id)).toContain(id));
    const seeds = Array.from({ length: 40 }, (_, i) => make(i + 1).state.moonIndex);
    expect(new Set(seeds).size).toBeGreaterThan(3);
    const pinned = make(42, { moonIndex: 4, decrees: { full: "doan_vien" } }).state;
    expect(pinned.moonIndex).toBe(4);
    expect(pinned.moonDecrees[4]).toBe("doan_vien");
    expect(pinned.players[0]!.drawPile).toEqual(a.players[0]!.drawPile);
    expect(pinned.rngState).toBe(a.rngState);
    const side = (heroIds: [string, string, string]) => ({ heroIds, loadout: { heroes: {}, pvp: true as const } });
    const pvp = createPvpCombat(data, { seed: 42, players: [side(TEAM), side(["f03", "f02", "m01"])] });
    expect(pvp.state.moonDecrees).toHaveLength(8);
    expect(pvp.events.some((e) => e.type === "moonDecreesRolled")).toBe(true);
  });

  it("T316: tag bonus is −1 (assassin ×1.5 at new moon) and stacks with run-relic modifiers", () => {
    const plain = makeTestCombat({ heroIds: ["f03", "f04", "m06"], start: { moonIndex: 2 }, setup: (s) => setHand(s, ["f03_han_an"]) });
    expect(phaseModifiers(plain.data, plain.state)).toEqual([{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }]);
    expect(getEffectiveCost(plain.data, plain.state, p0(plain.state).hand[0]!)).toBe(1); // Hàn Ấn: 2 − 1

    const relic = makeTestCombat({
      heroIds: ["f03", "f04", "m06"],
      start: { moonIndex: 2 },
      runRelicIds: ["t_control_relic"],
      mutateData: (d) => {
        d.runRelics["t_control_relic"] = { id: "t_control_relic", name: "T", text: "T", modifiers: [{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }] };
      },
      setup: (s) => setHand(s, ["f03_han_an"]),
    });
    expect(getEffectiveCost(relic.data, relic.state, p0(relic.state).hand[0]!)).toBe(0);

    const dark = makeTestCombat({ start: { moonIndex: 0 } });
    expect(phaseModifiers(dark.data, dark.state)).toEqual([{ type: "damageMultiplierForTag", tag: "assassin", multiplier: 1.5 }]);
  });
});

describe("Nguyệt Luân — lệnh chiến đấu", () => {
  it("T317: Ám Dạ/Viên Nguyệt scale heals, Phá Giáp/Huyền Giáp scale armor, Bóng Mờ extends stealth, Phản Chấn doubles reflect", () => {
    // Ám Dạ (new): every heal ×0.5 floored (`01` §7.5).
    const amDa = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 0, decrees: { new: "am_da" } },
      setup: (s) => {
        s.heroes[0]!.hp = s.heroes[0]!.maxHp - 10;
      },
    });
    const amDaHeal = injectCard(amDa.state, amDa.data, healTenCard);
    const amDaRes = play(amDa.data, amDa.state, amDaHeal, "hero:m05");
    expect(amDaRes.ok).toBe(true);
    if (!amDaRes.ok) return;
    expect(amDaRes.events.find((e) => e.type === "healed")).toMatchObject({ targetId: "hero:m05", amount: 5 });
    expect(amDaRes.state.heroes[0]!.hp).toBe(35);

    // Viên Nguyệt (full): every heal ×2.
    const vienNguyet = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 4, decrees: { full: "vien_nguyet" } },
      setup: (s) => {
        s.heroes[0]!.hp = 15;
      },
    });
    const vnHeal = injectCard(vienNguyet.state, vienNguyet.data, healTenCard);
    const vnRes = play(vienNguyet.data, vienNguyet.state, vnHeal, "hero:m05");
    expect(vnRes.ok).toBe(true);
    if (!vnRes.ok) return;
    expect(vnRes.events.find((e) => e.type === "healed")).toMatchObject({ targetId: "hero:m05", amount: 20 });
    expect(vnRes.state.heroes[0]!.hp).toBe(35);

    // Phá Giáp (waxingGibbous): armor gained ×0.5 floored.
    const phaGiap = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 3, decrees: { waxingGibbous: "pha_giap" } },
    });
    const pgArmor = injectCard(phaGiap.state, phaGiap.data, armorTenCard);
    const pgRes = play(phaGiap.data, phaGiap.state, pgArmor, "hero:m05");
    expect(pgRes.ok).toBe(true);
    if (!pgRes.ok) return;
    expect(pgRes.events.find((e) => e.type === "armorGained")).toMatchObject({ targetId: "hero:m05", amount: 5 });
    expect(pgRes.state.heroes[0]!.armor).toBe(5);

    // Huyền Giáp (lastQuarter): armor gained ×1.5.
    const huyenGiap = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 6, decrees: { lastQuarter: "huyen_giap" } },
    });
    const hgArmor = injectCard(huyenGiap.state, huyenGiap.data, armorTenCard);
    const hgRes = play(huyenGiap.data, huyenGiap.state, hgArmor, "hero:m05");
    expect(hgRes.ok).toBe(true);
    if (!hgRes.ok) return;
    expect(hgRes.state.heroes[0]!.armor).toBe(15);

    // Bóng Mờ (new): applied stealth lasts +1.
    const bongMo = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 0, decrees: { new: "bong_mo" } },
    });
    const bmStealth = injectCard(bongMo.state, bongMo.data, stealthOneCard);
    const bmRes = play(bongMo.data, bongMo.state, bmStealth);
    expect(bmRes.ok).toBe(true);
    if (!bmRes.ok) return;
    expect(bmRes.state.heroes[2]!.statuses).toContainEqual({ id: "stealth", value: 2 });

    // Phản Chấn (lastQuarter): Phản Đòn deals double (`01` §10.5).
    const phanChan = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 6, decrees: { lastQuarter: "phan_chan" } },
      setup: (s) => {
        s.enemies[0]!.statuses.push({ id: "reflect", value: 3 });
      },
    });
    const pcHit = injectCard(phanChan.state, phanChan.data, strikeCard("test_phan_chan_hit", "m05", 5));
    const pcRes = play(phanChan.data, phanChan.state, pcHit, "enemy:0");
    expect(pcRes.ok).toBe(true);
    if (!pcRes.ok) return;
    expect(pcRes.events).toContainEqual({ type: "hpLost", targetId: "hero:m05", amount: 6, cause: "reflect" });
    expect(pcRes.state.heroes[0]!.hp).toBe(34);
  });

  it("T318: Tập Kích first hit +3, Thế Thủ first single hit −3, Liên Kích chains +2", () => {
    // Tập Kích (new): first damage hit of each side in its own turn +3 (`01` §10.1).
    const tapKich = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 0, decrees: { new: "tap_kich" } },
      setup: (s) => {
        setIntent(s, 0, strike9Intent, "hero:m05");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const tkA = injectCard(tapKich.state, tapKich.data, strikeCard("test_tap_kich_a", "m05", 5));
    const tkB = injectCard(tapKich.state, tapKich.data, strikeCard("test_tap_kich_b", "m05", 5));
    const first = play(tapKich.data, tapKich.state, tkA, "enemy:0");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(dealtAmounts(first.events)).toEqual([8]);
    const second = play(tapKich.data, first.state, tkB, "enemy:0");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(dealtAmounts(second.events)).toEqual([5]);
    const enemyTurn = applyAction(tapKich.data, second.state, { type: "endTurn" });
    expect(enemyTurn.ok).toBe(true);
    if (!enemyTurn.ok) return;
    expect(dealtAmounts(enemyTurn.events, "enemy:0")).toEqual([12]);
    expect(enemyTurn.state.heroes[0]!.hp).toBe(28);

    // Thế Thủ (firstQuarter): each unit's first single-target hit taken per round −3 (min 0).
    const theThu = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 2, decrees: { firstQuarter: "the_thu" } },
    });
    const ttA = injectCard(theThu.state, theThu.data, strikeCard("test_the_thu_a", "m05", 5));
    const ttB = injectCard(theThu.state, theThu.data, strikeCard("test_the_thu_b", "m05", 5));
    const ttAoE = injectCard(theThu.state, theThu.data, aoeFiveCard);
    const s1 = play(theThu.data, theThu.state, ttA, "enemy:0");
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    expect(dealtAmounts(s1.events)).toEqual([2]);
    const s2 = play(theThu.data, s1.state, ttB, "enemy:0");
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    expect(dealtAmounts(s2.events)).toEqual([5]);
    const s3 = play(theThu.data, s2.state, ttAoE);
    expect(s3.ok).toBe(true);
    if (!s3.ok) return;
    expect(dealtAmounts(s3.events)).toEqual([5, 5]);

    // Liên Kích (waxingGibbous): attack cards from the second onward +2 per hit;
    // enemy chains: an attack/attackDefend after an earlier attack/attackDefend +2 per hit.
    const lienKich = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 3, decrees: { waxingGibbous: "lien_kich" } },
      setup: (s) => {
        setPlan(s, 0, [
          { intent: strike4Intent, targetId: "hero:m05" },
          { intent: strike4Intent, targetId: "hero:m05" },
        ]);
        setIntent(s, 1, idleIntent, null);
      },
    });
    const lkA = injectCard(lienKich.state, lienKich.data, strikeCard("test_lien_kich_a", "m05", 4));
    const lkHeal = injectCard(lienKich.state, lienKich.data, healFiveCard);
    const lkB = injectCard(lienKich.state, lienKich.data, strikeCard("test_lien_kich_b", "m05", 4, 2));
    const c1 = play(lienKich.data, lienKich.state, lkA, "enemy:0");
    expect(c1.ok).toBe(true);
    if (!c1.ok) return;
    expect(dealtAmounts(c1.events)).toEqual([4]);
    const c2 = play(lienKich.data, c1.state, lkHeal, "hero:f04");
    expect(c2.ok).toBe(true);
    if (!c2.ok) return;
    const c3 = play(lienKich.data, c2.state, lkB, "enemy:0");
    expect(c3.ok).toBe(true);
    if (!c3.ok) return;
    expect(dealtAmounts(c3.events)).toEqual([6, 6]);
    const lkEnd = applyAction(lienKich.data, c3.state, { type: "endTurn" });
    expect(lkEnd.ok).toBe(true);
    if (!lkEnd.ok) return;
    expect(dealtAmounts(lkEnd.events, "enemy:0")).toEqual([4, 6]);
    expect(lkEnd.state.heroes[0]!.hp).toBe(30);
  });

  it("T320: Thiên Bình extends timed debuffs, Cuồng Nguyệt doubles buffs, Nguyệt Chiếu suppresses stealth", () => {
    // Thiên Bình (firstQuarter): duration debuffs apply +1 (× durationFactor); stealth is not a debuff.
    const thienBinh = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 2, decrees: { firstQuarter: "thien_binh" } },
    });
    const tbWeak = injectCard(thienBinh.state, thienBinh.data, weakOneCard);
    const tbRes = play(thienBinh.data, thienBinh.state, tbWeak, "enemy:0");
    expect(tbRes.ok).toBe(true);
    if (!tbRes.ok) return;
    expect(tbRes.state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 2 });
    const tbStealth = injectCard(tbRes.state, thienBinh.data, stealthOneCard);
    const tbStealthRes = play(thienBinh.data, tbRes.state, tbStealth);
    expect(tbStealthRes.ok).toBe(true);
    if (!tbStealthRes.ok) return;
    expect(tbStealthRes.state.heroes[2]!.statuses).toContainEqual({ id: "stealth", value: 1 });

    // Cuồng Nguyệt (waxingGibbous): strength/empower apply at double value.
    const cuongNguyet = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 3, decrees: { waxingGibbous: "cuong_nguyet" } },
    });
    const cnStr = injectCard(cuongNguyet.state, cuongNguyet.data, strengthOneCard);
    const cnRes = play(cuongNguyet.data, cuongNguyet.state, cnStr);
    expect(cnRes.ok).toBe(true);
    if (!cnRes.ok) return;
    expect(cnRes.state.heroes[0]!.statuses).toContainEqual({ id: "strength", value: 2 });

    // Nguyệt Chiếu (full): entering the phase strips stealth; applying it inside is a no-op.
    const nguyetChieu = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 3, decrees: { full: "nguyet_chieu" } },
      setup: (s) => {
        s.heroes[2]!.statuses.push({ id: "stealth", value: 1 });
      },
    });
    const ncShift = injectCard(nguyetChieu.state, nguyetChieu.data, shiftUpCard);
    const shifted = play(nguyetChieu.data, nguyetChieu.state, ncShift);
    expect(shifted.ok).toBe(true);
    if (!shifted.ok) return;
    expect(shifted.state.moonIndex).toBe(4);
    expect(shifted.events).toContainEqual({ type: "statusRemoved", targetId: "hero:m06", status: "stealth" });
    expect(shifted.state.heroes[2]!.statuses.some((s) => s.id === "stealth")).toBe(false);
    const ncStealth = injectCard(shifted.state, nguyetChieu.data, stealthOneCard);
    const reStealth = play(nguyetChieu.data, shifted.state, ncStealth);
    expect(reStealth.ok).toBe(true);
    if (!reStealth.ok) return;
    expect(reStealth.events.some((e) => e.type === "statusApplied" && e.status === "stealth")).toBe(false);
    expect(reStealth.state.heroes[2]!.statuses.some((s) => s.id === "stealth")).toBe(false);
  });

  it("T320b: decree status rules reach direct applyStatus sources — passives, summon gains, turn-start buffs", () => {
    // Nguyệt Chiếu (full): Vũ Y's stealthOnCharm grant is suppressed too.
    const vuY = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 4, decrees: { full: "nguyet_chieu" } },
      mutateData: withLevelUp("f04", { passive: { type: "stealthOnCharm", rounds: 1 } }),
      setup: (s) => {
        s.heroes[1]!.leveledUp = true;
      },
    });
    const charmCard = injectCard(vuY.state, vuY.data, testCard("test_charm_nc", "f04", "skill", "enemy", [
      { type: "applyStatus", status: "charm", amount: 1, to: "chosen" },
    ]));
    const vuYRes = play(vuY.data, vuY.state, charmCard, "enemy:0");
    expect(vuYRes.ok).toBe(true);
    if (!vuYRes.ok) return;
    expect(vuYRes.state.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 1, sourceId: "hero:f04" });
    expect(vuYRes.state.heroes[1]!.statuses.some((s) => s.id === "stealth")).toBe(false);
    expect(vuYRes.events.some((e) => e.type === "statusApplied" && e.status === "stealth")).toBe(false);

    // Thiên Bình (firstQuarter): Chép Sử's sealWeakens applies +1 like any other source.
    const sealWeak = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 2, decrees: { firstQuarter: "thien_binh" } },
      mutateData: withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } }),
      setup: (s) => {
        s.heroes[1]!.leveledUp = true;
      },
    });
    const sealCard = injectCard(sealWeak.state, sealWeak.data, testCard("test_seal_tb", "f04", "skill", "enemy", [
      { type: "sealIntent", to: "chosen" },
    ]));
    const sealRes = play(sealWeak.data, sealWeak.state, sealCard, "enemy:0");
    expect(sealRes.ok).toBe(true);
    if (!sealRes.ok) return;
    expect(sealRes.state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 2 });

    // Cuồng Nguyệt (waxingGibbous): Huyết Mạch's rolled buff doubles — strength 1 → 2.
    // The roll fires at the next player turn, one phase after the pinned start.
    const huyetMach = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 2, decrees: { waxingGibbous: "cuong_nguyet" } },
      mutateData: (d) => {
        makeEnemiesIdle(d);
        withLevelUp("m05", { passive: { type: "randomBuffPerTurn" } })(d);
        d.combatConfig.levelUpRandomBuffs = [{ status: "strength", amount: 1 }];
      },
      setup: (s) => {
        s.heroes[0]!.leveledUp = true;
      },
    });
    const hmTurn = applyAction(huyetMach.data, huyetMach.state, { type: "endTurn" });
    expect(hmTurn.ok).toBe(true);
    if (!hmTurn.ok) return;
    expect(hmTurn.state.moonIndex).toBe(3);
    expect(hmTurn.state.heroes[0]!.statuses).toContainEqual({ id: "strength", value: 2 });
  });
});
