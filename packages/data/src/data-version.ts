import type { GameData } from "rules";

/** JSON with object keys sorted, so equal data always gives the same text. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** UTF-8 bytes of a string (no TextEncoder: `lib` is plain ES2022). */
function* utf8Bytes(text: string): Generator<number> {
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      yield code;
    } else if (code < 0x800) {
      yield 0xc0 | (code >> 6);
      yield 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      yield 0xe0 | (code >> 12);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    } else {
      yield 0xf0 | (code >> 18);
      yield 0x80 | ((code >> 12) & 0x3f);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    }
  }
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a 64-bit of the UTF-8 bytes of `text`, 16 lowercase hex digits. */
export function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of utf8Bytes(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Identifies the game data a client or server runs (`16` §2). Not a security
 * hash; it only detects mismatched data.
 */
export function dataVersion(data: GameData): string {
  return fnv1a64(stableStringify(data));
}
