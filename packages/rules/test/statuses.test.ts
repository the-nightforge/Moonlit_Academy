import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { armorBreakCard, cleanseHealCard, idleIntent, strike9Intent, twoHitCard } from "./fixtures";
import {
  heroByDefId,
  idleEnemies,
  injectCard,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  playCardById,
  setHand,
  setIntent,
} from "./helpers";

describe("statuses", () => {
  it("T16: vulnerable multiplies damage taken by 1.5", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.enemies[0]!.statuses.push({ id: "vulnerable", value: 1 });
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = playCardById(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 12);
  });

  it("T18: empower adds to the next attack card and is consumed", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["m05_tran_bac_huyet_tinh", "m05_liet_hoa_xung_phong"]);
      },
    });
    const first = playCardById(data, state, "m05_tran_bac_huyet_tinh");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.heroes[0]?.hp).toBe(37);
    expect(first.state.heroes[0]?.statuses).toContainEqual({ id: "empower", value: 4 });

    const second = playCardById(data, first.state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 12);
    expect(p0(second.state).moonPower).toBe(7);
    expect(second.state.heroes[0]?.statuses.some((s) => s.id === "empower")).toBe(false);
    expect(
      second.events.some((e) => e.type === "statusRemoved" && e.status === "empower"),
    ).toBe(true);
  });

  it("T19: empower is spent after one attack card", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, [
          "m05_tran_bac_huyet_tinh",
          "m05_liet_hoa_xung_phong",
        ]);
      },
    });
    injectCard(state, data, armorBreakCard);
    const first = playCardById(data, state, "m05_tran_bac_huyet_tinh");
    if (!first.ok) throw new Error("setup failed");
    const second = playCardById(data, first.state, "m05_liet_hoa_xung_phong", "enemy:0");
    if (!second.ok) throw new Error("setup failed");

    const third = playCardById(data, second.state, armorBreakCard.id, "enemy:0");
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    const damage = third.events.find((e) => e.type === "damageDealt");
    expect(damage).toMatchObject({ amount: 5 });
  });

  it("T37: mark adds +3 only to attacks of the hero who applied it", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["m06_nguyet_anh_an", "m06_am_tien"]);
      },
    });
    injectCard(state, data, armorBreakCard);
    const marked = playCardById(data, state, "m06_nguyet_anh_an", "enemy:0");
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(marked.state.enemies[0]?.statuses).toContainEqual({
      id: "mark",
      value: 2,
      sourceId: "hero:m06",
    });

    const arrow = playCardById(data, marked.state, "m06_am_tien", "enemy:0");
    expect(arrow.ok).toBe(true);
    if (!arrow.ok) return;
    expect(arrow.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 9 });

    const spear = playCardById(data, arrow.state, armorBreakCard.id, "enemy:0");
    expect(spear.ok).toBe(true);
    if (!spear.ok) return;
    const damage = spear.events.find((e) => e.type === "damageDealt");
    expect(damage).toMatchObject({ amount: 5 });
  });

  it("T42: cleanse removes debuffs but keeps buffs", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[2]!.hp = 20;
        s.heroes[2]!.statuses.push(
          { id: "weak", value: 2 },
          { id: "mark", value: 1, sourceId: "enemy:0" },
          { id: "stealth", value: 1 },
          { id: "regen", value: 2 },
        );
      },
    });
    injectCard(state, data, cleanseHealCard);
    const result = playCardById(data, state, cleanseHealCard.id, "hero:m06");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const statuses = result.state.heroes[2]!.statuses.map((s) => s.id);
    expect(statuses).not.toContain("weak");
    expect(statuses).not.toContain("mark");
    expect(statuses).toContain("stealth");
    expect(statuses).toContain("regen");
    expect(result.state.heroes[2]?.hp).toBe(22);
  });

  it("T39: armor is cleared before the burn tick at turn start", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[0]!.armor = 5;
        s.heroes[0]!.statuses.push({ id: "burn", value: 3 });
        idleEnemies(s);
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.armor).toBe(0);
    expect(result.state.heroes[0]?.hp).toBe(37);
    expect(result.state.heroes[0]?.statuses).toContainEqual({ id: "burn", value: 2 });
  });

  it("T41: regen ticking under a full moon heals double with Viên Nguyệt", () => {
    const { data, state } = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 1, decrees: { full: "vien_nguyet" } },
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.moonIndex = 3;
        s.heroes[0]!.hp = 30;
        s.heroes[0]!.statuses.push({ id: "regen", value: 3 });
      },
    });
    idleEnemies(state);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(4);
    expect(result.events).toContainEqual({ type: "healed", targetId: "hero:m05", amount: 6 });
    expect(result.state.heroes[0]?.hp).toBe(36);
  });

  it("T40: regen heals each player turn start until it runs out", () => {
    const { data, state } = makeTestCombat({
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        s.moonIndex = 6;
        s.heroes[0]!.hp = 30;
        s.heroes[0]!.statuses.push({ id: "regen", value: 3 });
      },
    });

    const expectations: [number, number | undefined][] = [
      [33, 2],
      [35, 1],
      [36, undefined],
    ];
    let current = state;
    for (const [hp, regen] of expectations) {
      const result = applyAction(data, current, { type: "endTurn" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
      expect(current.heroes[0]?.hp).toBe(hp);
      expect(current.heroes[0]?.statuses.find((s) => s.id === "regen")?.value).toBe(regen);
    }
  });
});

