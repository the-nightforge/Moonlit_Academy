import type Phaser from "phaser";
import { RENDER_SCALE } from "./theme";

/**
 * Shared texture loader (`home-ui-redesign` Task 3): one in-flight job per key
 * per TextureManager, whichever scene asked first. Waiters on a dead owner's
 * job reject and are free to retry on their own loader; failed files leave no
 * registry entry, so a retry queues a fresh job. The TextureManager is
 * game-global, so "cached" answers are shared by every scene.
 */

type TextureOutcome = "loaded" | "cached";

interface Waiter {
  resolve: (outcome: TextureOutcome) => void;
  reject: (error: Error) => void;
}

interface Job {
  owner: Phaser.Scene;
  waiters: Waiter[];
  settled: boolean;
}

// Event names match Phaser.Loader.Events / Phaser.Scenes.Events; kept as
// literals so this module stays loadable without a Phaser runtime (tests).
const FILE_COMPLETE = "filecomplete";
const FILE_LOAD_ERROR = "loaderror";
const SCENE_SHUTDOWN = "shutdown";

const registries = new WeakMap<Phaser.Textures.TextureManager, Map<string, Job>>();

/** Loads `key` on `scene`'s loader, or attaches to the job already fetching it. */
export function queueTexture(scene: Phaser.Scene, key: string, url: string): Promise<TextureOutcome> {
  const manager = scene.textures;
  if (manager.exists(key)) return Promise.resolve("cached");
  let table = registries.get(manager);
  if (!table) {
    table = new Map();
    registries.set(manager, table);
  }
  const existing = table.get(key);
  if (existing && !existing.settled) {
    return new Promise<TextureOutcome>((resolve, reject) => existing.waiters.push({ resolve, reject }));
  }

  const job: Job = { owner: scene, waiters: [], settled: false };
  table.set(key, job);
  const promise = new Promise<TextureOutcome>((resolve, reject) => job.waiters.push({ resolve, reject }));

  const cleanup = () => {
    scene.load.off(FILE_COMPLETE, onFileComplete);
    scene.load.off(FILE_LOAD_ERROR, onFileError);
    scene.events.off(SCENE_SHUTDOWN, onShutdown);
  };
  const settle = (error: Error | null) => {
    if (job.settled) return;
    job.settled = true;
    if (table.get(key) === job) table.delete(key);
    cleanup();
    for (const waiter of job.waiters.splice(0)) {
      if (error === null) waiter.resolve("loaded");
      else waiter.reject(error);
    }
  };
  const onFileComplete = (fileKey: string) => {
    if (fileKey === key) settle(null);
  };
  const onFileError = (file: { key?: string }) => {
    if (file?.key === key) settle(new Error(`Không tải được ${key}`));
  };
  const onShutdown = () => settle(new Error(`Loader dừng trước khi tải xong ${key}`));

  scene.load.on(FILE_COMPLETE, onFileComplete);
  scene.load.on(FILE_LOAD_ERROR, onFileError);
  scene.events.once(SCENE_SHUTDOWN, onShutdown);

  // SVG icons rasterize at the canvas scale so they stay sharp under the zoomed camera.
  if (url.endsWith(".svg")) scene.load.svg(key, url, { scale: RENDER_SCALE });
  else scene.load.image(key, url);
  // preload() callers can leave the queue for Phaser's own start; create()/click callers cannot.
  if (!scene.load.isLoading()) scene.load.start();
  return promise;
}
