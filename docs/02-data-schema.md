# 02 — Cấu trúc dữ liệu & API bộ luật

Các kiểu TypeScript dưới đây là **hợp đồng** giữa `packages/data`, `packages/rules` và `apps/client`. Viết lại thành file `.ts` trong `packages/rules/src/types/` và schema zod tương ứng trong `packages/data/src/schema.ts`.

---

## 1. Dữ liệu tĩnh (định nghĩa, nằm trong JSON)

### 1.1 Chung
```ts
export type Faction = "thanhLoan" | "huyenVu" | "bachLo" | "xichDien" | "neutral";
export type Archetype = "vanguard" | "striker" | "controller" | "support" | "specialist";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type MoonPhaseId =
  | "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous"
  | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";

export type StatusId =
  | "stealth" | "taunt" | "weak" | "vulnerable" | "mark"
  | "burn" | "regen" | "strength" | "empower" | "freeze"
  | "reflect" | "guard"                                    // GĐ2; GĐ7: Hộ Vệ
  | "charm";                                                // GĐ7: Mê Hoặc

export type CardTag =
  | "attack" | "assassin" | "control" | "moon" | "heal" | "forbidden"
  | "scheme" | "ward" | "harmony";                         // GĐ2: từ khóa phe
```

### 1.2 Hero — `heroes.json`
```ts
export interface HeroDef {
  id: string;               // "m05"
  name: string;             // "Hoắc Liệt" (hiển thị)
  faction: Faction;
  archetype: Archetype;
  rarity: Rarity;
  maxHp: number;
  cardIds: string[];        // đúng 6 lá miễn phí (GĐ 4b)
  lockedCardIds: string[];  // GĐ4b: đúng 6 lá khóa, mở bằng Tu Luyện (thay rewardCardIds); pool của Hero = cardIds + lockedCardIds (12 lá)
  branches: [HeroBranch, HeroBranch];  // GĐ4b: hai nhánh × 6 lá; hợp hai nhánh = pool 12 lá
  levelUp: LevelUpDef;
  art: { portrait: string; levelUp: string }; // đường dẫn ảnh, prototype có thể để trống ""
}

export interface HeroBranch {
  name: string;             // tên nhánh (chữ hiển thị), ví dụ "Huyết Chiến"
  cardIds: string[];        // đúng 6 lá thuộc pool của Hero
}

export type LevelUpCounter =
  | "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled"
  | "freezesApplied" | "buffsStolen"                       // GĐ2: F03, F02
  | "hitsIntercepted" | "schemeCardsPlayed" | "cardsChosen" // GĐ7 (M02, M01, M03)
  | "hpHealed" | "turnsSurvived" | "moonShifts"             // GĐ7 (M04, M07, M08)
  | "studyPoints" | "fullMoonsSeen" | "forbiddenHpLost"     // GĐ7 (M10, F01, F08)
  | "summonsMade" | "charmsApplied" | "intentsSealed"       // GĐ7b (F09, F06, F07)
  | "alliesFallen" | "debuffsApplied" | "backRowHits";      // GĐ7b (F10, M09, F05)
// GĐ7: schemeCardsPlayed và cardsChosen là bộ đếm của cả người chơi — mọi Hero còn
// sống của người đó được nhận +1, chỉ Hero có đúng bộ đếm thật sự tăng.
// GĐ7b: alliesFallen là bộ đếm của cả người chơi (mọi Hero của người đó ngã, kể cả
// chính Hero có bộ đếm này), tính cho Hero còn sống — không tăng cho Hero vừa ngã.

export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardDiscount"; amount: number }       // GĐ4a: M06 (thay firstOwnCardFreeEachTurn)
  | { type: "doubleDamageVsFrozen" }                       // GĐ2: F03
  | { type: "stealBonus" }                                 // GĐ2: F02
  // GĐ7 (`18` §2.1–§2.2) — 16 dạng mới:
  | { type: "armorPerTurn"; amount: number }               // M02 Thiết Bích
  | { type: "interceptArmor"; amount: number }             // M02 Trung Can
  | { type: "chooseMoon" }                                 // M08 Quan Tinh — Chọn Pha (01 §5.5)
  | { type: "freeChooseCardPerTurn"; look: number }        // M03 Vạn Kim — Chiêm Bài đầu lượt
  | { type: "none" }                                       // F01 dạng thường, M03 dạng thứ hai, F10 dạng thường (GĐ7b)
  | { type: "cheapestCardDiscount"; amount: number }       // M01 Thiên Cơ
  | { type: "chooseCardExtraLook"; amount: number }        // M01 Định Cục
  | { type: "healBonusOwnCards"; amount: number }          // M04 Tâm Nhãn
  | { type: "randomBuffPerTurn" }                          // M07 Huyết Mạch — bảng CombatConfig.levelUpRandomBuffs
  | { type: "bloodMoonImmune" }                            // M07 Huyết Nguyệt Chi Tử
  | { type: "moonShiftWeakensEnemies"; amount: number }    // M08 Tinh Mệnh
  | { type: "firstSchemeRepeats" }                         // M10 Bác Học
  | { type: "comboAttackBonus"; amount: number }           // M10 Trạng Nguyên
  | { type: "tagDiscountOwnCards"; tag: CardTag; amount: number } // F01 Tự Do
  | { type: "forbiddenNoSelfHpLoss" }                      // F08 Huyết Phượng
  | { type: "bloodMoonAttackBonus"; amount: number }       // F08 Phản Sư
  // GĐ7b (`18` §3.3) — Linh Thú, Mê Hoặc, Phong Ấn, Hồi Hồn, xuyên:
  | { type: "pierceOwnAttacks" }                           // F05 Xuyên Vân Tiễn
  | { type: "firstHitMarks"; rounds: number }               // F05 Biên Tái
  | { type: "charmMastery"; extraCharges: number; damageMultiplier: number }  // F06 Kinh Hồng Vũ
  | { type: "stealthOnCharm"; rounds: number }              // F06 Vũ Y
  | { type: "sealExtraFirstPerTurn" }                       // F07 Sử Bút
  | { type: "sealWeakens"; amount: number }                 // F07 Chép Sử
  | { type: "awakenSummons" }                               // F09 Thỏ Ngọc Thức Tỉnh
  | { type: "summonTaunts"; rounds: number }                // F09 Nguyệt Cung
  | { type: "armorOnAllyFall"; amount: number }             // F10 Vong Xuyên
  | { type: "debuffDurationBonus"; amount: number }         // M09 Vong Quốc Khúc
  | { type: "bonusVsDebuffed"; minDebuffs: number; amount: number };  // M09 Nam Chiếu Hồn

export interface LevelUpDef {
  name: string;             // "Liệt Hỏa"
  description: string;      // chữ hiển thị
  counter: LevelUpCounter;
  threshold: number;
  passive: LevelUpPassive;
  onLevelUp?: Effect[];     // GĐ7: chạy một lần ngay sau khi thăng cấp dạng thường (F01), Hero đó là đơn vị hành động
}
```

### 1.3 Lá bài — `cards.json`
```ts
export type CardType = "attack" | "skill";
export type CardTarget = "none" | "enemy" | "ally" | "fallenAlly";   // GĐ7b: fallenAlly — Hồi Hồn

export interface CardDef {
  id: string;               // "m05_liet_hoa_xung_phong"
  name: string;
  ownerId?: string;         // "m05" — lá thường
  bond?: { owners: [string, string] };  // GĐ2: lá Song Hành; đúng một trong ownerId / bond
  cost: number;
  copies: 1 | 2 | 3;        // GĐ4a: số bản của lá trong chồng bài (bắt buộc, designer đặt tay)
  type: CardType;
  tags: CardTag[];
  target: CardTarget;
  effects: Effect[];
  text: string;             // mô tả hiển thị
  requiresBloodMoon?: boolean;          // GĐ2: chỉ hợp lệ khi tags có "forbidden"
  keywords?: string[];      // GĐ4b: id từ khóa trong keywords.json (mục 1.9), client hiện khi di chuột
  token?: true;             // GĐ7: lá tạo ra trong trận (`createCard`, 01 §4.6) — không nằm trong pool, không xếp deck, không ở thưởng
}
```

