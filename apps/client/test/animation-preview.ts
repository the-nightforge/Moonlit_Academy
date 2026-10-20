/** Manual preview of the production effects; no combat action or profile writes. */
import Phaser from "phaser";
import { loadGameData } from "data";
import manifest from "virtual:assets-manifest";
import { createAnimationRuntime } from "../src/ui/animation-runtime";
import { armorWard, bloodMoonSurge, castCard, deathBurn, healBloom, moonWheel, playAttack, reflectStrike, statusPop } from "../src/ui/vfx";
import type { SupportEffect } from "../src/ui/vfx";
import { impactAnimation } from "../src/ui/impact-animation";
import type { AttackKind } from "../src/ui/attack-style";
import { addButton, showModal } from "../src/ui/widgets";
import { DialogueView } from "../src/ui/dialogue-view";
import { installUiMotion } from "../src/ui/ui-motion";
import { playAwakening, awakeningEffectsFor } from "../src/ui/awakening-showcase";
import { prepareCombatAssets } from "../src/ui/combat-assets";
import { reactToImpact } from "../src/ui/impact-reaction";
import { ATTACK_MOTION } from "../src/ui/vfx";
import { ATTACK_FLOWS, F06_FLOW, FLOW_PLAYBACK_STRETCH } from "../src/ui/illustrated-flow";
import type { IllustrationMode } from "../src/ui/illustrated-flow";
import { registerCombatFrames } from "../src/ui/combat-illustration";
import { registerAwakeningFrames } from "../src/ui/awakening-flipbook";
import "../src/ui/motion.css";

const data = loadGameData();
const inspect = new URLSearchParams(location.search).has("inspect");
const heroIds = ["m12", "f13", ...Object.keys(data.heroes).filter(id => id !== "m12" && id !== "f13")];
const kinds: [AttackKind, string][] = [
  ["slash", "Kiếm"], ["spear", "Thương"], ["darts", "Ám khí"], ["bow", "Cung"], ["herb", "Thảo dược"],
  ["fan", "Quạt"], ["ink", "Bút mực"], ["music", "Âm luật"], ["ribbon", "Dải lụa"], ["fire", "Lửa"],
  ["star", "Tinh tú"], ["moon", "Nguyệt"], ["talisman", "Phù chú"], ["blood", "Huyết"], ["spell", "Pháp thuật"],
];
const supports: [SupportEffect, string][] = [
  ["hit", "Trúng đòn"], ["guard", "Đỡ đòn"], ["heal", "Hồi máu"], ["armor", "Nhận Giáp"], ["armor_break", "Vỡ Giáp"],
  ["status_apply", "Nhận trạng thái"], ["status_remove", "Xóa trạng thái"], ["death", "Gục ngã"], ["blood_moon", "Huyết Nguyệt"],
  ["cast", "Thi triển bài"], ["moon_shift", "Chuyển pha Nguyệt"], ["reflect", "Phản Đòn"],
];
document.body.innerHTML = `<header><h1>Xem thử chuyển động</h1><p>Đòn đánh đi từ hàng nhân vật lên hàng đối thủ như trong trận đấu. Thức Tỉnh đổi hình ngay trên ô nhân vật.</p></header>
  <section id="controls"><label>Mẫu <select id="sample"><option value="bow">Cung — Xuyên Vân Tiễn</option><option value="ribbon">Dải lụa — Kinh Hồng Vũ</option><option value="awakening">Thức Tỉnh — Kinh Hồng Vũ</option></select></label>
  <label>So sánh <select id="comparison"><option value="improved">Bản mới</option><option value="legacy">Bản trước</option></select></label>
  <label>Đòn đánh <select id="style">${kinds.map(([key, label]) => `<option value="${key}"${key === "bow" ? " selected" : ""}>${label}</option>`).join("")}</select></label>
  <label>Tốc độ <select id="speed"><option value="1">Thường</option><option value="2">Gấp đôi</option></select></label>
  <label><input id="guard" type="checkbox">Đỡ đòn</label><label><input id="reduced" type="checkbox">Giảm chuyển động</label>
  <button id="play" disabled>Phát đòn đánh</button>
  <label>Hiệu ứng <select id="support">${supports.map(([key, label]) => `<option value="${key}"${key === "heal" ? " selected" : ""}>${label}</option>`).join("")}</select></label>
  <button id="support-play" disabled>Phát hiệu ứng</button>
  <label>Thức Tỉnh <select id="hero">${heroIds.map(id => `<option value="${id}"${id === "f05" ? " selected" : ""}>${data.heroes[id]!.name}</option>`).join("")}</select></label>
  <button id="awaken" disabled>Xem Thức Tỉnh</button><button id="abort" disabled>Hủy hiệu ứng</button>
  <label><input id="slow" type="checkbox">Xem chậm để kiểm tra</label></section>
  <p id="sample-details"></p><p id="result" role="status">Đang tải hình nhân vật…</p><div id="canvas"></div>`;
