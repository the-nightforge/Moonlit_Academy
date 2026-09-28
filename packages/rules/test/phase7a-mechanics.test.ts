import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, IntentDef, LevelUpCounter, LevelUpPassive } from "../src/index";
import { applyAction, autoChoiceAction, chooseCombatAction, createCoopCombat, createPvpCombat, createProfile, getEffectiveCost, previewEnemyIntent, validateDeck } from "../src/index";
import { chooseThreeCard, idleIntent } from "./fixtures";
import { injectCard, instanceIdOf, makeEnemiesIdle, makeTestCombat, ownAllHeroes, p0, setHand, setIntent, testData, withLevelUp } from "./helpers";

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

const card = (partial: Partial<CardDef>): CardDef => ({
  id: "test_c", name: "C", ownerId: "m05", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
  effects: [{ type: "gainMoonPower", amount: 0 }], text: "", ...partial,
});
const play = (data: GameData, state: CombatState, def: CardDef, targetId?: string) => {
  const instanceId = injectCard(state, data, def);
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
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

  it("T266c: re-applying guard replaces its duration and sourceId instead of stacking", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m02", "f04", "m06"],
      setup: (s) => {
        setHand(s, ["m02_ho_ve"]);
        s.heroes[1]!.statuses.push({ id: "guard", value: 5, sourceId: "hero:m05" });
      },
    });
    const played = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m02_ho_ve"),
      targetId: state.heroes[1]!.id,
    });
    if (!played.ok) throw new Error(played.error);
    const guard = played.state.heroes[1]!.statuses.find((s) => s.id === "guard")!;
    expect(guard.value).toBe(2);
    expect(guard.sourceId).toBe(played.state.heroes[0]!.id);
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

const tokenCard: CardDef = {
  id: "test_token_ult", name: "Tối Thượng", ownerId: "f04", cost: 0, copies: 1, type: "attack",
  tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 9, to: "chosen" }], text: "", token: true,
};

describe("phase 7a — lá tạo ra", () => {
  it("T270: onLevelUp createCard puts a token in hand with a stable id; a full hand skips it", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        d.cards[tokenCard.id] = tokenCard;
        withLevelUp("f04", { counter: "damageTaken", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "createCard", cardId: tokenCard.id }];
      },
    });
    const hurt = injectCard(state, data, {
      id: "test_selfcut", name: "Tự Thương", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [],
      target: "none", effects: [{ type: "loseHp", amount: 1, to: "self" }], text: "",
    });

    // 8 cards in hand: after `hurt` leaves, 7 remain — above `handSize` but under `handLimit`.
    const roomy = structuredClone(state);
    p0(roomy).hand = [hurt, ...p0(roomy).drawPile.splice(0, 7)];
    const result = applyAction(data, roomy, { type: "playCard", instanceId: hurt });
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: "t1" });
    expect(p0(result.state).hand).toHaveLength(8);
    expect(result.state.cards.t1).toMatchObject({ cardId: tokenCard.id, ownerIds: ["f04"], player: 0, heldTurns: 0 });

    // 9 cards in hand: after `hurt` leaves, 8 remain = handLimit → no room.
    const full = structuredClone(state);
    p0(full).hand = [hurt, ...p0(full).drawPile.splice(0, 8)];
    const skipped = applyAction(data, full, { type: "playCard", instanceId: hurt });
    if (!skipped.ok) throw new Error(skipped.error);
    expect(skipped.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: null });
    expect(skipped.state.cards.t1).toBeUndefined();
  });

  it("T271: token cards cannot be deck-built and createCard must point at a token", () => {
    const data = testData();
    data.cards[tokenCard.id] = tokenCard;
    const profile = ownAllHeroes(data, createProfile(data));
    const deck = { heroIds: ["m05", "f04", "m06"] as [string, string, string], cardIds: [...data.heroes.m05!.cardIds, ...data.heroes.f04!.cardIds.slice(0, 5), tokenCard.id, ...data.heroes.m06!.cardIds] };
    expect(validateDeck(data, profile, deck).length).toBeGreaterThan(0);
  });
});

