import { describe, expect, it } from "vitest";
import { nextRandom, shuffle } from "../src/index";

function sequence(seed: number, count: number): number[] {
  const values: number[] = [];
  let state = seed;
  for (let i = 0; i < count; i++) {
    const result = nextRandom(state);
    state = result.rngState;
    values.push(result.value);
  }
  return values;
}

describe("nextRandom", () => {
  it("produces the same sequence for the same seed", () => {
    expect(sequence(42, 10)).toEqual(sequence(42, 10));
  });

  it("produces different sequences for different seeds", () => {
    expect(sequence(1, 10)).not.toEqual(sequence(2, 10));
  });

  it("returns values in [0, 1)", () => {
    for (const value of sequence(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("keeps rngState a 32-bit integer", () => {
    let state = 123;
    for (let i = 0; i < 100; i++) {
      const result = nextRandom(state);
      state = result.rngState;
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(-2147483648);
      expect(state).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe("shuffle", () => {
  const input = Array.from({ length: 20 }, (_, i) => i);

  it("is deterministic for the same seed", () => {
    expect(shuffle(input, 123).items).toEqual(shuffle(input, 123).items);
  });

  it("keeps every element exactly once", () => {
    const { items } = shuffle(input, 99);
    expect([...items].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input array", () => {
    const copy = [...input];
    shuffle(input, 5);
    expect(input).toEqual(copy);
  });

  it("produces different orders for different seeds", () => {
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items);
  });

  it("advances rngState so repeated shuffles differ", () => {
    const first = shuffle(input, 7);
    const second = shuffle(input, first.rngState);
    expect(second.items).not.toEqual(first.items);
    expect(second.rngState).not.toBe(7);
  });
});
