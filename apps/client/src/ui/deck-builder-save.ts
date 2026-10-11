import type { SavedDeck } from "rules";

interface SaveDependencies {
  deck(): SavedDeck;
  online(): boolean;
  valid(): boolean;
  current(): boolean;
  request(draft: SavedDeck): Promise<{ deckId: string }>;
  activate(deckId: string): void;
  changed(): void;
  error(error: unknown): string;
}

/** Owns one editor run's save lifecycle; invalid decks remain editable drafts. */
export class DeckDraftSave {
  busy = false;
  notice = "";
  private initial: string;

  constructor(private readonly deps: SaveDependencies) {
    this.initial = JSON.stringify(deps.deck());
  }

  get dirty() { return JSON.stringify(this.deps.deck()) !== this.initial; }
  get disabledReason(): string {
    if (this.busy) return "Đang lưu bộ bài…";
    if (!this.deps.online()) return "Cần kết nối để lưu bộ bài";
    const name = this.deps.deck().name.trim();
    if (!name || name.length > 24) return "Tên bộ bài phải có 1–24 ký tự";
    return "";
  }

  async save(): Promise<void> {
    if (this.disabledReason || !this.deps.current()) return;
    const use = this.deps.valid();
    const draft = structuredClone(this.deps.deck());
    draft.name = draft.name.trim();
    this.busy = true;
    this.notice = "";
    this.deps.changed();
    try {
      const reply = await this.deps.request(draft);
      if (!this.deps.current()) return;
      const deck = this.deps.deck();
      deck.id = reply.deckId;
      deck.name = draft.name;
      this.initial = JSON.stringify(deck);
      this.notice = use ? "Đã lưu bộ bài" : "Đã lưu bản nháp";
      if (use) this.deps.activate(reply.deckId);
    } catch (error) {
      if (!this.deps.current()) return;
      this.notice = this.deps.error(error);
    } finally {
      this.busy = false;
      if (this.deps.current()) this.deps.changed();
    }
  }
}
