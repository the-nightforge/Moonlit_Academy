import { describe, expect, it } from "vitest";
import { normalizeRow, PG_OPTIONS } from "../src/db";

describe("postgres.js int8 handling", () => {
  // pg-mem returns numbers, so the route tests never see what postgres.js does
  // with BIGINT columns: by default it returns them as strings ("1"), which
  // broke `rev` checks (409 "stale profile"), `rev + 1` and `starter_deck === 1`.
  it("parses BIGINT columns so normalizeRow yields JS numbers", () => {
    const parse = PG_OPTIONS.types.bigint.parse;
    expect(normalizeRow({ rev: parse("1"), starter_deck: parse("1"), profile_json: "{}" })).toEqual({
      rev: 1,
      starter_deck: 1,
      profile_json: "{}",
    });
  });
});
