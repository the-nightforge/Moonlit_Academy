import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import {
  armorBreakCard,
  armorSixCard,
  chooseThreeCard,
  cleanseHealCard,
  healFiveCard,
  healSixCard,
  regenThreeCard,
} from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setHand } from "./helpers";

describe("playCard validation", () => {
  it("T04: rejects playCard when moonPower is below the card cost", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 1;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const before = JSON.stringify(state);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_liet_hoa_xung_phong"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("T05: rejects playCard for a card not in hand", () => {
    const { data, state } = makeTestCombat();
    const notInHand = state.drawPile[0]!;
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: notInHand,
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(false);
  });

  it("T06: rejects an enemy-target card aimed at a hero", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => setHand(s, ["m06_am_tien"]),
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "hero:m05",
    });
    expect(result.ok).toBe(false);
  });
});

describe("draw", () => {
  it("T09: drawn cards are not capped by hand size", () => {
    const { data, state } = makeTestCombat({
      setup: (s) =>
        setHand(s, [
          "m05_liet_hoa_xung_phong",
          "m05_ho_gam",
          "m05_tran_bac_huyet_tinh",
        ]),
    });
    for (const fixture of [
      armorBreakCard,
      healSixCard,
      healFiveCard,
      regenThreeCard,
      armorSixCard,
      cleanseHealCard,
    ]) {
      injectCard(state, data, fixture);
    }
    const top = state.drawPile.slice(0, 3);
    const instanceId = injectCard(state, data, chooseThreeCard);
    const result = applyAction(data, state, { type: "playCard", instanceId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("choosing");
    expect(result.state.pendingChoice).toEqual({ kind: "chooseCard", options: top });
    const picked = applyAction(data, result.state, { type: "chooseCard", instanceId: top[0]! });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.state.hand).toHaveLength(10);
    expect(picked.events.some((event) => event.type === "cardDiscarded")).toBe(false);
    expect(picked.state.discardPile).toContain(instanceId);
  });
});
