import Phaser from "phaser";
import { errorText, mutate } from "../account";
import { firstStoryStageId, starterDeck, validateDeck } from "rules";
import { api, auth } from "../api";
import { session } from "../session";
import { StoryView } from "../ui/story-view";
import { FirstLessonView } from "../ui/first-lesson-view";
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
  private lesson: FirstLessonView | null = null;
  private lessonBusy = false;
  private lessonError = "";
  private lessonDismissed = false;
  constructor() { super("story"); }
  create() {
    useDesignCamera(this);
    this.generation++;
    this.progress = null; this.error = ""; this.loading = false;
    this.notice = session.notices.splice(0).join(" ");
    this.lessonBusy = false; this.lessonError = ""; this.lessonDismissed = false;
    const saved = session.profile.decks.find(deck => deck.id === session.selectedDeckId);
    if (!saved && session.profile.firstLesson) session.selectedDeckId = session.profile.firstLesson.deckId;
    this.lesson = new FirstLessonView({ claim: (cardId, replaceCardId) => void this.claim(cardId, replaceCardId), prepare: () => void this.prepare(), deck: id => { session.selectedDeckId = id; this.render(); }, dismiss: () => { this.lessonDismissed = true; this.render(); } });
    this.view = new StoryView({ back: () => this.scene.start("deck-select"), retry: () => void this.refresh(), start: id => this.start(id), read: (id, part) => this.read(id, part), lesson: () => { this.lessonDismissed = false; this.render(); } });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); this.scene.start("deck-select"); } };
    window.addEventListener("keydown", escape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++; window.removeEventListener("keydown", escape); this.view?.destroy(); this.view = null; this.lesson?.destroy(); this.lesson = null;
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
    if (!session.online || this.loading || this.error || this.lessonBusy || (!this.progress?.unlocked.includes(id) && !this.progress?.cleared.includes(id))) return;
    session.pendingStageId = id;
    this.scene.start("dialogue", { stageId: id, part: "before" });
  }
  private read(id: string, part: "before" | "after") {
    if (!this.progress?.cleared.includes(id) || this.loading || this.lessonBusy) return;
    session.pendingStageId = null;
    this.scene.start("dialogue", { stageId: id, part, replayOnly: true });
  }
  private async changeLesson(action: (current: () => boolean) => Promise<unknown>) {
    if (this.lessonBusy) return;
    const generation = this.generation, account = auth.generation;
    const current = () => generation === this.generation && account === auth.generation && this.scene.isActive();
    this.lessonBusy = true; this.lessonError = ""; this.render();
    try { await action(current); }
    catch (error) { if (current()) this.lessonError = errorText(error); }
    finally { if (current()) { this.lessonBusy = false; this.render(); } }
  }
  private async prepare() {
    await this.changeLesson(async current => {
      const heroIds = [...session.heroIds] as [string, string, string];
      const reply = await mutate<{ profile: typeof session.profile; rev: number; deckId: string }>("PUT", "/profile/decks", { draft: { id: "", name: "Bài học đầu tiên", heroIds, cardIds: starterDeck(session.data, heroIds) } });
      if (current()) session.selectedDeckId = reply.deckId;
    });
  }
  private async claim(cardId: string, replaceCardId: string) {
    const deckId = this.lessonDeckId();
    await this.changeLesson(async current => {
      await mutate("POST", "/profile/first-card", { deckId, cardId, replaceCardId });
      if (current()) session.selectedDeckId = deckId;
    });
  }
  private lessonDeckId() {
    return session.profile.decks.find(deck => deck.id === session.selectedDeckId && !validateDeck(session.data, session.profile, deck).length)?.id
      ?? session.profile.decks.find(deck => !validateDeck(session.data, session.profile, deck).length)?.id ?? "";
  }
  private render() {
    const first = firstStoryStageId(session.data);
    const eligible = first && session.profile.story.cleared.includes(first) && !session.profile.firstLesson?.practiced;
    this.lesson?.render({ data: session.data, profile: session.profile, deckId: this.lessonDeckId(), busy: this.lessonBusy, error: this.lessonError });
    let notice = this.notice;
    if (first && !session.profile.story.cleared.includes(first)) notice += " Bắt đầu màn đầu tiên: học cách dùng bộ bài hữu hạn, Nguyệt Lực và Thức Tỉnh, rồi chọn một lá mới miễn phí.";
    this.view?.render({ data: session.data, progress: this.progress, online: session.online, loading: this.loading, error: this.error, notice, lesson: eligible && session.online && !this.loading && !this.error && !this.lessonDismissed ? this.lesson?.element : undefined });
    if (eligible && this.lessonDismissed && !this.loading && !this.error) {
      const host = document.querySelector(".vn-story .st-lesson-host");
      if (host) { const button = document.createElement("button"); button.dataset.action = "lesson"; button.textContent = "Tiếp tục bài học lá mới"; host.append(button); }
    }
  }
}