const REFLECT_STEAL_TEAM: [string, string, string] = ["m05", "f03", "f02"];

describe("reflect", () => {
  it("T61: a hit on a reflecting hero makes the attacker lose HP", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    heroByDefId(state, "f03").statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, strike9Intent, "hero:f03");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f03").hp).toBe(23);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 2);
    const hit = result.events.findIndex((e) => e.type === "damageDealt" && e.targetId === "hero:f03");
    expect(result.events[hit + 1]).toEqual({
      type: "hpLost",
      targetId: "enemy:0",
      amount: 2,
      cause: "reflect",
    });
  });

  it("T62: reflect triggers even when armor blocks the whole hit", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    const f03 = heroByDefId(state, "f03");
    f03.armor = 20;
    f03.statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, strike9Intent, "hero:f03");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetId: "hero:f03", blocked: 9, hpLost: 0 }),
    );
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 2);
  });

  it("T63: reflect triggers on every hit of a multi-hit attack", () => {
    const { data, state } = makeTestCombat({ heroIds: REFLECT_STEAL_TEAM });
    heroByDefId(state, "f03").statuses.push({ id: "reflect", value: 2 });
    setIntent(state, 0, idleIntent, null);
    setIntent(state, 1, data.enemies["shadow_fox"]!.intents.find((i) => i.id === "twin_claw")!, "hero:f03");

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[1]?.hp).toBe(state.enemies[1]!.hp - 4);
  });

  it("T64: reflect is removed together with armor at the start of its side's turn", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    heroByDefId(state, "f03").statuses.push({ id: "reflect", value: 2 });
    state.enemies[0]!.statuses.push({ id: "reflect", value: 3 });

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f03").statuses).toEqual([]);
    expect(result.state.enemies[0]?.statuses).toEqual([]);
    const enemyTurn = result.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    const heroTurn = result.events.findIndex((e) => e.type === "turnStarted" && e.side === "hero");
    const removed = (targetId: string) =>
      result.events.findIndex(
        (e) => e.type === "statusRemoved" && e.targetId === targetId && e.status === "reflect",
      );
    expect(removed("enemy:0")).toBeGreaterThan(enemyTurn);
    expect(removed("hero:f03")).toBeGreaterThan(heroTurn);
  });

  it("T65: an attacker killed by reflect stops its card; the card is still discarded", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      encounterId: "enc_04",
    });
    const twoHit = injectCard(state, data, twoHitCard);
    heroByDefId(state, "f03").hp = 3;
    state.enemies[0]!.statuses.push({ id: "reflect", value: 3 });

    const result = playCardById(data, state, twoHitCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const f03 = heroByDefId(result.state, "f03");
    expect(f03.alive).toBe(false);
    expect(result.events.filter((e) => e.type === "damageDealt")).toHaveLength(1);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 4);
    expect(result.events).toContainEqual({ type: "unitDied", unitId: "hero:f03", killerId: "enemy:0" });
    expect(p0(result.state).discardPile).toContain(twoHit);
  });

  it("T66: an enemy killed by reflect credits the reflector but not enemiesKilled", () => {
    const { data, state } = makeTestCombat();
    heroByDefId(state, "m06").statuses.push({ id: "reflect", value: 2 });
    state.enemies[0]!.hp = 2;
    setIntent(state, 0, strike9Intent, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.alive).toBe(false);
    expect(result.events).toContainEqual({ type: "unitDied", unitId: "enemy:0", killerId: "hero:m06" });
    expect(heroByDefId(result.state, "m06").levelUpCounter).toBe(0);
    expect(heroByDefId(result.state, "m06").hp).toBe(19);
  });
});
