import Phaser from "phaser";
import { errorText } from "../account";
import { api, auth } from "../api";
import { session } from "../session";
import { StoryView } from "../ui/story-view";
import type { StoryProgress } from "../ui/story-presentation";
import { useDesignCamera } from "../ui/theme";

/** Responsive journey selection; the server remains the authority for progression. */
export class StoryScene extends Phaser.Scene {
  private view: StoryView | null = null;
  private progress: StoryProgress | null = null;
  private generation = 0;
  private loading = false;
  private error = "";
  private notice = "";
  constructor() { super("story"); }
  create() {
    useDesignCamera(this);
    this.generation++;
    this.progress = null; this.error = ""; this.loading = false;
    this.notice = session.notices.splice(0).join(" ");
    this.view = new StoryView({ back: () => this.scene.start("deck-select"), retry: () => void this.refresh(), start: id => this.start(id) });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); this.scene.start("deck-select"); } };
    window.addEventListener("keydown", escape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++; window.removeEventListener("keydown", escape); this.view?.destroy(); this.view = null;
    });
    void this.refresh();
  }
  private async refresh() {
    if (this.loading) return;
    if (!session.online) { this.render(); return; }
    const generation = this.generation, account = auth.generation;
    const current = () => this.generation === generation && auth.generation === account && this.scene.isActive();
    this.loading = true; this.error = ""; this.render();
    try {
      const reply = await api<StoryProgress>("GET", "/story");
      if (!current()) return;
      this.progress = reply;
    } catch (error) {
      if (!current()) return;
      this.error = errorText(error);
    } finally {
      if (current()) { this.loading = false; this.render(); }
    }
  }
  private start(id: string) {
    if (!session.online || this.loading || this.error || !this.progress?.unlocked.includes(id) || this.progress.cleared.includes(id)) return;
    session.pendingStageId = id;
    this.scene.start("dialogue", { stageId: id, part: "before" });
  }
  private render() { this.view?.render({ data: session.data, progress: this.progress, online: session.online, loading: this.loading, error: this.error, notice: this.notice }); }
}
