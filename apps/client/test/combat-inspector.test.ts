import { describe, expect, it, vi } from "vitest";
import { viewFor } from "rules";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { pileModel, relicHudEntries, drawComposition, triggerAnchorKey } = await import(
  "../src/ui/combat-inspector"
);

describe("pileModel — Chồng rút stays a count in every mode (`05` review)", () => {
  const { data, state } = fixture("pve");

  it("own PvE draw pile: count only, never the order", () => {
    const seat = state.players[0]!;
    const model = pileModel(data, state, seat.index, "draw", seat.index);
    expect(model.hidden).toBe(true);
    expect(model.cards).toEqual([]);
    expect(model.count).toBe(seat.drawPile.length);
  });

  it("opponent PvP draw pile: redacted ids never resolve to definitions", () => {
    const { data, state } = fixture("pvp");
    const mySeat = 0;
    const view = viewFor(state, mySeat);
    const other = view.players[1]!;
    const model = pileModel(data, view, other.index, "draw", mySeat);
    expect(model).toMatchObject({ hidden: true, cards: [] });
    expect(model.count).toBe(other.drawPile.length);
  });

  it("own draw still tells the player what their deck can hold — counts only", () => {
    const seat = state.players[0]!;
    // The composition aggregates identities (never order): deck knowledge is the player's own.
    const composition = drawComposition(data, state, seat.index);
    if (!composition) throw new Error("expected visible draw composition for own seat");
    expect(composition.reduce((sum, entry) => sum + entry.count, 0)).toBe(seat.drawPile.length);
  });
});

describe("pileModel — Chồng bỏ is public information", () => {
  const { data, state } = fixture("pve");

  it("own discard lists every card with its definition", () => {
    const seat = state.players[0]!;
    const discard = pileModel(data, state, seat.index, "discard", seat.index);
    expect(discard.hidden).toBe(false);
    expect(discard.cards.map((card) => card.instanceId)).toEqual(seat.discardPile);
    expect(discard.count).toBe(seat.discardPile.length);
    for (const card of discard.cards) expect(card.definition.name.length).toBeGreaterThan(0);
  });

  it("opponent discard resolves public ids; a redacted sentinel never fabricates a card", () => {
    const { data, state } = fixture("pvp");
    // Push real played cards into the opponent's discard like a resolved play would.
    const view = viewFor(state, 0);
    const other = view.players[1]!;
    const realId = Object.values(state.cards).find((card) => card.player === other.index)!.instanceId;
    // A card landing in the discard stays public in the seat's view (`17` §4.8).
    view.cards[realId] = state.cards[realId]!;
    other.discardPile = [realId, "hidden_deck_3"];
    const model = pileModel(data, view, other.index, "discard", 0);
    expect(model.hidden).toBe(false);
    expect(model.count).toBe(2);
    expect(model.cards.map((card) => card.instanceId)).toEqual([realId]);
  });
});

describe("relicHudEntries — moon relics, Kỳ Vật and Lõi for one seat", () => {
  const { data, state } = fixture("pve");
  const seat = state.players[0]!;

  it("labels each kind and keeps resonance as the count", () => {
    seat.relics = [{ id: "r_thien_sach", resonance: 2 }];
    seat.runRelicIds = ["nguyet_giap_phu", "aug_nguyet_trieu"];
    const entries = relicHudEntries(data, state, seat.index);
    expect(entries.map((entry) => entry.kind)).toEqual(["relic", "runRelic", "augment"]);
    expect(entries[0]).toMatchObject({ id: "r_thien_sach", count: 2 });
    expect(entries[0]!.name).toBe(data.relics.r_thien_sach!.name);
    // The description reads the relic's *current* resonance level, not level 1.
    expect(entries[0]!.description).toBe(data.relics.r_thien_sach!.resonance[1]!.text);
    expect(entries[1]!.name).toBe(data.runRelics.nguyet_giap_phu!.name);
    expect(entries[2]!.name).toBe(data.augments.aug_nguyet_trieu!.name);
  });

  it("a removed/unknown relic still renders a name — never crashes", () => {
    seat.relics = [];
    seat.runRelicIds = ["rr_gone_forever"];
    const entries = relicHudEntries(data, state, seat.index);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("rr_gone_forever");
    expect(entries[0]!.description.length).toBeGreaterThanOrEqual(0);
  });
});

describe("trigger anchors — relic/runRelic/weapon flashes land on their icon", () => {
  it("the key format the scene's anchor map and the animator share", () => {
    expect(triggerAnchorKey(1, "runRelic", "nguyet_giap_phu")).toBe("1:runRelic:nguyet_giap_phu");
    expect(triggerAnchorKey(0, "relic", "r_thien_sach")).toBe("0:relic:r_thien_sach");
    expect(triggerAnchorKey(1, "weapon", "w_puppet_blade")).toBe("1:weapon:w_puppet_blade");
  });
});
