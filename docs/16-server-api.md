# 16 — Server và API

Tài liệu này mô tả **chính xác** server (`apps/server`), tài khoản, lưu trữ và API
HTTP. Luật hồ sơ / Tu Luyện / deck / lượt chơi có xác nhận ở `14-meta-rules.md`; bối
cảnh và lý do ở `15-phase4-spec.md`. Phạm vi: giai đoạn 4c (4d/4e thêm route ở đây).

Nguyên tắc: server là trọng tài của hồ sơ. Mọi thay đổi hồ sơ = gọi một hàm thuần của
`rules/src/meta/` rồi ghi kết quả, trong một transaction. Server không tự sửa JSON hồ
sơ và không tự tính luật.

---

## 1. Chạy server

- `apps/server`: Node 22, Fastify 5, better-sqlite3 (+ `@types/node`,
  `@types/better-sqlite3`). Bundle bằng Vite SSR build (gộp `rules`, `data`; để ngoài
  `fastify`, `better-sqlite3`, `zod`). `pnpm-workspace.yaml` cho phép script build của
  `better-sqlite3` (`onlyBuiltDependencies`) để module native được biên dịch khi cài.
- Biến môi trường: `PORT` (mặc định `8787`), `HOST` (mặc định `127.0.0.1`), `DB_PATH` (mặc định
  `./data/vong-nguyet.db`, tạo thư mục nếu thiếu).
- `pnpm --filter server dev` (build theo dõi + `node --watch`), `pnpm --filter server
  start`, `pnpm --filter server test`. `pnpm dev` ở gốc chạy client và server song song.
- Client dev gọi `/api/...` qua proxy Vite tới `http://localhost:8787`.
- `buildApp({ db, clock, random, data })`: `clock(): number` (ms UTC), `random(n): Buffer`
  (n byte) — test truyền bản giả để tất định.

---

## 2. Quy ước chung

- Mọi route dưới `/api`; request và response là JSON (UTF-8).
- Lỗi: mã HTTP + `{ "error": "<mã tiếng Anh>", ...chi tiết }`. Client dịch `error` sang
  tiếng Việt.
- Body kiểm bằng zod; sai cấu trúc → `400 { error: "bad request", issues }`.
- **Phiên bản dữ liệu:** mọi request (trừ `GET /api/health`) có header
  `X-Data-Version: <dataVersion>`; khác bản của server → `409 { error: "outdated
  client", dataVersion }`. `dataVersion(data)` (trong `packages/data`): `JSON` của
  `GameData` với khóa object sắp xếp tăng dần, băm FNV-1a 64 bit, 16 ký tự hex thường.
- **Xác thực:** header `Authorization: Bearer <token>`. Thiếu, sai, hoặc phiên hết hạn →
  `401 { error: "unauthorized" }`.
- **Đồng bộ hồ sơ:** mọi route làm đổi hồ sơ cần `If-Match: <rev>`; khác `rev` hiện tại →
  `409 { error: "stale profile", profile, rev }`; thiếu hoặc không phải số nguyên →
  `428 { error: "if-match required" }`. Thành công trả `{ profile, rev, ... }`
  với `rev` mới (= cũ + 1). Lỗi luật từ hàm thuần → `400 { error: "<chuỗi lỗi của hàm>" }`,
  hồ sơ không đổi.

---

## 3. Tài khoản và phiên

| Luật | Giá trị |
|---|---|
| Tên đăng nhập | Chuẩn hóa chữ thường; 3–20 ký tự `[a-z0-9_]`; duy nhất |
| Mật khẩu | 8–72 ký tự |
| Băm mật khẩu | `scrypt` (`node:crypto`): salt 16 byte ngẫu nhiên, `N = 32768`, `r = 8`, `p = 1`, khóa 64 byte; lưu `"<salt hex>:<hash hex>"`; so sánh bằng `timingSafeEqual` |
| Token phiên | 32 byte từ `random`, gửi client dạng base64url; DB chỉ lưu SHA-256 hex của token |
| Hạn phiên | 30 ngày kể từ lần dùng cuối; mỗi request hợp lệ cập nhật `last_used_at` |
| Đăng nhập sai | `401 { error: "invalid credentials" }` (không phân biệt sai tên / sai mật khẩu). Sai 5 lần liên tiếp cho một tài khoản → khóa 5 phút: `429 { error: "too many attempts", retryAfterMs }`. Đăng nhập đúng đặt lại bộ đếm |

