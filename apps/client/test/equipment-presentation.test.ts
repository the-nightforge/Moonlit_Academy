import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile } from "rules";
import { equipmentDecks, equipmentEffects, equipmentUpgrade, filterEquipment, initialEquipmentId, type EquipmentFilters } from "../src/ui/equipment-presentation";

const data = loadGameData();
const profile = createProfile(data);
profile.weapons = { w_xich_diem_thuong: { refinement: 3 }, w_thiet_thuan: { refinement: 5 }, w_anh_nguyet_chuy: { refinement: 2 } };
profile.relics = { r_vong_nguyet_kinh: { resonance: 2 } };
profile.currencies.darkIron = 64; profile.currencies.moonDust = 8;
const defaults: EquipmentFilters = { query: "", rarity: "all", ownership: "all", sort: "owned" };

describe("equipment collection", () => {
  it("finds Vietnamese names without accents and combines rarity/ownership", () => {
    expect(filterEquipment(data, profile, "weapons", { ...defaults, query: "XICH DIEM", rarity: "legendary", ownership: "owned" }, true).map(d => d.id)).toEqual(["w_xich_diem_thuong"]);
    expect(filterEquipment(data, profile, "weapons", { ...defaults, query: "xich diem", ownership: "locked" }, true)).toEqual([]);
    expect(filterEquipment(data, profile, "weapons", { ...defaults, query: "xich diem", rarity: "rare" }, true)).toEqual([]);
  });
  it("only offers affordable owned upgrades below five while online", () => {
    expect(filterEquipment(data, profile, "weapons", { ...defaults, ownership: "upgrade" }, true).map(d => d.id)).toEqual(["w_anh_nguyet_chuy"]);
    expect(filterEquipment(data, profile, "weapons", { ...defaults, ownership: "upgrade" }, false)).toEqual([]);
    expect(equipmentUpgrade(data, profile, "weapons", "w_xich_diem_thuong", true, false)).toMatchObject({ level: 3, cost: 65, have: 64, enabled: false, missing: 1 });
    expect(equipmentUpgrade(data, profile, "relics", "r_vong_nguyet_kinh", true, false)).toMatchObject({ level: 2, cost: 8, have: 8, enabled: true });
    expect(equipmentUpgrade(data, profile, "relics", "r_vong_nguyet_kinh", true, true).enabled).toBe(false);
    expect(equipmentUpgrade(data, profile, "weapons", "w_thiet_thuan", true, false)).toMatchObject({ level: 5, cost: null, enabled: false });
    expect(equipmentUpgrade(data, profile, "weapons", "w_liet_cung", true, false)).toMatchObject({ level: undefined, cost: null, enabled: false });
  });
  it("sorts by level with stable name ties without changing definitions", () => {
    const original = Object.keys(data.weapons);
    const sorted = filterEquipment(data, profile, "weapons", { ...defaults, sort: "level" }, true);
    expect(sorted.slice(0, 3).map(d => d.id)).toEqual(["w_thiet_thuan", "w_xich_diem_thuong", "w_anh_nguyet_chuy"]);
    expect(Object.keys(data.weapons)).toEqual(original);
    expect(filterEquipment(data, profile, "weapons", { ...defaults, sort: "rarity" }, true)[0]!.rarity).toBe("legendary");
  });
  it("resolves actual effective cards and replacing relic levels without mutating ownership", () => {
    expect(equipmentEffects(data, "weapons", "w_xich_diem_thuong", 3).card).toMatchObject({ cost: 3, text: "Gây 7 damage, Thiêu Đốt 2." });
    expect(equipmentEffects(data, "weapons", "w_xich_diem_thuong", 5).card).toMatchObject({ text: "Gây 9 damage, Thiêu Đốt 2." });
    expect(equipmentEffects(data, "relics", "r_vong_nguyet_kinh", 2).text).toBe("Mỗi lần trăng đổi pha: mọi Hero 3 giáp.");
    expect(profile.weapons.w_xich_diem_thuong!.refinement).toBe(3);
    const passive = equipmentEffects(data, "weapons", "w_cam_ve_kich", 3).passive;
    expect(passive).toContain("Đầu lượt người chơi: người mang +1 giáp");
    expect(passive).toContain("Lục Hàn Phong thêm Phản Đòn 1");
  });
  it("keeps a valid selection, prefers an owned item and derives usage per deck", () => {
    expect(initialEquipmentId(data, profile, "relics", "missing")).toBe("r_vong_nguyet_kinh");
    expect(initialEquipmentId(data, profile, "weapons", "w_liet_cung")).toBe("w_liet_cung");
    const decks = [{ id: "d1", name: "A", heroIds: ["m05", "f04", "m06"] as [string,string,string], cardIds: [], weapons: { m05: "w_xich_diem_thuong" }, relicIds: ["r_vong_nguyet_kinh"] }, { id: "d2", name: "B", heroIds: ["m05", "f04", "m06"] as [string,string,string], cardIds: [] }];
    expect(equipmentDecks(decks, "weapons", "w_xich_diem_thuong").map(d => d.id)).toEqual(["d1"]);
    expect(equipmentDecks(decks, "relics", "r_vong_nguyet_kinh").map(d => d.id)).toEqual(["d1"]);
  });
});
