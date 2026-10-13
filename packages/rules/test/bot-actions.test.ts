import { describe, expect, it } from "vitest";
import type { Action, CardDef, CombatState, CoopSide, GameData } from "../src/index";
import {
  applyAction,
  createCoopCombat,
  createPvpCombat,
  getValidTargets,
  isCardPlayable,
  makeBotObservation,
} from "../src/index";
import { canonicalActionKey, enumerateBotActions } from "../src/bot/actions";
import { makeTestCombat, p0, testData, withoutDecrees } from "./helpers";
import { idleIntent, testCard } from "./fixtures";

function obs(
  data: GameData,
  state: CombatState,
  seat = 0,
  mode: "pve" | "pvp" | "coop" = state.mode as "pve" | "pvp" | "coop",
) {
  return makeBotObservation(data, state, seat, mode, [], null);
}

function keys(actions: readonly Action[]): string[] {
  return actions.map(canonicalActionKey);
}

function pvpSide(heroIds: [string, string, string]) {
  return { heroIds, loadout: { heroes: {}, pvp: true } };
}

function coopSide(heroIds: [string, string, string]): CoopSide {
  return { heroIds, loadout: { heroes: {} } };
}

/** A finished coop combat with both mulligans sent — shared turn open. */
function coopPlayerTurn(seed = 7): { data: GameData; state: CombatState } {
  const data = testData();
  withoutDecrees(data);
  for (const def of Object.values(data.enemies)) def.intents = [{ ...idleIntent, cost: 0 }];
  const side = coopSide(["m05", "f04", "m06"]);
  let state = createCoopCombat(data, {
    seed,
    players: [side, side],
    encounterId: "enc_coop_01",
  }).state;
  for (const seat of [0, 1]) {
    const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  }
  return { data, state };
}

