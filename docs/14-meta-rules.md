# 14 — Luật hồ sơ, Tu Luyện và deck

Tài liệu này mô tả **chính xác** cách hồ sơ người chơi, Tu Luyện (mở lá khóa) và các deck đặt tên vận hành. Luật trận ở `01`, luật lượt chơi ở `11`. Thuật ngữ theo `04-glossary.md`. Bối cảnh và lý do thiết kế: `13-phase4b-spec.md`. Phạm vi: giai đoạn 4b (vẫn offline).

Hồ sơ là dữ liệu JSON thuần; mọi hàm dưới đây là hàm thuần trong `packages/rules` (`src/meta/`): nhận `Profile` và trả `Profile` mới, không sửa input. Chỉ client đọc/ghi `localStorage`; `createRun` / `createCombat` không đọc hồ sơ — chỉ nhận danh sách lá.

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

---

## 2. Hồ sơ và Tu Luyện

### 2.1 Kiểu

```ts
interface Profile {
  version: 1;
  heroes: Record<string, { xp: number; unlockedCardIds: string[] }>;
  decks: SavedDeck[];
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
| `createProfile(data)` | Mọi Hero `{ xp: 0, unlockedCardIds: [] }`, `decks: []` |
| `masteryLevel(data, xp)` | Số mốc `masteryLevels` ≤ `xp` (0–6) |
| `pendingUnlocks(data, profile, heroId)` | `masteryLevel − unlockedCardIds.length` (≥ 0) |
| `summarizeRun(data, run)` | Chỉ khi `run.status` là `won`/`lost`; `floorReached` = tầng của `position` (0 nếu chưa vào nút nào) |
| `applyRunResult(data, profile, result)` | Mỗi Hero trong đội: `xp += perFloor × floorReached + (won ? win : 0) + heroLevelUp × heroLevelUps[id]`. Trả `{ profile, gains: { heroId, xp, levelBefore, levelAfter }[] }`; không sửa input |
| `unlockCard(data, profile, heroId, cardId)` | Lỗi: `"not a locked card"` (không thuộc `lockedCardIds`), `"already unlocked"`, `"no pending unlock"`. Hợp lệ → thêm vào `unlockedCardIds` |
| `parseProfile(data, raw)` | Mục 2.3 |

Chỉ lượt chơi cho XP; trận lẻ và lượt chơi bỏ ngang không cho.

### 2.3 `parseProfile`

- Không phải object / thiếu trường / sai kiểu → `{ profile: createProfile(data), reset: true }`.
- `version` khác 1 → hàm chuyển đổi (hiện không có bản nào khác 1 → coi như hỏng).
- Hero không có trong data → bỏ; Hero trong data mà hồ sơ thiếu → thêm `{ xp: 0, unlockedCardIds: [] }`.
- `unlockedCardIds` không thuộc `lockedCardIds` của Hero → bỏ (lượt mở tự quay lại vì được tính ra).
- Deck: giữ nguyên (kể cả không hợp lệ); chỉ bỏ deck sai kiểu cơ bản (thiếu `id`, `name`, `heroIds` 3 phần tử, `cardIds` mảng chuỗi).

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
| `starterDeck(data, heroIds): string[]` | Lá của "Bộ cơ bản": `cardIds` miễn phí của 3 Hero theo thứ tự đội; không lưu trong hồ sơ (tên hiển thị do client đặt) |
| `saveDeck(data, profile, draft)` | `draft.id` rỗng → deck mới, `id = "d" + (số lớn nhất hiện có + 1)`; có `id` → ghi đè. Lỗi: `"invalid name"`, `"too many decks"` (khi tạo mới lúc đã có `maxDecks`), `"unknown deck"` (ghi đè `id` không có). Deck không hợp lệ **vẫn lưu được** |
| `deleteDeck(profile, deckId)` | Lỗi `"unknown deck"` |

### 3.3 Lượt chơi và trận lẻ

- `RunSetup` thêm `deckCardIds: string[]` (bắt buộc). `createRun` ném lỗi nếu một lá không tồn tại hoặc không thuộc đội (như `createCombat`); `run.deck = deckCardIds`.
- Client chỉ vào trận với deck có `validateDeck` rỗng (Bộ cơ bản luôn hợp lệ).
- Trận lẻ: `CombatSetup.deckCardIds` sẵn có.
- **Lõi (augment):** sau mỗi trận thắng (không phải boss) chọn 1 trong `augmentChoices` Lõi từ `run-augments.json`, mỗi Lõi ≤1 lần/lượt; deck giữ nguyên suốt lượt (xem `11` §3.3).
- Nghỉ Chân / `minDeckSize` như cũ; deck trong lượt chơi chỉ nhỏ hơn 18 lá khi bỏ lá ở Nghỉ Chân.
