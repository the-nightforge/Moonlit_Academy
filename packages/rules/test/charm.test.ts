import { injectCard, makeTestCombat, playTestCard, setIntent, testData, withLevelUp } from "./helpers";
import { idleIntent, spiritCard, strike6 } from "./fixtures";
import { describe, expect, it } from "vitest";
import { applyAction, createPvpCombat, previewEnemyIntent } from "../src/index";

describe("Mê Hoặc", () => {
  it("T287: a charmed enemy's single-target intent hits another living enemy (highest HP), consuming one charge; alone it fizzles; the preview shows the redirect", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.statuses.push({ id: "charm", value: 1, sourceId: "hero:f04" });
        setIntent(s, 0, strike6, "hero:m05");
        setIntent(s, 1, idleIntent, null);
      },
    });
    expect(previewEnemyIntent(data, state, state.enemies[0]!)!.intents[0]!.targetId).toBe("enemy:1");
    const r = applyAction(data, state, { type: "endTurn" });
    if (!r.ok) throw new Error(r.error);
    expect(r.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "enemy:1" }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 6 }));
    expect(r.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);

    const alone = structuredClone(state);
    alone.enemies[1]!.alive = false;
    alone.enemies[1]!.hp = 0;
    const r2 = applyAction(data, alone, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.events).toContainEqual({ type: "intentFizzled", enemyId: "enemy:0", intentId: "t_strike6" });
    expect(r2.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T288: charmsApplied counts; charmMastery adds a charge and ×1.5; stealthOnCharm hides the charmer; PvP charm turns the first attack onto an ally", () => {
    const charmCard = spiritCard({ id: "test_charm", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "charm", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "charmsApplied", threshold: 99 }) });
    expect(playTestCard(counting.data, counting.state, charmCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const mastery = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "charmMastery", extraCharges: 1, damageMultiplier: 1.5 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; setIntent(s, 0, strike6, "hero:m05"); setIntent(s, 1, idleIntent, null); },
    });
    const charmed = playTestCard(mastery.data, mastery.state, charmCard, "enemy:0");
    expect(charmed.state.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 2, sourceId: "hero:f04" });
    const hit = applyAction(mastery.data, charmed.state, { type: "endTurn" });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 9 }));

    const vuY = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "stealthOnCharm", rounds: 1 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    expect(playTestCard(vuY.data, vuY.state, charmCard, "enemy:0").state.heroes[1]!.statuses).toContainEqual({ id: "stealth", value: 1 });

    // PvP
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const myM06 = pvp.heroes.find((h) => h.player === me && h.defId === "m06")!;
    myM06.statuses.push({ id: "charm", value: 1, sourceId: "x" });
    const myM05 = pvp.heroes.find((h) => h.player === me && h.defId === "m05")!; // HP 52 in PvP: highest ally
    const foe = pvp.heroes.find((h) => h.player !== me)!;
    const strike = injectCard(pvp, data, spiritCard({ id: "test_pvp_strike", ownerId: "m06", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 4, to: "chosen" }] }));
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== strike);
    pvp.cards[strike]!.player = me;
    pvp.players[me]!.hand.push(strike);
    const turned = applyAction(data, pvp, { type: "playCard", instanceId: strike, targetId: foe.id, player: me });
    if (!turned.ok) throw new Error(turned.error);
    expect(turned.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: myM06.id, targetId: myM05.id }));
    expect(turned.state.heroes.find((h) => h.id === myM06.id)!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T294: debuffsApplied counts debuffs from the hero; debuffDurationBonus lengthens them; bonusVsDebuffed adds damage; extendDebuffs lengthens existing debuffs", () => {
    const weakCard = spiritCard({ id: "test_weak", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "weak", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "debuffsApplied", threshold: 99 }) });
    expect(playTestCard(counting.data, counting.state, weakCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const longer = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "debuffDurationBonus", amount: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    expect(playTestCard(longer.data, longer.state, weakCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 2 });

    const bonus = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "bonusVsDebuffed", minDebuffs: 2, amount: 3 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "mark", value: 1, sourceId: "x" }); },
    });
    const hit = playTestCard(bonus.data, bonus.state, spiritCard({ id: "test_hit", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const extend = makeTestCombat({ setup: (s) => { s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "burn", value: 3 }); } });
    const ext = playTestCard(extend.data, extend.state, spiritCard({ id: "test_ext", ownerId: "f04", target: "enemy", effects: [{ type: "extendDebuffs", amount: 1, to: "chosen" }] }), "enemy:0");
    expect(ext.state.enemies[0]!.statuses).toEqual([{ id: "weak", value: 2 }, { id: "burn", value: 3 }]);
  });
});
