# 14 — Luật hồ sơ, Tu Luyện và deck

Tài liệu này mô tả **chính xác** cách hồ sơ người chơi, Tu Luyện (mở lá khóa) và các deck đặt tên vận hành. Luật trận ở `01`, luật lượt chơi ở `11`. Thuật ngữ theo `04-glossary.md`. Bối cảnh và lý do thiết kế: `13-phase4b-spec.md` (4b), `15-phase4-spec.md` (4c, 4d). Phạm vi: giai đoạn 4b + 4c + 4d (hồ sơ nằm trên server; API ở `16-server-api.md`).

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

**[GĐ4d]** `economy-config.json` đầy đủ:

```json
{
  "starterHeroIds": ["m05", "f04", "m06"],
  "starterGift": { "moonJade": 2400 },
  "pullCost": 160,
  "runRewards": { "moonJadePerFloor": 3, "moonJadeWin": 20, "firstWinOfDay": 30 },
  "resetUtcHour": 21,
  "gacha": {
    "rates": { "legendary": 0.02, "epic": 0.13 },
    "epicPity": 10,
    "legendarySoftPityStart": 55,
    "legendarySoftPityStep": 0.06,
    "legendaryPity": 70,
    "newPlayerEpicHero": true
  },
  "dupeMoonStar": { "legendary": 25, "epic": 5, "rare": 1, "common": 1 },
  "moonStarShop": [
    { "id": "shop_pull", "item": { "type": "moonJade", "amount": 160 }, "price": 10, "limitPerWeek": 2 },
    { "id": "shop_epic_hero", "item": { "type": "heroChoice", "rarity": "epic" }, "price": 120, "limitPerWeek": 1 }
  ]
}
```

Kiểm tra khi nạp: `rates.legendary + rates.epic < 1`; `epicPity ≥ 1`;
`legendarySoftPityStart < legendaryPity`; id cửa hàng duy nhất.

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
  missions: MissionState;                       // GĐ 4d, §7
  shop: { weekKey: string; bought: Record<string, number> };  // GĐ 4d, §11
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
| `createProfile(data)` | **[GĐ4c]** Chỉ Hero trong `economyConfig.starterHeroIds` (`m05`, `f04`, `m06`), mỗi Hero `{ xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" }`; tiền tệ 0; `decks`, `weapons`, `relics`, `pity`, `achievements`, `stats` rỗng; `missions` `{ dayKey: "", weekKey: "", daily: 0, weekly: 0, claimed: [] }` (bộ đếm kỳ toàn 0, `heroesUsed: []`; **[GĐ4d]**); `shop` `{ weekKey: "", bought: {} }` **[GĐ4d]**; `flags` đều `false` |
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

---

## 5. Tiền tệ, quà và thưởng lượt chơi **[GĐ4d]**

Hàm trong `rules/src/meta/economy.ts`. Mọi hàm nhận `now` (ms UTC) từ server, trả
`{ ok: true; profile; ... } | { ok: false; error }`, không sửa input.

- `currencies.moonJade` (Nguyệt Ngọc): quay gacha. `currencies.moonStar` (Nguyệt Tinh):
  cửa hàng Nguyệt Tinh. `darkIron`, `moonDust`: GĐ 4e.
- `grantStarterGift(data, profile)`: `flags.starterGiftClaimed` đã `true` → trả hồ sơ
  nguyên (không lỗi). Ngược lại `moonJade += starterGift.moonJade`, đặt cờ `true`.
  Server gọi khi đăng ký và khi đăng nhập.
