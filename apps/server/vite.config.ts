import { defineConfig } from "vite";

// Server bundle: workspace packages (TypeScript sources, JSON data) are inlined;
// npm dependencies stay external and load from node_modules at runtime.
export default defineConfig({
  build: {
    target: "node22",
    ssr: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ["better-sqlite3", "fastify", "zod"],
    },
  },
  ssr: {
    noExternal: ["rules", "data"],
  },
});
