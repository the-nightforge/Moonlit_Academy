import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

const VIRTUAL_ID = "virtual:assets-manifest";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

function assetsManifest(): Plugin {
  return {
    name: "assets-manifest",
    resolveId(source) {
      return source === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const root = fileURLToPath(new URL("public/assets", import.meta.url));
      const manifest: Record<string, Record<string, string>> = {};
      for (const dir of readdirSync(root, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const files: Record<string, string> = {};
        for (const file of readdirSync(join(root, dir.name))) {
          if (file.startsWith(".") || !/\.(png|jpe?g|webp|svg)$/i.test(file)) continue;
          const key = file.replace(/\.[^.]+$/, "");
          // Prefer raster art (webp) while retaining any original SVG source.
          if (file.endsWith(".svg") && files[key]?.endsWith(".webp")) continue;
          files[key] = `/assets/${dir.name}/${file}`;
        }
        manifest[dir.name] = files;
      }
      return `export default ${JSON.stringify(manifest)};`;
    },
    configureServer(server) {
      const root = fileURLToPath(new URL("public/assets", import.meta.url));
      server.watcher.add(root);
      const invalidate = (path: string) => {
        if (!path.startsWith(root)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // The API server (`apps/server`, `16` §1) usually runs beside Vite; set
  // `API_PROXY_TARGET` (apps/client/.env.local) to reach a remote backend
  // such as the Render deployment. `ws: true` — `/api/ws` (`16` §8).
  const apiTarget = env.API_PROXY_TARGET ?? `http://localhost:${env.API_PORT ?? 8787}`;
  const remote = /^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(apiTarget);
  return {
    plugins: [assetsManifest()],
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          // A browser `Origin` outside `ALLOWED_ORIGINS` gets 403 on the remote
          // API (`16` §7.3); requests without it pass like any non-browser client.
          configure: remote
            ? (proxy) => {
                proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
                proxy.on("proxyReqWs", (proxyReq) => proxyReq.removeHeader("origin"));
              }
            : undefined,
        },
      },
    },
  };
});
