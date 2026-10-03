import { describe, expect, it, vi } from "vitest";
import { cardDefOf, cardOwners, viewFor } from "rules";
import type { UnitState } from "rules";
import { fixture } from "./helpers/combat-fixture";
import type { PublicPlayedCard } from "../src/net/protocol";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { resolvePlayedCard, seatAnchors, statusAppliedLabel, statusDisplayValue } = await import(
  "../src/ui/combat-display"
);

const withStatuses = (entries: { id: UnitState["statuses"][number]["id"]; value: number }[]) =>
  ({ statuses: entries }) as unknown as UnitState;

describe("cardOwners", () => {
  it("disambiguates equal defIds across seats — a seat-1 m05 card belongs to seat-1's m05", () => {
    const { state } = fixture("pvp");
    const m05Seat0 = state.heroes.find((hero) => hero.defId === "m05" && hero.player === 0)!;
    m05Seat0.leveledUp = true;
    const seat1Card = Object.values(state.cards).find(
      (instance) => instance.player === 1 && instance.ownerIds.includes("m05"),
    )!;
    expect(cardOwners(state, seat1Card)[0]?.player).toBe(1);
    expect(cardOwners(state, seat1Card)[0]?.leveledUp).toBe(false);
    // The defId-only lookup the renderer used before picks the wrong seat's hero.
    expect(state.heroes.find((hero) => hero.defId === "m05")!.player).toBe(0);
  });
});

describe("statusDisplayValue", () => {
  const { state: pvp } = fixture("pvp");
  const { state: pve } = fixture("pve");

  it("converts PvP half-round durations to displayed rounds; stacks stay raw", () => {
    const unit = withStatuses([
      { id: "freeze", value: 2 },
      { id: "strength", value: 5 },
    ]);
    expect(statusDisplayValue(pvp, unit, "freeze")).toBe(1);
    expect(statusDisplayValue(pvp, unit, "strength")).toBe(5);
    expect(statusDisplayValue(pvp, withStatuses([{ id: "weak", value: 3 }]), "weak")).toBe(2);
  });

  it("PvE shows the stored value", () => {
    expect(statusDisplayValue(pve, withStatuses([{ id: "weak", value: 3 }]), "weak")).toBe(3);
    expect(statusDisplayValue(pve, withStatuses([{ id: "strength", value: 5 }]), "strength")).toBe(5);
  });
});

describe("statusAppliedLabel", () => {
  const { data, state: pvp } = fixture("pvp");
  const unit = withStatuses([
    { id: "freeze", value: 2 },
    { id: "strength", value: 5 },
  ]);

  it("stacks use the short label with the raw total", () => {
    expect(statusAppliedLabel(pvp, unit, "strength", 5, data)).toBe("Mạnh → 5");
  });

  it("duration statuses use the full keyword name and display rounds", () => {
    expect(statusAppliedLabel(pvp, unit, "freeze", 2, data)).toBe("Đóng Băng → 1 vòng");
    expect(statusAppliedLabel(pvp, withStatuses([{ id: "weak", value: 2 }]), "weak", 4, data)).toBe(
      "Suy Yếu → 2 vòng",
    );
  });

  it("does not mutate the unit's statuses", () => {
    statusAppliedLabel(pvp, unit, "weak", 4, data);
    expect(unit.statuses.find((entry) => entry.id === "weak")).toBeUndefined();
    expect(unit.statuses.find((entry) => entry.id === "freeze")?.value).toBe(2);
  });
});

describe("resolvePlayedCard", () => {
  const { data, state } = fixture("pvp");
  const view0 = viewFor(state, 0);
  // A card in seat-1's hand is hidden from seat-0's view.
  const playedId = state.players[1]!.hand[0]!;
  const instance = state.cards[playedId]!;
  const definition = cardDefOf(data, state, instance)!;
  expect(view0.cards[playedId]).toBeUndefined();

  it("revealed metadata wins over the view lookups", () => {
    const revealed: Record<string, PublicPlayedCard> = { [playedId]: { instance, definition } };
    expect(resolvePlayedCard(data, view0, view0, playedId, revealed)?.definition.name).toBe(definition.name);
  });

  it("falls back to before, then after", () => {
    const before = { ...view0, cards: { ...view0.cards, [playedId]: instance } };
    expect(resolvePlayedCard(data, before, view0, playedId)?.instance.instanceId).toBe(playedId);
    const after = { ...view0, cards: { ...view0.cards, [playedId]: instance } };
    expect(resolvePlayedCard(data, view0, after, playedId)?.instance.instanceId).toBe(playedId);
    expect(resolvePlayedCard(data, view0, view0, playedId)).toBeUndefined();
  });
});

describe("seatAnchors", () => {
  it("the local seat and the remote seat anchor different zones", () => {
    const own = seatAnchors(0, 0, "pvp");
    const other = seatAnchors(1, 0, "pvp");
    expect(own.hand).not.toEqual(other.hand);
    expect(own.resource).not.toEqual(other.resource);
    expect(own.reserve).not.toEqual(other.reserve);
    expect(own.draw.y).toBeGreaterThan(other.draw.y); // own pile bottom row, theirs top row
    expect(own.discard.y).toBeGreaterThan(other.discard.y);
  });
});
