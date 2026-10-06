# Spec — Nguyệt Ước (Epitomized Path) & Túi đồ

> P6 của `docs/superpowers/plans/2026-10-06-gacha-ui-rework.md` §5e/§5f.
> Phase này đụng **rules + server + DB (profile blob) + client** — duyệt spec trước khi code.

## 1. Mục tiêu

| Tính năng | Nguồn cảm hứng | Giá trị |
|---|---|---|
| **Nguyệt Ước** trên `banner_weapons` | Genshin Epitomized Path | Giảm "frustration" khi trượt legendary vũ khí 2 lần liên tiếp; tăng lý do quay banner Binh Khí |
| **Túi đồ** | Genshin inventory/bag | Xem lại hero/trang bị đã quay được + cấp Tinh Luyện/Cộng Minh/Tinh Hồn |

## 2. Nguyệt Ước — luật (rules)

### 2.1. Luật chơi

- Chỉ áp dụng cho banner `kind === "weapon"` **có** `epitomized` trong `BannerDef` — hiện tại: `banner_weapons` (7 legendary).
- Người chơi **chọn trước 1 legendary** trong `pool.legendary` của banner làm *mục tiêu* (ví dụ `w_xich_diem_thuong`).
- Mỗi lần legendary **không trúng** mục tiêu → **+1 Nguyệt Điểm** (`fatePoints`).
- Đạt **2 Nguyệt Điểm** → legendary tiếp theo **chắc chắn** là mục tiêu.
- Trúng mục tiêu (dù nhờ guarantee hay tự nhiên) → **reset `fatePoints` về 0**.
- **Đổi mục tiêu** hoặc **hủy chọn** → reset `fatePoints` về 0 (giống Genshin).
- Chưa chọn mục tiêu → banner quay như hiện nay, **không tích điểm** (Genshin cũng vậy — cần chọn path trước).
- Không đổi pity/soft pity/tỉ lệ — Nguyệt Ước chỉ can thiệp **sau khi** roll đã ra `legendary`: thay cho bước chọn item trong pool.

### 2.2. Data model

`BannerDef` (`packages/rules/src/types/static.ts`):

```ts
featured?: { rateUp: number; rotation: FeaturedRotationEntry[] };
/** Opt-in: banner cho phép chọn mục tiêu legendary (Epitomized Path). */
epitomized?: { maxPoints: number };   // maxPoints = 2
```

`Profile` (`packages/rules/src/types/meta.ts`) — thêm trường mới, **không đổi version** (additive, JSONB):

```ts
/** Nguyệt Ước per banner: mục tiêu legendary + điểm trượt tích lũy (`spec P6`). */
epitomized: Record<string, { targetId: string; points: number }>;
```

- Key = `banner.id` (**không** theo `pityGroup` — path gắn với banner cụ thể).
- `parseProfile`/`newProfile` phải default `epitomized: {}` cho profile cũ (migration đọc JSONB: `?? {}`).
- Validation `load-game-data`: `epitomized` chỉ hợp lệ trên `kind === "weapon"` (relic banner để sau nếu cần); `maxPoints >= 1`.

`banners.json` — `banner_weapons` thêm `"epitomized": { "maxPoints": 2 }`.

### 2.3. Thuật toán trong `pullOnce`

Hiện nay (`gacha.ts` ~dòng 217–233) legendary trên banner không-featured lấy `candidates[Math.floor(draw()*len)]`. Chèn trước đó:

```
if rarity === "legendary" && banner.epitomized:
    epi = profile.epitomized[banner.id]
    if epi && epi.targetId ∈ heroPool.legendary:
        if epi.points >= banner.epitomized.maxPoints:
            itemId = epi.targetId           // guaranteed
            epi.points = 0
            result.epitomizedHit = true
        else:
            itemId = uniform(heroPool.legendary)
            if itemId === epi.targetId: epi.points = 0
            else: epi.points += 1
    else:
        // không có target (chưa chọn / target rời pool) → roll như cũ, không tích điểm
        itemId = uniform(...)
```

`PullResult` thêm field optional: `epitomizedHit?: boolean` — client hiển thị badge "NGUYỆT ƯỚC" trên thẻ kết quả (giống `featuredHit` → `★`).

API mới trong rules (`meta/gacha.ts`):

```ts
/** Đặt/đổi mục tiêu Nguyệt Ước. Đổi target → reset points. */
export function setEpitomizedTarget(data, profile, bannerId, targetId): { ok:true; profile } | { ok:false; error }
/** Hủy mục tiêu (points reset về 0 vì entry bị xóa). */
export function clearEpitomizedTarget(data, profile, bannerId): { ok:true; profile }
```

Validate: banner tồn tại, `banner.epitomized` defined, `targetId ∈ banner.pool.legendary`.

### 2.4. Server & DB

