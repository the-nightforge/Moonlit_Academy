import { expect, it } from "vitest";
import { libraryFramePosition, libraryFade } from "../src/ui/library-motion-clock";

it.each([70, 95, 130, 310, 410])("keeps frame velocity continuous at the %s millisecond impact", peakAt => {
  const duration = 830, epsilon = .001;
  const at = (time: number) => libraryFramePosition(time, duration, peakAt, 8, 3);
  expect(at(0)).toBe(0); expect(at(peakAt)).toBe(3); expect(at(duration)).toBe(7);
  const before = (at(peakAt) - at(peakAt - epsilon)) / epsilon;
  const after = (at(peakAt + epsilon) - at(peakAt)) / epsilon;
  expect(before).toBeGreaterThan(0); expect(after).toBeCloseTo(before, 5);
  let previous = 0;
  for (let time = 0; time <= duration; time++) {
    const position = at(time); expect(position).toBeGreaterThanOrEqual(previous); expect(position).toBeLessThanOrEqual(7); previous = position;
  }
  expect(at(.001) / .001).toBeLessThan(.00001);
  expect((7 - at(duration - .001)) / .001).toBeLessThan(.00001);
});

it("clamps malformed endpoints and gives fades zero slope and acceleration", () => {
  expect(libraryFramePosition(-1, 500, 120, 8, 3)).toBe(0);
  expect(libraryFramePosition(999, 500, 120, 8, 3)).toBe(7);
  for (const peakAt of [0, 500]) for (let time = 0; time <= 500; time += 10)
    expect(Number.isFinite(libraryFramePosition(time, 500, peakAt, 8, 3))).toBe(true);
  expect(libraryFade(-1)).toBe(0); expect(libraryFade(0)).toBe(0); expect(libraryFade(.5)).toBe(.5); expect(libraryFade(1)).toBe(1); expect(libraryFade(2)).toBe(1);
  expect(libraryFade(.001) / .001 ** 2).toBeLessThan(.02);
  expect((1 - libraryFade(.999)) / .001 ** 2).toBeLessThan(.02);
});