Không có khôi phục mật khẩu.

---

## 4. Route (GĐ 4c)

| Route | Body | Kết quả / lỗi |
|---|---|---|
| `GET /api/health` | — | `{ ok: true, dataVersion }` |
| `POST /api/auth/register` | `{ username, password }` | Tạo tài khoản + `createProfile` + phiên → `201 { token, profile, rev }`. `409 "username taken"`; tên/mật khẩu sai luật → `400 "invalid username"` / `"invalid password"` |
| `POST /api/auth/login` | `{ username, password }` | `{ token, profile, rev }`; §3 |
| `POST /api/auth/logout` | — | Xóa phiên hiện tại → `204` |
| `GET /api/profile` | — | `{ profile, rev }` |
| `POST /api/profile/unlock` | `{ heroId, cardId }` | `unlockCard` |
| `PUT /api/profile/decks` | `{ draft: SavedDeck }` | `saveDeck` → thêm `{ deckId }` |
| `DELETE /api/profile/decks/:id` | — | `deleteDeck` |
| `POST /api/profile/import` | `{ local: unknown }` | `parseProfile(local)` rồi `mergeImportedProfile` (`14` §2.4). `local` hỏng (`parseProfile` trả `reset`) → `400 "invalid profile"`, không tính là đã nhập |
| `POST /api/runs` | `{ deckId }` hoặc `{ deckId: "starter", heroIds }` | Cấp phiếu (`14` §4.1) → `201 { runId, setup }`. Deck không có → `404 "unknown deck"`; deck không hợp lệ → `400 { error: "invalid deck", errors: DeckError[] }` |
| `POST /api/runs/:id/finish` | `{ actions: RunAction[] }` (≤ 20000) | `14` §4.3 → `{ profile, rev, gains }`. `404 "unknown run"` (không có hoặc của tài khoản khác); `409 "run closed"` (không `open`); `410 "ticket expired"`; `409 "outdated client"` (phiếu cấp với `dataVersion` khác); `422 { error: "replay failed", step, reason }`; `422 "run not finished"` |
| `POST /api/runs/:id/abandon` | — | Phiếu `abandoned` → `204`; `409 "run closed"` nếu không `open` |

`POST /api/runs`, `/finish`, `/abandon` không cần `If-Match` khi không đổi hồ sơ; riêng
`/finish` đổi hồ sơ → cần `If-Match`.

Thứ tự kiểm tra của `/finish`: phiếu (`404` → `409 run closed` → `410` → `409 outdated
client`), rồi body (Action sai cấu trúc → `400 bad request`, phiếu vẫn `open`), rồi chạy
lại (`422`), rồi `If-Match` và ghi hồ sơ. Ghi hồ sơ và đóng phiếu (`finished`) nằm trong
cùng một transaction; `409 stale profile` để phiếu `open` cho client gửi lại.

### 4.1 Thay đổi và route mới (GĐ 4d)

- **Quà tài khoản:** `register` và `login` gọi `grantStarterGift` (`14` §5) trong cùng
  transaction ghi hồ sơ (đăng nhập: chỉ ghi và tăng `rev` khi thật sự trao quà).
- **`POST /api/runs`:** chụp thêm `loadout = buildLoadout(profile, heroIds)` và ghi phiếu
  có phải Bộ cơ bản không (`starter_deck`). Trả `{ runId, setup, loadout }`.
- **`/finish`:** chạy lại với `loadout` của phiếu; sau `applyRunResult` gọi
  `applyRunRewards(result, { now, starterDeck })`; trả thêm `rewards`.
- **`POST /api/profile/unlock`:** sau `unlockCard` gọi `recordProgress({ cardsUnlocked: 1 })`
  và `checkAchievements`.

| Route | Body | Kết quả / lỗi |
|---|---|---|
| `POST /api/missions/:id/claim` | — | `claimMission` (`14` §7) → `{ profile, rev }` |
| `GET /api/gacha/banners` | — | `{ banners: BannerDef[], gacha, pullCost, pity }` (`pity` của người chơi theo banner) |
| `POST /api/gacha/:bannerId/pull` | `{ count: 1 \| 10 }` | Seed = `random(4)` uint32 → `pullMany` (`14` §9); ghi `pulls` cùng transaction → `{ profile, rev, results }` |
| `GET /api/gacha/history` | query `banner?`, `page?` (0-based) | 20 bản ghi mới nhất mỗi trang: `{ entries: { bannerId, results, createdAt }[] }` (không trả seed cho client) |
| `POST /api/shop/:itemId/buy` | `{ heroId? }` | `buyShopItem` (`14` §11) → `{ profile, rev }` |

