import type { Effect, GameData, Profile, WeaponHook } from "rules";
import { relicAt, weaponAt } from "rules";
import { equipmentDefaults, equipmentTag, equipmentUpgrade, filterEquipment, type EquipmentFilters, type EquipmentKind } from "./equipment-presentation";
const TAGS: Record<string,string> = { attack: "tấn công", control: "khống chế", assassin: "ám sát", heal: "hồi phục", moon: "nguyệt", forbidden: "cấm", scheme: "mưu lược", ward: "hộ thể", harmony: "điều hòa" };
const STATUS_KEYS: Record<string,string> = { stealth:"an_than", taunt:"khieu_khich", weak:"suy_yeu", vulnerable:"de_vo", mark:"danh_dau", burn:"thieu_dot", regen:"hoi_phuc", strength:"suc_manh", empower:"cuong_hoa", freeze:"dong_bang", reflect:"phan_don", guard:"ho_ve", charm:"me_hoac" };
const statusName = (data:GameData,id:string) => data.keywords[STATUS_KEYS[id] ?? ""]?.name;

export const equipmentText = (text: string) => text.replace(/\bdamage\b/g, "sát thương");
export function clearEquipmentFilters(filters: EquipmentFilters): EquipmentFilters { return { ...equipmentDefaults(), sort: filters.sort }; }
export function equipmentCounts(data: GameData, profile: Profile, kind: EquipmentKind, filters: EquipmentFilters, online: boolean) {
  const base = { ...filters, ownership: "all" as const };
  return { all: filterEquipment(data, profile, kind, base, online).length,
    owned: filterEquipment(data, profile, kind, { ...base, ownership: "owned" }, online).length,
    upgrade: filterEquipment(data, profile, kind, { ...base, ownership: "upgrade" }, online).length,
    locked: filterEquipment(data, profile, kind, { ...base, ownership: "locked" }, online).length };
}
export function equipmentActionLabel(data: GameData, profile: Profile, kind: EquipmentKind, id: string, online: boolean, busy: boolean) {
  const up = equipmentUpgrade(data, profile, kind, id, online, busy);
  return up.level === undefined ? "Chưa sở hữu" : up.cost === null ? "Đã tối đa" : busy ? "Đang nâng…" : !online ? "Cần kết nối" : up.missing ? "Thiếu nguyên liệu" : `Nâng lên ${equipmentTag(kind)} ${up.level + 1}`;
}
export function equipmentNavigation(index: number, key: string, count: number): number {
  if (!count) return -1;
  const i = Math.max(0, Math.min(count - 1, index));
  if (key === "ArrowLeft") return i % 4 ? i - 1 : i;
  if (key === "ArrowRight") return i % 4 < 3 && i + 1 < count ? i + 1 : i;
  if (key === "ArrowUp") return i >= 4 ? i - 4 : i;
  if (key === "ArrowDown") return Math.min(count - 1, i + 4);
  return i;
}
const labels: Record<string, string> = { damage: "Sát thương", gainArmor: "Giáp", heal: "Hồi HP", gainMoonPower: "Nguyệt Lực", gainMoonPowerPerTurn: "Nguyệt Lực mỗi lượt", drawCards: "Rút lá" };
function numericDiff(data: GameData, before: readonly Effect[], after: readonly Effect[]): string[] {
  // Compare only complete, matching effects. Changed targets/conditions need their full prose.
  if (before.length !== after.length) return [];
  const result: string[] = [];
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!, b = after[i]!;
    const plain = (effect: Effect) => JSON.stringify({ ...effect, amount: undefined });
    if (plain(a) !== plain(b)) return [];
    if (!("amount" in a) || !("amount" in b) || typeof a.amount !== "number" || typeof b.amount !== "number" || a.amount === b.amount) continue;
    const label = a.type === "applyStatus" ? statusName(data, a.status) : labels[a.type];
    if (!label) return [];
    const delta = b.amount - a.amount;
    result.push(`${label}: ${a.amount} → ${b.amount} (${delta > 0 ? "+" : "−"}${Math.abs(delta)})`);
  }
  return result;
}
export function equipmentChange(data: GameData, kind: EquipmentKind, id: string, from: number): string[] {
  if (from < 1 || from >= 5) return [];
  if (kind === "weapons") {
    const def = data.weapons[id]!, a = weaponAt(def, from), b = weaponAt(def, from + 1), change = def.refinement[from - 1]!;
    const diff = numericDiff(data, a.card.effects, b.card.effects);
    if (a.card.cost !== b.card.cost) diff.unshift(`Nguyệt Lực: ${a.card.cost} → ${b.card.cost} (${b.card.cost > a.card.cost ? "+" : "−"}${Math.abs(b.card.cost - a.card.cost)})`);
    if (change.hooks || change.signatureHooks) diff.push(`Nội tại: ${equipmentText(change.text)}`);
    return diff.length ? diff : [equipmentText(change.text)];
  }
  const def = data.relics[id]!, a = relicAt(def, from), b = relicAt(def, from + 1);
  const ah = a.hooks ?? [], bh = b.hooks ?? [];
  if (ah.length === bh.length && ah.every((h, i) => JSON.stringify({ ...h, effects: undefined }) === JSON.stringify({ ...bh[i], effects: undefined }))) {
    const diff = ah.flatMap((h, i) => numericDiff(data, h.effects, bh[i]!.effects));
    if (diff.length) return diff;
  }
  return [equipmentText(b.text)];
}
function only(object: object, keys: string[]) { return Object.keys(object).every(k => keys.includes(k)); }
function describeHook(data: GameData, hook: WeaponHook): string | null {
  if (!only(hook, ["on", "actor", "every", "effects"]) || !only(hook.on, ["type", "tag", "cardType", "owner", "killer", "phase"])) return null;
  const on = hook.on;
  let trigger: string;
  switch (on.type) {
    case "combatStart": trigger = "Đầu trận"; break;
    case "playerTurnStart": trigger = "Đầu lượt người chơi"; break;
    case "playerTurnEnd": trigger = "Cuối lượt người chơi"; break;
    case "bloodMoonStarted": trigger = "Huyết Nguyệt bắt đầu"; break;
    case "moonPhaseEntered": trigger = on.phase ? `Trăng chuyển sang ${data.moonPhases.find(p => p.id === on.phase)?.name ?? on.phase}` : "Trăng đổi pha"; break;
    case "enemyKilled": trigger = on.killer === "wearer" ? "Người mang hạ địch" : "Một địch bị hạ"; break;
    case "heroDied": trigger = "Một Hero bị hạ"; break;
    case "cardPlayed": {
      const tag = on.tag ? TAGS[on.tag] : on.cardType === "attack" ? "Tấn công" : on.cardType === "skill" ? "Kỹ năng" : on.cardType ? null : "bất kỳ";
      if (!tag) return null;
      trigger = `${on.owner === "wearer" ? "Người mang" : "Đội"} chơi lá ${tag}`; break;
    }
    default: return null;
  }
  const actor = ({ wearer: "người mang", each: "mọi Hero", lowestHp: "Hero ít HP nhất", front: "Hero tuyến đầu" } as Record<string, string>)[hook.actor];
  if (!actor) return null; // 'trigger' depends on event context: do not invent a target.
  const descriptions: string[] = [];
  for (const effect of hook.effects) {
    if (!only(effect, ["type", "amount", "to", "status"])) return null;
    const to = "to" in effect ? effect.to : undefined;
    const target = to === "allEnemies" ? "mọi địch" : to === "allAllies" ? "mọi Hero" : to === "self" || to === undefined ? actor : null;
    if (!target) return null;
    if (effect.type === "cleanse") descriptions.push(`${target} xóa hiệu ứng xấu`);
    else if ("amount" in effect && typeof effect.amount === "number") {
      if (effect.type === "applyStatus") descriptions.push(`${target} ${statusName(data, effect.status)} ${effect.amount}`);
      else if (effect.type === "gainArmor") descriptions.push(`${target} +${effect.amount} giáp`);
      else if (effect.type === "heal") descriptions.push(`${target} hồi ${effect.amount} HP`);
      else if (effect.type === "damage") descriptions.push(`${target} nhận ${effect.amount} sát thương`);
      else if (effect.type === "gainMoonPower") descriptions.push(`đội +${effect.amount} Nguyệt Lực`);
      else if (effect.type === "gainMoonPowerPerTurn") descriptions.push(`đội +${effect.amount} Nguyệt Lực mỗi lượt`);
      else if (effect.type === "drawCards") descriptions.push(`đội rút ${effect.amount} lá`);
      else return null;
    } else return null;
  }
  return `${hook.every && hook.every > 1 ? `Mỗi ${hook.every} lần ` : ""}${trigger}: ${descriptions.join("; ")}.`;
}
/** All-or-nothing: unsupported mechanics retain the original/history text in the scene. */
export function equipmentPassive(data: GameData, id: string, level: number): { normal: string[]; signature: string[] } | null {
  const resolved = weaponAt(data.weapons[id]!, level);
  const normal = resolved.hooks.map(h => describeHook(data,h)), signature = (resolved.signatureHooks ?? []).map(h => describeHook(data,h));
  if ([...normal, ...signature].some(line => line === null)) return null;
  return { normal: normal as string[], signature: signature as string[] };
}
