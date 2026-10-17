/** Manual preview of production effects; no account, combat action or profile writes. */
import Phaser from "phaser";
import { loadGameData } from "data";
import manifest from "virtual:assets-manifest";
import { createAnimationRuntime } from "../src/ui/animation-runtime";
import { playAttack } from "../src/ui/vfx";
import type { AttackKind } from "../src/ui/attack-style";
import { addButton, showModal } from "../src/ui/widgets";
import { DialogueView } from "../src/ui/dialogue-view";
import { installUiMotion } from "../src/ui/ui-motion";
import { playAwakening } from "../src/ui/awakening-showcase";
import { reactToImpact } from "../src/ui/impact-reaction";
import "../src/ui/motion.css";

const data = loadGameData();
const kinds: [AttackKind, string][] = [
  ["slash", "Kiếm"], ["spear", "Thương"], ["darts", "Ám khí"], ["bow", "Cung"], ["herb", "Thảo dược"],
  ["fan", "Quạt"], ["ink", "Bút mực"], ["music", "Âm luật"], ["ribbon", "Dải lụa"], ["fire", "Lửa"],
  ["star", "Tinh tú"], ["moon", "Nguyệt"], ["talisman", "Phù chú"], ["blood", "Huyết"], ["spell", "Pháp thuật"],
];
document.body.innerHTML = `<header><h1>Xem thử chuyển động</h1><p>Renderer thật của bản game trong worktree. Không thay đổi tài khoản hoặc kết quả trận đấu.</p></header>
  <section id="controls"><label>Hiệu ứng <select id="style">${kinds.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label>
  <label>Tốc độ <select id="speed"><option value="1">Thường</option><option value="2">Gấp đôi</option></select></label>
  <label><input id="guard" type="checkbox">Đỡ đòn</label><label><input id="reduced" type="checkbox">Giảm chuyển động</label>
  <button id="play" disabled>Phát hiệu ứng</button>
  <label>Thức Tỉnh <select id="hero">${["m05","m12","f13"].map(id=>`<option value="${id}">${data.heroes[id]!.name}</option>`).join("")}</select></label>
  <button id="awaken" disabled>Xem Thức Tỉnh</button><button id="abort" disabled>Hủy hiệu ứng</button>
  <label><input id="slow" type="checkbox">Xem chậm để kiểm tra</label></section>
  <p id="result" role="status">Đang tải hình nhân vật…</p><div id="canvas"></div>`;
const result = document.querySelector<HTMLElement>("#result")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const abort = document.querySelector<HTMLButtonElement>("#abort")!;
const awaken = document.querySelector<HTMLButtonElement>("#awaken")!;
const reduced = document.querySelector<HTMLInputElement>("#reduced")!;
reduced.checked = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let controller: AbortController | undefined;