### 1.4 Hệ thống hiệu ứng
```ts
export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies"
  | "owner" | "summon";   // GĐ7b: owner — chỉ trong SummonDef.action; summon — chỉ trên lá Hero/Song Hành

// GĐ2: mọi effect có thể có `actor?: 0 | 1` (index vào bond.owners, mặc định 0),
// chỉ hợp lệ trên lá Song Hành. Effect trong then/else không có actor thì kế thừa
// actor của conditional chứa nó.
export type Effect = (
  | { type: "damage"; amount: number; to: TargetRef; hits?: number }   // hits mặc định 1
  | { type: "heal"; amount: number; to: TargetRef; overflow?: "armor" } // GĐ4b: overflow = Dư Sinh; chỉ lá bài
  | { type: "loseHp"; amount: number; to: TargetRef }
  | { type: "gainArmor"; amount: number; to: TargetRef }
  | { type: "removeArmor"; to: TargetRef }
  | { type: "applyStatus"; status: StatusId; amount: number; to: TargetRef }
      // amount = thời hạn (loại Thời hạn), số tầng (Cộng dồn), giá trị (strength/empower/reflect), bỏ qua với freeze
  | { type: "cleanse"; to: TargetRef }                                   // gỡ mọi debuff
  | { type: "chooseCard"; look: number }                                 // GĐ4a: Chiêm Bài, look ≥ 1; thay "draw"
  | { type: "gainMoonPower"; amount: number }                            // cộng thẳng vào quỹ lượt
  | { type: "drainMoonPower"; amount: number; to: TargetRef; steal?: true }   // GĐ4b: Tỏa / Đoạt Nguyệt; to chỉ "chosen" | "allEnemies"; chỉ lá bài
  | { type: "gainMoonPowerPerTurn"; amount: number }                     // GĐ4b: Dưỡng Nguyệt; chỉ lá bài
  | { type: "missingHpDamage"; ratio: number; to: TargetRef; hits?: number }  // GĐ4b: Phẫn Huyết; lá bài và chiêu địch
  | { type: "burstRegen"; multiplier: number; to: TargetRef }            // GĐ4b: Tụ Dược; chỉ lá bài
  | { type: "shiftMoon"; amount: number }                                // âm = lùi pha
  | { type: "stealBuff"; count: number }                                 // GĐ2: từ mục tiêu chosen
  | { type: "bloodMoon"; rounds: number }                                // GĐ2
  | { type: "createCard"; cardId: string }                               // GĐ7: tạo lá token vào tay (01 §4.6); chỉ lá bài / levelUp.onLevelUp
  | { type: "drawCards"; amount: number }                                 // GĐ7: rút mù lá đầu chồng; thừa `handLimit` vào chồng bỏ (01 §4.2)
  | { type: "summon"; summonId: string }                                  // GĐ7b: triệu hồi/triệu hồi lại Linh Thú (01 §17.1); chỉ lá bài
  | { type: "sealIntent"; to: TargetRef }                                 // GĐ7b: Phong Ấn (01 §5.6); chỉ lá bài
  | { type: "revive"; ratio: number; to: "chosen" | "lastFallen" }        // GĐ7b: Hồi Hồn (01 §5.6); to "chosen" chỉ trên lá `target: "fallenAlly"`, "lastFallen" chỉ trong onLevelUp
  | { type: "extendDebuffs"; amount: number; to: TargetRef }              // GĐ7b: kéo dài debuff có thời hạn (01 §5.6); chỉ lá bài
  | { type: "conditional"; condition: Condition; then: Effect[]; else?: Effect[] }
  | { type: "execute"; threshold: number; to: TargetRef; elseEffects?: Effect[] }
      // GĐ6: chỉ trong effects của Hợp Kích (01 §16.4) — kẻ địch trong `to` có
      // hp ≤ floor(maxHp × threshold) ngã ngay, không qua giáp; không ai đủ
      // ngưỡng → chạy elseEffects.
) & { actor?: 0 | 1 };

export type Condition =
  | { type: "selfHpBelow"; ratio: number }          // hp / maxHp < ratio (nhỏ hơn hẳn)
  | { type: "targetHpAtOrBelow"; ratio: number }    // hp / maxHp <= ratio, mục tiêu chosen
  | { type: "selfHasStatus"; status: StatusId }
  | { type: "targetHasStatus"; status: StatusId }
  | { type: "moonPhaseIs"; phase: MoonPhaseId }
  | { type: "bloodMoonActive" };                    // GĐ2: bloodMoonRounds > 0
  | { type: "heldTurnsAtLeast"; turns: number }           // GĐ4b: Tích Tụ; chỉ lá bài
  | { type: "cardsPlayedThisTurnAtLeast"; count: number } // GĐ4b: Liên Hoàn; chỉ lá bài
```

**Quy tắc mở rộng:** thêm loại effect mới = thêm vào union + thêm `case` trong hàm `resolveEffect` + thêm test. Không viết logic riêng cho từng lá bài.

**[GĐ4a]** `chooseCard` chỉ được là **effect cuối cùng** trong `effects` của một lá (không nằm trong `conditional`); **không** dùng trong chiêu địch hay hook Kỳ Vật.

### 1.5 Kẻ địch — `enemies.json`
```ts
export type Targeting = "random" | "lowestHp" | "highestHp" | "front";
export type IntentKind = "attack" | "defend" | "buff" | "debuff" | "attackDefend" | "special";

export interface IntentDef {
  id: string;
  name: string;             // "Trọng Kích"
  kind: IntentKind;         // quyết định biểu tượng hiển thị
  targeting?: Targeting;    // bắt buộc nếu có effect to: "chosen"
  effects: Effect[];        // "self" = chính kẻ địch, "chosen" = Hero mục tiêu
}

export interface EnemyIntentDef extends IntentDef {
  cost: number;           // GĐ4a: số nguyên ≥ 0 — Nguyệt Lực địch trả để đánh chiêu
  alwaysPlan?: boolean;   // GĐ6: luôn có trong chuỗi khi đủ quỹ (lên trước weightedPick)
}

export interface EnemyDef {
  id: string;               // "puppet_guard"
  name: string;
  maxHp: number;
  intents: EnemyIntentDef[];        // GĐ4a: ≥ 1 (thay intentPattern)
  moonPower: { start: number; cap: number };   // GĐ4a: start ≤ cap; perRound dùng chung của CombatConfig
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];   // intent không có cost
  bloodMoonOverride?: IntentDef;  // GĐ2: ưu tiên hơn moonOverrides khi đang Huyết Nguyệt; không có cost
  phases?: BossPhaseDef[];        // GĐ6: boss nhiều giai đoạn (co-op); thiếu → địch thường
  art: { portrait: string };
}

// GĐ6 (01 §16.5): bộ chiêu thay thế từ lần lên chuỗi kế tiếp khi boss vào giai đoạn.
export interface BossPhaseDef {
  hpBelow: number;                 // tỉ lệ HP để vào giai đoạn (giai đoạn 1 = 1, sau giảm dần)
  intents: EnemyIntentDef[];       // thay EnemyDef.intents trong giai đoạn
  maxIntentsPerRound?: number;     // ghi đè combatConfig (boss co-op đánh nhiều chiêu hơn)
  onEnter?: Effect[];              // chạy ngay khi vào giai đoạn (đơn vị hành động: boss)
  bloodMoonWhileActive?: true;     // GĐ6: bloodMoonRounds không giảm dưới 1 (giai đoạn 2)
  reviveAfterRounds?: number;      // GĐ6: chỉ giai đoạn cuối — đếm ngược hồi sinh
}
```

