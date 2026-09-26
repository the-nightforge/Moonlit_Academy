import { createHash, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt parameters (`16` §3). maxmem must exceed 128 × N × r bytes (32 MiB). */
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** "<salt hex>:<hash hex>" with a 16-byte salt from `random`. */
export async function hashPassword(password: string, random: (bytes: number) => Buffer): Promise<string> {
  const salt = random(16);
  const key = await derive(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A session token for the client and the hash the database keeps. */
export function newToken(random: (bytes: number) => Buffer): { token: string; tokenHash: string } {
  const token = random(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidPassword(password: string): boolean {
  const length = [...password].length;
  return length >= 8 && length <= 72;
}
