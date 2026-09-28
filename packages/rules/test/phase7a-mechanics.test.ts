import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, autoChoiceAction, chooseCombatAction, createCoopCombat, createPvpCombat, previewEnemyIntent } from "../src/index";
import { chooseThreeCard, idleIntent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, setIntent, testData, withLevelUp } from "./helpers";

/** Puts a test card into `seat`'s hand (injectCard only knows seat 0). */
function giveCard(state: CombatState, data: GameData, seat: number, card: CardDef): string {
  const instanceId = injectCard(state, data, card);
  state.players[0]!.hand = state.players[0]!.hand.filter((id) => id !== instanceId);
  state.cards[instanceId]!.player = seat;
  state.players[seat]!.hand.push(instanceId);
  return instanceId;
}

const strike6: IntentDef = {
  id: "t_strike6", name: "Đánh", kind: "attack", targeting: "front",
  effects: [{ type: "damage", amount: 6, to: "chosen" }],
};

describe("phase 7a — Hộ Vệ", () => {
  it("T263: an enemy hit aimed at a guarded hero lands on the guardian", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m05" }),
    );
    expect(result.state.heroes[1]!.hp).toBe(state.heroes[1]!.hp);
    expect(result.state.heroes[0]!.hp).toBe(state.heroes[0]!.hp - 6);
  });

  it("T264: taunt picks first, a dead guardian does not redirect, the preview shows the guardian", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    expect(previewEnemyIntent(data, state, state.enemies[0]!)!.intents[0]!.targetId).toBe("hero:m05");

    const tauntOnGuarded = structuredClone(state);
    tauntOnGuarded.heroes[2]!.statuses.push({ id: "taunt", value: 1 });
    tauntOnGuarded.heroes[2]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
    const taunted = applyAction(data, tauntOnGuarded, { type: "endTurn" });
    if (!taunted.ok) throw new Error(taunted.error);
    expect(taunted.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m05" }),
    );

    const deadGuardian = structuredClone(state);
    deadGuardian.heroes[0]!.alive = false;
    deadGuardian.heroes[0]!.hp = 0;
    const plain = applyAction(data, deadGuardian, { type: "endTurn" });
    if (!plain.ok) throw new Error(plain.error);
    expect(plain.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:f04" }),
    );
  });

  it("T265: hitsIntercepted counts each redirected intent and levels the guardian", () => {
    const { data, state } = makeTestCombat({
      mutateData: withLevelUp("m05", { counter: "hitsIntercepted", threshold: 1 }),
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.heroes[0]!.levelUpCounter).toBe(1);
    expect(result.state.heroes[0]!.leveledUp).toBe(true);
  });

  it("T266: armorPerTurn grants armor at turn start; interceptArmor shields the guardian before the hit", () => {
    const perTurn = makeTestCombat({
      mutateData: (d) => { makeEnemiesIdle(d); withLevelUp("m05", { passive: { type: "armorPerTurn", amount: 4 } })(d); },
      setup: (s) => { s.heroes[0]!.leveledUp = true; },
    });
    const next = applyAction(perTurn.data, perTurn.state, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.heroes[0]!.armor).toBe(4);

    const shield = makeTestCombat({
      mutateData: withLevelUp("m05", { passive: { type: "interceptArmor", amount: 2 } }),
      setup: (s) => {
        s.heroes[0]!.leveledUp = true;
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const hit = applyAction(shield.data, shield.state, { type: "endTurn" });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.events).toContainEqual({ type: "damageDealt", sourceId: "enemy:0", targetId: "hero:m05", amount: 6, blocked: 2, hpLost: 4 });
  });

  it("T265b: PvP cards aimed at a guarded hero hit the guardian", () => {
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    const created = createPvpCombat(data, {
      seed: 7,
      players: [
        { heroIds: ["m05", "f04", "m06"], loadout },
        { heroIds: ["m05", "f04", "m06"], loadout },
      ],
    });
    let state = created.state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    const attacker = state.activePlayer;
    const defender = 1 - attacker;
    const guarded = state.heroes.find((h) => h.player === defender && h.defId === "f04")!;
    const guardian = state.heroes.find((h) => h.player === defender && h.defId === "m05")!;
    guarded.statuses.push({ id: "guard", value: 2, sourceId: guardian.id });
    const instanceId = giveCard(state, data, attacker, {
      id: "test_poke", name: "Chọc", ownerId: "m06", cost: 0, copies: 1, type: "attack", tags: ["attack"],
      target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }], text: "",
    });
    const played = applyAction(data, state, { type: "playCard", instanceId, targetId: guarded.id, player: attacker });
    if (!played.ok) throw new Error(played.error);
    expect(played.events).toContainEqual(expect.objectContaining({ type: "damageDealt", targetId: guardian.id }));
    expect(played.state.heroes.find((h) => h.id === guarded.id)!.hp).toBe(guarded.hp);
  });
});

