import { describe, expect, it } from "vitest";
import { dataVersion, fnv1a64, loadGameData, stableStringify } from "../src/index";

describe("dataVersion", () => {
  it("T182: fnv1a64 matches reference values; dataVersion ignores key order and changes with any number", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
    // Multi-byte text hashes its UTF-8 bytes (same as a byte-wise reference).
    const text = "Hoắc Liệt 🌕";
    let reference = 0xcbf29ce484222325n;
    // UTF-8 of `text`, written out byte by byte.
    const utf8 = "486fe1baaf63204c69e1bb877420f09f8c95".match(/../g)!.map((pair) => parseInt(pair, 16));
    for (const byte of utf8) {
      reference = ((reference ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    expect(fnv1a64(text)).toBe(reference.toString(16).padStart(16, "0"));

    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');

    const data = loadGameData();
    const version = dataVersion(data);
    expect(version).toMatch(/^[0-9a-f]{16}$/);
    const reordered = Object.fromEntries(Object.entries(data).reverse()) as typeof data;
    expect(dataVersion(reordered)).toBe(version);
    const tweaked = loadGameData();
    tweaked.combatConfig.handSize += 1;
    expect(dataVersion(tweaked)).not.toBe(version);
  });
});
