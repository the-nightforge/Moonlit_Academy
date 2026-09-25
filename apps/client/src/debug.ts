import { drawCards } from "rules";
import type { CombatEvent, CombatState, GameData } from "rules";
import { session } from "./session";

function unitName(state: CombatState, data: GameData, unitId: string): string {
  const hero = state.heroes.find((h) => h.id === unitId);
  if (hero) return data.heroes[hero.defId]?.name ?? unitId;
  const enemy = state.enemies.find((e) => e.id === unitId);
  if (enemy) return data.enemies[enemy.defId]?.name ?? unitId;
  return unitId;
}

function checkEnd(): void {
  const state = session.state;
  if (state.status !== "playerTurn" && state.status !== "enemyTurn") return;
  if (state.enemies.every((enemy) => !enemy.alive)) {
    state.status = "won";
    session.events.push({ type: "combatEnded", result: "won" });
  } else if (state.heroes.every((hero) => !hero.alive)) {
    state.status = "lost";
    session.events.push({ type: "combatEnded", result: "lost" });
  }
}

export function debugAddMoonPower(amount = 3): void {
  session.state.moonPower += amount;
  session.events.push({ type: "moonPowerChanged", value: session.state.moonPower });
}

export function debugDrawCards(count = 1): void {
  drawCards(session.state, count, session.events);
}

export function debugSetMoon(index: number): void {
  const phases = session.data.moonPhases;
  const from = session.state.moonIndex;
  session.state.moonIndex = ((index % phases.length) + phases.length) % phases.length;
  session.events.push({ type: "moonShifted", from, to: session.state.moonIndex, cause: "card" });
}

export function debugSetBloodMoon(rounds: number): void {
  if (session.state.bloodMoonRounds === rounds) return;
  session.state.bloodMoonRounds = rounds;
  session.events.push({ type: "bloodMoonChanged", rounds, cause: "card" });
}

export function debugKillEnemy(index: number): void {
  const enemy = session.state.enemies[index];
  if (!enemy?.alive) return;
  enemy.hp = 0;
  enemy.alive = false;
  enemy.statuses = [];
  enemy.armor = 0;
  session.events.push({ type: "unitDied", unitId: enemy.id });
  checkEnd();
}

export function debugAdjustHeroHp(index: number, delta: number): void {
  const hero = session.state.heroes[index];
  if (!hero?.alive) return;
  hero.hp = Math.max(0, Math.min(hero.maxHp, hero.hp + delta));
  if (hero.hp === 0) {
    hero.alive = false;
    hero.statuses = [];
    hero.armor = 0;
    session.events.push({ type: "unitDied", unitId: hero.id });
  }
  checkEnd();
}

export function describeEvent(
  state: CombatState,
  data: GameData,
  event: CombatEvent,
): string {
  const name = (unitId: string | null | undefined) =>
    unitId ? unitName(state, data, unitId) : "—";
  switch (event.type) {
    case "combatStarted":
      return "Bắt đầu trận";
    case "turnStarted":
      return `Lượt ${event.side === "hero" ? "người chơi" : "kẻ địch"} (vòng ${event.round})`;
    case "cardsDrawn":
      return `Rút ${event.instanceIds.length} lá`;
    case "deckShuffled":
      return "Xáo lại chồng bỏ";
    case "mulliganed":
      return `Đổi Bài ${event.returned.length} lá`;
    case "choiceOpened":
      return `Chiêm Bài: ${event.options.length} lá`;
    case "cardChosen":
      return "Chọn 1 lá";
    case "cardPlayed": {
      const instance = state.cards[event.instanceId];
      const card = instance ? data.cards[instance.cardId] : undefined;
      return `Đánh ${card?.name ?? event.instanceId} (cost ${event.cost})`;
    }
    case "cardDiscarded":
      return `Bỏ ${event.instanceIds.length} lá`;
    case "damageDealt":
      return `${name(event.sourceId)} → ${name(event.targetId)}: ${event.amount} (chặn ${event.blocked}, -${event.hpLost})`;
    case "hpLost":
      return `${name(event.targetId)} -${event.amount} HP (${event.cause})`;
    case "healed":
      return `${name(event.targetId)} +${event.amount} HP`;
    case "armorGained":
      return `${name(event.targetId)} +${event.amount} giáp`;
    case "armorRemoved":
      return `${name(event.targetId)} mất giáp`;
    case "statusApplied":
      return `${name(event.targetId)} +${event.status} ${event.value}`;
    case "statusRemoved":
      return `${name(event.targetId)} -${event.status}`;
    case "moonPowerChanged":
      return `Nguyệt Lực = ${event.value}`;
    case "moonReserveChanged":
      return `Dự Trữ ${event.side === "hero" ? "người chơi" : name(event.enemyId)} = ${event.value}`;
    case "deckedOut":
      return "Cạn Bài";
    case "cardsPurged":
      return `Tán Chiêu: ${name(event.heroId)} mất ${event.instanceIds.length} lá trong chồng`;
    case "moonShifted":
      return `Pha ${event.from} → ${event.to}`;
    case "bloodMoonChanged":
      return `Huyết Nguyệt còn ${event.rounds} vòng (${event.cause})`;
    case "intentsRevealed":
      return `${name(event.enemyId)} báo ${event.intents.map((i) => i.intentId).join(", ") || "Tụ Lực"} (NL ${event.moonPower})`;
    case "intentsCancelled":
      return `${name(event.enemyId)} bị hủy ${event.intentIds.join(", ")}`;
    case "intentExecuted":
      return `${name(event.enemyId)} thực hiện ${event.intentId} → ${name(event.targetId)}`;
    case "intentSkipped":
      return `${name(event.enemyId)} bỏ qua (${event.reason})`;
    case "intentFizzled":
      return `${name(event.enemyId)} hụt`;
    case "runRelicTriggered":
      return `Kỳ Vật: ${data.runRelics[event.runRelicId]?.name ?? event.runRelicId}`;
    case "heroLeveledUp":
      return `${name(event.heroId)} thăng cấp: ${event.name}`;
    case "unitDied":
      return `${name(event.unitId)} ngã`;
    case "combatEnded":
      return event.result === "won" ? "THẮNG" : "THUA";
  }
}