### 1.6 Trận đấu — `encounters.json`
```ts
export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];       // 1–3, theo vị trí
  tier: "normal" | "elite" | "boss" | "coop";  // GĐ3; GĐ6: "coop" không vào bản đồ lượt chơi
  minFloor?: number;                  // GĐ3, mặc định 1
}
```

### 1.7 Pha trăng — `moon-phases.json`
```ts
export type MoonModifier =
  | { type: "damageMultiplierForTag"; tag: CardTag; multiplier: number }
  | { type: "stealthDurationBonus"; amount: number }
  | { type: "costModifierForTag"; tag: CardTag; amount: number; min: number }
  | { type: "healMultiplier"; multiplier: number }
  | { type: "armorMultiplier"; multiplier: number };

export interface MoonPhaseDef {
  index: number;            // 0–7
  id: MoonPhaseId;
  name: string;
  icon: string;             // emoji tạm thời
  modifiers: MoonModifier[];
}
```

### 1.8 Cấu hình trận đấu — `combat-config.json` [GĐ4a]
```json
{
  "moonPower": { "start": 3, "perRound": 1, "cap": 8 },
  "moonReserveMax": 3,
  "chooseCardDiscount": 1,
  "handSize": 6,
  "handLimit": 8,
  "maxMulligan": 2,
  "maxIntentsPerRound": 3,
  "bloodMoonHpLoss": 2,
  "levelUpRandomBuffs": [
    { "status": "strength", "amount": 1 },
    { "status": "empower", "amount": 3 },
    { "status": "regen", "amount": 3 },
    { "status": "reflect", "amount": 2 }
  ]
}
```

```ts
export interface CombatConfig {
  moonPower: { start: number; perRound: number; cap: number };
  moonReserveMax: number; // Nguyệt Lực Dự Trữ tối đa
  chooseCardDiscount: number; // lá lấy qua Chiêm Bài giảm chừng này NL tới hết lượt
  handSize: number;       // mốc rút bù đầu lượt, ≥ 1
  handLimit: number;      // GĐ7: trần cứng của tay — effect vượt quá thì lá mới vào chồng bỏ (01 §4.2)
  maxMulligan: number;    // số lá đổi tối đa khi Đổi Bài
  maxIntentsPerRound: number;  // số chiêu tối đa trong chuỗi của một kẻ địch
  bloodMoonHpLoss: number;     // HP mỗi Hero mất đầu lượt khi Huyết Nguyệt
  levelUpRandomBuffs: { status: StatusId; amount: number }[];   // GĐ7: bảng buff của Huyết Mạch (M07), bốc bằng RNG của trận
}
```

Mọi số nguyên ≥ 0; `moonPower.start ≤ moonPower.cap`; `handSize ≥ 1`. `GameData` thêm `combatConfig` (mục 4).

### 1.9 Từ khóa — `keywords.json` [GĐ4b]
```ts
export interface KeywordDef {
  id: string;
  name: string;             // chữ hiển thị, ví dụ "Tích Tụ"
  text: string;             // giải thích một câu, tiếng Việt
}
```

`keywords.json` là mảng `KeywordDef`: 8 từ khóa GĐ4b (`tich_tu`, `lien_hoan`, `toa_nguyet`, `doat_nguyet`, `duong_nguyet`, `phan_huyet`, `du_sinh`, `tu_duoc`) + `chiem_bai` + các trạng thái đã có (`an_than`, `khieu_khich`, `suy_yeu`, `de_vo`, `danh_dau`, `thieu_dot`, `hoi_phuc`, `suc_manh`, `cuong_hoa`, `dong_bang`, `phan_don`) + `huyet_nguyet`. `GameData.keywords: Record<string, KeywordDef>` (mục 4); `CardDef.keywords` trỏ id trong bảng này, client hiện khi di chuột lên lá.

### 1.10 Cấu hình meta — `meta-config.json` [GĐ4b]
```json
{
  "masteryLevels": [30, 110, 230, 390, 590, 830],
  "masteryXp": { "perFloor": 10, "win": 50, "heroLevelUp": 10 },
  "deckSize": 18,
  "minCardsPerHero": 4,
  "maxDecks": 30
}
```

```ts
export interface MetaConfig {
  masteryLevels: number[];   // XP cộng dồn cho cấp 1…6; tăng dần; độ dài = số lá khóa mỗi Hero (6)
  masteryXp: { perFloor: number; win: number; heroLevelUp: number };
  deckSize: number;
  minCardsPerHero: number;
  maxDecks: number;
}
```

`GameData` thêm `metaConfig: MetaConfig` (mục 4).

### 1.11 Kinh tế, nhiệm vụ, thành tựu, banner [GĐ4c–4d]

Luật đầy đủ ở `14-meta-rules.md` §1, §5–§11.

| File | Kiểu | `GameData` |
|---|---|---|
| `economy-config.json` | `EconomyConfig` (`14` §1): `starterHeroIds` (4c); `starterGift`, `pullCost`, `runRewards`, `resetUtcHour`, `gacha`, `dupeMoonStar`, `moonStarShop` (4d) | `economyConfig` |
| `missions.json` | `MissionDef[]` (`14` §7) | `missions: Record<id, MissionDef>` |
| `achievements.json` | `AchievementDef[]` (`14` §8) | `achievements: Record<id, AchievementDef>` |
| `banners.json` | `BannerDef[]` (`14` §9) | `banners: Record<id, BannerDef>` |

Trường mới **[GĐ4d]**:

```ts
// heroes.json
levelUp: LevelUpDef & { constellationThreshold: number };   // ≤ threshold (Tinh Hồn 2)
signature: { cardId: string; plusCardId: string };          // Tinh Hồn 4
// cards.json
plusOf?: string;   // lá "+" của lá chủ lực: cùng ownerId, cost, copies; không thuộc pool Hero nào
```

Kiểm tra khi nạp thêm: id nhiệm vụ / thành tựu / banner / mặt hàng duy nhất; `bondCardId`
của thành tựu là lá Song Hành; pool banner là Hero có thật, đúng độ hiếm, không trùng;
`signature` khớp luật trên; mọi lá có `plusOf` được đúng một Hero dùng làm `plusCardId`.

### 1.12 Binh Khí, Nguyệt Bảo, dạng thăng cấp thứ hai [GĐ4e]

Luật: `01` §8 (dạng thứ hai), `01` §14, `14` §10.1, §13. Nội dung: `03` §7.

| File | Kiểu | `GameData` |
|---|---|---|
| `weapons.json` | `WeaponDef[]` | `weapons: Record<id, WeaponDef>` |
| `relics.json` | `RelicDef[]` | `relics: Record<id, RelicDef>` |

