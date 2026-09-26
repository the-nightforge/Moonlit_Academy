import { randomBytes } from "node:crypto";
import { loadGameData } from "data";
import { buildApp } from "./app";
import { openDb } from "./db";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const db = openDb(process.env.DB_PATH ?? "./data/vong-nguyet.db");
const app = buildApp({ db, data: loadGameData(), clock: () => Date.now(), random: (bytes) => randomBytes(bytes) });

app.listen({ port, host }).then(
  (address) => console.log(`server listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
