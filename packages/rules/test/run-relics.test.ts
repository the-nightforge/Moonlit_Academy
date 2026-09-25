import { describe, expect, it } from "vitest";
import type { CombatEvent, CombatState, GameData, RunRelicDef } from "../src/index";
import { applyAction } from "../src/index";
import { idleIntent } from "./fixtures";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand, setIntent } from "./helpers";

function play(data: GameData, state: CombatState, cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((h) => h.defId === defId)!;
}

function triggered(events: CombatEvent[]): string[] {
  return events.flatMap((e) => (e.type === "runRelicTriggered" ? [e.runRelicId] : []));
}

describe("run relic hooks", () => {
  it("T115: combatStart armor lasts through the first enemy turn", () => {
    const { data, state } = makeTestCombat({ runRelicIds: ["nguyet_giap_phu"] });
    expect(state.heroes.map((h) => h.armor)).toEqual([5, 5, 5]);
    setIntent(state, 0, data.enemies["puppet_guard"]!.intentPattern[0]!, "hero:m05");
    setIntent(state, 1, idleIntent, null);
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetId: "hero:m05", blocked: 5, hpLost: 4 }),
    );
  });

  it("T116: every 2 player turns draws one more card", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["thanh_loan_vu"],
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    expect(state.hand).toHaveLength(5);
    const second = applyAction(data, state, { type: "endTurn" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.hand).toHaveLength(6);
    const third = applyAction(data, second.state, { type: "endTurn" });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.state.hand).toHaveLength(5);
  });

  it("T117: every third attack card grants 1 moon power", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["tam_tuyet_kiem_pho"],
      setup: (s) => {
        setHand(s, ["m05_liet_hoa_xung_phong", "m05_ho_gam", "m05_thuong_pha", "m06_am_tien"]);
        s.moonPower = 10;
      },
    });
    let current = state;
    for (const cardId of ["m05_liet_hoa_xung_phong", "m05_ho_gam", "m05_thuong_pha"]) {
      const result = play(data, current, cardId, cardId === "m05_ho_gam" ? undefined : "enemy:0");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
    }
    expect(current.moonPower).toBe(6);
    const last = play(data, current, "m06_am_tien", "enemy:0");
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    expect(triggered(last.events)).toEqual(["tam_tuyet_kiem_pho"]);
    expect(last.state.moonPower).toBe(6);
  });

  it("T118: cardPlayed filters by tag and uses the card owner (bond: owners[0])", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["han_ngoc"],
      setup: (s) => setHand(s, ["m06_nguyet_anh_an", "m05_thuong_pha"]),
    });
    const marked = play(data, state, "m06_nguyet_anh_an", "enemy:0");
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(hero(marked.state, "m06").armor).toBe(3);
    const attack = play(data, marked.state, "m05_thuong_pha", "enemy:0");
    expect(attack.ok).toBe(true);
    if (!attack.ok) return;
    expect(hero(attack.state, "m05").armor).toBe(0);

    const bond = makeTestCombat({
      heroIds: ["m05", "f03", "f04"],
      runRelicIds: ["han_ngoc"],
      setup: (s) => setHand(s, ["bond_tuyet_trung_tong_than"]),
    });
    const bonded = play(bond.data, bond.state, "bond_tuyet_trung_tong_than", "enemy:0");
    expect(bonded.ok).toBe(true);
    if (!bonded.ok) return;
    expect(hero(bonded.state, "f03").armor).toBe(3);
  });

  it("T119: enemyKilled heals the killer; a burn kill has no killer", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["huyet_an"],
      setup: (s) => setHand(s, ["m05_thuong_pha"]),
    });
    hero(state, "m05").hp = 30;
    state.enemies[0]!.hp = 5;
    const kill = play(data, state, "m05_thuong_pha", "enemy:0");
    expect(kill.ok).toBe(true);
    if (!kill.ok) return;
    expect(hero(kill.state, "m05").hp).toBe(34);

    const burn = makeTestCombat({ runRelicIds: ["huyet_an"], mutateData: makeEnemiesIdle, setup: idleEnemies });
    burn.state.enemies[0]!.hp = 3;
    burn.state.enemies[0]!.statuses.push({ id: "burn", value: 5 });
    const burned = applyAction(burn.data, burn.state, { type: "endTurn" });
    expect(burned.ok).toBe(true);
    if (!burned.ok) return;
    expect(burned.state.enemies[0]?.alive).toBe(false);
    expect(triggered(burned.events)).toEqual([]);
  });

  it("T120: heroDied heals the surviving heroes", () => {
    const { data, state } = makeTestCombat({ runRelicIds: ["tan_hon_dang"] });
    hero(state, "m06").hp = 5;
    hero(state, "m05").hp = 20;
    hero(state, "f04").hp = 20;
    setIntent(state, 0, data.enemies["puppet_guard"]!.intentPattern[0]!, "hero:m06");
    setIntent(state, 1, idleIntent, null);
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "m06").alive).toBe(false);
    expect(triggered(result.events)).toEqual(["tan_hon_dang"]);
    expect(hero(result.state, "m05").hp).toBe(26);
    expect(hero(result.state, "f04").hp).toBe(26);
  });

  it("T121: moonPhaseEntered fires on round end and on a moon shift card", () => {
    const roundEnd = makeTestCombat({
      runRelicIds: ["bach_lo_huong_tui"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        s.moonIndex = 3;
      },
    });
    hero(roundEnd.state, "f04").hp = 10;
    const ended = applyAction(roundEnd.data, roundEnd.state, { type: "endTurn" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.moonIndex).toBe(4);
    expect(hero(ended.state, "f04").hp).toBe(22);

    const shifted = makeTestCombat({
      runRelicIds: ["bach_lo_huong_tui"],
      setup: (s) => {
        s.moonIndex = 3;
        setHand(s, ["f04_nguyet_quang_dan"]);
      },
    });
    hero(shifted.state, "f04").hp = 10;
    const card = play(shifted.data, shifted.state, "f04_nguyet_quang_dan");
    expect(card.ok).toBe(true);
    if (!card.ok) return;
    expect(hero(card.state, "f04").hp).toBe(22);
  });

  it("T122: bloodMoonStarted fires only when blood moon begins", () => {
    const team: [string, string, string] = ["m05", "f03", "f02"];
    const start = makeTestCombat({
      heroIds: team,
      runRelicIds: ["huyet_nguyet_phu"],
      setup: (s) => setHand(s, ["f02_doi_van_chu"]),
    });
    const begun = play(start.data, start.state, "f02_doi_van_chu");
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    for (const h of begun.state.heroes) expect(h.statuses).toEqual([{ id: "strength", value: 1 }]);

    const extend = makeTestCombat({
      heroIds: team,
      runRelicIds: ["huyet_nguyet_phu"],
      setup: (s) => {
        s.bloodMoonRounds = 1;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });
    const extended = play(extend.data, extend.state, "f02_doi_van_chu");
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.state.bloodMoonRounds).toBe(2);
    expect(triggered(extended.events)).toEqual([]);
  });

  it("T124: relic damage is not an attack (no strength)", () => {
    const blast: RunRelicDef = {
      id: "test_end_blast",
      name: "Test",
      text: "",
      hooks: [{ on: { type: "playerTurnEnd" }, actor: "front", effects: [{ type: "damage", amount: 5, to: "allEnemies" }] }],
    };
    const { data, state } = makeTestCombat({
      runRelicIds: [blast.id],
      mutateData: (d) => {
        makeEnemiesIdle(d);
        d.runRelics[blast.id] = blast;
      },
      setup: idleEnemies,
    });
    hero(state, "m05").statuses.push({ id: "strength", value: 3 });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits = result.events.filter((e) => e.type === "damageDealt" && e.sourceId === "hero:m05");
    expect(hits.map((e) => e.type === "damageDealt" && e.amount)).toEqual([5, 5]);
  });

  it("T125: hooks do not fire from inside relic effects", () => {
    const chain: RunRelicDef = {
      id: "test_chain",
      name: "Test",
      text: "",
      hooks: [{ on: { type: "enemyKilled" }, actor: "front", effects: [{ type: "damage", amount: 99, to: "allEnemies" }] }],
    };
    const { data, state } = makeTestCombat({
      runRelicIds: [chain.id],
      mutateData: (d) => {
        d.runRelics[chain.id] = chain;
      },
      setup: (s) => setHand(s, ["m05_thuong_pha"]),
    });
    state.enemies[0]!.hp = 5;
    const result = play(data, state, "m05_thuong_pha", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(triggered(result.events)).toEqual(["test_chain"]);
  });

  it("T126: relics trigger in acquisition order", () => {
    const armor = (id: string): RunRelicDef => ({
      id,
      name: id,
      text: "",
      hooks: [{ on: { type: "combatStart" }, actor: "front", effects: [{ type: "gainArmor", amount: 1, to: "self" }] }],
    });
    const { events } = makeTestCombat({
      runRelicIds: ["test_b", "test_a"],
      mutateData: (d) => {
        d.runRelics["test_a"] = armor("test_a");
        d.runRelics["test_b"] = armor("test_b");
      },
    });
    expect(triggered(events)).toEqual(["test_b", "test_a"]);
  });
});
