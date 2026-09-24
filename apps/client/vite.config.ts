import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

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
          if (file.startsWith(".")) continue;
          files[file.replace(/\.[^.]+$/, "")] = `/assets/${dir.name}/${file}`;
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

export default defineConfig({ plugins: [assetsManifest()] });
