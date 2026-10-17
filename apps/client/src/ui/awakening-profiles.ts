/** Each hero owns an illustration and a three-phase motion, never a recolored shared fallback. */
import { awakeningSheet } from "./awakening-flipbook";
export interface AwakeningPose { x?: number; y?: number; angle?: number; scale?: number }
export interface AwakeningMotion {
  charge: number; blend: number; release: number;
  from: AwakeningPose; peak: AwakeningPose; out: AwakeningPose;
}
export interface AwakeningProfile { texture: string; color: number; motion: AwakeningMotion }
function profile(texture: string, color: number, charge: number, blend: number,
  from: AwakeningPose, peak: AwakeningPose, out: AwakeningPose): AwakeningProfile {
  return { texture, color, motion: { charge, blend, release: 520-charge-blend, from, peak, out } };
}

export const HERO_AWAKENINGS: Readonly<Record<string, AwakeningProfile>> = {
  // Liệt Hỏa
  m05: profile("awakening_m05_fire_spear", 0xffb24c, 100, 140, {"y":16,"scale":0.84}, {"y":-10,"scale":1.04}, {"y":-26,"scale":1.12}),
  // Bách Thảo
  f04: profile("awakening_f04_herbal_bloom", 0xb7e68b, 140, 160, {"y":10,"scale":0.76}, {"y":-4,"scale":1.03}, {"y":-14,"scale":1.14}),
  // Hàn Sơn Kiếm
  f03: profile("awakening_f03_frost_swords", 0xaad8ff, 80, 160, {"y":26,"scale":0.92}, {"y":-12,"scale":1.02}, {"y":-30,"scale":1.08}),
  // Thiên Diện
  f02: profile("awakening_f02_fox_masks", 0xffb1b0, 140, 140, {"angle":-10,"scale":0.84}, {"angle":3,"scale":1.02}, {"angle":11,"y":-6,"scale":1.08}),
  // Thiên Cơ
  m01: profile("awakening_m01_heaven_talismans", 0xc4d5ff, 130, 150, {"angle":-8,"y":3,"scale":0.9}, {"angle":3,"y":-5,"scale":1.01}, {"angle":13,"x":4,"scale":1.06}),
  // Thiết Bích
  m02: profile("awakening_m02_iron_bulwark", 0xf3c785, 160, 120, {"y":6,"scale":1.08}, {"y":-1,"scale":1.02}, {"y":0,"scale":1.03}),
  // Vạn Kim
  m03: profile("awakening_m03_golden_fan", 0xf5db9b, 100, 180, {"y":-18,"angle":3,"scale":0.94}, {"y":3,"angle":0,"scale":1.01}, {"y":22,"angle":-4,"scale":1.07}),
  // Thần Y
  m04: profile("awakening_m04_jade_remedy", 0xb2efcf, 110, 170, {"y":16,"scale":0.88}, {"y":-8,"scale":1.02}, {"y":-22,"scale":1.1}),
  // Nguyệt Chủ
  f01: profile("awakening_f01_moon_blossoms", 0xd7e9ff, 140, 160, {"y":-22,"scale":0.96}, {"y":-2,"scale":1.02}, {"y":10,"scale":1.08}),
  // Vô Nguyệt
  m06: profile("awakening_m06_shadow_daggers", 0xb0bef5, 80, 140, {"x":-14,"y":-3,"scale":0.88}, {"x":3,"y":-6,"scale":1.02}, {"x":18,"y":-10,"scale":1.15}),
  // Huyết Mạch
  m07: profile("awakening_m07_blood_meridians", 0xf4a3ad, 160, 160, {"scale":0.78}, {"scale":1.09}, {"y":-6,"scale":1.12}),
  // Quan Tinh
  m08: profile("awakening_m08_star_astrolabe", 0xc0d6ff, 120, 180, {"angle":-14,"scale":0.92}, {"angle":5,"scale":1.03}, {"angle":18,"scale":1.08}),
  // Bác Học
  m10: profile("awakening_m10_scholar_scrolls", 0xeed6a7, 140, 180, {"angle":7,"y":9,"scale":0.82}, {"angle":-2,"y":-4,"scale":1.03}, {"angle":-9,"y":-12,"scale":1.08}),
  // Huyết Phượng
  f08: profile("awakening_f08_blood_phoenix", 0xffaaa1, 100, 140, {"y":10,"scale":0.72}, {"y":-6,"scale":1.09}, {"y":-18,"scale":1.18}),
  // Xuyên Vân Tiễn
  f05: profile("awakening_f05_cloud_arrow", 0xffd297, 70, 130, {"x":-10,"y":24,"scale":0.88}, {"x":4,"y":-10,"scale":1.02}, {"x":14,"y":-34,"scale":1.1}),
  // Kinh Hồng Vũ
  f06: profile("awakening_f06_azure_ribbons", 0xaed7ff, 130, 170, {"x":-8,"angle":-6,"scale":0.92}, {"x":6,"angle":4,"scale":1.03}, {"x":-4,"angle":-3,"y":-12,"scale":1.14}),
  // Sử Bút
  f07: profile("awakening_f07_history_brush", 0xc4d8ff, 120, 150, {"x":-12,"y":-10,"angle":-3,"scale":0.94}, {"x":2,"y":2,"angle":1,"scale":1.01}, {"x":14,"y":14,"angle":5,"scale":1.06}),
  // Thỏ Ngọc Thức Tỉnh
  f09: profile("awakening_f09_jade_rabbit", 0xf4e6b4, 100, 160, {"y":22,"angle":-5,"scale":0.8}, {"y":-16,"angle":3,"scale":1.02}, {"y":-8,"angle":0,"scale":1.12}),
  // Nguyệt Hồn
  f10: profile("awakening_f10_soul_lotus", 0xe2d4fb, 160, 160, {"y":24,"scale":0.88}, {"y":-6,"scale":1.01}, {"y":-28,"scale":1.1}),
  // Vong Quốc Khúc
  m09: profile("awakening_m09_sorrow_strings", 0xaadbd8, 120, 180, {"x":-3,"scale":0.9}, {"x":3,"scale":1.06}, {"x":-2,"y":-3,"scale":1.13}),
  // Ẩn Diệp
  m11: profile("awakening_m11_hidden_leaves", 0xf1a5a3, 80, 160, {"angle":10,"scale":0.84}, {"angle":-3,"scale":1.02}, {"angle":-18,"y":-14,"scale":1.19}),
  // Vũ Điệp
  f11: profile("awakening_f11_butterfly_fans", 0xc7eda6, 110, 170, {"x":-5,"y":10,"angle":-8,"scale":0.82}, {"x":5,"y":-8,"angle":5,"scale":1.04}, {"x":-3,"y":-18,"angle":-4,"scale":1.17}),
  // Thiết Bút
  f12: profile("awakening_f12_iron_brush", 0xbed8f5, 90, 130, {"x":12,"y":-18,"angle":5,"scale":0.94}, {"x":-3,"y":4,"angle":-2,"scale":1.02}, {"x":-14,"y":20,"angle":-6,"scale":1.12}),
  // Cổng Đồng
  m12: profile("awakening_bronze_gate", 0xe7b86a, 120, 160, {"scale":0.96}, {"scale":1}, {"y":-5,"scale":1.04}),
  // Bạch Đồng
  f13: profile("awakening_omen_pages", 0xbceef0, 120, 160, {"scale":0.96,"y":4}, {"y":-4,"angle":2,"scale":1.01}, {"y":-12,"angle":-4,"scale":1.06}),
};

export const AWAKENING_EFFECTS = Object.keys(HERO_AWAKENINGS).flatMap(awakeningEffectsFor);
export function awakeningEffectsFor(heroId: string): string[] {
  const profile = HERO_AWAKENINGS[heroId];
  return profile ? [profile.texture,awakeningSheet(heroId)] : [];
}
