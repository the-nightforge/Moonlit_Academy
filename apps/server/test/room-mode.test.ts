import { expect, it } from "vitest";
import { accountIdOf, giveStarterDeck, register, testServer } from "./helpers";
import { Ws, hello } from "./helpers/realtime";

it("rejects a private room from the wrong lobby before consuming either seat", async () => {
  const server = await testServer();
  const host = await register(server, "mode_host"), guest = await register(server, "mode_guest");
  for (const account of [host, guest]) await giveStarterDeck(server, await accountIdOf(server, account.token), ["m05", "f04", "m06"]);
  const a = await Ws.connect(server.app), b = await Ws.connect(server.app);
  await hello(server, a, host.token);
  await hello(server, b, guest.token);
  a.send({ type: "room.create", mode: "pvp", deckId: "d1" });
  await a.settle();
  const { code } = a.last<{ code: string }>("room.created")!;
  b.send({ type: "room.join", mode: "coop", code, deckId: "d1" });
  await b.settle();
  expect(b.last("error")).toMatchObject({ error: "room mode mismatch" });
  expect(b.last("match.start")).toBeUndefined();
  expect(a.last("match.start")).toBeUndefined();
  // Legacy clients with no explicit mode may still join the existing PvP room.
  b.send({ type: "room.join", code, deckId: "d1" });
  await b.settle();
  await a.settle();
  expect(b.last("match.start")).toMatchObject({ mode: "private" });
  expect(a.last("match.start")).toMatchObject({ mode: "private" });
}, 15_000);