- `applyRunRewards(data, profile, result, context)` — sau `applyRunResult`, cùng
  transaction; `context = { now, starterDeck: boolean }` (`starterDeck`: phiếu cấp cho Bộ
  cơ bản). Theo thứ tự:
  1. Sang kỳ mới nếu cần (§6).
  2. `moonJade += moonJadePerFloor × floorReached + (won ? moonJadeWin : 0)`.
  3. `won` và `missions.daily.runsWon` = 0 trước lượt này → thêm `firstWinOfDay`.
  4. Bộ đếm kỳ (§7) và `stats` (§8): `runsFinished += 1`; `floorsReached +=
     floorReached`; `won` → `runsWon += 1`, `bossKills += 1` (thắng lượt = hạ boss tầng
     cuối); `heroesUsed` thêm 3 Hero của đội.
  5. `checkAchievements` (§8).
  Trả thêm `rewards = { moonJade: số đã cộng ở bước 2–3 (không gồm thành tựu),
  firstWinOfDay: boolean, achievements: string[] (id vừa đạt) }`.

## 6. Kỳ ngày và tuần **[GĐ4d]**

`rules/src/meta/periods.ts`. Ngày mới bắt đầu lúc 04:00 giờ Việt Nam
(`resetUtcHour` = 21 UTC hôm trước).

- `shifted = now + (24 − resetUtcHour) giờ`.
- `dayKey(now)` = ngày UTC của `shifted`, dạng `"YYYY-MM-DD"`.
- `weekKey(now)` = tuần ISO 8601 của ngày đó, dạng `"YYYY-Www"` (tuần bắt đầu thứ Hai,
  tức 04:00 sáng thứ Hai giờ Việt Nam).
- `rollPeriods(data, profile, now)`: `missions.dayKey` khác `dayKey(now)` → `daily` về 0,
  bỏ khỏi `claimed` mọi nhiệm vụ `daily`, đặt `dayKey`; tương tự tuần. `shop.weekKey`
  khác → `bought = {}`. Mọi hàm §5–§11 chạy bước này đầu tiên.

## 7. Nhiệm vụ ngày/tuần **[GĐ4d]**

```ts
interface MissionState {
  dayKey: string;
  weekKey: string;
  daily: PeriodCounters;
  weekly: PeriodCounters;
  claimed: string[];            // id nhiệm vụ đã nhận trong kỳ hiện tại của nó
}
interface PeriodCounters {
  runsFinished: number; runsWon: number; floorsReached: number; bossKills: number;
  gachaPulls: number; cardsUnlocked: number;
  heroesUsed: string[];         // Hero khác nhau đã dùng trong lượt chơi của kỳ
}
interface MissionDef {          // missions.json
  id: string; name: string; text: string;
  period: "daily" | "weekly";
  goal: { type: "runsFinished" | "runsWon" | "floorsReached" | "bossKills"
               | "distinctHeroesUsed" | "gachaPulls" | "cardsUnlocked"; count: number };
  reward: { moonJade: number };
}
```

- Tiến độ của nhiệm vụ = bộ đếm của kỳ nó (`distinctHeroesUsed` = `heroesUsed.length`).
- `recordProgress(data, profile, now, counts)`: sang kỳ, cộng `counts` (ví dụ
  `{ gachaPulls: 10 }`, `{ cardsUnlocked: 1 }`) vào cả `daily` và `weekly`. Server gọi sau
  quay gacha và sau mở lá.
- `claimMission(data, profile, missionId, now)`: sang kỳ; lỗi `"unknown mission"`,
  `"already claimed"`, `"not complete"` (tiến độ < `count`); hợp lệ → `moonJade +=
  reward`, thêm vào `claimed`.
- Nội dung khởi điểm: ngày — hoàn thành 1 lượt chơi (40), tổng 10 tầng (40), dùng 3 Hero
  khác nhau (30); tuần — thắng 3 lượt chơi (200), hạ 2 boss (150), quay 10 lượt (100).

## 8. Thành tựu **[GĐ4d]**

```ts
interface AchievementDef {      // achievements.json
  id: string; name: string; text: string;
  goal:
    | { type: "runsWon"; count: number }
    | { type: "bossKillWithBond"; bondCardId: string }   // thắng lượt với đội có lá Song Hành đó
    | { type: "masteryLevel"; level: number }             // một Hero sở hữu đạt cấp Tu Luyện
    | { type: "ownAllHeroes" }                            // sở hữu mọi Hero trong data
    | { type: "starterFloor"; floor: number }             // đạt tầng với Bộ cơ bản
    | { type: "allLockedUnlocked" };                      // mọi Hero sở hữu đã mở hết lá khóa
  reward: { moonJade: number };
}
```