```ts
interface WeaponDef {
  id: string; name: string; rarity: Rarity;
  archetype?: Archetype;            // vũ khí chung (chỉ để hiển thị)
  signatureHeroId?: string;         // vũ khí bản mệnh
  text: string;                     // nội tại R1 (hiển thị)
  card: Omit<CardDef, "id" | "ownerId" | "copies" | "plusOf"> & { copies: 1 | 2 };
  hooks: WeaponHook[];              // 01 §14.3
  signatureHooks?: WeaponHook[];    // chỉ khi có signatureHeroId
  refinement: WeaponRefinement[];   // đúng 4 mục: R2, R3, R4, R5
}
interface WeaponRefinement {
  text: string;                     // mô tả phần thay đổi (hiển thị)
  card?: Partial<WeaponDef["card"]>;
  hooks?: WeaponHook[];
  signatureHooks?: WeaponHook[];
}
interface RelicDef {
  id: string; name: string; rarity: Rarity;
  resonance: { text: string; modifiers?: MoonModifier[]; hooks?: RunRelicHook[] }[];  // đúng 5 cấp
}
// heroes.json
altLevelUp: { name: string; description: string; passive: LevelUpPassive; onLevelUp?: Effect[] };
// LevelUpPassive thêm: armorBonusOwnCards(amount) | healCleanses | firstComboCountsExtra(amount)
//                      | firstHitVulnerable(rounds) | bloodMoonOwnCardDiscount(amount)
// MoonModifier costModifierForTag thêm: while?: "bloodMoon"
// HookTrigger: cardPlayed thêm owner?: "wearer"; enemyKilled thêm killer?: "wearer" (chỉ trong WeaponHook)
// banners.json: kind "weapon" | "relic"; economy-config: gearDupeMoonStar; meta-config: maxRelics
```

Kiểm tra khi nạp thêm: id vũ khí / Nguyệt Bảo duy nhất và không trùng id lá, Kỳ Vật, Lõi,
Hero; `signatureHeroId` là Hero có thật; `signatureHooks` chỉ khi có `signatureHeroId`;
`card` (sau mỗi cấp Tinh Luyện) hợp lệ như `CardDef` (target, effect, từ khóa);
`refinement` đúng 4 mục, `resonance` đúng 5 cấp; hook vũ khí / Nguyệt Bảo theo ràng buộc
của Lõi (`11` §3.3); `actor` / `owner` / `killer` `"wearer"` chỉ trong hook vũ khí;
`onLevelUp` theo ràng buộc effect của lá không có mục tiêu chọn (`to` ≠ `"chosen"`).

### 1.13 Cấu hình PvP — `pvp-config.json` [GĐ5]

```ts
export interface PvpConfig {
  heroStats: Record<string, { maxHp: number }>;   // HP trận Đấu Trường theo Hero
  trialHeroIds: string[];                          // Hero thử: chơi được khi chưa sở hữu
  freeWeaponIds: string[];                         // vũ khí cơ bản, miễn phí (Tinh Luyện 1)
  freeRelicIds: string[];                          // Nguyệt Bảo cơ bản, miễn phí (Cộng Minh 1)
  secondPlayerBonus: { moonPower: number };        // bù người đi sau, lượt đầu (01 §15.2)
  turnSeconds: number;                             // 60 — giới hạn một lượt (server đếm)
  mulliganSeconds: number;                         // 30 — giới hạn Đổi Bài
  timeoutsToForfeit: number;                       // 3 — số lượt hết giờ liên tiếp → thua
  reconnectSeconds: number;                        // 60 — chờ kết nối lại trước khi thua
  roundCap: number;                                // 30 — trần vòng, quá tròn → hòa
  tiers?: { id: string; name: string; minRating: number }[];    // bậc xếp hạng (§5d)
  // cửa hàng Vinh Dự — `item` như mặt hàng Nguyệt Tinh + "relicChoice"; giá bằng Vinh Dự
  honorShop?: {
    id: string;
    item: ShopItemDef["item"] | { type: "relicChoice"; rarity: Rarity };
    cost: number;
    limitPerWeek?: number;
    limitPerMonth?: number;                      // kỳ tháng theo monthKey (`14` §14.4)
  }[];
  emotes?: string[];                               // câu biểu cảm cố định
}
```

Kiểm tra khi nạp: `heroStats` phủ mọi Hero trong `heroes.json` (id lạ → lỗi);
`trialHeroIds`, `freeWeaponIds`, `freeRelicIds` tham chiếu id có thật; mọi số > 0;
`roundCap` chẵn.

```ts
// Một bên trận PvP (17 §4.1)
export interface PvpSide {
  heroIds: [string, string, string];
  deckCardIds?: string[];   // 18 ô như CombatSetup; thiếu = lá mặc định của đội
  loadout: Loadout;         // pvp: true — từ buildPvpLoadout (14 §12)
}
```

### 1.14 Cấu hình co-op — `coop-config.json`, `coop-combos.json` [GĐ6]

```ts
export interface CoopConfig {
  turnSeconds: number;        // 45 — giới hạn lượt đồng đội (server đếm)
  reconnectSeconds: number;   // 60 — chờ kết nối lại trước khi Hero người đó ngã
  encounterId: string;        // "enc_coop_01" — encounter tier "coop" dựng trận
  rewards: {                  // thưởng mỗi người mỗi trận có thưởng (`14` §15)
    win: CoopReward;          //   { moonJade, moonDust } — thắng
    loss: CoopReward;         //   thua (không bỏ cuộc)
    firstWinOfDay: CoopReward;//   cộng thêm cho trận thắng đầu tiên trong ngày
  };
  rewardedMatchesPerDay: number; // 3 — trần trận có thưởng mỗi kỳ ngày
  emotes: string[];           // biểu cảm nhanh trong trận co-op
}

export interface CoopReward { moonJade: number; moonDust: number; }

// Một đòn Hợp Kích: hai lá của hai người khác nhau (01 §16.4).
export interface CoopComboDef {
  id: string;
  name: string;
  text: string;                                // mô tả hiển thị
  parts: [CardMatcher, CardMatcher];           // mỗi lá của một người; thứ tự không quan trọng
  limit: { perRound: 1; perCombat?: number };
  effects: Effect[];                           // đơn vị hành động: Hero đánh lá kích hoạt
}

export interface CardMatcher {
  tag?: CardTag;                               // lá có tag này
  ownerId?: string;                            // Hero (defId) sở hữu lá
  appliesStatus?: StatusId;                    // lá có applyStatus này (kể cả trong conditional)
  effect?: Effect["type"];                     // lá có effect loại này (kể cả trong conditional)
  moonPhaseAfter?: MoonPhaseId;                // sau khi lá kích hoạt giải quyết, pha là pha này
}
```

Kiểm tra khi nạp: `ownerId` trỏ Hero tồn tại; `appliesStatus`/`effect`/`moonPhaseAfter`
tham chiếu id có thật; `effects` của Hợp Kích mới được dùng `execute` (§6); `limit` hợp
lệ.

### 1.15 Linh Thú — `summons.json` [GĐ7b]

Luật: `01` §17.

```ts
export interface SummonDef {
  id: string;
  name: string;
  maxHp: number;
  targeting: "lowestHp" | "front" | "random";   // chọn kẻ địch cho effect `to: "chosen"` trong action
  action: Effect[];                              // chạy mỗi cuối lượt người chơi (01 §17.2)
  awakenedId?: string;                           // dùng thay khi nội tại đang có hiệu lực của Hero chủ là `awakenSummons`
}
```

`GameData.summons: Record<string, SummonDef>` (mục 4).

