import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile } from "rules";
import { clearEquipmentFilters, equipmentActionLabel, equipmentChange, equipmentCounts, equipmentNavigation, equipmentPassive } from "../src/ui/equipment-insights";
import { equipmentEffects } from "../src/ui/equipment-presentation";
const data = loadGameData();
const profile = createProfile(data);
profile.weapons = { w_xich_diem_thuong: { refinement: 3 }, w_thiet_thuan: { refinement: 5 }, w_anh_nguyet_chuy: { refinement: 2 } };
profile.relics = { r_vong_nguyet_kinh: { resonance: 2 } };
profile.currencies.darkIron = 96;
const filters = { query: "", rarity: "all", ownership: "owned", sort: "level" } as const;
describe("equipment decision insights", () => {
  it("counts matching definitions before applying ownership", () => {
    expect(equipmentCounts(data, profile, "weapons", { ...filters, query: "xich diem" }, true)).toEqual({ all: 1, owned: 1, upgrade: 1, locked: 0 });
    expect(equipmentCounts(data, profile, "weapons", { ...filters, query: "xich diem" }, false)).toMatchObject({ all: 1, owned: 1, upgrade: 0 });
    expect(equipmentCounts(data, profile, "weapons", { ...filters, ownership: "locked", query: "xich diem" }, true).owned).toBe(1);
  });
  it("clears search/filters while preserving the chosen ordering", () => {
    expect(clearEquipmentFilters({ ...filters, query: "test", rarity: "epic" })).toEqual({ query: "", rarity: "all", ownership: "all", sort: "level" });
  });
  it("compares resolved effects at consecutive real owned levels", () => {
    expect(equipmentChange(data, "weapons", "w_xich_diem_thuong", 3)).toContain("Sát thương: 7 → 9 (+2)");
    expect(equipmentChange(data, "weapons", "w_xich_diem_thuong", 2)).toContain("Nguyệt Lực: 4 → 3 (−1)");
    expect(equipmentChange(data, "relics", "r_vong_nguyet_kinh", 2).join(" ")).toContain("Giáp: 3 → 4 (+1)");
    expect(equipmentChange(data, "relics", "r_vong_nguyet_kinh", 5)).toEqual([]);
  });
  it("renders the effective passive without old overwritten numbers", () => {
    const current = equipmentPassive(data, "w_xich_diem_thuong", 5)!;
    expect(current.normal.join(" ")).toContain("Phản Đòn 3");
    expect(current.signature.join(" ")).toContain("Phản Đòn 5");
    expect(current.signature.join(" ")).toContain("Sức Mạnh 1");
    expect(current.normal.join(" ")).not.toContain("Phản Đòn 2");
    expect(equipmentEffects(data, "weapons", "w_xich_diem_thuong", 3).card?.ownerId).toBeUndefined();
  });
  it("preserves event frequency, actor and wearer conditions", () => {
    const text = equipmentPassive(data, "w_cam_ve_kich", 3)!;
    expect(text.normal.join(" ")).toContain("Đầu lượt người chơi");
    expect(text.signature.join(" ")).toContain("Phản Đòn 1");
    const all = Object.values(data.weapons).flatMap(w => equipmentPassive(data, w.id, 5)?.normal ?? []).join(" ");
    expect(all).toContain("Mỗi 2 lần");
    expect(all).toContain("người mang");
  });
  it("falls back rather than silently dropping unsupported passive mechanics", () => {
    const copy = structuredClone(data);
    (copy.weapons.w_xich_diem_thuong!.hooks[0] as any).futureCondition = true;
    expect(equipmentPassive(copy, "w_xich_diem_thuong", 1)).toBeNull();
  });
  it("keeps compound conditions and unknown status mechanics complete", () => {
    const copy=structuredClone(data), hook=copy.weapons.w_xich_diem_thuong!.hooks[0]!;
    (hook as any).on={type:"cardPlayed",owner:"wearer",tag:"attack",cardType:"skill"};
    expect(equipmentPassive(copy,"w_xich_diem_thuong",1)).toBeNull();
    (hook as any).on={type:"combatStart"};(hook.effects[0] as any).status="futureStatus";
    expect(equipmentPassive(copy,"w_xich_diem_thuong",1)).toBeNull();
  });
  it("retains full change prose when a numeric summary cannot cover new effects", () => {
    const copy=structuredClone(data), step=copy.weapons.w_xich_diem_thuong!.refinement[1]!;
    (step as any).card={...step.card,effects:[{type:"drawCards",amount:2}]};step.text="Rút thêm 2 lá và giảm chi phí.";
    expect(equipmentChange(copy,"weapons","w_xich_diem_thuong",2).join(" ")).toContain(step.text);
  });
  it("falls back for per-hero global effects rather than dropping repeated execution",()=>{
    const copy=structuredClone(data),hook=copy.weapons.w_xich_diem_thuong!.hooks[0]!;hook.actor="each";hook.effects=[{type:"drawCards",amount:1}];
    expect(equipmentPassive(copy,"w_xich_diem_thuong",1)).toBeNull();
    hook.effects=[{type:"gainArmor",amount:1,to:"allAllies"}];expect(equipmentPassive(copy,"w_xich_diem_thuong",1)).toBeNull();
  });
  it("labels actual upgrade eligibility instead of the preview level", () => {
    expect(equipmentActionLabel(data, profile, "weapons", "w_xich_diem_thuong", true, false)).toBe("Nâng lên Tinh Luyện 4");
    expect(equipmentActionLabel(data, profile, "weapons", "w_thiet_thuan", true, false)).toBe("Đã tối đa");
    expect(equipmentActionLabel(data, profile, "weapons", "w_xich_diem_thuong", false, false)).toBe("Cần kết nối");
    expect(equipmentActionLabel(data, profile, "weapons", "w_xich_diem_thuong", true, true)).toBe("Đang nâng…");
  });
  it("keeps left/right within rows and vertical movement in the final row", () => {
    expect(equipmentNavigation(3, "ArrowRight", 13)).toBe(3);
    expect(equipmentNavigation(4, "ArrowLeft", 13)).toBe(4);
    expect(equipmentNavigation(11, "ArrowDown", 13)).toBe(12);
    expect(equipmentNavigation(12, "ArrowUp", 13)).toBe(8);
    expect(equipmentNavigation(0, "ArrowLeft", 0)).toBe(-1);
  });
});
