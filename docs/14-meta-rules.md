# 14 — Luật hồ sơ, Tu Luyện và deck

Tài liệu này mô tả **chính xác** cách hồ sơ người chơi, Tu Luyện (mở lá khóa) và các deck đặt tên vận hành. Luật trận ở `01`, luật lượt chơi ở `11`. Thuật ngữ theo `04-glossary.md`. Bối cảnh và lý do thiết kế: `13-phase4b-spec.md` (4b), `15-phase4-spec.md` (4c). Phạm vi: giai đoạn 4b + 4c (hồ sơ nằm trên server; API ở `16-server-api.md`).

Hồ sơ là dữ liệu JSON thuần; mọi hàm dưới đây là hàm thuần trong `packages/rules` (`src/meta/`): nhận `Profile` và trả `Profile` mới, không sửa input. **[GĐ4c]** Hồ sơ lưu trên server; chỉ server gọi các hàm làm thay đổi hồ sơ rồi ghi lại, client chỉ giữ bản sao để hiển thị. `createRun` / `createCombat` không đọc hồ sơ — chỉ nhận danh sách lá.

---

## 1. Cấu hình — `meta-config.json`

```json
{
  "masteryLevels": [30, 110, 230, 390, 590, 830],
  "masteryXp": { "perFloor": 10, "win": 50, "heroLevelUp": 10 },
  "deckSize": 18,
  "minCardsPerHero": 4,
  "maxDecks": 30
}
```

`masteryLevels`: XP cộng dồn cho cấp 1…6; độ dài phải bằng số lá khóa mỗi Hero (6), tăng dần.

**[GĐ4c]** `economy-config.json` (mở rộng ở GĐ 4d):

```json
{ "starterHeroIds": ["m05", "f04", "m06"] }
```

`starterHeroIds`: 3 Hero khác nhau, có trong `heroes.json`; tài khoản mới sở hữu đúng các Hero này.

---

## 2. Hồ sơ và Tu Luyện

### 2.1 Kiểu

```ts
interface Profile {
  version: 2;                                   // [GĐ4c]; v1 = hồ sơ 4b (localStorage)
  heroes: Record<string, HeroProgress>;         // chỉ Hero đã sở hữu
  decks: SavedDeck[];
  currencies: { moonJade: number; moonStar: number; darkIron: number; moonDust: number };
  weapons: Record<string, { refinement: number }>;   // GĐ 4e; 4c: {}
  relics: Record<string, { resonance: number }>;     // GĐ 4e; 4c: {}
  pity: Record<string, { sinceEpic: number; sinceLegendary: number }>;  // GĐ 4d; 4c: {}
  missions: { dayKey: string; weekKey: string; progress: Record<string, number>; claimed: string[] }; // GĐ 4d; 4c: rỗng
  achievements: string[];                       // GĐ 4d; 4c: []
  stats: Record<string, number>;                // GĐ 4d; 4c: {}
  flags: { starterGiftClaimed: boolean; localImportDone: boolean };
}

interface HeroProgress {
  xp: number;
  unlockedCardIds: string[];
  constellation: number;       // 0–6, GĐ 4d; 4c: 0
  bonusUnlocks: number;        // lượt mở lá từ Tinh Hồn, GĐ 4d; 4c: 0
  levelUpForm: "base" | "alt"; // GĐ 4d; 4c: "base"
}

interface RunResult {
  heroIds: [string, string, string];
  floorReached: number;
  won: boolean;
  heroLevelUps: Record<string, number>; // defId → số trận Hero thăng cấp
}
```

`RunState` thêm `heroLevelUps: Record<string, number>`: khi một trận trong lượt chơi kết thúc (thắng hoặc thua), cộng số event `heroLeveledUp` của trận đó theo Hero (`heroId` "hero:m05" → "m05").

### 2.2 Hàm (`rules/src/meta/profile.ts`)

