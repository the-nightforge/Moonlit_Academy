# 11 — Luật lượt chơi (Roguelike)

Tài liệu này mô tả **chính xác** cách một lượt chơi vận hành, bổ sung cho `01-combat-rules.md` (một trận). Thuật ngữ theo `04-glossary.md`. Bối cảnh và lý do thiết kế: `10-phase3-spec.md`. Phạm vi: giai đoạn 3.

---

## 1. Dữ liệu và trạng thái

### 1.1 `RunState`

```ts
type RunStatus = "map" | "combat" | "reward" | "rest" | "treasure" | "won" | "lost";

interface RunState {
  status: RunStatus;
  rngState: number;
  heroes: { defId: string; hp: number; maxHp: number }[];  // theo thứ tự heroIds
  deck: string[];              // cardId, không gồm lá Song Hành
  runRelicIds: string[];       // theo thứ tự nhận
  map: RunMap;
  position: string | null;     // nút hiện tại; null = chưa vào tầng 1
  combat: CombatState | null;
  pendingReward: { cardChoices: string[]; runRelicId?: string } | null;
}
```

- Bắt đầu: `deck` = `RunSetup.deckCardIds` (bắt buộc từ GĐ4b — deck đã lưu
  của người chơi hoặc `starterDeck()` = toàn bộ lá free của 3 Hero;
  `createRun` kiểm mọi lá phải thuộc một Hero trong đội), HP đầy,
  `runRelicIds = []`, sinh bản đồ, `status = "map"`, `position = null`.
- `RunState` là JSON thuần; lưu `localStorage` để sau.

### 1.2 Nối với trận đấu

```ts
interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
  deckCardIds?: string[];                    // mặc định: cardIds của 3 Hero
  heroes?: { hp: number; maxHp: number }[];  // mặc định: hp = maxHp của HeroDef
  runRelicIds?: string[];                    // mặc định: []
}
```

- Lá Song Hành vẫn tự thêm theo đội (`bondCardsForTeam`), không nằm trong deck.
- Instance id: `c01`, `c02`… theo thứ tự `deckCardIds`, rồi `bond01`…; xáo như cũ.
- **Seed trận** = `floor(value × 2³²)` với `value` lấy từ `nextRandom(run.rngState)` khi vào nút trận.
- Thăng cấp Hero vẫn reset mỗi trận (`01` §8).

### 1.3 `run-config.json`

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

Mọi số liệu là điểm khởi đầu, chỉnh sau playtest 3.7.

---

## 2. Bản đồ

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

### 2.1 Kích thước và cạnh

- Tầng 1..`floors`−1: số nút ngẫu nhiên trong `floorWidth`. Tầng cuối (boss): 1 nút.
- Giữa hai tầng liền nhau, mỗi nút nối tới một **dải liền nhau** 1–2 nút tầng
  sau. Các dải xếp theo lane: dải của nút lane `i+1` bắt đầu ở đúng cuối dải
  lane `i` hoặc ngay sau đó. Dải đầu bắt đầu ở lane 0, dải cuối kết thúc ở lane
  cuối. Hệ quả:
  - mọi nút tầng sau có ít nhất một cạnh vào;
  - **không có hai cạnh cắt nhau**;
  - mọi đường đi đều tới boss.
- Nút tầng áp chót nối hết vào nút boss.

### 2.2 Loại nút

- Theo `floorRules`: tầng có `type` → mọi nút loại đó; tầng có `weights` → chọn
  theo trọng số.
- Trên tầng có `weights`: nút `elite` hoặc `rest` **không** được có nút cha cùng
  loại; nếu trúng thì chọn lại trong các loại còn lại (theo trọng số của chúng).

### 2.3 Gán trận

Gán ngay khi sinh bản đồ (cùng seed → cùng trận):

