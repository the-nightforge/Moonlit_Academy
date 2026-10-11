import { describe, expect, it } from "vitest";
import type { GameData, SavedDeck } from "rules";
import { createProfile } from "rules";
import { loadGameData } from "data";
import { matchesDeckText, summarizeDeck } from "../src/ui/deck-presentation";

const data = {
  cards: {
    a: { ownerId: "h1", cost: 2, copies: 3 },
    b: { ownerId: "h2", cost: 10, copies: 2 },
    c: { ownerId: "h1", cost: 0, copies: 1 },
  },
  weapons: { w: { card: { cost: 4, copies: 2 }, refinement: [], hooks: [] } },
} as unknown as GameData;
const deck: SavedDeck = { id: "d1", name: "Test", heroIds: ["h1", "h2", "h3"], cardIds: ["a", "b", "c"], weapons: { h1: "w", h2: null }, relicIds: ["r1", "r2"] };

describe("deck presentation", () => {
  it("uses owned weapon refinement in normal view and R1 in PvP", () => {
    const gameData = loadGameData();
    const profile = createProfile(gameData);
    profile.weapons.w_xich_diem_thuong = { refinement: 3 };
    const draft: SavedDeck = { id: "", name: "Refined", heroIds: ["m05", "f04", "m06"], cardIds: [], weapons: { m05: "w_xich_diem_thuong" } };
    const normal = summarizeDeck(gameData, draft, { profile });
    const pvp = summarizeDeck(gameData, draft, { profile, mode: "pvp" });
    expect(normal.averageCost).toBe(3);
    expect(normal.curve[3]).toBe(2);
    expect(pvp.averageCost).toBe(4);
    expect(pvp.curve[4]).toBe(2);
  });
  it("weapons add battle copies without occupying slots, relics use none", () => {
    expect(summarizeDeck(data, deck)).toEqual({ slots: 3, copies: 8, cardCopies: 6, weaponCopies: 2, averageCost: 34 / 8, curve: [1, 0, 3, 0, 2, 0, 0, 0, 2], heroCounts: { h1: 2, h2: 1, h3: 0 } });
  });
  it("handles empty or unknown cards without NaN or changing a draft", () => {
    const draft = { ...deck, cardIds: ["missing"], weapons: {} };
    const before = JSON.stringify(draft);
    const stats = summarizeDeck(data, draft);
    expect(stats.slots).toBe(1);
    expect(stats.copies).toBe(0);
    expect(stats.averageCost).toBe(0);
    expect(stats.curve).toEqual(Array(9).fill(0));
    expect(JSON.stringify(draft)).toBe(before);
  });
  it("searches Vietnamese names and descriptions without accents and treats spaces literally", () => {
    expect(matchesDeckText("  nguyet dao  ", "Nguyệt Đao", "Khác")).toBe(true);
    expect(matchesDeckText("HOI PHUC", "Chiến binh", "Hồi phục đồng đội")).toBe(true);
    expect(matchesDeckText("[", "Nguyệt Đao")).toBe(false);
    expect(matchesDeckText("", "")).toBe(true);
  });
});