Kiểm tra khi nạp: `awakenedId` trỏ tới Linh Thú có sẵn; `action` không dùng `summon`,
`chooseCard`, `createCard` hay `to: "summon"`; `action` chỉ dùng `to` thuộc `chosen`
(kẻ địch theo `targeting`), `self`, `allEnemies`, `allAllies`, `owner`; effect `summon`
(trên lá bài hay lồng trong `conditional`) trỏ tới Linh Thú có thật; `to: "owner"` chỉ
xuất hiện trong `SummonDef.action`; `to: "summon"` chỉ xuất hiện trên lá có `ownerId`
hoặc `bond` (lá Hero / Song Hành), không trong `SummonDef.action`, ý định kẻ địch,
`moonOverrides` / `bloodMoonOverride`, hook Kỳ Vật / vũ khí / Nguyệt Bảo, hay `effects`
của Hợp Kích. `summon`, `sealIntent`, `revive`, `extendDebuffs` bị cấm ở mọi chỗ cấm
`createCard` (§6).

---

## 2. Trạng thái trận đấu (runtime)

```ts
export interface StatusInstance {
  id: StatusId;
  value: number;            // thời hạn / số tầng / giá trị tùy loại; freeze dùng 1; reflect = HP phản; charm = số lượt còn dùng (GĐ7b)
  sourceId?: string;        // mark: id Hero đã đánh dấu; guard: id Hero hộ vệ (GĐ7); charm: id người gây Mê Hoặc (GĐ7b)
}

export interface UnitState {
  id: string;               // "hero:m05", "enemy:0"
  defId: string;            // "m05", "puppet_guard"
  side: "hero" | "enemy";
  position: number;         // 0–2
  hp: number;
  maxHp: number;
  armor: number;
  statuses: StatusInstance[];
  alive: boolean;
}

export interface HeroState extends UnitState {
  side: "hero";
  levelUpCounter: number;
  leveledUp: boolean;
  firstCardDiscountUsedThisTurn: boolean;   // GĐ4a: cho nội tại M06 (tên cũ: freeCardUsedThisTurn)
  firstCardDiscountActive: boolean;         // GĐ4a: true từ lượt sau khi M06 thăng cấp
  firstSchemeUsedThisTurn?: boolean;        // GĐ7: Bác Học (M10) — lá scheme đầu tiên lượt này đã giải quyết 2 lần
  firstSealUsedThisTurn?: boolean;          // GĐ7b: Sử Bút (F07) — Phong Ấn đầu tiên lượt này đã hủy thêm 1 chiêu
  firstHitUsedThisTurn?: boolean;           // GĐ7b: Biên Tái (F05) — lượt damage đầu tiên lượt này đã áp Đánh Dấu
  revived?: true;                            // GĐ7b: đã được Hồi Hồn (chặn lần hai, 01 §5.6)
}

export interface EnemyState extends UnitState {
  side: "enemy";
  // GĐ4a: bỏ patternIndex, currentIntent
  plannedIntents: { intent: IntentDef; cost: number; targetId: string | null }[];
  lastIntentIds: string[];   // chuỗi đã lên vòng trước
  moonPower: number;         // quỹ của vòng đã lên chuỗi
  moonReserve: number;       // Dự Trữ sẽ mang sang vòng sau
  sealedIntentIds?: string[]; // GĐ7b: id chiêu bị Phong Ấn vòng này — cộng vào lastIntentIds rồi xóa (01 §5.6)
}

export interface CardInstance {
  instanceId: string;       // "c01"; lá Song Hành: "bond01"; lá tạo ra: "t<n>" / "p<i>_t<n>" (GĐ7)
  cardId: string;
  ownerIds: string[];       // id Hero, ví dụ ["m05"]; lá Song Hành: 2 id theo thứ tự bond.owners
  heldTurns: number;        // GĐ4b: số lượt đã nằm trên tay (Tích Tụ); 0 khi lá vào tay
  turnDiscount?: number;    // GĐ7: Thiên Cơ (M01) — giảm cost chỉ trong lượt này, xóa cuối lượt
  sealSurcharge?: number;   // GĐ7b: PvP Phong Ấn — +1 cost chỉ tới hết lượt kế của chủ lá (01 §5.6), xóa ở endSeatTurn của người sở hữu lá
}

// GĐ7b: Linh Thú trên bàn (01 §17). Cùng phe Hero, không bao giờ quyết định thắng/thua.
export interface SummonState extends UnitState {
  side: "hero";
  player: number;            // seat của Hero chủ
  ownerHeroId: string;       // unit id của Hero triệu hồi
  summonId: string;          // id SummonDef đang dùng (đổi khi thức tỉnh)
}

export type CombatStatus = "mulligan" | "playerTurn" | "choosing" | "enemyTurn" | "won" | "lost"
  | "opponentTurn";   // [GĐ5] chỉ xuất hiện trong viewFor của seat đang chờ, không lưu state (17 §4.2)
export type CombatMode = "pve" | "pvp" | "coop";   // [GĐ5] spec 17 §2.2

// [GĐ7] Lựa chọn người chơi phải trả lời trước khi hành động (01 §3.1, §5.5).
export type PendingChoice =
  | { kind: "chooseCard"; options: string[] }      // Chiêm Bài — chọn instanceId
  | { kind: "chooseMoon"; options: number[] };     // Chọn Pha — chọn offset 0|1|2

// [GĐ5] Mọi thứ gắn với một người chơi nằm trong PlayerState; PvE = đúng 1 người chơi.
export interface PlayerState {
  index: number;            // 0 hoặc 1
  heroIds: string[];        // unit id của các Hero của người chơi này
  drawPile: string[]; hand: string[]; discardPile: string[];
  moonPower: number; moonReserve: number; moonPowerBonus: number;
  cardsPlayedThisTurn: number;
  pendingChoice: PendingChoice | null;
  moonChoicePending?: true; // GĐ7: nợ Chọn Pha lượt này (Hero `chooseMoon` đã thăng cấp lúc đầu lượt)
  createdCards?: number;    // GĐ7: số lá đã tạo trong trận (`createCard`) — đặt tên instance `t<n>` kế tiếp
  purged?: Record<string, string[]>;   // GĐ7b: unit id Hero → instanceId lá bị Tán Chiêu lúc ngã, để Hồi Hồn xáo lại (01 §5.6)
  fallenOrder?: string[];   // GĐ7b: unit id Hero theo thứ tự ngã, dùng cho revive `to: "lastFallen"` (01 §5.6)
  weapons: CombatWeapon[];                       // GĐ4e
  relics: { id: string; resonance: number }[];   // GĐ4e
  runRelicIds: string[];                         // GĐ3 (chỉ PvE: Kỳ Vật, Lõi)
  hookCounters: Record<string, number>;          // tên cũ: runRelicCounters
  done: boolean;                                 // co-op: đã bấm Xong (17 §8.3)
}

export interface CombatState {
  mode: CombatMode;         // [GĐ5]
  status: CombatStatus;
  activePlayer: number;     // [GĐ5] PvP: người đang có lượt; PvE / co-op: 0
  round: number;
  moonIndex: number;        // 0–7
  bloodMoonRounds: number;  // > 0 = đang Huyết Nguyệt (01 mục 7.4)
  players: PlayerState[];   // [GĐ5] PvE: 1; PvP, co-op: 2
  heroes: HeroState[];      // HeroState thêm `player: number` (chỉ số trong players)
  enemies: EnemyState[];    // PvP: rỗng
  summons?: SummonState[];  // [GĐ7b] Linh Thú; absent tới khi có triệu hồi đầu tiên (01 §17.1)
  cards: Record<string, CardInstance>;  // theo instanceId
  rngState: number;
  winner?: number | "draw"; // PvP (17 §4.6)
  // [GĐ6] co-op (`01` §16.2/§16.5):
  comboUsed?: Record<string, { total: number; round: number }>;  // tổng trận + vòng dùng gần nhất
  playedThisTurn?: { player: number; instanceId: string; cardId: string; comboId?: string; moonAfter: number }[];  // xóa đầu mỗi lượt đồng đội
  boss?: { enemyId: string; phase: number; reviveCountdown: number | null; revived: boolean };
}
```

