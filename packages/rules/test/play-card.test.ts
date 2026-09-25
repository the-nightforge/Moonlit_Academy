import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { drawTwoCard } from "./fixtures";
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
          "m05_thuong_pha",
          "m05_tran_bac_huyet_tinh",
          "m05_bat_khuat",
          "f04_thao_duoc",
          "f04_bach_thao_huong",
          "f04_linh_chi_ho_the",
          "f04_tinh_tam_tra",
        ]),
    });
    const instanceId = injectCard(state, data, drawTwoCard);
    const discardBefore = state.discardPile.length;
    const result = applyAction(data, state, { type: "playCard", instanceId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hand).toHaveLength(11);
    expect(result.events.some((event) => event.type === "cardDiscarded")).toBe(false);
    expect(result.state.discardPile).toHaveLength(discardBefore + 1);
  });
});
