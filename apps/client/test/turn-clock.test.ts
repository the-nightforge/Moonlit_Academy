import { describe, expect, it } from "vitest";
import { OfflineTurnClock } from "../src/ui/turn-clock";

describe("OfflineTurnClock", () => {
  it("starts at the limit on the first active tick", () => {
    const clock = new OfflineTurnClock(60);
    expect(clock.tick(true, false, 0)).toBe(60_000);
  });

  it("counts down while active and unfrozen", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick(true, false, 0);
    expect(clock.tick(true, false, 1_500)).toBe(58_500);
  });

  it("freezes while input is locked or a modal is open", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick(true, false, 0);
    expect(clock.tick(true, true, 5_000)).toBe(60_000);
    expect(clock.tick(true, false, 10_000)).toBe(50_000);
  });

  it("resets when the status leaves playerTurn", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick(true, false, 30_000);
    expect(clock.tick(false, false, 0)).toBeNull();
    expect(clock.tick(true, false, 0)).toBe(60_000);
  });

  it("clamps at zero and stays there until the turn ends", () => {
    const clock = new OfflineTurnClock(60);
    clock.tick(true, false, 0);
    expect(clock.tick(true, false, 61_000)).toBe(0);
    expect(clock.tick(true, true, 5_000)).toBe(0);
  });
});