- `combat`: ngẫu nhiên trong các trận `tier: "normal"` có `minFloor ≤ floor`.
- `elite`: trong `tier: "elite"` có `minFloor ≤ floor`.
- `boss`: trận `tier: "boss"` (đúng 1 trận; hiện là `enc_04`).
- Với `combat`/`elite`: không trùng trận của **bất kỳ** nút cha; nếu mọi lựa chọn
  đều trùng thì bỏ qua ràng buộc này.
- UI chỉ hiện loại nút, không hiện trước trận.

### 2.4 Thứ tự dùng RNG của lượt chơi

1. `createRun`: sinh bản đồ (độ rộng từng tầng → cạnh → loại nút → trận).
2. Vào nút trận: lấy seed trận.
3. Thắng trận: rút lá thưởng, rồi (Tinh Anh) rút Kỳ Vật.
4. Vào Kho Báu: rút Kỳ Vật.

---

## 3. Vòng đời lượt chơi

### 3.1 Hành động

```ts
type RunAction =
  | { type: "chooseNode"; nodeId: string }
  | { type: "combat"; action: Action }
  | { type: "pickCard"; cardId: string | null }
  | { type: "rest"; choice: "heal" }
  | { type: "rest"; choice: "removeCard"; cardId: string }
  | { type: "continue" };
```

| Hành động | Hợp lệ khi | Kết quả |
|---|---|---|
| `chooseNode` | `map`; nút thuộc `next` của `position` (hoặc tầng 1 nếu `position = null`) | `position` = nút. `combat`/`elite`/`boss` → tạo trận (mục 1.2), `combat`. `rest` → `rest`. `treasure` → nhận 1 Kỳ Vật (mục 3.4), `treasure` |
| `combat` | `combat` | Chuyển tiếp `applyAction`; lỗi của trận trả về nguyên văn. Trận kết thúc → mục 3.2 |
| `pickCard` | `reward`; `cardId` thuộc `cardChoices` hoặc `null` | Thêm lá vào `deck` (hoặc bỏ qua), xóa `pendingReward` → `map` |
| `rest heal` | `rest` | Mỗi Hero hồi `floor(maxHp × restHealRatio)`, không quá `maxHp` → `map` |
| `rest removeCard` | `rest`; `cardId` có trong `deck`; `deck.length > minDeckSize` | Bỏ **một** bản của lá đó khỏi `deck` → `map` |
| `continue` | `treasure` | → `map` |

- Hành động không hợp lệ bị từ chối, state không đổi (lỗi tiếng Anh, như trận đấu).
- `won` / `lost`: mọi hành động bị từ chối.

### 3.2 Khi trận kết thúc

- **Thua** → `status = "lost"`.
- **Thắng:**
  1. HP: Hero còn sống giữ HP cuối trận; Hero đã ngã sống lại với
     `max(1, ceil(maxHp × reviveHpRatio))` (event `heroRevived`).
  2. Nút `boss` → `status = "won"`.
  3. Ngược lại: tạo `pendingReward` (mục 3.3), `combat = null`. Nếu không có
     lá nào để chọn và không có Kỳ Vật → thẳng `map`; ngược lại → `reward`.

### 3.3 Lá thưởng

- Pool = hợp `cardIds` + `lockedCardIds` (pool 12 lá/Hero, GĐ4b) của 3 Hero
  trong đội, **trừ** lá đã có trong `deck`.
- Rút `rewardCardChoices` lá khác nhau bằng RNG của lượt chơi (ít hơn nếu pool
  không đủ). Lá đã bỏ ở Nghỉ Chân có thể xuất hiện lại.
- Nút `elite`: thêm 1 Kỳ Vật (mục 3.4) vào `pendingReward.runRelicId`, **nhận
  ngay** (event `runRelicGained`); màn thưởng chỉ hiển thị.

### 3.4 Nhận Kỳ Vật

Rút ngẫu nhiên trong các Kỳ Vật **chưa có**. Hết Kỳ Vật → không nhận gì.

### 3.5 Event

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