describe("enumerateBotActions", () => {
  it("each_enumerated_action_applies_to_original_state", () => {
    // playerTurn: every enumerated action is legal on the authoritative state.
    const { data, state } = makeTestCombat();
    for (const action of enumerateBotActions(data, obs(data, state))) {
      const result = applyAction(data, state, action);
      expect(result.ok, `${JSON.stringify(action)} → ${result.ok ? "" : result.error}`).toBe(true);
    }

    // mulligan: subsets must resolve against the real piles, not placeholders.
    const pending = makeTestCombat({ mulligan: "pending" });
    for (const action of enumerateBotActions(pending.data, obs(pending.data, pending.state))) {
      const result = applyAction(pending.data, pending.state, action);
      expect(result.ok, `${JSON.stringify(action)} → ${result.ok ? "" : result.error}`).toBe(true);
    }

    // coop seat 1 (the shared turn): every enumerated action is legal.
    const coop = coopPlayerTurn();
    for (const action of enumerateBotActions(coop.data, obs(coop.data, coop.state, 1))) {
      const result = applyAction(coop.data, coop.state, action);
      expect(result.ok, `${JSON.stringify(action)} → ${result.ok ? "" : result.error}`).toBe(true);
    }
  });

  it("enumeration_ignores_hidden_variants", () => {
    const { data, state } = makeTestCombat();
    const variant = structuredClone(state) as CombatState;
    variant.rngState = 424242;
    variant.players[0]!.drawPile = [...variant.players[0]!.drawPile].reverse();
    for (const enemy of variant.enemies) {
      enemy.plannedIntents = enemy.plannedIntents.map((p) => ({ ...p, targetId: null }));
    }
    expect(keys(enumerateBotActions(data, obs(data, variant)))).toEqual(
      keys(enumerateBotActions(data, obs(data, state))),
    );
  });

  it("choosing_has_no_end_turn", () => {
    const { data, state } = makeTestCombat();
    // Force a pending Chiêm Bài without playing a card (the engine never
    // produces this directly mid-turn, but the gate is status+pendingChoice).
    const choosing = structuredClone(state) as CombatState;
    choosing.status = "choosing";
    p0(choosing).pendingChoice = {
      kind: "chooseCard",
      options: p0(choosing).drawPile.slice(0, 3),
    };
    const actions = enumerateBotActions(data, obs(data, choosing));
    expect(actions.length).toBe(3);
    expect(actions.every((a) => a.type === "chooseCard")).toBe(true);
    const choosingOptions = p0(choosing).pendingChoice!;
    if (choosingOptions.kind !== "chooseCard") throw new Error("fixture expected chooseCard");
    expect(new Set(actions.map((a) => (a as { instanceId: string }).instanceId))).toEqual(
      new Set(choosingOptions.options),
    );
    expect(actions.some((a) => a.type === "endTurn")).toBe(false);

    // chooseMoon variant: three offsets, still no endTurn.
    const moon = structuredClone(state) as CombatState;
    moon.status = "choosing";
    p0(moon).pendingChoice = { kind: "chooseMoon", options: [0, 1, 2] };
    const moonActions = enumerateBotActions(data, obs(data, moon));
    expect(new Set(moonActions.map((a) => (a as { offset: number }).offset))).toEqual(
      new Set([0, 1, 2]),
    );
    expect(moonActions.some((a) => a.type === "endTurn")).toBe(false);
  });

  it("mulligan_has_empty_and_all_valid_subsets", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    const hand = p0(state).hand;
    const cap = data.combatConfig.maxMulligan;
    const actions = enumerateBotActions(data, obs(data, state));
    const mulligans = actions.filter((a) => a.type === "mulligan");
    const subsets = new Set(mulligans.map((a) => canonicalActionKey(a)));
    // C(hand,0)+…+C(hand,cap) unique subsets, including the empty keep-all.
    let expected = 0;
    for (let k = 0; k <= Math.min(cap, hand.length); k++) {
      let choose = 1;
      for (let i = 0; i < k; i++) choose = (choose * (hand.length - i)) / (i + 1);
      expected += choose;
    }
    expect(mulligans.length).toBe(expected);
    expect(subsets.size).toBe(expected);
    expect(
      mulligans.some((a) => (a as { instanceIds: string[] }).instanceIds.length === 0),
    ).toBe(true);
    // No subset exceeds the cap; every id is a real hand card.
    for (const a of mulligans) {
      const ids = (a as { instanceIds: string[] }).instanceIds;
      expect(ids.length).toBeLessThanOrEqual(cap);
      for (const id of ids) expect(hand).toContain(id);
    }
    // Nothing but mulligan while the phase is open.
    expect(actions.every((a) => a.type === "mulligan")).toBe(true);
  });

  it("full_hand_dead_owner_taunt_and_fallen_targets", () => {
    // Dead owner: the hero's cards leave the enumeration entirely.
    const dead = makeTestCombat({
      setup: (s) => {
        const m05 = s.heroes.find((h) => h.defId === "m05")!;
        m05.alive = false;
        m05.hp = 0;
      },
    });
    const deadActions = enumerateBotActions(dead.data, obs(dead.data, dead.state));
    const deadPlays = deadActions.filter((a) => a.type === "playCard");
    for (const a of deadPlays) {
      const instance = dead.state.cards[(a as { instanceId: string }).instanceId]!;
      expect(instance.ownerIds).not.toContain("m05");
    }

    // PvP taunt: enemy-targeted cards may only pick the taunting hero.
    const pvpData = testData();
    withoutDecrees(pvpData);
    const pvp = createPvpCombat(pvpData, {
      seed: 3,
      players: [pvpSide(["m05", "f04", "m06"]), pvpSide(["f03", "f02", "m03"])],
    }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(pvpData, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp.heroes = r.state.heroes;
      pvp.players = r.state.players;
      pvp.cards = r.state.cards;
      pvp.status = r.state.status;
      pvp.activePlayer = r.state.activePlayer;
    }
    const active = pvp.activePlayer;
    const foeHeroes = pvp.heroes.filter((h) => h.player !== active);
    const taunter = foeHeroes[0]!;
    taunter.statuses = [...taunter.statuses, { id: "taunt", value: 1 }];
    const pvpObs = obs(pvpData, pvp, active, "pvp");
    const pvpActions = enumerateBotActions(pvpData, pvpObs);
    for (const a of pvpActions) {
      if (a.type !== "playCard" || a.targetId === undefined) continue;
      const instance = pvpObs.visibleState.cards[a.instanceId];
      if (!instance) continue; // opponent card placeholders are never enumerated
      const card = pvpData.cards[instance.cardId]!;
      if (card.target === "enemy") expect(a.targetId).toBe(taunter.id);
    }
    // The enumeration only offers legal targets — check one real targeted card.
    const targeted = pvpActions.filter(
      (a) => a.type === "playCard" && a.targetId !== undefined,
    );
    expect(targeted.length).toBeGreaterThan(0);

    // fallenAlly: no fallen heroes → the revive card is absent; one falls → only it.
    const reviveTeam = makeTestCombat({
      heroIds: ["f10", "f04", "m06"],
      setup: (s) => {
        const instance = Object.values(s.cards).find((c) => c.cardId === "f10_hoi_hon");
        if (instance === undefined) throw new Error("fixture needs f10_hoi_hon in deck");
        if (!p0(s).hand.includes(instance.instanceId)) {
          p0(s).drawPile = p0(s).drawPile.filter((id) => id !== instance.instanceId);
          p0(s).hand[0] = instance.instanceId;
        }
        p0(s).moonPower = 9;
      },
    });
    const noneFallen = enumerateBotActions(reviveTeam.data, obs(reviveTeam.data, reviveTeam.state));
    const reviveId = instanceOf(reviveTeam.state, "f10_hoi_hon");
    expect(
      noneFallen.some((a) => a.type === "playCard" && a.instanceId === reviveId),
    ).toBe(false);

    const fallen = makeTestCombat({
      heroIds: ["f10", "f04", "m06"],
      setup: (s) => {
        const instance = Object.values(s.cards).find((c) => c.cardId === "f10_hoi_hon");
        if (!p0(s).hand.includes(instance!.instanceId)) {
          p0(s).drawPile = p0(s).drawPile.filter((id) => id !== instance!.instanceId);
          p0(s).hand[0] = instance!.instanceId;
        }
        p0(s).moonPower = 9;
        const victim = s.heroes.find((h) => h.defId === "f04")!;
        victim.alive = false;
        victim.hp = 0;
      },
    });
    const fallenActions = enumerateBotActions(fallen.data, obs(fallen.data, fallen.state));
    const revivePlays = fallenActions.filter(
      (a): a is Extract<Action, { type: "playCard" }> =>
        a.type === "playCard" && a.instanceId === instanceOf(fallen.state, "f10_hoi_hon"),
    );
    expect(revivePlays.length).toBe(1);
    expect(revivePlays[0]!.targetId).toBe("hero:f04");
  });

  it("lunar_discard_and_blood_pact_limits", () => {
    // Xả Thân: discard appears only under the decree, one per hand card,
    // and disappears at the per-turn cap.
    const xaThan = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 5, decrees: { waningGibbous: "xa_than" } },
      mutateData: (d) => {
        for (const def of Object.values(d.enemies)) def.intents = [{ ...idleIntent, cost: 0 }];
      },
    });
    const discardActions = enumerateBotActions(xaThan.data, obs(xaThan.data, xaThan.state));
    const discards = discardActions.filter((a) => a.type === "discardCard");
    expect(discards.length).toBe(p0(xaThan.state).hand.length);
    const used = structuredClone(xaThan.state) as CombatState;
    p0(used).discardsThisTurn = 99;
    expect(
      enumerateBotActions(xaThan.data, obs(xaThan.data, used)).filter(
        (a) => a.type === "discardCard",
      ).length,
    ).toBe(0);

    // No decree → no discard at all.
    const plain = makeTestCombat();
    expect(
      enumerateBotActions(plain.data, obs(plain.data, plain.state)).some(
        (a) => a.type === "discardCard" || a.type === "bloodPact",
      ),
    ).toBe(false);

    // Huyết Tế: one bloodPact per living hero that can pay the cost; none once used.
    const huyetTe = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 5, decrees: { waningGibbous: "huyet_te" } },
      mutateData: (d) => {
        for (const def of Object.values(d.enemies)) def.intents = [{ ...idleIntent, cost: 0 }];
      },
    });
    const pactRule = huyetTe.data.moonPhases[5]!.decrees.find((d) => d.id === "huyet_te")!
      .modifiers[0] as { type: "bloodPact"; hp: number; draw: number };
    const pactActions = enumerateBotActions(huyetTe.data, obs(huyetTe.data, huyetTe.state));
    const pacts = pactActions.filter((a) => a.type === "bloodPact");
    const eligible = huyetTe.state.heroes.filter((h) => h.alive && h.hp > pactRule.hp);
    expect(pacts.length).toBe(eligible.length);
    for (const a of pacts) {
      const hero = huyetTe.state.heroes.find((h) => h.id === (a as { heroId: string }).heroId)!;
      expect(hero.alive && hero.hp > pactRule.hp).toBe(true);
    }
    const spent = structuredClone(huyetTe.state) as CombatState;
    p0(spent).bloodPactUsed = true;
    expect(
      enumerateBotActions(huyetTe.data, obs(huyetTe.data, spent)).some(
        (a) => a.type === "bloodPact",
      ),
    ).toBe(false);
  });

  it("covers every getValidTargets target, never emits system actions, keys are unique", () => {
    const { data, state } = makeTestCombat();
    const observation = obs(data, state);
    const actions = enumerateBotActions(data, observation);
    // Every legal target of every playable targeted card is enumerated.
    for (const instanceId of observation.visibleState.players[0]!.hand) {
      const instance = observation.visibleState.cards[instanceId]!;
      const card = data.cards[instance.cardId]!;
      if (card.target === "none" || !isCardPlayable(data, observation.visibleState, instanceId)) {
        continue;
      }
      const targets = getValidTargets(data, observation.visibleState, instanceId);
      for (const targetId of targets) {
        expect(
          actions.some(
            (a) => a.type === "playCard" && a.instanceId === instanceId && a.targetId === targetId,
          ),
          `missing playCard ${instanceId} → ${targetId}`,
        ).toBe(true);
      }
    }
    // No system-only shapes.
    expect(actions.some((a) => a.type === "forfeit")).toBe(false);
    expect(actions.some((a) => a.type === "surrender")).toBe(false);
    expect(
      actions.some((a) => a.type === "endTurn" && (a as { system?: boolean }).system === true),
    ).toBe(false);
    // Keys unique.
    const keySet = new Set(keys(actions));
    expect(keySet.size).toBe(actions.length);
    // Inactive seat: PvP seat waiting on the opponent gets an empty list.
    const pvpData = testData();
    withoutDecrees(pvpData);
    let pvp = createPvpCombat(pvpData, {
      seed: 3,
      players: [pvpSide(["m05", "f04", "m06"]), pvpSide(["f03", "f02", "m03"])],
    }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(pvpData, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const waiting = 1 - pvp.activePlayer;
    expect(enumerateBotActions(pvpData, obs(pvpData, pvp, waiting, "pvp")).length).toBe(0);
    // A finished co-op seat likewise.
    const coop = coopPlayerTurn();
    const done = structuredClone(coop.state) as CombatState;
    done.players[1]!.done = true;
    expect(enumerateBotActions(coop.data, obs(coop.data, done, 1, "coop")).length).toBe(0);
  });

  it("coop partner enumerates own cards and answers own choices, plus endTurn while pending", () => {
    const { data, state } = coopPlayerTurn();
    const seat1 = enumerateBotActions(data, obs(data, state, 1, "coop"));
    expect(seat1.some((a) => a.type === "endTurn")).toBe(true);
    const seat1Hand = new Set(state.players[1]!.hand);
    for (const a of seat1) {
      if (a.type === "playCard") expect(seat1Hand.has(a.instanceId)).toBe(true);
      expect(a.player).toBe(1);
    }
    // Pending Chiêm Bài on the seat: choices + endTurn only.
    const pending = structuredClone(state) as CombatState;
    pending.players[1]!.pendingChoice = {
      kind: "chooseCard",
      options: pending.players[1]!.drawPile.slice(0, 2),
    };
    const pendingActions = enumerateBotActions(data, obs(data, pending, 1, "coop"));
    const types = new Set(pendingActions.map((a) => a.type));
    expect(types.has("chooseCard")).toBe(true);
    expect(types.has("endTurn")).toBe(true);
    expect(types.has("playCard")).toBe(false);
  });
});

function instanceOf(state: CombatState, cardId: string): string {
  return Object.values(state.cards).find((c) => c.cardId === cardId)!.instanceId;
}

describe("canonicalActionKey", () => {
  it("mulligan order is canonicalized without touching play order", () => {
    const a: Action = { type: "mulligan", instanceIds: ["c02", "c01"], player: 0 };
    const b: Action = { type: "mulligan", instanceIds: ["c01", "c02"], player: 0 };
    expect(canonicalActionKey(a)).toBe(canonicalActionKey(b));
    expect(canonicalActionKey(a)).not.toBe(
      canonicalActionKey({ type: "mulligan", instanceIds: ["c01"], player: 0 }),
    );
  });
});
