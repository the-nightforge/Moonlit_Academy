import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand } from "./helpers";

function play(data: Parameters<typeof applyAction>[0], state: Parameters<typeof applyAction>[1], cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

describe("statuses", () => {
  it("T16: vulnerable multiplies damage taken by 1.5", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.statuses.push({ id: "vulnerable", value: 1 });
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = play(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(30);
  });

  it("T18: empower adds to the next attack card and is consumed", () => {
    const { data, state } = makeTestCombat({
      setup: (s) =>
        setHand(s, ["m05_tran_bac_huyet_tinh", "m05_liet_hoa_xung_phong"]),
    });
    const first = play(data, state, "m05_tran_bac_huyet_tinh");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.heroes[0]?.hp).toBe(37);
    expect(first.state.heroes[0]?.statuses).toContainEqual({ id: "empower", value: 4 });

    const second = play(data, first.state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.enemies[0]?.hp).toBe(30);
    expect(second.state.moonPower).toBe(1);
    expect(second.state.heroes[0]?.statuses.some((s) => s.id === "empower")).toBe(false);
    expect(
      second.events.some((e) => e.type === "statusRemoved" && e.status === "empower"),
    ).toBe(true);
  });

  it("T19: empower is spent after one attack card", () => {
    const { data, state } = makeTestCombat({
      setup: (s) =>
        setHand(s, [
          "m05_tran_bac_huyet_tinh",
          "m05_liet_hoa_xung_phong",
          "m05_thuong_pha",
        ]),
    });
    const first = play(data, state, "m05_tran_bac_huyet_tinh");
    if (!first.ok) throw new Error("setup failed");
    const second = play(data, first.state, "m05_liet_hoa_xung_phong", "enemy:0");
    if (!second.ok) throw new Error("setup failed");

    const third = play(data, second.state, "m05_thuong_pha", "enemy:0");
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    const damage = third.events.find((e) => e.type === "damageDealt");
    expect(damage).toMatchObject({ amount: 5 });
  });

  it("T37: mark adds +3 only to attacks of the hero who applied it", () => {
    const { data, state } = makeTestCombat({
      setup: (s) =>
        setHand(s, ["m06_nguyet_anh_an", "m06_am_tien", "m05_thuong_pha"]),
    });
    const marked = play(data, state, "m06_nguyet_anh_an", "enemy:0");
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(marked.state.enemies[0]?.statuses).toContainEqual({
      id: "mark",
      value: 2,
      sourceId: "hero:m06",
    });

    const arrow = play(data, marked.state, "m06_am_tien", "enemy:0");
    expect(arrow.ok).toBe(true);
    if (!arrow.ok) return;
    expect(arrow.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 9 });

    const spear = play(data, arrow.state, "m05_thuong_pha", "enemy:0");
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
        setHand(s, ["f04_tinh_tam_tra"]);
      },
    });
    const result = play(data, state, "f04_tinh_tam_tra", "hero:m06");
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