Mọi route đổi hồ sơ ở trên cần `If-Match`.

---

## 5. Lưu trữ (SQLite)

Bảng `schema_version(version INTEGER)`; migration đánh số, chạy khi mở DB. `PRAGMA
foreign_keys = ON`; `journal_mode = WAL` cho file DB.

**Migration 1:**

| Bảng | Cột |
|---|---|
| `accounts` | `id INTEGER PK`, `username TEXT UNIQUE NOT NULL`, `password_hash TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `failed_logins INTEGER NOT NULL DEFAULT 0`, `locked_until INTEGER` |
| `sessions` | `token_hash TEXT PK`, `account_id INTEGER NOT NULL → accounts`, `last_used_at INTEGER NOT NULL` |
| `profiles` | `account_id INTEGER PK → accounts`, `profile_json TEXT NOT NULL`, `rev INTEGER NOT NULL`, `updated_at INTEGER NOT NULL` |
| `runs` | `id TEXT PK` (16 byte base64url), `account_id INTEGER NOT NULL → accounts`, `status TEXT NOT NULL` (`open`/`finished`/`abandoned`/`rejected`), `setup_json TEXT NOT NULL`, `data_version TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `finished_at INTEGER`, `result_json TEXT` |

**Migration 2 (GĐ 4d):**

| Thay đổi | Cột |
|---|---|
| `runs` thêm | `loadout_json TEXT` (null với phiếu cũ → chạy lại không loadout), `starter_deck INTEGER NOT NULL DEFAULT 0` |
| Bảng mới `pulls` | `id INTEGER PK`, `account_id INTEGER NOT NULL → accounts`, `banner_id TEXT NOT NULL`, `count INTEGER NOT NULL`, `seed INTEGER NOT NULL`, `results_json TEXT NOT NULL`, `created_at INTEGER NOT NULL`; chỉ mục `(account_id, created_at)` |

Thời gian lưu dạng ms UTC từ `clock()`. Mọi thao tác "đọc hồ sơ → hàm thuần → ghi hồ
sơ (+ bảng `runs`)" chạy trong một transaction đồng bộ của better-sqlite3.

---

## 6. Client

- `api.ts`: mọi request gửi `X-Data-Version` (tính bằng `dataVersion` khi khởi động),
  `Authorization` nếu có token, `If-Match` cho route đổi hồ sơ. Trả lời không phải JSON
  hoặc lỗi 502–504 không có `error` (proxy dev khi server tắt) được coi như mất kết
  nối (`network`). Mọi `401` → xóa token, về màn đăng nhập. Mã lỗi → câu tiếng Việt
  trong `theme.ts` (`API_ERROR_TEXT`).
- `localStorage`: `vong-nguyet.token` (token phiên); `vong-nguyet.run` (phiếu đang
  chơi: `runId`, `setup`, chuỗi Action đã được chấp nhận — để chơi tiếp sau khi tải lại
  trang bằng `replayRun`); hồ sơ 4b cũ `vong-nguyet.profile` chỉ đọc để nhập một lần,
  sau đó đổi tên thành `vong-nguyet.profile.imported`.
- Hồ sơ chỉ giữ trong bộ nhớ (bản sao + `rev`); `409 stale profile` thay bản sao bằng
  bản trong lỗi. Nộp lượt chơi gặp `stale profile` tự gửi lại một lần; phiếu đã bị đóng
  (`replay failed`, `run closed`, `ticket expired`, `unknown run`) thì xóa bản lưu tạm.
- Không kết nối được server (lúc mở game hoặc khi đăng nhập): chế độ offline, hồ sơ
  trống, chỉ **Trận lẻ**; Lượt chơi, xếp/xóa deck, Tu Luyện bị khóa.
- Công cụ debug sửa hồ sơ (+XP, mở hết lá, xóa hồ sơ) đã bỏ (hồ sơ chỉ đổi trên
  server); sửa trận bằng debug trong lượt chơi làm server từ chối kết quả (có cảnh báo).
