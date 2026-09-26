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
  | "reflect";                                             // GĐ2

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
  | "freezesApplied" | "buffsStolen";                      // GĐ2: F03, F02

export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardDiscount"; amount: number }       // GĐ4a: M06 (thay firstOwnCardFreeEachTurn)
  | { type: "doubleDamageVsFrozen" }                       // GĐ2: F03
  | { type: "stealBonus" };                                // GĐ2: F02

export interface LevelUpDef {
  name: string;             // "Liệt Hỏa"
  description: string;      // chữ hiển thị
  counter: LevelUpCounter;
  threshold: number;
  passive: LevelUpPassive;
}
```

### 1.3 Lá bài — `cards.json`
```ts
export type CardType = "attack" | "skill";
export type CardTarget = "none" | "enemy" | "ally";

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
}
```

### 1.4 Hệ thống hiệu ứng
```ts
export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies";

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
  | { type: "conditional"; condition: Condition; then: Effect[]; else?: Effect[] }
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
}

export interface EnemyDef {
  id: string;               // "puppet_guard"
  name: string;
  maxHp: number;
  intents: EnemyIntentDef[];        // GĐ4a: ≥ 1 (thay intentPattern)
  moonPower: { start: number; cap: number };   // GĐ4a: start ≤ cap; perRound dùng chung của CombatConfig
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];   // intent không có cost
  bloodMoonOverride?: IntentDef;  // GĐ2: ưu tiên hơn moonOverrides khi đang Huyết Nguyệt; không có cost
  art: { portrait: string };
}
```

### 1.6 Trận đấu — `encounters.json`
```ts
export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];       // 1–3, theo vị trí
  tier: "normal" | "elite" | "boss";  // GĐ3
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
  "maxMulligan": 2,
  "maxIntentsPerRound": 3,
  "bloodMoonHpLoss": 2
}
```

```ts
export interface CombatConfig {
  moonPower: { start: number; perRound: number; cap: number };
  moonReserveMax: number; // Nguyệt Lực Dự Trữ tối đa
  chooseCardDiscount: number; // lá lấy qua Chiêm Bài giảm chừng này NL tới hết lượt
  handSize: number;       // số lá trên tay, ≥ 1
  maxMulligan: number;    // số lá đổi tối đa khi Đổi Bài
  maxIntentsPerRound: number;  // số chiêu tối đa trong chuỗi của một kẻ địch
  bloodMoonHpLoss: number;     // HP mỗi Hero mất đầu lượt khi Huyết Nguyệt
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

---

## 2. Trạng thái trận đấu (runtime)

```ts
export interface StatusInstance {
  id: StatusId;
  value: number;            // thời hạn / số tầng / giá trị tùy loại; freeze dùng 1; reflect = HP phản
  sourceId?: string;        // mark: id Hero đã đánh dấu
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
}

export interface EnemyState extends UnitState {
  side: "enemy";
  // GĐ4a: bỏ patternIndex, currentIntent
  plannedIntents: { intent: IntentDef; cost: number; targetId: string | null }[];
  lastIntentIds: string[];   // chuỗi đã lên vòng trước
  moonPower: number;         // quỹ của vòng đã lên chuỗi
  moonReserve: number;       // Dự Trữ sẽ mang sang vòng sau
}

export interface CardInstance {
  instanceId: string;       // "c01"; lá Song Hành: "bond01"
  cardId: string;
  ownerIds: string[];       // id Hero, ví dụ ["m05"]; lá Song Hành: 2 id theo thứ tự bond.owners
  heldTurns: number;        // GĐ4b: số lượt đã nằm trên tay (Tích Tụ); 0 khi lá vào tay
}

export type CombatStatus = "mulligan" | "playerTurn" | "choosing" | "enemyTurn" | "won" | "lost";   // GĐ4a: mulligan, choosing

export interface CombatState {
  status: CombatStatus;
  round: number;
  moonIndex: number;        // 0–7
  bloodMoonRounds: number;  // > 0 = đang Huyết Nguyệt (01 mục 7.4)
  moonPower: number;        // quỹ hiện tại của người chơi (gốc + Dự Trữ + cộng thêm)
  moonReserve: number;      // GĐ4a: Dự Trữ mang vào lượt này (để UI hiển thị)
  moonPowerBonus: number;   // GĐ4b: quỹ cộng thêm mỗi đầu lượt (Dưỡng Nguyệt), không trần
  cardsPlayedThisTurn: number;  // GĐ4b: số lá đã đánh trong lượt (Liên Hoàn); 0 đầu lượt
  pendingChoice: { kind: "chooseCard"; options: string[] } | null;   // GĐ4a: Chiêm Bài đang chờ chọn
  heroes: HeroState[];
  enemies: EnemyState[];
  cards: Record<string, CardInstance>;  // theo instanceId
  drawPile: string[];       // instanceId, phần tử đầu = lá rút tiếp theo
  hand: string[];
  discardPile: string[];
  rngState: number;
  runRelicIds: string[];                  // GĐ3
  runRelicCounters: Record<string, number>;  // GĐ3: "<relicId>#<hookIndex>"
}
```

---

## 3. Hành động & sự kiện

```ts
export type Action =
  | { type: "mulligan"; instanceIds: string[] }        // GĐ4a: Đổi Bài (01 §2.1)
  | { type: "playCard"; instanceId: string; targetId?: string }
  | { type: "chooseCard"; instanceId: string }         // GĐ4a: Chiêm Bài (01 §3.2)
  | { type: "endTurn" };
```

Action hợp lệ theo `status` **[GĐ4a]**:

| `status` | Action hợp lệ | Lỗi khác |
|---|---|---|
| `mulligan` | `mulligan` | `"mulligan pending"` |
| `playerTurn` | `playCard`, `endTurn` | `mulligan` → `"mulligan already done"`; `chooseCard` → `"no pending choice"` |
| `choosing` | `chooseCard` | `"choice pending"` |
| `enemyTurn` / `won` / `lost` | — | như hiện tại |

```ts
export type CombatEvent =
  | { type: "combatStarted" }
  | { type: "turnStarted"; side: "hero" | "enemy"; round: number }
  | { type: "cardsDrawn"; instanceIds: string[] }
  | { type: "deckShuffled" }                       // GĐ4a: chỉ khi xáo lúc tạo trận và sau Đổi Bài (không còn xáo chồng bỏ)
  | { type: "mulliganed"; returned: string[]; drawn: string[] }    // GĐ4a
  | { type: "choiceOpened"; options: string[] }                    // GĐ4a
  | { type: "cardChosen"; instanceId: string; bottomed: string[] } // GĐ4a
  | { type: "deckedOut" }                          // GĐ4a: ngay trước combatEnded { result: "lost" }
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
  | { type: "combatEnded"; result: "won" | "lost" };
```

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
- Lá có `target: "enemy" | "ally"` phải có ít nhất một effect `to: "chosen"`; lá `target: "none"` không được có `to: "chosen"`.
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
