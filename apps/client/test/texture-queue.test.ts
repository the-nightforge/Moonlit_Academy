import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/ui/theme", () => ({ RENDER_SCALE: 2 }));

import { queueTexture } from "../src/ui/texture-queue";

/**
 * Phaser-free harness: `queueTexture` only touches `scene.textures`,
 * `scene.load` (an EventEmitter with image/svg/isLoading/start),
 * `scene.events` and `scene.scene.isActive()`.
 */
class FakeLoader extends EventEmitter {
  files: { key: string; url: string; kind: "image" | "svg"; scale?: number }[] = [];
  loading = false;
  textures: Set<string>;

  constructor(textures: Set<string>) {
    super();
    this.textures = textures;
  }

  isLoading() {
    return this.loading;
  }

  image(key: string, url: string) {
    this.files.push({ key, url, kind: "image" });
  }

  svg(key: string, url: string, options?: { scale?: number }) {
    this.files.push({ key, url, kind: "svg", scale: options?.scale });
  }

  start() {
    this.loading = true;
  }

  /** Every queued file resolves like a real loader pass. */
  completeAll() {
    for (const file of this.files.splice(0)) {
      this.textures.add(file.key);
      this.emit("filecomplete", file.key);
    }
    this.loading = false;
    this.emit("complete");
  }

  fail(key: string) {
    const index = this.files.findIndex((file) => file.key === key);
    if (index >= 0) this.files.splice(index, 1);
    this.emit("loaderror", { key });
  }
}

interface SharedManager {
  manager: { exists(key: string): boolean };
  textures: Set<string>;
}

function sharedManager(): SharedManager {
  const textures = new Set<string>();
  return { textures, manager: { exists: (key: string) => textures.has(key) } };
}

/** A scene is just enough Phaser surface for the queue; `shutdown()` kills it. */
function fakeScene(shared: SharedManager) {
  const events = new EventEmitter();
  const scene = {
    active: true,
    textures: shared.manager,
    load: new FakeLoader(shared.textures),
    events,
    scene: { isActive: () => scene.active },
    shutdown() {
      scene.active = false;
      events.emit("shutdown");
    },
  };
  return scene as any;
}

describe("queueTexture", () => {
  it("deduplicates one load across scenes sharing the manager", async () => {
    const shared = sharedManager();
    const a = fakeScene(shared);
    const b = fakeScene(shared);
    const first = queueTexture(a, "heroes:m05", "/assets/heroes/m05.webp");
    const second = queueTexture(b, "heroes:m05", "/assets/heroes/m05.webp");
    expect(a.load.files).toHaveLength(1);
    expect(b.load.files).toHaveLength(0);
    a.load.completeAll();
    await expect(first).resolves.toBe("loaded");
    await expect(second).resolves.toBe("loaded");
    expect(shared.textures.has("heroes:m05")).toBe(true);
  });

  it("resolves cached without touching the loader", async () => {
    const shared = sharedManager();
    shared.textures.add("ui:seal");
    const scene = fakeScene(shared);
    await expect(queueTexture(scene, "ui:seal", "/assets/ui/seal.svg")).resolves.toBe("cached");
    expect(scene.load.files).toHaveLength(0);
  });

  it("owner shutdown rejects waiters, who can retry on their own loader", async () => {
    const shared = sharedManager();
    const owner = fakeScene(shared);
    const waiter = fakeScene(shared);
    const ownerJob = queueTexture(owner, "heroes:m05", "/x.webp");
    const waiterJob = queueTexture(waiter, "heroes:m05", "/x.webp");
    owner.shutdown();
    await expect(ownerJob).rejects.toThrow();
    await expect(waiterJob).rejects.toThrow();

    const retry = queueTexture(waiter, "heroes:m05", "/x.webp");
    expect(waiter.load.files).toHaveLength(1);
    waiter.load.completeAll();
    await expect(retry).resolves.toBe("loaded");
  });

  it("a failed file rejects and frees the key for retry", async () => {
    const shared = sharedManager();
    const scene = fakeScene(shared);
    const first = queueTexture(scene, "cards:c1", "/bad.webp");
    scene.load.fail("cards:c1");
    await expect(first).rejects.toThrow();

    const retry = queueTexture(scene, "cards:c1", "/good.webp");
    expect(scene.load.files).toHaveLength(1);
    scene.load.completeAll();
    await expect(retry).resolves.toBe("loaded");
  });

  it("SVG files go through load.svg at RENDER_SCALE, raster through load.image", async () => {
    const shared = sharedManager();
    const scene = fakeScene(shared);
    void queueTexture(scene, "ui:seal", "/assets/ui/seal.svg");
    void queueTexture(scene, "heroes:m05", "/assets/heroes/m05.webp");
    expect(scene.load.files[0]).toMatchObject({ key: "ui:seal", kind: "svg", scale: 2 });
    expect(scene.load.files[1]).toMatchObject({ key: "heroes:m05", kind: "image" });
    scene.load.completeAll();
  });
});