- `stats` (trọn đời): `runsFinished`, `runsWon`, `floorsTotal`, `bossKills`,
  `gachaPulls`, `bossKillBond.<bondCardId>` (1 khi đã thắng lượt với đội có lá đó —
  `bondCardsForTeam`), `starterBestFloor` (tầng cao nhất đạt với Bộ cơ bản).
- `checkAchievements(data, profile)`: mọi thành tựu chưa có trong `achievements` mà điều
  kiện đúng → thêm id, `moonJade += reward`. Tự nhận, không cần bấm. Chạy sau thưởng lượt
  chơi, mở lá, quay gacha, mua ở cửa hàng.
- Nội dung khởi điểm: thắng lượt đầu (300); một thành tựu cho mỗi lá Song Hành: thắng
  lượt với đội có cặp đó (200 × 3); Tu Luyện cấp 6 một Hero (300); sở hữu cả 5 Hero
  (500); đạt tầng 8 với Bộ cơ bản (200); mở hết lá khóa của mọi Hero đang sở hữu (500).

## 9. Gacha **[GĐ4d]**

`rules/src/meta/gacha.ts`. `banners.json`:

```ts
interface BannerDef {
  id: string; name: string;
  kind: "hero";                               // "weapon" | "relic" ở GĐ 4e
  pool: Record<Rarity, string[]>;             // id theo độ hiếm; mảng rỗng được phép
}
```

Banner khởi điểm `banner_heroes` (Triệu Hồi Anh Hùng): legendary `[m05]`, epic `[m06,
f02, f03]`, rare `[f04]`, common `[]`. Kiểm tra khi nạp: id trong pool là Hero có trong
data, độ hiếm khớp `heroes.json rarity`, không trùng.

`pullMany(data, profile, bannerId, count, rngState, now)` — `count` là 1 hoặc 10:

- Lỗi `"unknown banner"`; `moonJade < pullCost × count` → `"not enough moonJade"`.
- Trừ `pullCost × count`, rồi `count` lần **một lượt quay** (dưới) liên tiếp, RNG nối tiếp
  (`nextRandom` của `rules/src/rng.ts`, bắt đầu từ `rngState`).
- Rồi `recordProgress({ gachaPulls: count })`, `stats.gachaPulls += count`,
  `checkAchievements`.
- Trả thêm `results: PullResult[]`:
  `{ itemId, rarity, outcome: "newHero" | "constellation" | "moonStar", constellation?, moonStar? }`.

**Một lượt quay:**

1. `p = pity[bannerId]` (thiếu → `{ sinceEpic: 0, sinceLegendary: 0 }`); tăng cả hai 1.
2. `pLeg` = 1 nếu `sinceLegendary ≥ legendaryPity`; `rates.legendary + legendarySoftPityStep
   × (sinceLegendary − legendarySoftPityStart + 1)` nếu `sinceLegendary ≥
   legendarySoftPityStart`; ngược lại `rates.legendary`.
3. Rút `u1`: `u1 < pLeg` → legendary; ngược lại `sinceEpic ≥ epicPity` hoặc `u1 < pLeg +
   rates.epic` → epic; ngược lại rare/common: nếu pool có cả hai, rút `u2`: `u2 < 0.5` →
   common, ngược lại rare; chỉ có một → độ hiếm đó.
4. Độ hiếm không có id nào → hạ dần (legendary → epic → rare → common) tới độ hiếm đầu
   tiên có id; không có → nâng dần từ độ hiếm ban đầu.
5. Theo độ hiếm **cuối cùng**: legendary → `sinceLegendary = 0`, `sinceEpic = 0`; epic →
   `sinceEpic = 0`.
