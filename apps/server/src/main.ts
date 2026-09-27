import { randomBytes } from "node:crypto";
import { loadGameData } from "data";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { openDb } from "./db";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const db = openDb(config.dbPath);
const app = buildApp({
  db,
  data: loadGameData(),
  clock: () => Date.now(),
  random: (bytes) => randomBytes(bytes),
  config,
});

app.listen({ port: config.port, host: config.host }).then(
  (address) => console.log(`server listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