describe("phase 7a — bộ đếm", () => {
  const counterOn = (counter: LevelUpCounter) => withLevelUp("m05", { counter, threshold: 99 });

  it("T272: every new counter bumps on its trigger", () => {
    // schemeCardsPlayed: a scheme card by any teammate
    let t = makeTestCombat({ mutateData: counterOn("schemeCardsPlayed") });
    expect(play(t.data, t.state, card({ id: "s1", ownerId: "f04", tags: ["scheme"] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // studyPoints: +1 per own scheme card, +1 per turn start alive
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("studyPoints")(d); } });
    const s = play(t.data, t.state, card({ id: "s2", tags: ["scheme"] }));
    expect(s.state.heroes[0]!.levelUpCounter).toBe(1);
    const turn = applyAction(t.data, s.state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.heroes[0]!.levelUpCounter).toBe(2);

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
    expect(play(t.data, t.state, card({ id: "s3", effects: [{ type: "shiftMoon", amount: 1 }] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // hpHealed: real HP healed by the hero's card
    t = makeTestCombat({ mutateData: counterOn("hpHealed"), setup: (st) => { st.heroes[1]!.hp -= 4; } });
    expect(play(t.data, t.state, card({ id: "s4", target: "ally", effects: [{ type: "heal", amount: 10, to: "chosen" }] }), "hero:f04").state.heroes[0]!.levelUpCounter).toBe(4);

    // forbiddenHpLost: self loseHp from the hero's forbidden card
    t = makeTestCombat({ mutateData: counterOn("forbiddenHpLost") });
    expect(play(t.data, t.state, card({ id: "s5", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }] })).state.heroes[0]!.levelUpCounter).toBe(3);

    // cardsChosen: a Chiêm Bài pick by the seat
    t = makeTestCombat({ mutateData: counterOn("cardsChosen") });
    const opened = play(t.data, t.state, card({ id: "s6", effects: [{ type: "chooseCard", look: 3 }] }));
    const pending = p0(opened.state).pendingChoice!;
    const picked = applyAction(t.data, opened.state, { type: "chooseCard", instanceId: pending.options[0] as string });
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.heroes[0]!.levelUpCounter).toBe(1);
  });
});

describe("phase 7a — nội tại", () => {
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
    const moonCard = injectCard(tuDo.state, tuDo.data, card({ id: "mc", cost: 2, tags: ["moon"] }));
    expect(getEffectiveCost(tuDo.data, tuDo.state, moonCard)).toBe(1);

    const dinhCuc = makeTestCombat(leveled("m05", { type: "chooseCardExtraLook", amount: 1 }));
    const opened = play(dinhCuc.data, dinhCuc.state, card({ id: "look", ownerId: "f04", effects: [{ type: "chooseCard", look: 3 }] }));
    expect(p0(opened.state).pendingChoice!.options).toHaveLength(4);
  });

  it("T274: damage/heal passives — combo bonus, blood moon bonus, heal bonus, no forbidden self-loss, moon shift weakens", () => {
    const combo = makeTestCombat(leveled("m05", { type: "comboAttackBonus", amount: 1 }));
    const first = play(combo.data, combo.state, card({ id: "a2" }));
    const hit = play(combo.data, first.state, card({ id: "a3", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 6 });

    const phanSu = makeTestCombat(leveled("m05", { type: "bloodMoonAttackBonus", amount: 3 }, undefined));
    phanSu.state.bloodMoonRounds = 1;
    const bm = play(phanSu.data, phanSu.state, card({ id: "a4", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(bm.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const tamNhan = makeTestCombat(leveled("m05", { type: "healBonusOwnCards", amount: 2 }));
    tamNhan.state.heroes[1]!.hp -= 10;
    const healed = play(tamNhan.data, tamNhan.state, card({ id: "h1", target: "ally", effects: [{ type: "heal", amount: 3, to: "chosen" }] }), "hero:f04");
    expect(healed.events).toContainEqual({ type: "healed", targetId: "hero:f04", amount: 5 });

    const huyetPhuong = makeTestCombat(leveled("m05", { type: "forbiddenNoSelfHpLoss" }));
    const f = play(huyetPhuong.data, huyetPhuong.state, card({ id: "f1", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }, { type: "gainArmor", amount: 1, to: "self" }] }));
    expect(f.state.heroes[0]!.hp).toBe(huyetPhuong.state.heroes[0]!.hp);

    const tinhMenh = makeTestCombat(leveled("m05", { type: "moonShiftWeakensEnemies", amount: 1 }));
    const shifted = play(tinhMenh.data, tinhMenh.state, card({ id: "sh", effects: [{ type: "shiftMoon", amount: 1 }] }));
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
    const once = play(bacHoc.data, bacHoc.state, card({ id: "sc1", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(once.state.heroes[0]!.armor).toBe(4);
    const twice = play(bacHoc.data, once.state, card({ id: "sc2", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(twice.state.heroes[0]!.armor).toBe(6);
    const withChoice = makeTestCombat(leveled("m05", { type: "firstSchemeRepeats" }));
    const chooser = play(withChoice.data, withChoice.state, card({ id: "sc3", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 1, to: "self" }, { type: "chooseCard", look: 3 }] }));
    expect(chooser.state.heroes[0]!.armor).toBe(2);
    expect(p0(chooser.state).pendingChoice!.options).toHaveLength(3);
  });
});

describe("phase 7a — giới hạn tay bài", () => {
  const drawCard = (amount: number): CardDef => ({
    id: `test_draw${amount}`, name: `Rút ${amount}`, ownerId: "m05", cost: 0, copies: 1,
    type: "skill", tags: [], target: "none", effects: [{ type: "drawCards", amount }], text: "",
  });

  it("T277: drawCards draws blindly; cards past handLimit are discarded", () => {
    const { data, state } = makeTestCombat({ setup: (s) => { p0(s).moonPower = 99; } });
    const small = structuredClone(state);
    const fit = injectCard(small, data, drawCard(3));
    p0(small).hand = [fit];
    const fitted = applyAction(data, small, { type: "playCard", instanceId: fit });
    if (!fitted.ok) throw new Error(fitted.error);
    expect(fitted.events).toContainEqual(expect.objectContaining({ type: "cardsDrawn" }));
    expect(fitted.events.find((e) => e.type === "cardsDrawn")).toMatchObject({ instanceIds: expect.arrayContaining([expect.any(String)]) });
    expect(p0(fitted.state).hand).toHaveLength(3);
    expect(fitted.events.some((e) => e.type === "cardDiscarded")).toBe(false);

    const crowded = structuredClone(state);
    const over = injectCard(crowded, data, drawCard(3));
    p0(crowded).hand = [over, ...p0(crowded).drawPile.splice(0, 7)];
    const spilled = applyAction(data, crowded, { type: "playCard", instanceId: over });
    if (!spilled.ok) throw new Error(spilled.error);
    expect(p0(spilled.state).hand).toHaveLength(data.combatConfig.handLimit);
    const drawn = spilled.events.find((e) => e.type === "cardsDrawn") as { instanceIds: string[] } | undefined;
    const dropped = spilled.events.find((e) => e.type === "cardDiscarded") as { instanceIds: string[] } | undefined;
    expect(drawn?.instanceIds).toHaveLength(1);
    expect(dropped?.instanceIds).toHaveLength(2);
    for (const id of dropped!.instanceIds) {
      expect(p0(spilled.state).discardPile).toContain(id);
      expect(p0(spilled.state).drawPile).not.toContain(id);
    }
  });

  it("T279: a Chiêm Bài pick on a full hand is discarded; unchosen options still bottom", () => {
    const { data, state } = makeTestCombat({ setup: (s) => { p0(s).moonPower = 99; } });
    const peek = injectCard(state, data, card({
      id: "test_peek", effects: [{ type: "chooseCard", look: 3 }],
    }));
    p0(state).hand = [peek, ...p0(state).drawPile.splice(0, data.combatConfig.handLimit)];
    const opened = applyAction(data, state, { type: "playCard", instanceId: peek });
    if (!opened.ok) throw new Error(opened.error);
    const pending = p0(opened.state).pendingChoice;
    if (pending?.kind !== "chooseCard") throw new Error("expected Chiêm Bài");
    const picked = applyAction(data, opened.state, { type: "chooseCard", instanceId: pending.options[0]! });
    if (!picked.ok) throw new Error(picked.error);
    const seat = p0(picked.state);
    expect(seat.hand).toHaveLength(data.combatConfig.handLimit);
    expect(seat.hand).not.toContain(pending.options[0]);
    expect(seat.discardPile).toContain(pending.options[0]);
    expect(picked.events).toContainEqual(expect.objectContaining({ type: "cardChosen", instanceId: pending.options[0] }));
    expect(picked.events).toContainEqual(expect.objectContaining({ type: "cardDiscarded", instanceIds: [pending.options[0]] }));
    for (const other of pending.options.slice(1)) expect(seat.drawPile).toContain(other);
  });
});
