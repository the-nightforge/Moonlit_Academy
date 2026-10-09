import { injectCard, makeTestCombat, playTestCard, setIntent, testData, withLevelUp } from "./helpers";
import { idleIntent, spiritCard } from "./fixtures";
import { describe, expect, it } from "vitest";
import { applyAction, createPvpCombat, type CombatState } from "../src/index";

describe("Phong Ấn", () => {
  const sealCard = spiritCard({ id: "test_seal", ownerId: "f04", target: "enemy", effects: [{ type: "sealIntent", to: "chosen" }] });
  const cheap = { id: "t_cheap", name: "Rẻ", kind: "attack" as const, targeting: "front" as const, effects: [{ type: "damage" as const, amount: 1, to: "chosen" as const }] };
  const dear = {
    id: "t_dear", name: "Đắt", kind: "attack" as const, targeting: "front" as const,
    effects: [
      { type: "damage" as const, amount: 9, to: "chosen" as const },
      { type: "applyStatus" as const, status: "strength" as const, amount: 2, to: "self" as const },
    ],
  };

  const withPlan = (s: CombatState) => {
    s.enemies[0]!.plannedIntents = [
      { intent: cheap, cost: 1, targetId: "hero:m05" },
      { intent: dear, cost: 3, targetId: "hero:m05" },
    ];
    setIntent(s, 1, idleIntent, null);
  };

  it("T289: sealIntent marks an enemy for its next turn — each intent keeps damage but loses its other effects; sealExtraFirstPerTurn seals another enemy; sealWeakens applies weak; intentsSealed counts stripped intents", () => {
    const t = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "intentsSealed", threshold: 99 }), setup: withPlan });
    const sealed = playTestCard(t.data, t.state, sealCard, "enemy:0");
    expect(sealed.state.enemies[0]!.sealedBy).toBe("hero:f04");
    // Nothing is stripped at cast time — the counter bumps when the intent executes.
    expect(sealed.state.heroes[1]!.levelUpCounter).toBe(0);
    const next = applyAction(t.data, sealed.state, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    // t_dear kept its damage but lost the Sức Mạnh; t_cheap had nothing to strip.
    expect(next.events).toContainEqual({ type: "sealStripped", unitId: "enemy:0", refId: "t_dear" });
    expect(next.events.some((e) => e.type === "sealStripped" && e.refId === "t_cheap")).toBe(false);
    expect(next.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", amount: 9 }));
    expect(next.state.enemies[0]!.statuses.some((st) => st.id === "strength")).toBe(false);
    // The seal expired after that enemy's turn, used or not.
    expect(next.state.enemies[0]!.sealedBy).toBeUndefined();
    expect(next.state.heroes[1]!.levelUpCounter).toBe(1);

    // A frozen enemy skips its chain — the seal still expires unused.
    const frozen = makeTestCombat({
      setup: (s) => { withPlan(s); s.enemies[0]!.statuses.push({ id: "freeze", value: 1 }); },
    });
    const frosted = playTestCard(frozen.data, frozen.state, sealCard, "enemy:0");
    const skipped = applyAction(frozen.data, frosted.state, { type: "endTurn" });
    if (!skipped.ok) throw new Error(skipped.error);
    expect(skipped.events).toContainEqual({ type: "intentSkipped", enemyId: "enemy:0", reason: "freeze" });
    expect(skipped.state.enemies[0]!.sealedBy).toBeUndefined();

    // Sử Bút: the first seal each turn also seals the lowest-position other enemy.
    const extra = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealExtraFirstPerTurn" } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    const twice = playTestCard(extra.data, extra.state, sealCard, "enemy:0");
    expect(twice.state.enemies[0]!.sealedBy).toBe("hero:f04");
    expect(twice.state.enemies[1]!.sealedBy).toBe("hero:f04");
    expect(twice.state.heroes[1]!.firstSealUsedThisTurn).toBe(true);

    const weakens = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    expect(playTestCard(weakens.data, weakens.state, sealCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 1 });
  });

  it("T290: PvP sealIntent marks the opposing hero — their cards keep damage but lose other effects during their next turn, then the mark expires", () => {
    const data = testData();
    withLevelUp("f04", { counter: "intentsSealed", threshold: 99 })(data);
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const them = 1 - me;
    const seal = injectCard(pvp, data, sealCard);
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== seal);
    pvp.cards[seal]!.player = me;
    pvp.players[me]!.hand.push(seal);
    const mySealer = pvp.heroes.find((h) => h.player === me && h.defId === "f04")!;
    const foe = pvp.heroes.find((h) => h.player === them && h.defId === "m05" && h.alive)!;
    const otherFoe = pvp.heroes.find((h) => h.player === them && h.defId === "m06")!;
    const sealed = applyAction(data, pvp, { type: "playCard", instanceId: seal, targetId: foe.id, player: me });
    if (!sealed.ok) throw new Error(sealed.error);
    expect(sealed.state.heroes.find((h) => h.id === foe.id)!.sealedBy).toBe(mySealer.id);

    // Their turn: a card of the sealed hero loses its non-damage effects (m05's
    // m05_liet_hoa_xung_phong would deal damage AND draw a card without the seal).
    const theirTurn = applyAction(data, sealed.state, { type: "endTurn", player: me });
    if (!theirTurn.ok) throw new Error(theirTurn.error);
    const poke = injectCard(theirTurn.state, data, spiritCard({
      id: "test_poke",
      ownerId: "m05",
      type: "attack",
      target: "enemy",
      effects: [
        { type: "damage", amount: 2, to: "chosen" },
        { type: "applyStatus", status: "weak", amount: 1, to: "chosen" },
      ],
    }));
    theirTurn.state.cards[poke]!.player = them;
    theirTurn.state.players[them]!.hand.push(poke);
    theirTurn.state.players[0]!.hand = theirTurn.state.players[0]!.hand.filter((id) => id !== poke);
    const target = theirTurn.state.heroes.find((h) => h.player === me && h.alive)!;
    const struck = applyAction(data, theirTurn.state, { type: "playCard", instanceId: poke, targetId: target.id, player: them });
    if (!struck.ok) throw new Error(struck.error);
    expect(struck.events).toContainEqual({ type: "sealStripped", unitId: foe.id, refId: poke });
    expect(struck.events).toContainEqual(expect.objectContaining({ type: "damageDealt", amount: 2 }));
    expect(struck.events.some((e) => e.type === "statusApplied" && (e as { status: string }).status === "weak")).toBe(false);
    // The sealer's counter bumps at strip time, like PvE.
    expect(struck.state.heroes.find((h) => h.id === mySealer.id)!.levelUpCounter).toBe(1);

    // The mark covers the whole seat turn — another card of that hero is stripped too.
    const poke2 = injectCard(struck.state, data, spiritCard({
      id: "test_poke2", ownerId: "m05", type: "attack", target: "enemy",
      effects: [{ type: "damage", amount: 1, to: "chosen" }, { type: "gainArmor", amount: 5, to: "self" }],
    }));
    struck.state.cards[poke2]!.player = them;
    struck.state.players[them]!.hand.push(poke2);
    struck.state.players[0]!.hand = struck.state.players[0]!.hand.filter((id) => id !== poke2);
    const struck2 = applyAction(data, struck.state, { type: "playCard", instanceId: poke2, targetId: target.id, player: them });
    if (!struck2.ok) throw new Error(struck2.error);
    expect(struck2.events).toContainEqual({ type: "sealStripped", unitId: foe.id, refId: poke2 });
    expect(struck2.events.some((e) => e.type === "armorGained" && (e as { targetId: string }).targetId === foe.id)).toBe(false);

    // A different hero's card is unaffected.
    const stray = injectCard(struck2.state, data, spiritCard({
      id: "test_stray", ownerId: "m06", type: "attack", target: "enemy",
      effects: [{ type: "damage", amount: 1, to: "chosen" }, { type: "applyStatus", status: "weak", amount: 1, to: "chosen" }],
    }));
    struck2.state.cards[stray]!.player = them;
    struck2.state.players[them]!.hand.push(stray);
    struck2.state.players[0]!.hand = struck2.state.players[0]!.hand.filter((id) => id !== stray);
    const strayHit = applyAction(data, struck2.state, { type: "playCard", instanceId: stray, targetId: target.id, player: them });
    if (!strayHit.ok) throw new Error(strayHit.error);
    expect(strayHit.events.some((e) => e.type === "sealStripped")).toBe(false);
    expect(strayHit.events.some((e) => e.type === "statusApplied" && (e as { status: string }).status === "weak")).toBe(true);
    expect(otherFoe.sealedBy).toBeUndefined();

    // The mark expires at the end of that seat's turn, used or not.
    const afterTheirs = applyAction(data, strayHit.state, { type: "endTurn", player: them });
    if (!afterTheirs.ok) throw new Error(afterTheirs.error);
    expect(afterTheirs.state.heroes.find((h) => h.id === foe.id)!.sealedBy).toBeUndefined();
  });

  it("T290b: PvP seal on a hero that never acts expires without bumping intentsSealed; sealWeakens weakens the target hero", () => {
    const data = testData();
    withLevelUp("f04", { counter: "intentsSealed", threshold: 99 })(data);
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const them = 1 - me;
    const seal = injectCard(pvp, data, sealCard);
    pvp.cards[seal]!.player = me;
    pvp.players[me]!.hand.push(seal);
    const foe = pvp.heroes.find((h) => h.player === them && h.alive)!;
    // The opponent plays nothing → nothing is stripped and no intentsSealed bump.
    const cast = applyAction(data, pvp, { type: "playCard", instanceId: seal, targetId: foe.id, player: me });
    if (!cast.ok) throw new Error(cast.error);
    const pass = applyAction(data, cast.state, { type: "endTurn", player: me });
    if (!pass.ok) throw new Error(pass.error);
    const done = applyAction(data, pass.state, { type: "endTurn", player: them });
    if (!done.ok) throw new Error(done.error);
    expect(done.state.heroes.find((h) => h.id === foe.id)!.sealedBy).toBeUndefined();
    expect(done.state.heroes.find((h) => h.player === me && h.defId === "f04")!.levelUpCounter).toBe(0);
    // Chép Sử: the seal carries the weak rider onto the target hero (×2, `01` §15.3).
    const data2 = testData();
    withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } })(data2);
    let pvp2 = createPvpCombat(data2, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data2, pvp2, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp2 = r.state;
    }
    const seal2 = injectCard(pvp2, data2, sealCard);
    pvp2.cards[seal2]!.player = me;
    pvp2.players[me]!.hand.push(seal2);
    pvp2.heroes.find((h) => h.player === me && h.defId === "f04")!.leveledUp = true;
    const hit = applyAction(data2, pvp2, { type: "playCard", instanceId: seal2, targetId: foe.id, player: me });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.state.heroes.find((h) => h.id === foe.id)!.statuses).toContainEqual({ id: "weak", value: 2 });
  });
});
