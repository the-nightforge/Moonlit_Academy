import { describe, expect, it } from "vitest";
import { aoeFiveCard, armorBreakCard, spiritCard } from "./fixtures";
import {
  injectCard,
  instanceIdOf,
  makeTestCombat,
  p0,
  playCardById,
  playTestCard,
  setHand,
  withLevelUp,
} from "./helpers";

describe("card damage", () => {
  it("T10: Liet Hoa Xung Phong deals 8 at full hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = playCardById(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 8);
    const damage = result.events.find((event) => event.type === "damageDealt");
    expect(damage).toMatchObject({ sourceId: "hero:m05", targetId: "enemy:0", amount: 8, blocked: 0, hpLost: 8 });
    expect(p0(result.state).moonPower).toBe(7);
    expect(p0(result.state).hand).toHaveLength(0);
    expect(p0(result.state).discardPile).toContain(
      instanceIdOf(state, "m05_liet_hoa_xung_phong"),
    );
  });

  it("T11: Liet Hoa Xung Phong deals 12 when owner below 50% hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.heroes[0]!.hp = 19;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = playCardById(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 12);
  });

  it("T12: selfHpBelow is strictly below (50% exactly deals 8)", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.heroes[0]!.hp = 20;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = playCardById(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 8);
  });

  it("T13: armor blocks before hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        p0(s).moonPower = 11;
        s.enemies[0]!.armor = 5;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = playCardById(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.armor).toBe(0);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 3);
    const damage = result.events.find((event) => event.type === "damageDealt");
    expect(damage).toMatchObject({ blocked: 5, hpLost: 3 });
  });

  it("T14: Thuong Pha removes armor then damages", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.armor = 8;
      },
    });
    injectCard(state, data, armorBreakCard);
    const result = playCardById(data, state, armorBreakCard.id, "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.armor).toBe(0);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 5);
  });

  it("T20: Song Nhan Loan Vu hits every enemy", () => {
    const { data, state } = makeTestCombat();
    injectCard(state, data, aoeFiveCard);
    const result = playCardById(data, state, aoeFiveCard.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 5);
    expect(result.state.enemies[1]?.hp).toBe(state.enemies[1]!.hp - 5);
    expect(result.events.filter((event) => event.type === "damageDealt")).toHaveLength(2);
  });
});

describe("Xuyên", () => {
  const shot = spiritCard({ id: "test_shot", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });

  it("T293: backRowHits counts hits on non-front enemies; pierceOwnAttacks also hits the enemy right behind; firstHitMarks marks once per turn", () => {
    const count = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "backRowHits", threshold: 99 }) });
    expect(playTestCard(count.data, count.state, shot, "enemy:1").state.heroes[1]!.levelUpCounter).toBe(1);
    expect(playTestCard(count.data, count.state, { ...shot, id: "test_shot_front" }, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(0);

    const pierce = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "pierceOwnAttacks" } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const through = playTestCard(pierce.data, pierce.state, shot, "enemy:0");
    const hits = through.events.filter((e) => e.type === "damageDealt").map((e) => (e as { targetId: string }).targetId);
    expect(hits).toEqual(["enemy:0", "enemy:1"]);

    const marks = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "firstHitMarks", rounds: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const first = playTestCard(marks.data, marks.state, shot, "enemy:0");
    expect(first.state.enemies[0]!.statuses).toContainEqual({ id: "mark", value: 1, sourceId: "hero:f04" });
    const second = playTestCard(marks.data, first.state, { ...shot, id: "test_shot2" }, "enemy:1");
    expect(second.state.enemies[1]!.statuses.some((st) => st.id === "mark")).toBe(false);

    // `01` §5.6: counters and marks only fire off attack cards — a skill dealing
    // damage to a back-row enemy does neither.
    const count2 = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "backRowHits", threshold: 99 }) });
    const skill = spiritCard({ id: "test_skill_dmg", ownerId: "f04", type: "skill", tags: [], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });
    const skillHit = playTestCard(count2.data, count2.state, skill, "enemy:1");
    expect(skillHit.state.heroes[1]!.levelUpCounter).toBe(0);
    const skillMarks = playTestCard(marks.data, second.state, { ...skill, id: "test_skill_dmg2" }, "enemy:1");
    expect(skillMarks.state.enemies[1]!.statuses.some((st) => st.id === "mark")).toBe(false);
  });
});