| Hàm | Luật |
|---|---|
| `createProfile(data)` | **[GĐ4c]** Chỉ Hero trong `economyConfig.starterHeroIds` (`m05`, `f04`, `m06`), mỗi Hero `{ xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" }`; tiền tệ 0; `decks`, `weapons`, `relics`, `pity`, `achievements`, `stats` rỗng; `missions` `{ dayKey: "", weekKey: "", progress: {}, claimed: [] }`; `flags` đều `false` |
| `masteryLevel(data, xp)` | Số mốc `masteryLevels` ≤ `xp` (0–6) |
| `pendingUnlocks(data, profile, heroId)` | `min(masteryLevel + bonusUnlocks, số lá khóa) − unlockedCardIds.length` (≥ 0); Hero chưa sở hữu → 0 |
| `summarizeRun(data, run)` | Chỉ khi `run.status` là `won`/`lost`; `floorReached` = tầng của `position` (0 nếu chưa vào nút nào) |
| `applyRunResult(data, profile, result)` | Mỗi Hero trong đội: `xp += perFloor × floorReached + (won ? win : 0) + heroLevelUp × heroLevelUps[id]`. Trả `{ profile, gains: { heroId, xp, levelBefore, levelAfter }[] }`; không sửa input |
| `unlockCard(data, profile, heroId, cardId)` | Lỗi: `"hero not owned"` **[GĐ4c]**, `"not a locked card"` (không thuộc `lockedCardIds`), `"already unlocked"`, `"no pending unlock"`. Hợp lệ → thêm vào `unlockedCardIds` |
| `parseProfile(data, raw)` | Mục 2.3 |

Chỉ lượt chơi cho XP; trận lẻ và lượt chơi bỏ ngang không cho.

### 2.3 `parseProfile`

- Không phải object / thiếu trường / sai kiểu → `{ profile: createProfile(data), reset: true }`.
- **[GĐ4c]** `version: 1` → chuyển sang v2: giữ `xp`, `unlockedCardIds` của Hero có trong v1 **và** thuộc `starterHeroIds` (các trường Hero mới lấy mặc định); Hero ngoài bộ khởi đầu bị bỏ (chưa sở hữu); giữ `decks` nguyên (deck dùng Hero chưa sở hữu vẫn lưu, không hợp lệ — `unownedHero`); mọi trường v2 khác lấy mặc định như `createProfile`.
- `version: 2`: từng trường kiểm kiểu; thiếu hoặc sai kiểu → mặc định của trường đó (không reset cả hồ sơ). `version` khác 1/2 → coi như hỏng.
- Hero không có trong data → bỏ. **[GĐ4c]** Hero trong data mà hồ sơ thiếu **không** được thêm (chưa sở hữu), trừ Hero trong `starterHeroIds`: luôn có (mặc định nếu thiếu).
- `unlockedCardIds` không thuộc `lockedCardIds` của Hero → bỏ (lượt mở tự quay lại vì được tính ra).
- Deck: giữ nguyên (kể cả không hợp lệ); chỉ bỏ deck sai kiểu cơ bản (thiếu `id`, `name`, `heroIds` 3 phần tử, `cardIds` mảng chuỗi).

### 2.4 Nhập hồ sơ cũ **[GĐ4c]**

`mergeImportedProfile(data, profile, local)` — `local` là hồ sơ `localStorage` (4b) đã qua `parseProfile`:

- `profile.flags.localImportDone` đã `true` → lỗi `"already imported"`.
- Với mỗi Hero **đã sở hữu** trong `profile`: `xp = max(xp, local.xp)`; `unlockedCardIds` = hợp của hai bên, chỉ giữ lá thuộc `lockedCardIds`, rồi cắt theo thứ tự (bên server trước) cho vừa `masteryLevel(xp mới) + bonusUnlocks`.
- `decks`: nối deck của `local` sau deck hiện có, mỗi deck cấp `id` mới như `saveDeck`; bỏ phần vượt `maxDecks`.
- Không nhập tiền tệ, vật phẩm, Hero chưa sở hữu.
- Đặt `flags.localImportDone = true`.

---

## 3. Deck

### 3.1 Kiểu và luật (`rules/src/meta/deck.ts`)

```ts
interface SavedDeck {
  id: string;                        // "d1", "d2", …
  name: string;                      // 1–24 ký tự sau khi trim
  heroIds: [string, string, string]; // thứ tự = vị trí trong đội
  cardIds: string[];
}

type DeckError =
  | { code: "badHeroes" }                          // không đủ 3 Hero khác nhau có trong data
  | { code: "unownedHero"; heroId: string }        // [GĐ4c] Hero chưa sở hữu
  | { code: "wrongSize"; size: number }            // ≠ deckSize
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }        // không thuộc 3 Hero / lá Song Hành / không tồn tại
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };        // chưa mở (không miễn phí, không trong unlockedCardIds)
```