describe("phase 7a — Chọn Pha", () => {
  const quanTinh = (d: GameData) => {
    makeEnemiesIdle(d);
    withLevelUp("m06", { passive: { type: "chooseMoon" } })(d);
  };

  it("T267: a leveled chooseMoon hero opens Chọn Pha at turn start; chooseMoon shifts the moon", () => {
    const { data, state } = makeTestCombat({ mutateData: quanTinh, setup: (s) => { s.heroes[2]!.leveledUp = true; } });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.status).toBe("choosing");
    expect(p0(turn.state).pendingChoice).toEqual({ kind: "chooseMoon", options: [0, 1, 2] });
    expect(turn.events).toContainEqual({ type: "moonChoiceOpened", options: [0, 1, 2] });

    expect(applyAction(data, turn.state, { type: "endTurn" })).toEqual({ ok: false, error: "choice pending" });
    expect(applyAction(data, turn.state, { type: "chooseCard", instanceId: "c01" })).toEqual({ ok: false, error: "no pending choice" });
    expect(applyAction(data, turn.state, { type: "chooseMoon", offset: 3 as 2 })).toEqual({ ok: false, error: "not a choice option" });

    const chosen = applyAction(data, turn.state, { type: "chooseMoon", offset: 2 });
    if (!chosen.ok) throw new Error(chosen.error);
    expect(chosen.state.status).toBe("playerTurn");
    expect(chosen.state.moonIndex).toBe((turn.state.moonIndex + 2) % 8);
    expect(p0(chosen.state).pendingChoice).toBeNull();
    expect(applyAction(data, chosen.state, { type: "chooseMoon", offset: 0 })).toEqual({ ok: false, error: "no pending choice" });
  });

  it("T268: Vạn Kim's Chiêm Bài comes first, then Chọn Pha; mid-turn level-up waits a turn", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        quanTinh(d);
        withLevelUp("f04", { passive: { type: "freeChooseCardPerTurn", look: 3 } })(d);
      },
      setup: (s) => { s.heroes[1]!.leveledUp = true; s.heroes[2]!.leveledUp = true; },
    });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    const pending = p0(turn.state).pendingChoice!;
    expect(pending.kind).toBe("chooseCard");
    const picked = applyAction(data, turn.state, { type: "chooseCard", instanceId: pending.options[0] as string });
    if (!picked.ok) throw new Error(picked.error);
    expect(p0(picked.state).pendingChoice).toEqual({ kind: "chooseMoon", options: [0, 1, 2] });
    expect(picked.state.status).toBe("choosing");

    // Leveled mid-turn: nothing is owed until next turn, even after a Chiêm Bài is answered.
    const late = makeTestCombat({ mutateData: quanTinh });
    late.state.heroes[2]!.leveledUp = true;
    const look = injectCard(late.state, late.data, chooseThreeCard);
    const opened = applyAction(late.data, late.state, { type: "playCard", instanceId: look });
    if (!opened.ok) throw new Error(opened.error);
    const lateOptions = p0(opened.state).pendingChoice!.options as string[];
    const answered = applyAction(late.data, opened.state, { type: "chooseCard", instanceId: lateOptions[0]! });
    if (!answered.ok) throw new Error(answered.error);
    expect(p0(answered.state).pendingChoice).toBeNull();
    expect(answered.state.status).toBe("playerTurn");
  });

  it("T268b: co-op — when both seats owe Chọn Pha, only seat 0 chooses", () => {
    const data = testData();
    quanTinh(data);
    const side = { heroIds: ["m06", "f04", "m05"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    for (const hero of state.heroes) if (hero.defId === "m06") hero.leveledUp = true;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "endTurn", player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    expect(state.players[0]!.pendingChoice?.kind).toBe("chooseMoon");
    expect(state.players[1]!.pendingChoice).toBeNull();
    expect(state.status).toBe("playerTurn");
  });

  it("T267b: co-op — a dead chooser resolves the choice without a shift or a crash", () => {
    const data = testData();
    quanTinh(data);
    const side = { heroIds: ["m06", "f04", "m05"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    state.heroes.find((hero) => hero.player === 0 && hero.defId === "m06")!.leveledUp = true;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "endTurn", player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    expect(state.players[0]!.pendingChoice?.kind).toBe("chooseMoon");
    expect(state.status).toBe("playerTurn");

    // The shared turn stays open, so the chooser can die before answering.
    const chooser = state.heroes.find((hero) => hero.player === 0 && hero.defId === "m06")!;
    chooser.alive = false;
    chooser.hp = 0;
    const moonIndex = state.moonIndex;
    const answered = applyAction(data, state, { type: "chooseMoon", offset: 1, player: 0 });
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.state.moonIndex).toBe(moonIndex);
    expect(answered.events.some((event) => event.type === "moonShifted")).toBe(false);
    expect(answered.state.players[0]!.pendingChoice).toBeNull();
    expect(answered.state.players[0]!.moonChoicePending).toBeUndefined();
  });

  it("T269: autoChoiceAction and the bot answer both kinds of choice", () => {
    const { data, state } = makeTestCombat({ mutateData: quanTinh, setup: (s) => { s.heroes[2]!.leveledUp = true; } });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(autoChoiceAction(turn.state, 0)).toEqual({ type: "chooseMoon", offset: 0, player: 0 });
    const bot = chooseCombatAction(data, turn.state, 0);
    expect(bot.type).toBe("chooseMoon");
    expect(applyAction(data, turn.state, bot).ok).toBe(true);
    expect(autoChoiceAction(state, 0)).toBeNull();
  });
});