**[GĐ5] Quy tắc id có tiền tố** (spec `17` §2.2): khi trận có 2 người chơi, unit id và
instance id có tiền tố `p<n>_` (`p0_m05`, `p1_c12`, `p1_wpn_m05_1`) để hai người chơi được
chọn cùng Hero / cùng lá. PvE giữ id cũ không tiền tố (`m05`, `c12`…) để phiếu lượt chơi
cũ chạy lại được. Truy cập thành phần theo người chơi qua `players.ts` (`playerOf`,
`activePlayerState`, `alliesOf`, `opponentsOf`, `prefixedId`); **không** đọc trường trong
`players[i]` bằng tay ngoài các hàm đó.

---

## 3. Hành động & sự kiện

```ts
export type Action =
  | { type: "mulligan"; instanceIds: string[]; player?: number }   // GĐ4a; [GĐ5] PvP: seat nào đổi
  | { type: "playCard"; instanceId: string; targetId?: string; player?: number }   // [GĐ5] seat thực hiện
  | { type: "chooseCard"; instanceId: string; player?: number }    // GĐ4a: Chiêm Bài (01 §3.2)
  | { type: "chooseMoon"; offset: 0 | 1 | 2; player?: number }     // GĐ7: Chọn Pha (01 §5.5)
  | { type: "endTurn"; player?: number }
  | { type: "forfeit"; player: number; reason: "resign" | "timeout" | "disconnect"; system: true };   // [GĐ5] chỉ server tạo (01 §15.6)
```

**[GĐ5]** `player` mặc định `activePlayer`. Trận 2 người chơi: Action có `player` ≠
`activePlayer` → lỗi `"not your turn"` (riêng `mulligan` nhận cả hai seat vì đổi song
song, và `forfeit` luôn hợp lệ — là action hệ thống). `forfeit` không phải Action client
gửi được; nó chỉ xuất hiện trong nhật ký trận do server chèn.

Action hợp lệ theo `status` **[GĐ4a]**:

| `status` | Action hợp lệ | Lỗi khác |
|---|---|---|
| `mulligan` | `mulligan` | `"mulligan pending"` |
| `playerTurn` | `playCard`, `endTurn` | `mulligan` → `"mulligan already done"`; `chooseCard` / `chooseMoon` → `"no pending choice"` |
| `choosing` | `chooseCard` / `chooseMoon` (theo `pendingChoice.kind`) | `"choice pending"` |
| `enemyTurn` / `won` / `lost` | — | như hiện tại |

```ts
export type CombatEvent =
  | { type: "combatStarted" }
  | { type: "turnStarted"; side: "hero" | "enemy"; round: number; player?: number }   // [GĐ5] PvP: seat có lượt (side luôn "hero")
  | { type: "cardsDrawn"; instanceIds: string[] }
  | { type: "deckShuffled" }                       // GĐ4a: chỉ khi xáo lúc tạo trận và sau Đổi Bài (không còn xáo chồng bỏ)
  | { type: "mulliganed"; returned: string[]; drawn: string[] }    // GĐ4a
  | { type: "choiceOpened"; options: string[] }                    // GĐ4a
  | { type: "cardChosen"; instanceId: string; bottomed: string[] } // GĐ4a
  | { type: "moonChoiceOpened"; options: number[]; player?: number } // GĐ7: Chọn Pha (01 §5.5)
  | { type: "cardCreated"; cardId: string; instanceId: string | null; player?: number } // GĐ7: instanceId null khi tay đầy (01 §4.6)
  | { type: "summoned"; unitId: string; summonId: string; ownerHeroId: string; player?: number }  // GĐ7b: Linh Thú tạo mới / triệu hồi lại / thức tỉnh (01 §17.1)
  | { type: "summonActed"; unitId: string }              // GĐ7b: Linh Thú hành động cuối lượt (01 §17.2)
  | { type: "summonDismissed"; unitId: string }          // GĐ7b: Linh Thú biến mất vì Hero chủ ngã (01 §17.4)
  | { type: "heroRevived"; heroId: string; hp: number; player?: number }  // GĐ7b: Hồi Hồn (01 §5.6; tên dùng lại của lượt chơi, `02` §7)
  | { type: "deckedOut" }                          // GĐ4a: ngay trước combatEnded { result: "lost" }; GĐ6 co-op: mang `player` — chỉ Hero người đó ngã
  | { type: "cardsPurged"; heroId: string; instanceIds: string[] } // GĐ4a: Tán Chiêu
  | { type: "moonReserveChanged"; side: "hero" | "enemy"; enemyId?: string; value: number }  // GĐ4a
  | { type: "cardPlayed"; instanceId: string; targetId?: string; cost: number }
  | { type: "cardDiscarded"; instanceIds: string[] }
  | { type: "damageDealt"; sourceId: string; targetId: string; amount: number; blocked: number; hpLost: number }
  | { type: "hpLost"; targetId: string; amount: number; cause: "loseHp" | "burn" | "reflect" | "bloodMoon" }
  | { type: "healed"; targetId: string; amount: number }
  | { type: "armorGained"; targetId: string; amount: number }
  | { type: "armorRemoved"; targetId: string }
  | { type: "statusApplied"; targetId: string; status: StatusId; value: number }
  | { type: "statusRemoved"; targetId: string; status: StatusId }
  | { type: "moonPowerChanged"; value: number }
  | { type: "moonShifted"; from: number; to: number; cause: "roundEnd" | "card" }
  | { type: "bloodMoonChanged"; rounds: number; cause: "roundEnd" | "card" }   // GĐ2; rounds 0 = hết
  | { type: "intentsRevealed"; enemyId: string; moonPower: number; intents: { intentId: string; cost: number; targetId: string | null }[] }  // GĐ4a: một event cho cả chuỗi mỗi địch (thay intentRevealed); chuỗi rỗng = Tụ Lực
  | { type: "intentsCancelled"; enemyId: string; intentIds: string[] }   // GĐ4b: Tỏa/Đoạt Nguyệt hủy chiêu cuối chuỗi, theo thứ tự bị bỏ (01 §9.5)
  | { type: "intentExecuted"; enemyId: string; intentId: string; targetId: string | null }   // một event mỗi chiêu trong chuỗi
  | { type: "intentFizzled"; enemyId: string; intentId: string }                             // một event mỗi chiêu trong chuỗi
  | { type: "intentSkipped"; enemyId: string; reason: "freeze" }                             // một event cho cả chuỗi bị bỏ
  | { type: "heroLeveledUp"; heroId: string; name: string }
  | { type: "unitDied"; unitId: string; killerId?: string }
  | { type: "runRelicTriggered"; runRelicId: string }   // GĐ3
  | { type: "relicTriggered"; relicId: string }          // GĐ4e (Nguyệt Bảo)
  | { type: "weaponTriggered"; weaponId: string; heroId: string }   // GĐ4e
  | { type: "playerForfeited"; player: number; reason: "resign" | "timeout" | "disconnect" }    // [GĐ5]
  | { type: "playerDisconnected"; player: number }                                             // [GĐ5]
  | { type: "coopComboTriggered"; comboId: string; cardIds: string[] }    // [GĐ6] trước event của effects (01 §16.4)
  | { type: "bossPhaseChanged"; enemyId: string; phase: number }          // [GĐ6] (01 §16.5)
  | { type: "combatEnded"; result: "won" | "lost" | "draw"; winner?: number | "draw" };   // [GĐ5] PvP
```

