import {
  injectCard,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  testData,
  withLevelUp,
  withoutDecrees,
} from "./helpers";
import { describe, expect, it } from "vitest";
import {
  applyAction,
  autoChoiceAction,
  chooseCombatAction,
  createCoopCombat,
  type GameData,
} from "../src/index";
import { chooseThreeCard } from "./fixtures";


describe("Chọn Pha", () => {
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
    withoutDecrees(data); // no Bói Nguyệt Chiêm Bài ahead of Chọn Pha (`01` §3.1)
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
    withoutDecrees(data); // no Bói Nguyệt Chiêm Bài ahead of Chọn Pha (`01` §3.1)
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

