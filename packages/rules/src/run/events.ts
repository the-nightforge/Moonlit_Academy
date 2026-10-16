import type { GameData, PendingRunEvent, RunState } from "../types/index";
import { applySignatureCards } from "../create-combat";
import { pickOne, type Rng } from "./random";

export const RUN_EVENT_IDS = ["moonShrine", "wanderingSmith", "forgottenArchive"] as const;
export const EVENT_HEAL_RATIO = 0.2;
export const EVENT_FALLBACK_HEAL_RATIO = 0.1;

/** Costs never kill a hero. Preview and resolution use exactly the same amounts. */
export function eventHealthCosts(run: RunState): number[] {
  return run.heroes.map(h => Math.min(Math.max(0, h.hp - 1), Math.ceil(h.maxHp * 0.2)));
}

export function drawRunEvent(data: GameData, run: RunState): PendingRunEvent {
  const rng: Rng = { state: run.rngState };
  const id = pickOne(rng, RUN_EVENT_IDS);
  const pool = id === "moonShrine"
    ? Object.keys(data.runRelics).filter(key => !run.runRelicIds.includes(key))
    : Object.keys(data.augments).filter(key => !run.augmentIds.includes(key));
  const reward = pool.length ? pickOne(rng, pool) : undefined;
  run.rngState = rng.state;
  return { id, ...(reward ? id === "moonShrine" ? { runRelicId: reward } : { augmentId: reward } : {}) };
}

/** Every template has two legal exits, including when its reward pool is exhausted. */
export function runEventModel(data: GameData, run: RunState) {
  const event = run.pendingEvent;
  if (!event) return null;
  const cardIds = run.deck.length > data.runConfig.minDeckSize ? [...run.deck] : [];
  const hasReward = event.id === "moonShrine" ? !!event.runRelicId
    : !!event.augmentId && (event.id !== "forgottenArchive" || cardIds.length > 0);
  const health = eventHealthCosts(run).map((amount, i) => `${data.heroes[run.heroes[i]!.defId]?.name ?? run.heroes[i]!.defId}: −${amount} máu`).join(" · ");
  const lastRelicId = run.runRelicIds.at(-1);
  const reward = event.runRelicId ? data.runRelics[event.runRelicId] : event.augmentId ? data.augments[event.augmentId] : undefined;
  const title = event.id === "moonShrine" ? "Miếu Trăng" : event.id === "wanderingSmith" ? "Người Rèn Lõi" : "Tàng Thư Bỏ Quên";
  const text = event.id === "moonShrine" ? "Ánh trăng soi lên một Kỳ Vật. Bạn có thể dùng sinh lực để mang nó theo."
    : event.id === "wanderingSmith" ? "Bạn có thể đổi Kỳ Vật gần nhất lấy một Lõi; nếu chưa có Kỳ Vật, đội hình phải trao sinh lực."
    : "Một trang sách có thể đổi kiến thức cũ trong bộ bài thành một Lõi mới.";
  const tradeText = !hasReward ? "Không còn vật phẩm hoặc lá phù hợp để đổi. Hồi 10% máu tối đa cho mỗi anh hùng."
    : event.id === "moonShrine" ? `${health}. Nhận Kỳ Vật ${reward!.name}.`
    : event.id === "wanderingSmith" ? `${lastRelicId ? `Mất Kỳ Vật ${data.runRelics[lastRelicId]?.name ?? lastRelicId}` : health}. Nhận Lõi ${reward!.name}.`
    : `Bỏ một lá đã chọn; giữ ít nhất ${data.runConfig.minDeckSize} lá. Nhận Lõi ${reward!.name}.`;
  return { title, text, hasReward, reward, cardIds: event.id === "forgottenArchive" && hasReward ? cardIds : [],
    tradeLabel: hasReward ? event.id === "forgottenArchive" ? "Đổi một lá lấy Lõi" : "Chấp nhận trao đổi" : "Đọc dấu tích",
    tradeText, restText: "Hồi 20% máu tối đa cho mỗi anh hùng. Không nhận vật phẩm." };
}

/** Only ticket-snapshotted cards for the same owner, never duplicates or generated cards. */
export function runSwapChoices(data: GameData, run: RunState, cardId: string): string[] {
  if (!run.deck.includes(cardId)) return [];
  const owner = data.cards[cardId]?.ownerId;
  if (!owner || !run.heroes.some(h => h.defId === owner)) return [];
  const legal = new Set([...(data.heroes[owner]?.cardIds ?? []), ...(data.heroes[owner]?.lockedCardIds ?? [])]);
  const candidates = [...new Set(run.availableCardIds ?? run.deck)].filter(id => legal.has(id) && data.cards[id]?.ownerId === owner);
  return applySignatureCards(data, candidates, run.loadout).filter(id => !run.deck.includes(id));
}