**[GĐ5]** Trong trận 2 người chơi, các event gắn với một seat mang thêm `player: number`:
`turnStarted`, `cardsDrawn`, `deckShuffled`, `mulliganed`, `choiceOpened`, `cardChosen`,
`deckedOut`, `cardsPurged`, `moonReserveChanged`, `cardPlayed`, `cardDiscarded`,
`moonPowerChanged`, `runRelicTriggered`, `relicTriggered`; **[GĐ7]** `moonChoiceOpened`,
`cardCreated`; **[GĐ7b]** `summoned`, `heroRevived`. PvE giữ event cũ không trường
`player` để nhật ký / bản ghi vàng khớp. Client PvP không nhận state thô — nhận gói
`{ events, view }` đã qua `viewFor` / `redactEvents` (`01` §15.7).

Event là **nguồn duy nhất** để client phát animation. Mọi thay đổi state có ý nghĩa hiển thị phải có event tương ứng, theo đúng thứ tự xảy ra.

---

## 4. API công khai của `packages/rules`

```ts
export interface GameData {
  heroes: Record<string, HeroDef>;
  cards: Record<string, CardDef>;
  enemies: Record<string, EnemyDef>;
  encounters: Record<string, EncounterDef>;
  moonPhases: MoonPhaseDef[];     // đúng 8 phần tử, theo index
  runRelics: Record<string, RunRelicDef>;  // GĐ3
  runConfig: RunConfig;                    // GĐ3
  combatConfig: CombatConfig;              // GĐ4a (mục 1.8)
  keywords: Record<string, KeywordDef>;    // GĐ4b (mục 1.9)
  metaConfig: MetaConfig;                  // GĐ4b (mục 1.10)
  summons: Record<string, SummonDef>;      // GĐ7b (mục 1.15)
}

export interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
  deckCardIds?: string[];                    // mặc định: cardIds của 3 Hero
  heroes?: { hp: number; maxHp: number }[];  // mặc định: hp = maxHp của HeroDef
  runRelicIds?: string[];                    // mặc định: []
}

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; error: string };

export function createCombat(data: GameData, setup: CombatSetup): { state: CombatState; events: CombatEvent[] };
export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult;

// [GĐ5] PvP (mục 1.13, luật 01 §15)
export function createPvpCombat(data: GameData, setup: { seed: number; players: [PvpSide, PvpSide] }): { state: CombatState; events: CombatEvent[] };
export function viewFor(state: CombatState, player: number): CombatState;                  // góc nhìn đã che (01 §15.7)
export function redactEvents(events: CombatEvent[], player: number): CombatEvent[];        // che event lộ bài đối thủ
export function replayMatch(data: GameData, setup: { seed: number; players: [PvpSide, PvpSide] }, actions: Action[]): { state: CombatState; events: CombatEvent[] };

// [GĐ6] co-op (mục 1.14, luật 01 §16)
export interface CoopSide { heroIds: [string, string, string]; deckCardIds?: string[]; loadout: Loadout }
export function createCoopCombat(data: GameData, setup: { seed: number; players: [CoopSide, CoopSide]; encounterId: string }): { state: CombatState; events: CombatEvent[] };
export function coopBot(data: GameData, view: CombatState, player: number): Action;   // bot trên góc nhìn (01 §16.4/§8.8 spec)

// Hỗ trợ UI
export function getEffectiveCost(data: GameData, state: CombatState, instanceId: string): number;
export function getValidTargets(data: GameData, state: CombatState, instanceId: string): string[];
export function isCardPlayable(data: GameData, state: CombatState, instanceId: string): boolean;
```

- `applyAction(endTurn)` chạy hết lượt kẻ địch và cuối vòng, trả về state đã ở **lượt người chơi kế tiếp** (hoặc trận đã kết thúc) cùng toàn bộ event.
- Hàm không mutate `state` đầu vào.

---

## 5. RNG

- Dùng thuật toán đơn giản, xác định (ví dụ mulberry32). `rngState` là số nguyên 32-bit lưu trong state.
- Hàm `nextRandom(rngState) → { value: number /* [0,1) */, rngState }`.
- Xáo bài: Fisher–Yates dùng RNG trên.
- Khởi tạo: `rngState = seed`.
- **Mọi** lần dùng ngẫu nhiên đều đi qua RNG này.

---

## 6. Kiểm tra dữ liệu khi nạp

Viết schema zod cho mọi kiểu ở mục 1 và các kiểm tra chéo:
- `cardIds` của Hero trỏ tới lá tồn tại và lá đó có `ownerId` đúng Hero.
- **[GĐ2]** Mỗi lá có **đúng một** trong `ownerId` / `bond`. `bond.owners` là 2 Hero tồn tại, khác nhau.
- **[GĐ2]** `actor` chỉ xuất hiện trên effect của lá có `bond` (kể cả effect lồng trong `conditional`).
- **[GĐ2]** `requiresBloodMoon: true` chỉ hợp lệ khi `tags` có `"forbidden"`.
- Lá có `target` khác `"none"` (`"enemy"`, `"ally"`, `"fallenAlly"` **[GĐ7b]**) phải có ít nhất một effect `to: "chosen"`; lá `target: "none"` không được có `to: "chosen"`.
- Ý định có effect `to: "chosen"` phải có `targeting`.
- `moonPhases` đủ 8 phần tử, `index` 0–7 không trùng.
- `enemyIds` của encounter trỏ tới kẻ địch tồn tại, 1–3 phần tử.
- **[GĐ4b]** `lockedCardIds` (thay `rewardCardIds` của GĐ3) trỏ tới lá tồn tại, `ownerId` = Hero đó, không trùng `cardIds`; `branches` chia đúng pool 12 lá (`cardIds + lockedCardIds`, không trùng); mỗi Hero có ≥ 2 lá miễn phí cost ≤ 3.
- **[GĐ3]** Đúng 1 trận `boss`; ≥1 trận `normal` có `minFloor` ≤ 1; ≥1 trận `elite`.
- **[GĐ3]** `runConfig`: mỗi tầng 1..`floors` có đúng 1 `floorRules`; tầng cuối là `boss` và chỉ tầng cuối có `boss`; `floorWidth.min ≤ max ≤ 2 × min`.
- **[GĐ3]** Effect Kỳ Vật không dùng `to: "chosen"`, `stealBuff`, `actor`, condition `target…`; `heroDied` không dùng `actor: "trigger"`.
- **[GĐ4a]** `copies` ∈ {1, 2, 3}; `intents` ≥ 1 phần tử, `cost` của chiêu là số nguyên ≥ 0; `EnemyDef.moonPower.start ≤ cap`; `combatConfig` hợp lệ (mọi số nguyên ≥ 0, `moonPower.start ≤ cap`, `handSize ≥ 1`).
- **[GĐ4a]** `chooseCard` chỉ được là **effect cuối cùng** trong `effects` của một lá (không nằm trong `conditional`); không dùng trong `EnemyIntentDef`, `moonOverrides`/`bloodMoonOverride` hay hook Kỳ Vật.
- **[GĐ4b]** `heldTurnsAtLeast`, `cardsPlayedThisTurnAtLeast`, `drainMoonPower`, `gainMoonPowerPerTurn`, `burstRegen`, `heal.overflow`: chỉ trên **lá bài**, không trong chiêu địch hay hook Kỳ Vật. `missingHpDamage`: lá bài và chiêu địch; không trong hook Kỳ Vật. `drainMoonPower.to` chỉ `chosen` (lá `target: "enemy"`) hoặc `allEnemies`.
- **[GĐ4b]** `CardDef.keywords`: mỗi id phải có trong `keywords.json`. `metaConfig`: `masteryLevels` tăng dần, độ dài = số lá khóa mỗi Hero (6).
- **[GĐ6]** `execute` chỉ xuất hiện trong `effects` của `coop-combos.json` (không lá bài, không chiêu địch, không hook). `CardMatcher`: `ownerId` trỏ Hero tồn tại; `appliesStatus`, `effect`, `moonPhaseAfter` tham chiếu id có thật. `BossPhaseDef.phases`: `hpBelow` giai đoạn 1 = 1, các giai đoạn sau giảm dần trong (0, 1]; `reviveAfterRounds` chỉ ở giai đoạn cuối; `bloodMoonWhileActive`, `alwaysPlan` là cờ boolean. Encounter `tier: "coop"` không xuất hiện trên bản đồ lượt chơi; `enemyIds` của nó trỏ địch có `phases` hợp lệ. `coopConfig.encounterId` trỏ encounter có `tier: "coop"`; `reconnectSeconds > turnSeconds`; các `reward`/`rewardedMatchesPerDay` không âm.
- **[GĐ7]** `createCard` (kể cả lồng trong `conditional` và trong `levelUp.onLevelUp` / `altLevelUp.onLevelUp`) phải trỏ tới lá `token` của **đúng Hero** tạo (`ownerId` = chủ lá / Hero đó); trên lá không có `ownerId` → lỗi. `token` không được nằm trong pool Hero nào (`cardIds` / `lockedCardIds` / `branches`), không được là lá "+" (`plusOf`) hay lá Song Hành (`bond`). `createCard` bị cấm ở mọi chỗ cấm `chooseCard`: chiêu địch, `moonOverrides` / `bloodMoonOverride`, hook Kỳ Vật / vũ khí / Nguyệt Bảo, `effects` của Hợp Kích. `combatConfig.levelUpRandomBuffs` ≥ 1 phần tử, `status` hợp lệ, `amount` nguyên dương.
- **[GĐ7b]** `summons.json` (`SummonDef`): kiểm chéo ở mục 1.15. `summon`, `sealIntent`,
  `revive`, `extendDebuffs` bị cấm ở mọi chỗ cấm `createCard` (dòng trên), cộng thêm
  `SummonDef.action` (mục 1.15) — Linh Thú không tự triệu hồi Linh Thú khác, không Phong
  Ấn, không Hồi Hồn, không kéo dài debuff. Lá có `target: "fallenAlly"` phải có đúng một
  effect `revive` với `to: "chosen"`; effect `revive` với `to: "chosen"` chỉ xuất hiện
  trên lá có `target: "fallenAlly"`; `revive` với `to: "lastFallen"` chỉ xuất hiện trong
  `levelUp.onLevelUp` / `altLevelUp.onLevelUp`, không trên lá bài. `to: "owner"` chỉ
  trong `SummonDef.action`; `to: "summon"` chỉ trên lá có `ownerId` hoặc `bond`.

