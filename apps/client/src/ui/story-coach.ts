import { firstStoryStageId, type CombatState, type GameData, type Profile } from "rules";
import { session } from "../session";
import { displayText } from "./display-text";
import { heroTooltipLines } from "./combat-display";
import "./story-coach.css";

/** Tips describe the live setup rather than granting or recording progress locally. */
export function storyCoachTips(data: GameData, profile: Profile, stageId: string, state: CombatState): string[] {
  if (!stageId || state.status === "won" || state.status === "lost") return [];
  const first = firstStoryStageId(data);
  if (stageId === first && !profile.story.cleared.includes(stageId)) {
    const hero = state.heroes[0] && data.heroes[state.heroes[0].defId];
    return [
      "Bộ bài có số lá hữu hạn: lá đã dùng không xáo lại vào chồng rút. Hãy giữ lá hồi máu hoặc phòng thủ cho lượt cần thiết; không cần đánh hết tay.",
      `Nguyệt Lực trả chi phí lá bài. Trăng hiện tại: ${data.moonPhases[state.moonIndex]?.name ?? "xem vòng trăng"}; xem chi phí đang hiển thị trên từng lá, vì hiệu ứng trăng có thể đổi chi phí. Chọn lá rồi chọn mục tiêu hợp lệ.`,
      hero ? `${hero.name}: ${displayText(heroTooltipLines(data, state, state.heroes[0]!)[0]!)}. Sau Thức Tỉnh: ${displayText(hero.levelUp.description)} Theo dõi tiến độ trên viền Hero.` : "Theo dõi điều kiện Thức Tỉnh trên từng Hero để mở cách chơi mạnh hơn trong trận này.",
    ];
  }
  const lesson = profile.firstLesson;
  if (lesson && !lesson.practiced && stageId !== first && Object.values(state.cards).some(card => card.cardId === lesson.cardId)) {
    const card = data.cards[lesson.cardId];
    if (card) return [`Thử ${card.name}: ${displayText(card.text)}. Chi phí cơ bản ${card.cost} Nguyệt Lực; xem chi phí thực tế theo trăng trên lá. Lá này đã thay ${data.cards[lesson.replacedCardId]?.name ?? "lá cũ"} trong bộ bài. Nếu chưa rút được, giữ kế hoạch phòng thủ và kiểm tra chồng rút. Chiến thắng bằng bộ bài này sẽ hoàn tất bài học.`];
  }
  return [];
}

/** Mounted after combat assets are ready; CombatScene updates and destroys it. */
export function mountStoryCoach(): { update: () => void; destroy: () => void } {
  const element = document.createElement("aside");
  element.className = "vn-story-coach"; element.setAttribute("aria-label", "Gợi ý trận Cốt Truyện");
  let step = 0, dismissed = false;
  const update = () => {
    const tips = storyCoachTips(session.data, session.profile, session.story?.setup.stageId ?? "", session.state);
    element.hidden = dismissed || tips.length === 0;
    if (element.hidden) return;
    step = Math.min(step, tips.length - 1);
    const hadFocus = element.contains(document.activeElement);
    element.replaceChildren();
    const text = document.createElement("p"); text.textContent = tips[step]!;
    const next = document.createElement("button"); next.textContent = tips.length > 1 ? `Gợi ý ${step + 1}/${tips.length} · Tiếp` : "Đã hiểu";
    next.addEventListener("click", () => { if (step < tips.length - 1) step++; else dismissed = true; update(); });
    const close = document.createElement("button"); close.textContent = "×"; close.setAttribute("aria-label", "Đóng gợi ý trận Cốt Truyện");
    close.addEventListener("click", () => { dismissed = true; update(); });
    element.append(text, next, close);
    if (hadFocus) next.focus({ preventScroll: true });
  };
  document.body.append(element); update();
  return { update, destroy: () => element.remove() };
}
