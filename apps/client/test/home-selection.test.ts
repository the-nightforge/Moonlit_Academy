import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile, starterDeck } from "rules";
import type { SavedDeck } from "rules";
import { homeDecks, resolveHomeDeck, savedLobbyDeckIndex, starterDeckId } from "../src/home-selection";
import type { Team } from "../src/session";

const data = loadGameData();
const TEAM: Team = ["m05", "f04", "m06"];
const OTHER_TEAM: Team = ["m07", "f01", "m02"];

function deck(id: string, name: string, heroIds: Team): SavedDeck {
  return { id, name, heroIds: [...heroIds] as Team, cardIds: starterDeck(data, heroIds) };
}

function fixture() {
  const profile = createProfile(data);
  for (const heroId of [...TEAM, ...OTHER_TEAM]) profile.heroes[heroId] ??= { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
  profile.decks.push(deck("d1", "Một", TEAM), deck("d2", "Hai", OTHER_TEAM));
  return profile;
}

describe("home deck selection", () => {
  it("starterDeckId keeps team order", () => {
    expect(starterDeckId(TEAM)).toBe("starter:m05+f04+m06");
    expect(starterDeckId(["f04", "m05", "m06"])).not.toBe(starterDeckId(TEAM));
  });

  it("homeDecks lists the current team's starter, starters of saved teams, then saved decks", () => {
    const decks = homeDecks(data, fixture(), TEAM);
    expect(decks.map((entry) => entry.id)).toEqual(["starter:m05+f04+m06", "starter:m07+f01+m02", "d1", "d2"]);
    expect(decks[0]!.name).toBe("Bộ cơ bản");
  });

  it("resolveHomeDeck returns the selected deck while its id exists", () => {
    const profile = fixture();
    expect(resolveHomeDeck(data, profile, TEAM, "d2").id).toBe("d2");
    expect(resolveHomeDeck(data, profile, TEAM, "starter:m07+f01+m02").id).toBe("starter:m07+f01+m02");
  });

  it("resolveHomeDeck falls back to the current team's starter when the id is gone", () => {
    const profile = fixture();
    const resolved = resolveHomeDeck(data, profile, TEAM, "d9");
    expect(resolved.id).toBe("starter:m05+f04+m06");
    expect(resolved.heroIds).toEqual(TEAM);
    // A deleted starter (its saved team vanished) also resolves to the current starter.
    expect(resolveHomeDeck(data, profile, TEAM, "starter:f09+f08+f07").id).toBe("starter:m05+f04+m06");
  });

  it("resolveHomeDeck does not mutate the profile", () => {
    const profile = fixture();
    const before = JSON.stringify(profile);
    resolveHomeDeck(data, profile, TEAM, "d2");
    homeDecks(data, profile, TEAM);
    expect(JSON.stringify(profile)).toBe(before);
  });

  it("savedLobbyDeckIndex maps only saved ids — starters and unknowns stay -1", () => {
    const profile = fixture();
    expect(savedLobbyDeckIndex(profile.decks, "d2")).toBe(1);
    expect(savedLobbyDeckIndex(profile.decks, "starter:m05+f04+m06")).toBe(-1);
    expect(savedLobbyDeckIndex(profile.decks, "d9")).toBe(-1);
    expect(savedLobbyDeckIndex(profile.decks, null)).toBe(-1);
  });
});
