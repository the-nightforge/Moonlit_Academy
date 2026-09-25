import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand } from "./helpers";

function play(data: Parameters<typeof applyAction>[0], state: Parameters<typeof applyAction>[1], cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

describe("card damage", () => {
  it("T10: Liet Hoa Xung Phong deals 8 at full hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = play(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(34);
    const damage = result.events.find((event) => event.type === "damageDealt");
    expect(damage).toMatchObject({ sourceId: "hero:m05", targetId: "enemy:0", amount: 8, blocked: 0, hpLost: 8 });
    expect(result.state.moonPower).toBe(7);
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.discardPile).toContain(
      instanceIdOf(state, "m05_liet_hoa_xung_phong"),
    );
  });

  it("T11: Liet Hoa Xung Phong deals 12 when owner below 50% hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.heroes[0]!.hp = 19;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = play(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(30);
  });

  it("T12: selfHpBelow is strictly below (50% exactly deals 8)", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.heroes[0]!.hp = 20;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = play(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(34);
  });

  it("T13: armor blocks before hp", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        s.enemies[0]!.armor = 5;
        setHand(s, ["m05_liet_hoa_xung_phong"]);
      },
    });
    const result = play(data, state, "m05_liet_hoa_xung_phong", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.armor).toBe(0);
    expect(result.state.enemies[0]?.hp).toBe(39);
    const damage = result.events.find((event) => event.type === "damageDealt");
    expect(damage).toMatchObject({ blocked: 5, hpLost: 3 });
  });

  it("T14: Thuong Pha removes armor then damages", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.armor = 8;
        setHand(s, ["m05_thuong_pha"]);
      },
    });
    const result = play(data, state, "m05_thuong_pha", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.armor).toBe(0);
    expect(result.state.enemies[0]?.hp).toBe(37);
  });

  it("T20: Song Nhan Loan Vu hits every enemy", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonPower = 11;
        setHand(s, ["m06_song_nhan_loan_vu"]);
      },
    });
    const result = play(data, state, "m06_song_nhan_loan_vu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(37);
    expect(result.state.enemies[1]?.hp).toBe(19);
    expect(result.events.filter((event) => event.type === "damageDealt")).toHaveLength(2);
  });
});
