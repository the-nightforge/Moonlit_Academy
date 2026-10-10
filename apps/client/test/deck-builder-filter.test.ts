import { describe, expect, it } from "vitest";
import type { CardDef } from "rules";
import { matchesBuilderCard } from "../src/ui/deck-builder-filter";

const card = { name: "Nguyệt kiếm", text: "Gây sát thương và hồi phục", cost: 3 } as CardDef;
describe("deck editor collection filters", () => {
  it("combines descriptive search, cost and ownership/selection filters", () => {
    expect(matchesBuilderCard(card, { query: "hoi phuc", cost: 3, unlockedOnly: true, selectedOnly: true }, true, true)).toBe(true);
    expect(matchesBuilderCard(card, { query: "hoi phuc", cost: 2, unlockedOnly: true, selectedOnly: true }, true, true)).toBe(false);
    expect(matchesBuilderCard(card, { query: "", cost: null, unlockedOnly: true, selectedOnly: false }, false, false)).toBe(false);
    expect(matchesBuilderCard(card, { query: "", cost: null, unlockedOnly: false, selectedOnly: true }, true, false)).toBe(false);
  });
  it("matches high costs in the 8+ filter and keeps locked information visible without ownership filtering", () => {
    expect(matchesBuilderCard({ ...card, cost: 12 }, { query: "nguyet kiem", cost: 8, unlockedOnly: false, selectedOnly: false }, false, false)).toBe(true);
    expect(matchesBuilderCard(card, { query: "missing", cost: null, unlockedOnly: false, selectedOnly: false }, true, true)).toBe(false);
  });
});