`validateDeck(data, profile, deck): DeckError[]` — kiểm tra mọi luật, trả mọi lỗi theo thứ tự trên (rỗng = hợp lệ).

### 3.2 Hàm

| Hàm | Luật |
|---|---|
| `starterDeck(data, heroIds): string[]` (**[GĐ4c]** client chỉ đưa Hero đã sở hữu; server kiểm lại khi cấp phiếu) | Lá của "Bộ cơ bản": `cardIds` miễn phí của 3 Hero theo thứ tự đội; không lưu trong hồ sơ (tên hiển thị do client đặt) |
| `saveDeck(data, profile, draft)` | `draft.id` rỗng → deck mới, `id = "d" + (số lớn nhất hiện có + 1)`; có `id` → ghi đè. Lỗi: `"invalid name"`, `"too many decks"` (khi tạo mới lúc đã có `maxDecks`), `"unknown deck"` (ghi đè `id` không có). Deck không hợp lệ **vẫn lưu được** |
| `deleteDeck(profile, deckId)` | Lỗi `"unknown deck"` |

### 3.3 Lượt chơi và trận lẻ

- `RunSetup` thêm `deckCardIds: string[]` (bắt buộc). `createRun` ném lỗi nếu một lá không tồn tại hoặc không thuộc đội (như `createCombat`); `run.deck = deckCardIds`.
- Client chỉ vào trận với deck có `validateDeck` rỗng (Bộ cơ bản luôn hợp lệ).
- Trận lẻ: `CombatSetup.deckCardIds` sẵn có.
- **Lõi (augment):** sau mỗi trận thắng (không phải boss) chọn 1 trong `augmentChoices` Lõi từ `run-augments.json`, mỗi Lõi ≤1 lần/lượt; deck giữ nguyên suốt lượt (xem `11` §3.3).
- Nghỉ Chân / `minDeckSize` như cũ; deck trong lượt chơi chỉ nhỏ hơn 18 lá khi bỏ lá ở Nghỉ Chân.

---

## 4. Lượt chơi có xác nhận **[GĐ4c]**

Lượt chơi cho XP (và từ GĐ 4d: tiền tệ) chỉ khi server xác nhận bằng cách **chạy lại**. Route và lưu trữ: `16-server-api.md`.

### 4.1 Phiếu lượt chơi

- Server cấp phiếu `{ runId, setup: RunSetup, dataVersion }` cho một deck **hợp lệ** (`validateDeck` rỗng; Bộ cơ bản: `starterDeck` của 3 Hero đã sở hữu). `setup.seed` do server sinh (32 bit ngẫu nhiên); `setup` là ảnh chụp tại lúc cấp.
- Mỗi tài khoản tối đa 1 phiếu `open`; cấp phiếu mới → phiếu cũ `abandoned`.
- Phiếu `open` quá 7 ngày không nhận nộp (`"ticket expired"`).
- Client dựng lượt chơi bằng đúng `createRun(data, setup)` và ghi lại mọi `RunAction` đã được chấp nhận theo thứ tự.

### 4.2 `replayRun` (`rules/src/meta/replay.ts`)

```ts
function replayRun(data: GameData, setup: RunSetup, actions: RunAction[]):
  | { ok: true; run: RunState }
  | { ok: false; step: number; reason: string };
```

`createRun(data, setup)`, rồi `applyRunAction` lần lượt. Action thứ `step` (0-based) bị từ chối → `{ ok: false, step, reason: error }`; còn Action khi `run.status` đã là `won`/`lost` → `{ ok: false, step, reason: "actions after end" }`. Hàm thuần; cùng `data`, `setup`, `actions` luôn cho cùng `RunState` (T177).

### 4.3 Nộp kết quả

- Phiếu phải `open`, `dataVersion` khớp, `actions.length ≤ 20000`.
- `replayRun` lỗi → phiếu `rejected`, không thưởng.
- `run.status` chưa `won`/`lost` → từ chối (`"run not finished"`), phiếu vẫn `open`.
- Hợp lệ → `summarizeRun` → `applyRunResult` (§2.2) ghi vào hồ sơ; phiếu `finished`. Một phiếu chỉ nộp được một lần.

