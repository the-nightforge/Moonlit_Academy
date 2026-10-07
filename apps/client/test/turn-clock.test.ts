import { describe, expect, it } from "vitest";
import { OfflineTurnClock } from "../src/ui/turn-clock";

describe("OfflineTurnClock", () => {
  it("starts at the limit on the first active tick", () => {
    const clock = new OfflineTurnClock(60);
    expect(clock.tick("1:0", false, 0)).toBe(60_000);
  });

  it("counts down while active and unfrozen", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 0);
    expect(clock.tick("1:0", false, 1_500)).toBe(58_500);
  });

  it("freezes while input is locked or a modal is open", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 0);
    expect(clock.tick("1:0", true, 5_000)).toBe(60_000);
    expect(clock.tick("1:0", false, 10_000)).toBe(50_000);
  });

  it("resets when the turn key changes — the enemy turn is never observed", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 30_000);
    // playerTurn → playerTurn between rounds arrives as one commit; the key changes.
    expect(clock.tick("2:0", false, 0)).toBe(60_000);
  });

  it("keeps the same clock through a Chiêm Bài choice in the same turn", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 0);
    clock.tick("1:0", false, 10_000); // playerTurn
    // Choosing Chiêm Bài passes the same key — the clock keeps running.
    expect(clock.tick("1:0", false, 5_000)).toBe(45_000);
  });

  it("clears while inactive and restarts full on the next turn", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 30_000);
    expect(clock.tick(null, false, 0)).toBeNull();
    expect(clock.tick("2:0", false, 0)).toBe(60_000);
  });

  it("clamps at zero and stays there until the turn ends", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 0);
    expect(clock.tick("1:0", false, 61_000)).toBe(0);
    expect(clock.tick("1:0", true, 5_000)).toBe(0);
  });

  it("clear() drops the in-progress countdown", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick("1:0", false, 30_000);
    clock.clear();
    expect(clock.tick("1:0", false, 0)).toBe(60_000);
  });
});
