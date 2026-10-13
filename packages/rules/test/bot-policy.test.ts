import { describe, expect, it } from "vitest";
import type { Action, CardDef, CombatState, GameData } from "../src/index";
import { applyAction, makeBotObservation } from "../src/index";
import { canonicalActionKey, enumerateBotActions } from "../src/bot/actions";
import { actionFeatures, type FeatureName } from "../src/bot/features";
import {
  chooseBotAction,
  scoreBotAction,
  type BotContext,
  type BotProfile,
  type Skill,
  type Style,
} from "../src/bot/policy";
import { injectCard, makeTestCombat, p0, heroByDefId } from "./helpers";
import { testCard } from "./fixtures";
import { loadProfiles } from "./playtest-bot";

const CTX: BotContext = { policySeed: 123, beliefSeed: 456 };

function profile(
  style: Style,
  weights: Partial<Record<FeatureName, number>>,
  skill: Skill = "regular",
  extra: Partial<BotProfile> = {},
): BotProfile {
  return {
    id: `test-${skill}-${style}`,
    version: "1",
    skill,
    style,
    mistakeRate: 0,
    temperature: 0,
    weights,
    search: { maxExpansions: 0, depth: 0, beamWidth: 0, samples: 0 },
    ...extra,
  };
}

function obs(data: GameData, state: CombatState) {
  return makeBotObservation(data, state, 0, "pve", [], null);
}

/** Hand = exactly `cards` (injected); enough Nguyệt Lực to play anything. */
function handOf(state: CombatState, data: GameData, cards: CardDef[]): string[] {
  const ids = cards.map((card) => injectCard(state, data, card));
  p0(state).hand = ids;
  p0(state).moonPower = 8;
  return ids;
}

function legalKeys(data: GameData, state: CombatState): Set<string> {
  return new Set(enumerateBotActions(data, obs(data, state)).map(canonicalActionKey));
}