- Profile lưu JSONB trong bảng `profiles` — trường `epitomized` nằm trong blob → **không cần migration DB**, chỉ cần `parseProfile` default.
- Route mới trong `apps/server/src/routes/gacha.ts`:

```
POST /api/gacha/:bannerId/path    body: { targetId: string | null }
  → mutateProfile(profile => setEpitomizedTarget / clearEpitomizedTarget)
```

- Không cần bảng mới. History (`pulls.results_json`) tự mang `epitomizedHit`.

### 2.5. Client (`gacha-scene.ts`)

- Trên `banner_weapons`: panel pity thêm dòng **"Nguyệt Ước: <tên mục tiêu / Chưa chọn> · <points>/2"**.
- Bấm vào → modal `openList` liệt kê 7 legendary + mục "Không chọn", mỗi dòng kèm owned-state (`chưa có` / `Tinh Luyện n`).
- `PullResult.epitomizedHit` → `outcomeText` thêm nhãn; thẻ kết quả legendary trúng path thêm ribbon "NGUYỆT ƯỚC" (tái dùng chỗ `featuredHit` hiển thị `★`).

### 2.6. Test (rules, đặt tên theo mã T335+)

- **T335**: chọn target, legendary đầu trượt → `points=1`; lần 2 trượt → `points=2`; lần 3 → `epitomizedHit` đúng target, `points=0`.
- **T336**: trúng target tự nhiên (không qua guarantee) → `points=0`.
- **T337**: đổi target giữa chừng → `points` reset; hủy chọn → entry xóa.
- **T338**: chưa chọn target → 0 điểm tích, legendary roll như cũ (uniform pool).
- **T339**: target không còn trong pool (validation) → `setEpitomizedTarget` trả `ok:false`.
- Server test: route `POST /gacha/:id/path` 200/400; profile cũ không có `epitomized` → parseProfile default `{}`.

### 2.7. Câu hỏi đã chốt

- **Chọn trong 7 legendary**: modal list đơn giản (7 dòng), không cần carousel — pool ít.
- **Reset khi đổi target**: theo Genshin (points về 0) — tránh exploit "farm điểm rồi đổi sang món khác".
- **Chỉ weapon banner**: relic banner pool chỉ 4 legendary, độ khó chênh không đáng kể; field `epitomized` vẫn generic để bật cho relic sau này chỉ bằng JSON.

## 3. Túi đồ — inventory

### 3.1. Phạm vi

- **Scene riêng** `inventory` (không gộp Nhật ký): 3 tab — **Tướng** (grid hero + Tinh Hồn), **Binh khí** (Tinh Luyện), **Nguyệt Bảo** (Cộng Minh).
- Mỗi ô: art thumbnail (tái dùng `heroes:`/`weapons:`/`relics:`), tên, rarity border, cấp dup (`Tinh Hồn n`, `Luyện n`, `Minh n`), trạng thái chưa có → ô mờ + "Chưa có".
- Chỉ **đọc** `session.profile` (heroes/weapons/relics đã đầy đủ client-side) → **không cần endpoint mới**. Dữ liệu tên/rarity/art lấy từ `session.data`.
- Vào từ: nút **"Túi đồ"** trong footer gacha (cụm trái, cạnh "Cửa hàng Nguyệt Tinh") hoặc menu chính — quyết trong lúc làm: ưu tiên footer gacha vì đây là "đồ từ gacha".
- Sort: rarity giảm dần → owned trước → tên.
- Scroll grid tái dùng pattern `openList` (wheel + ▲▼) hoặc mask gallery — chọn lúc implement, ưu tiên đơn giản.

### 3.2. Test

- E2E nhẹ: mở scene, thấy grid, tab chuyển đúng, hero mới quay xuất hiện. Không cần test server.

## 4. Không làm (giữ phase sạch)

- Không đổi pity, rate, hay giá quay.
- Không thêm Nguyệt Ước cho relic banner (chỉ mở sẵn khả năng trong schema).
- Không làm trang chi tiết item (bấm vào ô trong Túi đồ chỉ hiện tooltip tên — chưa có trang chi tiết).
- Không di chuyển `gacha-scene.ts` sang multi-file — việc đó (P-gốc §6 refactor) để sau khi P6 xong, tránh conflict.

## 5. Thứ tự implement đề xuất

1. **P6a**: rules — `epitomized` schema + `setEpitomizedTarget`/`clearEpitomizedTarget` + `pullOnce` hook + `epitomizedHit` + test T335–T339.
2. **P6b**: server — route `/gacha/:id/path` + `parseProfile` default + test route.
3. **P6c**: client — UI chọn mục tiêu + badge kết quả + e2e.
4. **P6d**: scene `inventory` + nút vào + e2e.

Mỗi bước 1 commit; P6a+b có thể gộp nếu diff nhỏ.
