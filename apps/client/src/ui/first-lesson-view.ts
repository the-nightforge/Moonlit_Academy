import { firstCardChoices, firstStoryStageId, validateDeck, type GameData, type Profile } from "rules";
import { storyEscape as esc } from "./story-art";
import { displayText } from "./display-text";
import "./first-lesson.css";

export interface FirstLessonState { data: GameData; profile: Profile; deckId: string; busy: boolean; error: string }

/** A resumable account reward. Only the server's claimed profile closes the lesson. */
export class FirstLessonView {
  readonly element = document.createElement("section");
  private state: FirstLessonState | null = null;
  private cardId = "";
  private replaceCardId = "";
  constructor(private readonly actions: { claim: (cardId: string, replaceCardId: string) => void; prepare: () => void; deck: (id: string) => void; dismiss: () => void }) {
    this.element.className = "vn-first-lesson";
    this.element.setAttribute("aria-label", "Lá bài đầu tiên");
    this.element.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || button.disabled || !this.state || this.state.busy) return;
      if (button.dataset.newCard) { this.cardId = button.dataset.newCard; this.replaceCardId = ""; this.render(this.state, `new-${this.cardId}`); }
      if (button.dataset.replaceCard) { this.replaceCardId = button.dataset.replaceCard; this.render(this.state, `replace-${this.replaceCardId}`); }
      if (button.dataset.action === "claim" && this.cardId && this.replaceCardId) this.actions.claim(this.cardId, this.replaceCardId);
      if (button.dataset.action === "prepare") this.actions.prepare();
      if (button.dataset.action === "later") this.actions.dismiss();
    });
    this.element.addEventListener("change", event => {
      const select = event.target as HTMLSelectElement;
      if (select.matches("[data-lesson-deck]") && !this.state?.busy) { this.cardId = ""; this.replaceCardId = ""; this.actions.deck(select.value); }
    });
  }
  render(state: FirstLessonState, focus?: string) {
    this.state = state;
    const { data, profile, busy, error } = state;
    const lesson = profile.firstLesson;
    const first = firstStoryStageId(data);
    this.element.hidden = !first || !profile.story.cleared.includes(first) || lesson?.practiced === true;
    if (this.element.hidden) return;
    const disabled = busy ? "disabled" : "";
    const later = `<button data-action="later" ${disabled}>Để sau</button>`;
    if (lesson) {
      const deck = profile.decks.find(deck => deck.id === lesson.deckId);
      this.element.innerHTML = `<h2>Thử lá bài vừa chọn</h2><p><strong>${esc(data.cards[lesson.cardId]?.name ?? lesson.cardId)}</strong> đã được mở khóa và thay cho ${esc(data.cards[lesson.replacedCardId]?.name ?? lesson.replacedCardId)} trong bộ ${esc(deck?.name ?? "đã lưu")}.</p>${this.card(data, lesson.cardId)}<p>Trong trận Cốt Truyện tiếp theo, chọn bộ bài này, tìm lá mới trên tay và đọc Nguyệt Lực cần dùng trước khi đánh. Lá đã dùng không được xáo lại; hãy chọn đúng lúc.</p>${!deck || !deck.cardIds.includes(lesson.cardId) ? '<p>Bộ bài hiện chưa chứa lá mới. Hãy thêm lại lá trong phần sửa bộ bài để thực hành.</p>' : ""}${later}`;
      return;
    }
    const decks = profile.decks.filter(deck => validateDeck(data, profile, deck).length === 0);
    const choices = firstCardChoices(data, profile, state.deckId);
    if (!choices.includes(this.cardId)) { this.cardId = ""; this.replaceCardId = ""; }
    const deck = decks.find(deck => deck.id === state.deckId);
    const owner = data.cards[this.cardId]?.ownerId;
    const replacements = deck?.cardIds.filter(id => owner && data.cards[id]?.ownerId === owner) ?? [];
    if (!replacements.includes(this.replaceCardId)) this.replaceCardId = "";
    const deckSelect = decks.length ? `<label>Bộ bài sẽ thay đổi <select data-lesson-deck ${disabled}>${decks.map(deck => `<option value="${esc(deck.id)}" ${state.deckId === deck.id ? "selected" : ""}>${esc(deck.name)}</option>`).join("")}</select></label>` : "";
    const pick = choices.length ? `<h3>1. Chọn một lá mới miễn phí</h3><div class="fl-grid">${choices.map(id => `<button data-new-card="${esc(id)}" data-focus="new-${esc(id)}" aria-pressed="${this.cardId === id}" ${disabled}>${this.card(data, id)}</button>`).join("")}</div>` : `<p>Lưu bộ cơ bản của đội đang chọn để nhận lá mới, hoặc chọn một bộ bài hợp lệ đã lưu.</p><button data-action="prepare" ${disabled}>Lưu bộ cơ bản để chọn lá</button>`;
    const replace = this.cardId ? `<h3>2. Chọn lá cùng Hero để thay ra</h3><p>Giữ nguyên số lá và trang bị; mỗi lựa chọn thay đổi cách chơi của bộ bài.</p><div class="fl-grid">${replacements.map(id => `<button data-replace-card="${esc(id)}" data-focus="replace-${esc(id)}" aria-pressed="${this.replaceCardId === id}" ${disabled}>${this.card(data, id)}</button>`).join("")}</div>` : "";
    const compare = this.replaceCardId ? `<div class="fl-compare"><article><h3>Trước: đưa ra khỏi bộ</h3>${this.card(data, this.replaceCardId)}</article><article><h3>Sau: thêm vào bộ</h3>${this.card(data, this.cardId)}</article></div>` : "";
    this.element.innerHTML = `<h2>Chiến thắng đầu tiên — tự chọn cách chơi</h2><p>Chọn một lá mới miễn phí rồi thay một lá cùng Hero trong bộ bài. Bạn có thể để sau và quay lại Cốt Truyện bất cứ lúc nào.</p>${deckSelect}${pick}${replace}${compare}${error ? `<p role="alert">${esc(error)}</p>` : ""}<div class="fl-actions">${choices.length ? `<button data-action="claim" ${busy || !this.cardId || !this.replaceCardId ? "disabled" : ""}>${busy ? "Đang lưu…" : "Mở khóa và thay vào bộ bài"}</button>` : ""}${later}</div>`;
    if (focus) Array.from(this.element.querySelectorAll<HTMLElement>("[data-focus]")).find(node => node.dataset.focus === focus)?.focus({ preventScroll: true });
  }
  private card(data: GameData, id: string) {
    const card = data.cards[id];
    return card ? `<div class="fl-card"><strong>${esc(card.name)}</strong><span>${esc(data.heroes[card.ownerId ?? ""]?.name ?? "")} · ${card.cost} Nguyệt Lực</span><p>${esc(displayText(card.text))}</p></div>` : "";
  }
  destroy() { this.element.remove(); }
}