describe("bot-policy situations", () => {
  it("cheap_lethal_beats_expensive_overkill", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        for (const enemy of s.enemies) enemy.hp = 2;
      },
    });
    const cheap = testCard({ id: "t_cheap_kill", cost: 1, target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });
    const costly = testCard({ id: "t_costly_overkill", cost: 5, target: "enemy", effects: [{ type: "damage", amount: 20, to: "chosen" }] });
    const [cheapId] = handOf(state, data, [cheap, costly]) as [string, string];

    const aggressive = profile("aggressive", { damage: 3, lethal: 4, overkill: -0.5, cost: -0.2 });
    const decision = chooseBotAction(data, obs(data, state), aggressive, CTX);
    expect(decision).not.toBeNull();
    expect(decision!.action).toMatchObject({ type: "playCard", instanceId: cheapId });
  });

  it("prevent_own_lethal_beats_draw", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        for (const def of Object.values(d.enemies)) {
          def.intents = [{ id: "t_kill", name: "K", kind: "attack", cost: 0, effects: [{ type: "damage", amount: 9, to: "chosen" }] }];
        }
      },
      setup: (s) => {
        heroByDefId(s, "m05").hp = 4;
      },
    });
    const heal = testCard({ id: "t_heal", cost: 1, ownerId: "f04", target: "ally", effects: [{ type: "heal", amount: 5, to: "chosen" }] });
    const draw = testCard({ id: "t_draw", cost: 1, effects: [{ type: "drawCards", amount: 2 }] });
    const [healId] = handOf(state, data, [heal, draw]) as [string, string];

    const defensive = profile("defensive", { heal: 2, preventLethal: 5, draw: 0.5 });
    const decision = chooseBotAction(data, obs(data, state), defensive, CTX);
    expect(decision!.action).toMatchObject({ type: "playCard", instanceId: healId });
  });

  it("heal_avoids_full_hp_target", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        heroByDefId(s, "m05").hp = 3;
      },
    });
    const heal = testCard({ id: "t_heal", cost: 1, ownerId: "f04", target: "ally", effects: [{ type: "heal", amount: 5, to: "chosen" }] });
    const [healId] = handOf(state, data, [heal]) as [string];

    const wounded = heroByDefId(state, "m05");
    const full = heroByDefId(state, "f04");
    const hurt: Action = { type: "playCard", instanceId: healId, targetId: wounded.id };
    const topped: Action = { type: "playCard", instanceId: healId, targetId: full.id };
    const defensive = profile("defensive", { heal: 2, overheal: -1 });
    expect(scoreBotAction(data, obs(data, state), hurt, defensive)).toBeGreaterThan(
      scoreBotAction(data, obs(data, state), topped, defensive),
    );
  });

  it("guard_avoids_its_own_source", () => {
    const { data, state } = makeTestCombat();
    const guard = testCard({ id: "t_guard", cost: 1, ownerId: "m05", target: "ally", effects: [{ type: "applyStatus", status: "guard", amount: 1, to: "chosen" }] });
    const [guardId] = handOf(state, data, [guard]) as [string];

    const self = heroByDefId(state, "m05");
    const ally = heroByDefId(state, "f04");
    const onSelf: Action = { type: "playCard", instanceId: guardId, targetId: self.id };
    const onAlly: Action = { type: "playCard", instanceId: guardId, targetId: ally.id };
    const defensive = profile("defensive", { control: 1 });
    expect(scoreBotAction(data, obs(data, state), onAlly, defensive)).toBeGreaterThan(
      scoreBotAction(data, obs(data, state), onSelf, defensive),
    );
  });

  it("combo_ordering_beats_cost_ordering", () => {
    const { data, state } = makeTestCombat();
    const setupCard = testCard({ id: "t_setup", cost: 1, target: "enemy", effects: [{ type: "damage", amount: 1, to: "chosen" }] });
    const payoff = testCard({
      id: "t_payoff", cost: 3, target: "enemy",
      effects: [{ type: "scaledDamage", per: "cardsPlayedThisTurn", amount: 5, base: 2, to: "chosen" }],
    });
    const [setupId, payoffId] = handOf(state, data, [setupCard, payoff]) as [string, string];

    const enemy = state.enemies[0]!;
    const setupHit: Action = { type: "playCard", instanceId: setupId, targetId: enemy.id };
    const payoffHit: Action = { type: "playCard", instanceId: payoffId, targetId: enemy.id };
    const combo = profile("combo", { synergy: 4, damage: 1 });
    const o = obs(data, state);
    // Enabler first: the payoff is weakest before any card has been played.
    expect(scoreBotAction(data, o, setupHit, combo)).toBeGreaterThan(
      scoreBotAction(data, o, payoffHit, combo),
    );
    // After cards have been played the same profile prefers the payoff — ordering, not cost.
    p0(state).cardsPlayedThisTurn = 3;
    const o2 = obs(data, state);
    expect(scoreBotAction(data, o2, payoffHit, combo)).toBeGreaterThan(
      scoreBotAction(data, o2, setupHit, combo),
    );
  });

  it("hold_and_shift_can_justify_end_turn", () => {
    // Tích Tụ: the card's reward needs heldTurns ≥ 2 — playing now gets nothing.
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        // Landing anywhere off the current phase empowers the enemy — shifting is bad.
        const bad = d.moonPhases[2]!.id;
        for (const def of Object.values(d.enemies)) {
          def.moonOverrides = [{ phase: bad, intent: { id: "t_bad", name: "B", kind: "attack", effects: [] } }];
        }
      },
    });
    const held = testCard({
      id: "t_tich_tu", cost: 1,
      effects: [{
        type: "conditional",
        condition: { type: "heldTurnsAtLeast", turns: 2 },
        then: [{ type: "applyStatus", status: "strength", amount: 2, to: "self" }],
      }],
    });
    const shift = testCard({ id: "t_shift", cost: 1, effects: [{ type: "shiftMoon", amount: 1 }] });
    handOf(state, data, [held, shift]);

    const tempo = profile("tempo", { reserve: 2, hold: 1, moon: 2, control: 1 });
    const decision = chooseBotAction(data, obs(data, state), tempo, CTX);
    expect(decision!.action).toMatchObject({ type: "endTurn" });
  });

  it("style_changes_ambiguous_action", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        for (const def of Object.values(d.enemies)) {
          def.intents = [{ id: "t_kill", name: "K", kind: "attack", cost: 0, effects: [{ type: "damage", amount: 9, to: "chosen" }] }];
        }
      },
      setup: (s) => {
        heroByDefId(s, "m05").hp = 4;
      },
    });
    const strike = testCard({ id: "t_strike", cost: 1, target: "enemy", effects: [{ type: "damage", amount: 6, to: "chosen" }] });
    const armor = testCard({ id: "t_armor", cost: 1, ownerId: "f04", target: "ally", effects: [{ type: "gainArmor", amount: 6, to: "chosen" }] });
    handOf(state, data, [strike, armor]);

    const o = obs(data, state);
    const legal = legalKeys(data, state);
    const aggressive = profile("aggressive", { damage: 4, lethal: 5 });
    const defensive = profile("defensive", { heal: 3, preventLethal: 6 });
    const a = chooseBotAction(data, o, aggressive, CTX)!.action;
    const d = chooseBotAction(data, o, defensive, CTX)!.action;
    expect(legal.has(canonicalActionKey(a))).toBe(true);
    expect(legal.has(canonicalActionKey(d))).toBe(true);
    expect(canonicalActionKey(a)).not.toBe(canonicalActionKey(d));
  });

  it("seeded_noise_repeats", () => {
    const { data, state } = makeTestCombat();
    const strike = testCard({ id: "t_a", cost: 1, target: "enemy", effects: [{ type: "damage", amount: 4, to: "chosen" }] });
    const draw = testCard({ id: "t_b", cost: 1, effects: [{ type: "drawCards", amount: 1 }] });
    handOf(state, data, [strike, draw]);

    const noisy = profile("tempo", { damage: 1, draw: 1 }, "regular", { temperature: 0.7 });
    const first = chooseBotAction(data, obs(data, state), noisy, CTX)!.action;
    const second = chooseBotAction(data, obs(data, state), noisy, CTX)!.action;
    expect(canonicalActionKey(first)).toBe(canonicalActionKey(second));
  });

  it("mistake_policy_never_selects_invalid_action", () => {
    const { data, state } = makeTestCombat();
    const sloppy = profile("tempo", { damage: 1 }, "novice", { mistakeRate: 1 });
    const legal = legalKeys(data, state);
    for (let seed = 1; seed <= 30; seed++) {
      const decision = chooseBotAction(data, obs(data, state), sloppy, { policySeed: seed, beliefSeed: 0 });
      expect(decision).not.toBeNull();
      expect(legal.has(canonicalActionKey(decision!.action))).toBe(true);
    }
  });
});

