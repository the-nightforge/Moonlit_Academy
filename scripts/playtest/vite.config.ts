import { fileURLToPath } from "node:url";

// Playtest CLI bundle: workspace packages (TypeScript sources + JSON data) are
// inlined into a single main.mjs; only Node builtins stay external so the
// output runs with plain `node output/playtest-tool/main.mjs`. Paths anchor to
// this config file so the build works from any CWD. No `vite` import — this
// file lives outside the packages that depend on it.
const entry = fileURLToPath(new URL("./main.ts", import.meta.url));
const outDir = fileURLToPath(new URL("../../output/playtest-tool", import.meta.url));

/** @type {import("vite").UserConfig} */
export default {
  resolve: {
    alias: {
      data: fileURLToPath(new URL("../../packages/data/src/index.ts", import.meta.url)),
      rules: fileURLToPath(new URL("../../packages/rules/src/index.ts", import.meta.url)),
    },
  },
  build: {
    target: "node20",
    ssr: entry,
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      external: [/^node:/],
      output: { entryFileNames: "main.mjs" },
    },
  },
  ssr: {
    noExternal: true,
  },
};
