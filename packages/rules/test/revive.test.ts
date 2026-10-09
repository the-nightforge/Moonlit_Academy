import { injectCard, makeEnemiesIdle, makeTestCombat, p0, playTestCard, withLevelUp } from "./helpers";
import { spiritCard } from "./fixtures";
import { describe, expect, it } from "vitest";
import { applyAction, getValidTargets, type CombatState } from "../src/index";

describe("Hồi Hồn", () => {
  const reviveCard = spiritCard({ id: "test_revive", ownerId: "f04", target: "fallenAlly", effects: [{ type: "revive", ratio: 0.5, to: "chosen" }] });
  const down = (s: CombatState, index: number) => {
    const hero = s.heroes[index]!;
    hero.hp = 0;
    hero.alive = false;
  };

  it("T291: revive raises a fallen ally once at ratio × maxHp, reshuffles its purged cards into the draw pile; fallenAlly lists only fallen, unrevived allies", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle });
    // Kill m05 through the real path so its draw-pile cards are purged.
    state.heroes[0]!.hp = 1;
    const s = structuredClone(state);
    const m05Pile = p0(s).drawPile.filter((id) => s.cards[id]!.ownerIds.includes("m05"));
    const cut = spiritCard({ id: "test_cut", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 1, to: "chosen" }] });
    const killed = playTestCard(data, s, cut, "hero:m05");
    expect(killed.state.heroes[0]!.alive).toBe(false);
    expect(killed.state.players[0]!.purged!["hero:m05"]).toEqual(m05Pile);

    const reviveId = injectCard(killed.state, data, reviveCard);
    expect(getValidTargets(data, killed.state, reviveId)).toEqual(["hero:m05"]);
    const raised = applyAction(data, killed.state, { type: "playCard", instanceId: reviveId, targetId: "hero:m05" });
    if (!raised.ok) throw new Error(raised.error);
    const m05 = raised.state.heroes[0]!;
    expect(m05).toMatchObject({ alive: true, hp: Math.floor(0.5 * m05.maxHp), armor: 0, statuses: [], revived: true });
    expect(raised.events).toContainEqual({ type: "heroRevived", heroId: "hero:m05", hp: m05.hp });
    for (const id of m05Pile) expect(p0(raised.state).drawPile).toContain(id);
    for (const id of m05Pile) expect(p0(raised.state).discardPile).not.toContain(id);

    const again = structuredClone(raised.state);
    down(again, 0);
    const second = injectCard(again, data, { ...reviveCard, id: "test_revive2" });
    expect(getValidTargets(data, again, second)).toEqual([]);
  });

  it("T292: alliesFallen counts for the seat; an onLevelUp revive to lastFallen raises the ally that just fell; armorOnAllyFall shields the survivors", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        withLevelUp("f04", { counter: "alliesFallen", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "revive", ratio: 0.3, to: "lastFallen" }];
      },
    });
    const cut = spiritCard({ id: "test_cut2", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 99, to: "chosen" }] });
    const r = playTestCard(data, state, cut, "hero:m05");
    expect(r.state.heroes[1]!.leveledUp).toBe(true);
    expect(r.state.heroes[0]).toMatchObject({ alive: true, hp: Math.max(1, Math.floor(0.3 * r.state.heroes[0]!.maxHp)), revived: true });

    const shield = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "armorOnAllyFall", amount: 6 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    const fell = playTestCard(shield.data, shield.state, { ...cut, id: "test_cut3" }, "hero:m05");
    expect(fell.state.heroes[1]!.armor).toBe(6);
    expect(fell.state.heroes[2]!.armor).toBe(6);
  });
});