describe("profiles.v1.json", () => {
  it("twelve_profiles_pinned_budgets_zero_noise", () => {
    const profiles = loadProfiles();
    expect(profiles).toHaveLength(12);
    const budgets: Record<Skill, number> = { novice: 0, regular: 512, advanced: 2048 };
    for (const p of profiles) {
      expect(p.mistakeRate).toBe(0);
      expect(p.temperature).toBe(0);
      expect(p.search.maxExpansions).toBe(budgets[p.skill]);
    }
    expect(new Set(profiles.map((p) => p.id)).size).toBe(12);
    expect(new Set(profiles.map((p) => p.skill)).size).toBe(3);
    expect(new Set(profiles.map((p) => p.style)).size).toBe(4);
  });

  it("decisions_explainable_via_action_scores", () => {
    const { data, state } = makeTestCombat();
    const all = loadProfiles();
    const decision = chooseBotAction(data, obs(data, state), all[4]!, CTX)!;
    const legal = enumerateBotActions(data, obs(data, state));
    expect(decision.actionScores).toHaveLength(legal.length);
    const keys = new Set(decision.actionScores.map((s) => s.key));
    for (const action of legal) expect(keys.has(canonicalActionKey(action))).toBe(true);
  });

  it("T329: missingHpDamage is valued by the caster's missing HP, not the target's", () => {
    const rage = testCard({
      id: "t_rage",
      type: "attack",
      target: "enemy",
      effects: [
        { type: "loseHp", amount: 3, to: "self" },
        { type: "missingHpDamage", ratio: 1, to: "chosen" },
      ],
    });
    const plain = testCard({
      id: "t_plain",
      type: "attack",
      target: "enemy",
      effects: [{ type: "damage", amount: 8, to: "chosen" }],
    });
    const aggro = profile("aggressive", { damage: 3, selfDamage: -0.5 });
    const { data, state } = makeTestCombat();
    const [rageId, plainId] = handOf(state, data, [rage, plain]) as [string, string];

    // Full HP: the payoff resolves to ~loseHp ⇒ the plain 8 damage wins.
    let decision = chooseBotAction(data, obs(data, state), aggro, CTX);
    expect(decision!.action).toMatchObject({ type: "playCard", instanceId: plainId });

    // Wounded by 30: the payoff reads ~30 and beats the plain hit.
    state.heroes[0]!.hp = state.heroes[0]!.maxHp - 30;
    decision = chooseBotAction(data, obs(data, state), aggro, CTX);
    expect(decision!.action).toMatchObject({ type: "playCard", instanceId: rageId });
  });

  it("T330: calling blood moon gains synergy from gated cards and riders in hand", () => {
    const call = testCard({
      id: "t_call",
      effects: [{ type: "bloodMoon", rounds: 1 }],
    });
    const gated = testCard({
      id: "t_gated",
      type: "attack",
      target: "enemy",
      requiresBloodMoon: true,
      effects: [{ type: "damage", amount: 18, to: "chosen" }],
    });
    const rider = testCard({
      id: "t_rider",
      type: "attack",
      target: "enemy",
      effects: [
        {
          type: "conditional",
          condition: { type: "bloodMoonActive" },
          then: [{ type: "damage", amount: 8, to: "chosen" }],
          else: [{ type: "damage", amount: 5, to: "chosen" }],
        },
      ],
    });
    const plain = testCard({ id: "t_plain2", effects: [{ type: "drawCards", amount: 1 }] });

    const { data, state } = makeTestCombat();
    const [callId] = handOf(state, data, [call, gated, rider]);
    const vec = actionFeatures(data, obs(data, state), { type: "playCard", instanceId: callId! });
    expect(vec.synergy).toBe(1.5); // gated card 1 + conditional rider 0.5

    const bare = makeTestCombat();
    const [callId2] = handOf(bare.state, bare.data, [call, plain]);
    const vec2 = actionFeatures(bare.data, obs(bare.data, bare.state), {
      type: "playCard",
      instanceId: callId2!,
    });
    expect(vec2.synergy ?? 0).toBe(0);
  });
});