Dữ liệu sai → báo lỗi rõ ràng ngay khi khởi động, không chạy game với dữ liệu lỗi.

---

## 7. Lượt chơi [GĐ3]

```ts
type RunStatus = "map" | "combat" | "reward" | "rest" | "treasure" | "won" | "lost";

interface RunState {
  status: RunStatus;
  rngState: number;
  heroes: { defId: string; hp: number; maxHp: number }[];  // theo thứ tự heroIds
  deck: string[];              // cardId, không gồm lá Song Hành
  heroLevelUps: Record<string, number>;  // GĐ4b: defId → số trận Hero thăng cấp trong lượt chơi (14 §2.1)
  runRelicIds: string[];       // theo thứ tự nhận
  map: RunMap;
  position: string | null;     // nút hiện tại; null = chưa vào tầng 1
  combat: CombatState | null;
  pendingReward: { cardChoices: string[]; runRelicId?: string } | null;
}

interface RunSetup {
  heroIds: [string, string, string];
  seed: number;
  deckCardIds: string[];       // GĐ4b: bắt buộc — deck đã chọn; `run.deck = deckCardIds` (14 §3.3)
}
```

```json
{
  "floors": 8,
  "floorWidth": { "min": 2, "max": 3 },
  "floorRules": [
    { "floors": [1], "type": "combat" },
    { "floors": [2, 3], "weights": { "combat": 80, "rest": 20 } },
    { "floors": [4], "type": "treasure" },
    { "floors": [5, 6], "weights": { "combat": 60, "elite": 25, "rest": 15 } },
    { "floors": [7], "type": "rest" },
    { "floors": [8], "type": "boss" }
  ],
  "restHealRatio": 0.3,
  "reviveHpRatio": 0.25,
  "rewardCardChoices": 3,
  "minDeckSize": 10
}
```

```ts
type NodeType = "combat" | "elite" | "rest" | "treasure" | "boss";
interface MapNode {
  id: string;          // "f3n1" = tầng 3, lane 1
  floor: number;       // 1..floors
  lane: number;        // 0..width-1
  type: NodeType;
  next: string[];      // id nút tầng sau, theo lane tăng dần
  encounterId?: string;// có với combat / elite / boss
}
interface RunMap { floors: MapNode[][] }  // floors[i] = tầng i+1, theo lane
```

```ts
type RunAction =
  | { type: "chooseNode"; nodeId: string }
  | { type: "combat"; action: Action }
  | { type: "pickCard"; cardId: string | null }
  | { type: "rest"; choice: "heal" }
  | { type: "rest"; choice: "removeCard"; cardId: string }
  | { type: "continue" };
```

```ts
type RunEvent =
  | { type: "nodeEntered"; nodeId: string; nodeType: NodeType }
  | { type: "cardAdded"; cardId: string }
  | { type: "cardRemoved"; cardId: string }
  | { type: "runRelicGained"; runRelicId: string }
  | { type: "heroRevived"; heroId: string; hp: number }      // heroId = defId ("m05")
  | { type: "restHealed"; heroId: string; amount: number }
  | { type: "runEnded"; result: "won" | "lost" };
```

```ts
interface RunRelicDef {
  id: string; name: string; text: string;
  modifiers?: MoonModifier[];
  hooks?: RunRelicHook[];
}
interface RunRelicHook {
  on: HookTrigger;
  actor: "trigger" | "each" | "lowestHp" | "front";
  every?: number;   // ≥ 2; kích hoạt khi bộ đếm của hook chia hết cho every
  effects: Effect[];
}
type HookTrigger =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  | { type: "cardPlayed"; tag?: CardTag; cardType?: CardType }
  | { type: "enemyKilled" }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase?: MoonPhaseId }
  | { type: "bloodMoonStarted" };
```

---

## 8. Hồ sơ và deck [GĐ4b]

Các kiểu của `packages/rules/src/types/meta.ts`; luật đầy đủ ở `14-meta-rules.md`. Mọi hàm `meta/*` là hàm thuần, không sửa input.

```ts
export interface Profile {
  version: 1;
  heroes: Record<string, { xp: number; unlockedCardIds: string[] }>;
  decks: SavedDeck[];
}

export interface SavedDeck {
  id: string;                        // "d1", "d2", …
  name: string;                      // 1–24 ký tự sau khi trim
  heroIds: [string, string, string]; // thứ tự = vị trí trong đội
  cardIds: string[];
}

export interface RunResult {
  heroIds: [string, string, string];
  floorReached: number;
  won: boolean;
  heroLevelUps: Record<string, number>; // defId → số trận Hero thăng cấp
}

export type DeckError =
  | { code: "badHeroes" }                          // không đủ 3 Hero khác nhau có trong data
  | { code: "wrongSize"; size: number }            // ≠ deckSize
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }        // không thuộc 3 Hero / lá Song Hành / không tồn tại
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };        // chưa mở (không miễn phí, không trong unlockedCardIds)
```
