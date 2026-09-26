import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, Loadout } from "../src/index";
import { applyAction, cardDefOf, getEffectiveCost, getPlayCardError, weaponAt } from "../src/index";
import { cloneState } from "../src/clone";
import { idleEnemies, injectCard, makeTestCombat } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

/** Loadout: `weapons` maps hero → [weaponId, refinement]; every hero at constellation 0. */
function gear(weapons: Record<string, [string, number]>, relics: [string, number][] = []): Loadout {
  return {
    heroes: Object.fromEntries(TEAM.map((heroId) => {
      const weapon = weapons[heroId];
      return [heroId, { constellation: 0, levelUpForm: "base" as const, weaponId: weapon?.[0] ?? null, refinement: weapon?.[1] ?? 0 }];
    })),
    relics: relics.map(([id, resonance]) => ({ id, resonance })),
  };
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((unit) => unit.defId === defId)!;
}

function play(data: GameData, state: CombatState, instanceId: string, targetId?: string) {
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

/** Moves a weapon card instance into the hand. */
function draw(state: CombatState, instanceId: string): string {
  state.drawPile = state.drawPile.filter((id) => id !== instanceId);
  state.discardPile = state.discardPile.filter((id) => id !== instanceId);
  if (!state.hand.includes(instanceId)) state.hand.push(instanceId);
  return instanceId;
}

const zeroCost = (id: string, ownerId: string, tags: CardDef["tags"], effects: CardDef["effects"] = [{ type: "gainArmor", amount: 1, to: "self" }]): CardDef =>
  ({ id, name: id, ownerId, cost: 0, copies: 1, type: "skill", tags, target: "none", effects, text: "" });

describe("weapons and moon relics in combat", () => {
  it("T198: a weapon adds its copies as cards of the wearer; they break with the wearer and count for its level-up", () => {
    const { data, state } = makeTestCombat({ loadout: gear({ m05: ["w_thiet_thuan", 1] }) });
    expect(state.weapons).toEqual([{ heroId: "m05", weaponId: "w_thiet_thuan", refinement: 1 }]);
    const weaponCards = Object.values(state.cards).filter((card) => card.cardId === "w_thiet_thuan");
    expect(weaponCards.map((card) => card.instanceId).sort()).toEqual(["wpn_m05_1", "wpn_m05_2"]);
    expect(weaponCards.every((card) => card.ownerIds.join() === "m05")).toBe(true);
    expect(cardDefOf(data, state, state.cards["wpn_m05_1"]!)).toMatchObject({ id: "w_thiet_thuan", ownerId: "m05", cost: 2, name: "Thuẫn Kích" });

    idleEnemies(state);
    const armorBefore = hero(state, "m05").armor;
    const played = play(data, state, draw(state, "wpn_m05_1"));
    expect(hero(played.state, "m05").armor).toBe(armorBefore + 6);
    expect(hero(played.state, "m05").statuses).toContainEqual(expect.objectContaining({ id: "taunt" }));

    const broken = cloneState(played.state);
    Object.assign(hero(broken, "m05"), { hp: 0, alive: false });
    expect(getPlayCardError(data, broken, { type: "playCard", instanceId: draw(broken, "wpn_m05_2") })).toBe("card is broken (owner is dead)");

    // Tô Dạ finishing an enemy with a weapon card counts toward his level-up (enemiesKilled).
    const assassin = makeTestCombat({ loadout: gear({ m06: ["w_anh_nguyet_chuy", 1] }) });
    idleEnemies(assassin.state);
    assassin.state.enemies[0]!.hp = 3;
    const kill = play(assassin.data, assassin.state, draw(assassin.state, "wpn_m06_1"), assassin.state.enemies[0]!.id);
    expect(kill.state.enemies[0]!.alive).toBe(false);
    expect(hero(kill.state, "m06").leveledUp).toBe(true);
  });

  it("T199: weapon passives act as the wearer, filter on its cards and kills, use signature hooks, and stop when it falls", () => {
    const shield = makeTestCombat({ loadout: gear({ f04: ["w_thiet_thuan", 1] }) });
    expect(hero(shield.state, "f04").armor).toBe(4);
    expect(shield.events).toContainEqual({ type: "weaponTriggered", weaponId: "w_thiet_thuan", heroId: "f04" });

    const onSignature = makeTestCombat({ loadout: gear({ m05: ["w_xich_diem_thuong", 1], f04: ["w_han_tuyet_song_kiem", 1] }) });
    const reflect = (defId: string) => hero(onSignature.state, defId).statuses.find((status) => status.id === "reflect")?.value;
    expect(reflect("m05")).toBe(3);
    const offSignature = makeTestCombat({ loadout: gear({ f04: ["w_xich_diem_thuong", 1] }) });
    expect(hero(offSignature.state, "f04").statuses.find((status) => status.id === "reflect")?.value).toBe(2);
    expect(hero(offSignature.state, "f04").statuses.some((status) => status.id === "strength")).toBe(false);

    // Ảnh Nguyệt Chủy on Tô Dạ: every 3rd assassin card of the wearer gives +2 moon power.
    const dagger = makeTestCombat({ loadout: gear({ m06: ["w_anh_nguyet_chuy", 1] }) });
    let state = dagger.state;
    idleEnemies(state);
    const other = injectCard(state, dagger.data, zeroCost("test_other_assassin", "m05", ["assassin"]));
    state = play(dagger.data, state, other).state;
    const ids = [1, 2, 3].map((n) => injectCard(state, dagger.data, zeroCost(`test_own_assassin_${n}`, "m06", ["assassin"])));
    state = play(dagger.data, state, ids[0]!).state;
    state = play(dagger.data, state, ids[1]!).state;
    const power = state.moonPower;
    state = play(dagger.data, state, ids[2]!).state;
    expect(state.moonPower).toBe(power + 2);
    expect(state.runRelicCounters["w_anh_nguyet_chuy@m06#0"]).toBe(3);

    // Liệt Cung: only kills by the wearer give moon power.
    const bow = makeTestCombat({ encounterId: "enc_06", loadout: gear({ f04: ["w_liet_cung", 1] }) });
    idleEnemies(bow.state);
    bow.state.enemies[0]!.hp = 1;
    bow.state.enemies[1]!.hp = 1;
    const hit = (ownerId: string, n: number) =>
      zeroCost(`test_hit_${n}`, ownerId, ["attack"], [{ type: "damage", amount: 5, to: "chosen" }]);
    const byM05 = injectCard(bow.state, bow.data, { ...hit("m05", 1), target: "enemy", type: "attack" });
    const afterM05 = play(bow.data, bow.state, byM05, bow.state.enemies[0]!.id);
    expect(afterM05.events.some((event) => event.type === "weaponTriggered")).toBe(false);
    const byF04 = injectCard(afterM05.state, bow.data, { ...hit("f04", 2), target: "enemy", type: "attack" });
    const afterF04 = play(bow.data, afterM05.state, byF04, afterM05.state.enemies[1]!.id);
    expect(afterF04.events).toContainEqual({ type: "weaponTriggered", weaponId: "w_liet_cung", heroId: "f04" });
    expect(afterF04.state.moonPower).toBe(afterM05.state.moonPower + 1);

    // Bách Hoa Trâm (every 2nd turn end) acts through the lowest-HP hero, but only while its wearer stands.
    const hairpin = makeTestCombat({ loadout: gear({ f04: ["w_bach_hoa_tram", 1] }) });
    idleEnemies(hairpin.state);
    const first = applyAction(hairpin.data, hairpin.state, { type: "endTurn" });
    if (!first.ok) throw new Error(first.error);
    expect(first.events.some((event) => event.type === "weaponTriggered")).toBe(false);
    idleEnemies(first.state);
    const standing = applyAction(hairpin.data, first.state, { type: "endTurn" });
    if (!standing.ok) throw new Error(standing.error);
    expect(standing.events).toContainEqual({ type: "weaponTriggered", weaponId: "w_bach_hoa_tram", heroId: "f04" });
    Object.assign(hero(hairpin.state, "f04"), { hp: 0, alive: false });
    const fallen = applyAction(hairpin.data, hairpin.state, { type: "endTurn" });
    if (!fallen.ok) throw new Error(fallen.error);
    expect(fallen.events.some((event) => event.type === "weaponTriggered")).toBe(false);
    expect(fallen.state.runRelicCounters["w_bach_hoa_tram@f04#0"]).toBeUndefined();
  });

  it("T200: refinement applies R2..Rn changes in order to the card and the passives", () => {
    const { data } = makeTestCombat();
    const spear = data.weapons["w_xich_diem_thuong"]!;
    const damageOf = (level: number) => weaponAt(spear, level).card.effects.find((effect) => effect.type === "damage");
    expect([1, 2, 3, 4, 5].map((level) => weaponAt(spear, level).card.cost)).toEqual([4, 4, 3, 3, 3]);
    expect([1, 2, 3, 4, 5].map((level) => (damageOf(level) as { amount: number }).amount)).toEqual([6, 7, 7, 9, 9]);
    expect(weaponAt(spear, 4).hooks).toBe(spear.hooks);
    expect(weaponAt(spear, 5).signatureHooks).toEqual(spear.refinement[3]!.signatureHooks);

    const r3 = makeTestCombat({ loadout: gear({ m05: ["w_xich_diem_thuong", 3] }) });
    expect(cardDefOf(r3.data, r3.state, r3.state.cards["wpn_m05_1"]!)?.cost).toBe(3);
    const r5 = makeTestCombat({ loadout: gear({ m05: ["w_xich_diem_thuong", 5] }) });
    expect(hero(r5.state, "m05").statuses.find((status) => status.id === "reflect")?.value).toBe(5);
  });

  it("T201: moon relics use their resonance level; a bloodMoon cost modifier only works during blood moon", () => {
    const low = makeTestCombat({ loadout: gear({}, [["r_huyen_vu_giap_phu", 1]]) });
    expect(low.state.heroes.map((unit) => unit.armor)).toEqual([3, 3, 3]);
    expect(low.events).toContainEqual({ type: "relicTriggered", relicId: "r_huyen_vu_giap_phu" });
    const high = makeTestCombat({ loadout: gear({}, [["r_huyen_vu_giap_phu", 4]]) });
    expect(high.state.heroes.map((unit) => unit.armor)).toEqual([6, 6, 6]);

    const { data, state } = makeTestCombat({ loadout: gear({}, [["r_huyet_ngoc_boi", 1]]) });
    const forbidden = injectCard(state, data, { ...zeroCost("test_forbidden", "m05", ["forbidden"]), cost: 3 });
    expect(getEffectiveCost(data, state, forbidden)).toBe(3);
    state.bloodMoonRounds = 2;
    expect(getEffectiveCost(data, state, forbidden)).toBe(2);
  });

  it("T202: one trigger fires run relics, then moon relics, then weapons by wearer position", () => {
    const { events } = makeTestCombat({
      runRelicIds: ["nguyet_giap_phu"],
      loadout: gear({ m05: ["w_thiet_thuan", 1], f04: ["w_thanh_tam_binh", 1] }, [["r_huyen_vu_giap_phu", 1]]),
    });
    const fired = events.filter((event) => event.type.endsWith("Triggered"));
    expect(fired).toEqual([
      { type: "runRelicTriggered", runRelicId: "nguyet_giap_phu" },
      { type: "relicTriggered", relicId: "r_huyen_vu_giap_phu" },
      { type: "weaponTriggered", weaponId: "w_thiet_thuan", heroId: "m05" },
      { type: "weaponTriggered", weaponId: "w_thanh_tam_binh", heroId: "f04" },
    ]);
    // Each source's event comes before the effects it causes.
    const relicAt = events.findIndex((event) => event.type === "relicTriggered");
    expect(events.slice(relicAt + 1).find((event) => event.type === "armorGained")).toBeDefined();
  });
});