6. Chọn id: danh sách = pool của độ hiếm đó; **bảo vệ người mới** (`newPlayerEpicHero`,
   banner `hero`, độ hiếm epic): nếu có Hero epic chưa sở hữu trong pool → danh sách chỉ
   gồm các Hero đó. Rút `u3`, chọn `danh sách[floor(u3 × độ dài)]`.
7. `grantItem` (§10).

Mỗi lượt quay dùng RNG theo thứ tự `u1`, (`u2` nếu cần), `u3`. Cùng hồ sơ, `rngState`,
`count` → cùng kết quả (T186).

## 10. Sở hữu Hero và Tinh Hồn **[GĐ4d]**

`grantItem` cho Hero `id`, độ hiếm `r`:

- Chưa sở hữu → thêm `heroes[id]` mặc định (§2.2); `outcome: "newHero"`.
- Đã sở hữu, `constellation < 6` → `constellation += 1`; cấp mới là 1 hoặc 3 →
  `bonusUnlocks += 1`; `outcome: "constellation"`.
- `constellation = 6` → `moonStar += dupeMoonStar[r]`; `outcome: "moonStar"`.

| Cấp | Hiệu ứng (GĐ 4d) |
|---|---|
| 1, 3 | Thêm 1 lượt mở lá khóa (`bonusUnlocks`, xem `pendingUnlocks` §2.2) |
| 2 | Trong trận: ngưỡng thăng cấp = `levelUp.constellationThreshold` (`01` §8) |
| 4 | Trong deck: lá chủ lực thay bằng bản "+" (`01` §8) |
| 5 | Dạng thăng cấp thứ hai — **GĐ 4e**; ở 4d cấp vẫn tăng, `levelUpForm` luôn `"base"` |
| 6 | Hiển thị (khung vàng ở client) |

`heroes.json` thêm: `levelUp.constellationThreshold: number` (≤ `threshold`) và
`signature: { cardId, plusCardId }` — `cardId` thuộc `cardIds` của Hero; `plusCardId` là
lá trong `cards.json` có `plusOf: cardId`, cùng `ownerId`, `cost`, `copies`, không nằm
trong `cardIds`/`lockedCardIds` của Hero nào (không xếp được vào deck trực tiếp).

## 11. Cửa hàng Nguyệt Tinh **[GĐ4d]**

`buyShopItem(data, profile, itemId, now, heroId?)`:

- Sang kỳ (reset `shop.bought` theo tuần).
- Lỗi: `"unknown item"`; `"weekly limit"` (`bought[itemId] ≥ limitPerWeek`); `"not enough
  moonStar"`.
- `item.type = "moonJade"` → `moonJade += amount`.
- `item.type = "heroChoice"` → cần `heroId`: thiếu → `"hero required"`; Hero không có,
  khác `rarity`, hoặc đã sở hữu → `"invalid hero"`. Hợp lệ → sở hữu Hero đó (như §10).
- Trừ `price` Nguyệt Tinh, `bought[itemId] += 1`, `checkAchievements`.

## 12. Loadout **[GĐ4d]**

```ts
interface Loadout {
  heroes: Record<string, { constellation: number; levelUpForm: "base" | "alt" }>;
  // GĐ 4e: weaponId, refinement mỗi Hero; relics
}
```

- `buildLoadout(data, profile, heroIds)`: lấy `constellation`, `levelUpForm` của 3 Hero từ
  hồ sơ (Hero chưa sở hữu → lỗi `"hero not owned"`).
- `createRun(data, setup, loadout?)`, `createCombat(data, setup, loadout?)`,
  `replayRun(data, setup, actions, loadout?)`: thiếu `loadout` = mọi Hero cấp 0. Trận
  trong lượt chơi dùng loadout của lượt chơi.
- Phiếu lượt chơi (§4.1) chụp thêm `loadout` lúc cấp; nộp kết quả chạy lại với đúng
  loadout đó (đổi Tinh Hồn sau khi cấp phiếu không ảnh hưởng lượt đang chơi).