const result = document.querySelector<HTMLElement>("#result")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const abort = document.querySelector<HTMLButtonElement>("#abort")!;
const awaken = document.querySelector<HTMLButtonElement>("#awaken")!;
const supportPlay = document.querySelector<HTMLButtonElement>("#support-play")!;
const heroSelect = document.querySelector<HTMLSelectElement>("#hero")!;
const styleSelect = document.querySelector<HTMLSelectElement>("#style")!;
const supportSelect = document.querySelector<HTMLSelectElement>("#support")!;
const sampleSelect = document.querySelector<HTMLSelectElement>("#sample")!;
const comparison = document.querySelector<HTMLSelectElement>("#comparison")!;
const sampleDetails = document.querySelector<HTMLElement>("#sample-details")!;
// Explicit values also reset restored form state after reload or hot replacement.
sampleSelect.value = "bow"; styleSelect.value = "bow"; heroSelect.value = "f05"; comparison.value = "improved";
const illustrationMode = () => comparison.value as IllustrationMode;
const reduced = document.querySelector<HTMLInputElement>("#reduced")!;
reduced.checked = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let controller: AbortController | undefined;

class Preview extends Phaser.Scene {
  preload() {
    this.load.image("preview-enemy", manifest.enemies!.puppet_guard!);
    this.load.image("heroes:f05", manifest.heroes!.f05!);
    this.load.image("heroes:f05_up", manifest.heroes!.f05_up!);
  }
  create() {
    this.game.canvas.setAttribute("aria-label", "Sân xem thử hiệu ứng chiến đấu");
    // The local seat attacks upward into the opponent row, matching the battlefield.
    const from = { x: 640, y: 450 }, to = { x: 640, y: 160 };
    const portraitBox = { width: 128, height: 180 };
    const portrait = (key: string, at: { x: number; y: number }, name: string) => {
      const image = this.add.image(0, 0, key);
      const source = image.texture.getSourceImage() as HTMLImageElement;
      const scale = Math.min(portraitBox.width / source.width, portraitBox.height / source.height);
      image.setScale(scale);
      const border = this.add.rectangle(0, 0, source.width * scale + 1, source.height * scale + 1, 0, 0).setStrokeStyle(1, 0xd4bd86);
      const view = this.add.container(at.x, at.y, [image, border]);
      const label = this.add.text(at.x, at.y + portraitBox.height / 2 + 24, name, { fontSize: "23px", color: "#eed5a0" }).setOrigin(0.5);
      view.setData("unitPortrait", image); view.setData("label", label); view.setData("border", border);
      return view;
    };
    const attacker = portrait("heroes:f05", from, data.heroes.f05!.name);
    const defender = portrait("preview-enemy", to, data.enemies.puppet_guard!.name);
    const resetHero = (up = false, heroId = heroSelect.value) => {
      const image = attacker.getData("unitPortrait") as Phaser.GameObjects.Image;
      image.setTexture(`heroes:${heroId}${up ? "_up" : ""}`).setAlpha(1);
      image.setScale(Math.min(portraitBox.width / image.width, portraitBox.height / image.height));
      (attacker.getData("border") as Phaser.GameObjects.Rectangle).setSize(image.displayWidth + 1, image.displayHeight + 1);
      (attacker.getData("label") as Phaser.GameObjects.Text).setText(data.heroes[heroId]!.name);
    };
    let request = 0, ready = false, alive = true;
    const managed = new Set<string>();
    let retainedKeys = new Set(["heroes:f05", "heroes:f05_up"]), requestedKeys = new Set<string>();
    const releaseUnused = () => {
      for (const key of managed) if (!retainedKeys.has(key) && !requestedKeys.has(key) && this.textures.exists(key)) {
        this.textures.remove(key); managed.delete(key);
      }
    };
    const setControls = () => {
      const busy = !!controller;
      for (const button of [play, awaken, supportPlay]) button.disabled = !alive || !ready || busy;
      for (const select of [heroSelect, styleSelect, supportSelect, sampleSelect, comparison]) select.disabled = !alive || busy;
      abort.disabled = !busy;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { alive = false; request++; controller?.abort(); setControls(); });
    const loadSelection = async () => {
      if (controller || !alive) return;
      const ticket = ++request, id = heroSelect.value;
      ready = false; setControls(); result.textContent = "Đang tải hình nhân vật và hiệu ứng đã chọn…";
      const flow = ATTACK_FLOWS[styleSelect.value as keyof typeof ATTACK_FLOWS];
      const optional = new Set([...(flow ? [`combat_attack_${styleSelect.value}_flow`, ...flow.layers] : []), ...(id === "f06" ? ["awakening_f06_flow", ...ATTACK_FLOWS.ribbon.layers] : [])]);
      const stems = new Set([`combat_attack_${styleSelect.value}`, "combat_effect_hit", "combat_effect_guard", `combat_effect_${supportSelect.value}`, ...awakeningEffectsFor(id).filter(stem => stem !== "awakening_f06_flow"), ...optional]);
      const files = [{ key: `heroes:${id}`, url: manifest.heroes![id]! }, { key: `heroes:${id}_up`, url: manifest.heroes![`${id}_up`]! },
        ...[...stems].flatMap(stem => manifest.vfx?.[stem] ? [{ key: `vfx:${stem}`, url: manifest.vfx[stem]! }] : []),
        ...["status_burn", ...data.moonPhases.map(phase => `moon_${phase.id}`)].flatMap(stem => manifest.ui?.[stem] ? [{ key: `ui:${stem}`, url: manifest.ui[stem]! }] : [])];
      files.forEach(file => managed.add(file.key));
      requestedKeys = new Set(files.map(file => file.key));
      const outcome = await prepareCombatAssets(this, { files, isCurrent: () => alive && ticket === request });
      if (!alive) return;
      if (ticket !== request) { releaseUnused(); return; }
      ready = outcome.failed.every(key => optional.has(key.replace(/^vfx:/, ""))) && [...stems].filter(stem => !optional.has(stem)).every(stem => this.textures.exists(`vfx:${stem}`))
        && this.textures.exists(`heroes:${id}`) && this.textures.exists(`heroes:${id}_up`);
      if (ready) {
        resetHero();
        retainedKeys = new Set(files.map(file => file.key));
      }
      releaseUnused();
      setControls();
      result.textContent = ready ? "Sẵn sàng. Chọn đòn đánh, hiệu ứng hoặc Thức Tỉnh để xem thử." : "Chưa tải đủ hình. Chọn lại nhân vật hoặc hiệu ứng để thử lại.";
      describeSample(sampleSelect.value === "awakening" ? "awakening" : "attack");
    };
    const describeSample = (kind: "attack" | "awakening" | "support") => {
      if(kind==="support") { sampleDetails.textContent=`Hiệu ứng: ${supportSelect.options[supportSelect.selectedIndex]!.text}.`;return; }
      const flow=ATTACK_FLOWS[styleSelect.value as keyof typeof ATTACK_FLOWS];
      const improved=illustrationMode()!=="legacy" && (kind==="awakening" ? heroSelect.value==="f06" && !!registerAwakeningFrames(this,"vfx:awakening_f06_flow") : !!flow && !!registerCombatFrames(this,`vfx:combat_attack_${styleSelect.value}_flow`));
      const count=kind==="awakening" ? improved?F06_FLOW.count:reduced.checked?1:8 : kind==="attack"&&improved?flow!.count:8;
      const sourceDuration=kind==="awakening"?reduced.checked?180:520:ATTACK_MOTION[styleSelect.value as AttackKind].duration;
      const duration=sourceDuration*(improved&&!reduced.checked?FLOW_PLAYBACK_STRETCH:1);
      const speed=Number(document.querySelector<HTMLSelectElement>("#speed")!.value), slow=document.querySelector<HTMLInputElement>("#slow")!.checked?5:1;
      sampleDetails.textContent=`${comparison.options[comparison.selectedIndex]!.text}: ${count} khung hình nguồn${reduced.checked?", giữ khung hình đỉnh và chỉ mờ dần":""} · ${duration} mili giây gốc · ${Math.round(duration/speed*slow)} mili giây khi phát${!improved&&illustrationMode()!=="legacy"&&(kind==="awakening"?heroSelect.value==="f06":!!flow)?" · Dùng bản trước vì hình mới chưa sẵn sàng":""}.`;
    };
    for (const select of [heroSelect, styleSelect, supportSelect]) select.onchange = () => { void loadSelection(); };
    sampleSelect.onchange = () => { heroSelect.value=sampleSelect.value==="bow"?"f05":"f06";styleSelect.value=sampleSelect.value==="bow"?"bow":"ribbon";void loadSelection(); };
    comparison.onchange = () => describeSample(sampleSelect.value==="awakening"?"awakening":"attack");
    for(const control of [reduced,document.querySelector<HTMLSelectElement>("#speed")!,document.querySelector<HTMLInputElement>("#slow")!])
      control.onchange=()=>describeSample(sampleSelect.value==="awakening"?"awakening":"attack");
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
    const run = async (kind: "attack" | "awakening" | "support") => {
      if (controller || !ready || !alive) return;
      // Slow inspection affects only this preview, and all production clocks together.
      const scale = document.querySelector<HTMLInputElement>("#slow")!.checked ? 0.2 : 1;
      this.time.timeScale = scale; this.tweens.timeScale = scale; this.anims.globalTimeScale = scale;
      const scope = new AbortController(); controller = scope;
      const runtime = createAnimationRuntime(this, scope.signal, {
        speed: Number(document.querySelector<HTMLSelectElement>("#speed")!.value) as 1 | 2,
        reducedMotion: reduced.checked, volume: 0,
      });
      setControls(); result.textContent = "Đang phát hiệu ứng…";
      describeSample(kind);
      if(inspect)this.game.events.emit("preview-run-start",`${kind}:${kind==="awakening"?heroSelect.value:kind==="attack"?styleSelect.value:supportSelect.value}; mode=${illustrationMode()}; reduced=${reduced.checked}`);
      const started = performance.now(); let impacts = 0;
      let outcome: "completed" | "error" | "aborted" = "error";
      const heroId = heroSelect.value, hero = data.heroes[heroId]!;
      try {
        const blocked = document.querySelector<HTMLInputElement>("#guard")!.checked;
        if (kind === "awakening") { resetHero(false, heroId); await playAwakening(runtime, { heroId, view: attacker, illustrationMode:illustrationMode(), transform: () => resetHero(true, heroId) }); }
        else if (kind === "attack") await playAttack({ kind: styleSelect.value as AttackKind, color: 0xf4d35e }, from, to, {
          runtime, attackerView: attacker, blocked, illustrationMode:illustrationMode(),
          onImpact: () => { impacts++; result.textContent = `Điểm chạm: ${impacts}`; void reactToImpact(runtime, defender, from, to, blocked ? 0 : 12).catch(() => {}); },
        });
        else {
          const support = supportSelect.value as SupportEffect;
          switch (support) {
            case "hit": case "guard": await impactAnimation(runtime, to, 0xffffff, support === "guard", 1); break;
            case "heal": await healBloom(runtime, to); break;
            case "armor": case "armor_break": await armorWard(runtime, to, support === "armor_break"); break;
            case "status_apply": case "status_remove": await statusPop(runtime, to, "ui:status_burn", 0xffffff, support === "status_remove"); break;
            case "death": await deathBurn(runtime, defender, to); break;
            case "blood_moon": await bloodMoonSurge(runtime, to); break;
            case "moon_shift": await moonWheel(runtime, from, to, data.moonPhases.map(phase => phase.id), 0, 1); break;
            case "reflect": await reflectStrike(runtime, to, from); break;
            case "cast": {
              const image = this.add.image(0, 0, `heroes:${heroId}`).setScale(Math.min(portraitBox.width / this.textures.get(`heroes:${heroId}`).getSourceImage().width, portraitBox.height / this.textures.get(`heroes:${heroId}`).getSourceImage().height));
              const border = this.add.rectangle(0, 0, image.displayWidth + 1, image.displayHeight + 1, 0, 0).setStrokeStyle(1, 0xd4bd86);
              await castCard(runtime, this.add.container(from.x, from.y, [image, border]), { x: from.x, y: from.y - 70 }, 0xffffff, to); break;
            }
          }
        }
        await runtime.drain();
        outcome = "completed";
        if (alive) result.textContent = `Hoàn tất sau ${Math.round(performance.now() - started)} mili giây.${kind === "attack" ? ` Điểm chạm: ${impacts}.` : kind === "awakening" ? ` ${hero.name} — ${hero.levelUp.name}.` : ""}`;
      } catch (error) {
        outcome = scope.signal.aborted ? "aborted" : "error";
        if (alive) result.textContent = scope.signal.aborted ? "Đã hủy hiệu ứng và trả nhân vật về vị trí ban đầu." : `Chưa phát được hiệu ứng: ${error instanceof Error ? error.message : "hãy thử lại"}.`;
      } finally {
        runtime.dispose(); if (controller === scope) controller = undefined; setControls();
        if (alive) { this.time.timeScale = 1; this.tweens.timeScale = 1; this.anims.globalTimeScale = 1; }
        if(inspect)this.game.events.emit("preview-run-end",outcome);
      }
    };
    play.onclick = () => { void run("attack"); };
    awaken.onclick = () => { void run("awakening"); };
    supportPlay.onclick = () => { void run("support"); };
    abort.onclick = () => controller?.abort();
    void loadSelection();
  }
}
const removeUiMotion = installUiMotion();
const game = new Phaser.Game({ type: Phaser.AUTO, parent: "canvas", width: 1280, height: 720, backgroundColor: "#0d192a", scene: Preview,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
// Opt-in, DOM-visible diagnostics distinguish frame delivery from effect update cost.
if (inspect) {
  const meter = document.createElement("p"); meter.id = "frame-diagnostics";
  const snapshot = document.createElement("p"); snapshot.id = "run-diagnostics";
  snapshot.textContent = "RUN: no completed measurement yet.";
  document.querySelector("#canvas")!.before(meter,snapshot);
  let previous = 0, started = 0, gap = 0, count = 0, totalGap = 0, maxGap = 0, totalCost = 0, maxCost = 0;
  let run: {id:number;label:string;started:number;previous:number;frames:number;gaps:number[];work:number[]} | undefined, runId=0;
  const statistics = (values:number[]) => {
    if(!values.length)return "mean=0.0ms, p95=0.0ms, max=0.0ms";
    const sorted=[...values].sort((a,b)=>a-b),mean=values.reduce((total,value)=>total+value,0)/values.length;
    return `mean=${mean.toFixed(1)}ms, p95=${sorted[Math.ceil(sorted.length*.95)-1]!.toFixed(1)}ms, max=${sorted[sorted.length-1]!.toFixed(1)}ms`;
  };
  game.events.on("preview-run-start",(label:string)=>{
    run={id:++runId,label,started:performance.now(),previous:0,frames:0,gaps:[],work:[]};
    snapshot.textContent=`RUN ${run.id} ACTIVE: ${label}; measuring this playback only…`;
  });
  game.events.on("preview-run-end",(outcome:string)=>{
    if(!run)return;
    snapshot.textContent=`RUN ${run.id} FROZEN: ${run.label}; status=${outcome}; elapsed=${Math.round(performance.now()-run.started)}ms; frames=${run.frames}; frameGap[${statistics(run.gaps)}]; work[${statistics(run.work)}].`;
    run=undefined;
  });
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    started = performance.now(); gap = previous ? started - previous : 0; previous = started;
    totalGap += gap; maxGap=Math.max(maxGap,gap);count++;
    if(run){if(run.previous)run.gaps.push(started-run.previous);run.previous=started;run.frames++;}
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const cost = performance.now() - started; maxCost = Math.max(maxCost, cost);totalCost+=cost;
    if(run)run.work.push(cost);
    meter.textContent = `LIVE since page load (${run?"active":"idle"}): visibility=${document.visibilityState}; frames=${count}; gap=${Math.round(gap)}ms; meanGap=${Math.round(totalGap / Math.max(1,count-1))}ms; maxGap=${Math.round(maxGap)}ms; meanWork=${(totalCost/count).toFixed(1)}ms; work=${cost.toFixed(1)}ms; maxWork=${maxCost.toFixed(1)}ms; textures=${game.textures.getTextureKeys().length}`;
  });
}
game.events.once(Phaser.Core.Events.DESTROY, removeUiMotion);
