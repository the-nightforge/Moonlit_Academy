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
  cardIds: string[];        // đúng 5 lá
  levelUp: LevelUpDef;
  art: { portrait: string; levelUp: string }; // đường dẫn ảnh, prototype có thể để trống ""
}

export type LevelUpCounter =
  | "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled"
  | "freezesApplied" | "buffsStolen";                      // GĐ2: F03, F02

export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardFreeEachTurn" }
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
  type: CardType;
  tags: CardTag[];
  target: CardTarget;
  effects: Effect[];
  text: string;             // mô tả hiển thị
  requiresBloodMoon?: boolean;          // GĐ2: chỉ hợp lệ khi tags có "forbidden"
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
  | { type: "heal"; amount: number; to: TargetRef }
  | { type: "loseHp"; amount: number; to: TargetRef }
  | { type: "gainArmor"; amount: number; to: TargetRef }
  | { type: "removeArmor"; to: TargetRef }
  | { type: "applyStatus"; status: StatusId; amount: number; to: TargetRef }
      // amount = thời hạn (loại Thời hạn), số tầng (Cộng dồn), giá trị (strength/empower/reflect), bỏ qua với freeze
  | { type: "cleanse"; to: TargetRef }                                   // gỡ mọi debuff
  | { type: "draw"; amount: number }
  | { type: "gainMoonPower"; amount: number }
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
```

**Quy tắc mở rộng:** thêm loại effect mới = thêm vào union + thêm `case` trong hàm `resolveEffect` + thêm test. Không viết logic riêng cho từng lá bài.

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

export interface EnemyDef {
  id: string;               // "puppet_guard"
  name: string;
  maxHp: number;
  intentPattern: IntentDef[];
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];
  bloodMoonOverride?: IntentDef;  // GĐ2: ưu tiên hơn moonOverrides khi đang Huyết Nguyệt
  art: { portrait: string };
}
```

### 1.6 Trận đấu — `encounters.json`
```ts
export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];       // 1–3, theo vị trí
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
  freeCardUsedThisTurn: boolean;   // cho nội tại M06
  freeCardActive: boolean;         // true từ lượt sau khi M06 thăng cấp
}

export interface EnemyState extends UnitState {
  side: "enemy";
  patternIndex: number;
  currentIntent: { intent: IntentDef; targetId: string | null } | null;
}

export interface CardInstance {
  instanceId: string;       // "c01"; lá Song Hành: "bond01"
  cardId: string;
  ownerIds: string[];       // id Hero, ví dụ ["m05"]; lá Song Hành: 2 id theo thứ tự bond.owners
}

export type CombatStatus = "playerTurn" | "enemyTurn" | "won" | "lost";

export interface CombatState {
  status: CombatStatus;
  round: number;
  moonIndex: number;        // 0–7
  bloodMoonRounds: number;  // > 0 = đang Huyết Nguyệt (01 mục 7.4)
  moonPower: number;
  heroes: HeroState[];
  enemies: EnemyState[];
  cards: Record<string, CardInstance>;  // theo instanceId
  drawPile: string[];       // instanceId, phần tử đầu = lá rút tiếp theo
  hand: string[];
  discardPile: string[];
  rngState: number;
}
```

---

## 3. Hành động & sự kiện

```ts
export type Action =
  | { type: "playCard"; instanceId: string; targetId?: string }
  | { type: "endTurn" };

export type CombatEvent =
  | { type: "combatStarted" }
  | { type: "turnStarted"; side: "hero" | "enemy"; round: number }
  | { type: "cardsDrawn"; instanceIds: string[] }
  | { type: "deckShuffled" }
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
  | { type: "intentRevealed"; enemyId: string; intentId: string; targetId: string | null }
  | { type: "intentExecuted"; enemyId: string; intentId: string; targetId: string | null }
  | { type: "intentFizzled"; enemyId: string; intentId: string }
  | { type: "intentSkipped"; enemyId: string; reason: "freeze" }
  | { type: "heroLeveledUp"; heroId: string; name: string }
  | { type: "unitDied"; unitId: string; killerId?: string }
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
}

export interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
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

Dữ liệu sai → báo lỗi rõ ràng ngay khi khởi động, không chạy game với dữ liệu lỗi.