class Preview extends Phaser.Scene {
  preload() {
    this.load.image("preview-hero", manifest.heroes!.m05!);
    this.load.image("preview-enemy", manifest.enemies!.puppet_guard!);
    for (const id of ["m05","m12","f13"]) {
      this.load.image(`heroes:${id}`, manifest.heroes![id]!);
      this.load.image(`heroes:${id}_up`, manifest.heroes![`${id}_up`]!);
    }
  }
  create() {
    this.game.canvas.setAttribute("aria-label", "Sân xem thử hiệu ứng chiến đấu");
    const from = { x: 350, y: 310 }, to = { x: 930, y: 310 };
    const portrait = (key: string, x: number, name: string) => {
      const image = this.add.image(0, 0, key);
      const source = image.texture.getSourceImage() as HTMLImageElement;
      const scale = Math.min(160 / source.width, 240 / source.height);
      image.setScale(scale);
      const border = this.add.rectangle(0, 0, source.width * scale + 1, source.height * scale + 1, 0, 0).setStrokeStyle(1, 0xd4bd86);
      const view = this.add.container(x, from.y, [image, border]);
      this.add.text(x, from.y + 145, name, { fontSize: "23px", color: "#eed5a0" }).setOrigin(0.5);
      return view;
    };
    const attacker = portrait("preview-hero", from.x, data.heroes.m05!.name);
    const defender = portrait("preview-enemy", to.x, data.enemies.puppet_guard!.name);
    const root = this.add.container(0, 0);
    addButton(this, root, 360, 610, 230, "Xem popup", () => {
      void showModal(this, { title: "Chuyển động popup", message: "Popup dùng helper chung của game, giữ nguyên bố cục và vùng bấm.", actions: [{ label: "Đóng" }] });
    });
    addButton(this, root, 880, 610, 230, "Xem thoại truyện", () => {
      const [stageId, stage] = Object.entries(data.storyStages).find(([, value]) => value.before.length > 0)!;
      let index = 0;
      const view = new DialogueView({ next: () => { index++; if (index >= stage.before.length) view.destroy(); else render(); }, skip: () => view.destroy() });
      const render = () => view.render(data, stage.name, stage.before[index]!, index, stage.before.length, { stageId, part: "before" });
      render();
    });
    result.textContent = "Sẵn sàng. Chọn hiệu ứng và tốc độ để xem thử.";
    play.disabled = false;
    awaken.disabled = false;
    const run = async (kind: "attack" | "awakening") => {
      if (controller) return;
      // Preview-only slow observation; production settings remain the normal two speeds.
      const scale = document.querySelector<HTMLInputElement>("#slow")!.checked ? 0.2 : 1;
      this.time.timeScale = scale;
      this.tweens.timeScale = scale;
      this.anims.globalTimeScale = scale;
      controller = new AbortController();
      const runtime = createAnimationRuntime(this, controller.signal, {
        speed: Number(document.querySelector<HTMLSelectElement>("#speed")!.value) as 1 | 2,
        reducedMotion: reduced.checked, volume: 0,
      });
      play.disabled = true; awaken.disabled = true; abort.disabled = false;
      const started = performance.now(); let impacts = 0;
      try {
        const blocked = document.querySelector<HTMLInputElement>("#guard")!.checked;
        const heroId = document.querySelector<HTMLSelectElement>("#hero")!.value, hero = data.heroes[heroId]!;
        if (kind === "awakening") await playAwakening(runtime, { heroId, heroName: hero.name, formName: hero.levelUp.name, style: hero.attackStyle ?? "moon" });
        else await playAttack({ kind: document.querySelector<HTMLSelectElement>("#style")!.value as AttackKind, color: 0xf4d35e }, from, to, {
          runtime, attackerView: attacker, blocked: document.querySelector<HTMLInputElement>("#guard")!.checked,
          onImpact: () => { impacts++; result.textContent = `Điểm chạm: ${impacts}`; void reactToImpact(runtime, defender, from, to, blocked ? 0 : 12).catch(()=>{}); },
        });
        await runtime.drain();
        result.textContent = `Hoàn tất sau ${Math.round(performance.now() - started)} mili giây.${kind === "attack" ? ` Điểm chạm: ${impacts}.` : ` ${hero.name} — ${hero.levelUp.name}.`}`;
      } catch { result.textContent = "Đã hủy hiệu ứng và trả nhân vật về vị trí ban đầu."; }
      finally { runtime.dispose(); controller = undefined; play.disabled = false; awaken.disabled = false; abort.disabled = true; }
    };
    play.onclick = () => { void run("attack"); };
    awaken.onclick = () => { void run("awakening"); };
    abort.onclick = () => controller?.abort();
  }
}
const removeUiMotion = installUiMotion();
const game = new Phaser.Game({ type: Phaser.AUTO, parent: "canvas", width: 1280, height: 720, backgroundColor: "#0d192a", scene: Preview,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
game.events.once(Phaser.Core.Events.DESTROY, removeUiMotion);
