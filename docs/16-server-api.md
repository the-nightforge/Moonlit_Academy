# 16 — Server và API

Tài liệu này mô tả **chính xác** server (`apps/server`), tài khoản, lưu trữ và API
HTTP. Luật hồ sơ / Tu Luyện / deck / lượt chơi có xác nhận ở `14-meta-rules.md`; bối
cảnh và lý do ở `15-phase4-spec.md`. Phạm vi: giai đoạn 4c (4d/4e thêm route ở đây).

Nguyên tắc: server là trọng tài của hồ sơ. Mọi thay đổi hồ sơ = gọi một hàm thuần của
`rules/src/meta/` rồi ghi kết quả, trong một transaction. Server không tự sửa JSON hồ
sơ và không tự tính luật.

---

## 1. Chạy server

- `apps/server`: Node 22, Fastify 5, Postgres qua `postgres` (postgres.js)
  (+ `@types/node`). DB host là Supabase (dev/prod là hai project riêng —
  `deploy/vercel-render.md`). Bundle bằng Vite SSR build (gộp `rules`, `data`;
  để ngoài `fastify`, `postgres`, `zod`). Test chạy trên `pg-mem` trong bộ nhớ.
- Biến môi trường: `DATABASE_URL` (chuỗi kết nối Postgres — Supabase pooler
  6543, bắt buộc mọi chế độ; dev để trong `apps/server/.env`), `PORT`
  (mặc định `8787`), `HOST` (mặc định `127.0.0.1`, production `0.0.0.0`).
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

**[Nguyệt Luân mới]** `combatActionSchema` (schema zod của từng Action trong `actions`)
thêm `discardCard { instanceId, player? }` và `bloodPact { heroId, player? }` (`02` §3).
Replay từ chối action đúng cấu trúc nhưng sai luật — ví dụ Hủy Bài / Huyết Tế khi lệnh
tương ứng (`xa_than` / `huyet_te`) không có hiệu lực, hoặc quá giới hạn lượt — theo
`{ step, reason }` của `replayRun` → `422 "replay failed"`. `moonDecrees` của
`CombatState` là **công khai**: nằm trong `view` trả về client, không bị `viewFor` /
`redactEvents` che (T325).

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

### 4.2 Thay đổi và route mới (GĐ 4e)

- **`PUT /api/profile/decks`:** `draft` nhận thêm `weapons?: Record<heroId, weaponId | null>`,
  `relicIds?: string[]` (≤ 8 phần tử; luật ở `validateDeck`, `14` §3.1).
- **`POST /api/runs`:** `buildLoadout(data, profile, deck)` với trang bị của deck (Bộ cơ
  bản: không trang bị); lỗi sở hữu → `400` như `"invalid deck"`. Loadout vẫn nằm trong
  `runs.loadout_json` — **không** cần migration.
- **Gacha:** `GET /api/gacha/banners` trả cả 3 banner; `POST /api/gacha/:bannerId/pull`
  không đổi (kết quả theo `14` §9, §13.1).

| Route | Body | Kết quả / lỗi |
|---|---|---|
| `PUT /api/profile/heroes/:id/level-up-form` | `{ form: "base" \| "alt" }` | `setLevelUpForm` (`14` §10.1) → `{ profile, rev }`; `400 "hero not owned"`, `400 "constellation too low"` |

### 4.3 Route nâng cấp trang bị (GĐ 7d)

| Route | Body | Kết quả / lỗi |
|---|---|---|
| `POST /api/profile/weapons/:id/upgrade` | — | `upgradeItem(data, profile, "weapon", id)` (`14` §13.3) → `{ profile, rev, level, spent }` |
| `POST /api/profile/relics/:id/upgrade` | — | `upgradeItem(data, profile, "relic", id)` → `{ profile, rev, level, spent }` |

`If-Match` bắt buộc như mọi route đổi hồ sơ (§2): thiếu → `428 "if-match required"`,
`rev` cũ → `409 "stale profile"` kèm hồ sơ; lỗi luật của `upgradeItem` → `400
{ error: "not owned" | "maxed" | "not enough" }` (id lạ cũng là `"not owned"`), hồ sơ
không đổi.

---

## 5. Lưu trữ (Postgres)

Bảng `schema_version(version BIGINT)`; migration đánh số, chạy khi mở DB trong
một transaction mỗi migration. `db.ts` bọc `postgres`/`SqlRunner`: call site
giữ placeholder `?` được viết lại thành `$1..$n`, transaction lồng nhau nhập
vào transaction mở (AsyncLocalStorage), kết quả `BIGINT` chuẩn hóa về number.
Test: `pg-mem` qua `dbFromRunner`/`memRunner` trong `test/helpers.ts`
(transaction giả lập bằng `mem.backup()`/`restore()`).

**Migration 1:**

| Bảng | Cột |
|---|---|
| `accounts` | `id BIGINT GENERATED ALWAYS AS IDENTITY PK`, `username TEXT UNIQUE NOT NULL`, `password_hash TEXT NOT NULL`, `created_at BIGINT NOT NULL`, `failed_logins BIGINT NOT NULL DEFAULT 0`, `locked_until BIGINT` |
| `sessions` | `token_hash TEXT PK`, `account_id BIGINT NOT NULL → accounts`, `last_used_at BIGINT NOT NULL` |
| `profiles` | `account_id BIGINT PK → accounts`, `profile_json TEXT NOT NULL`, `rev BIGINT NOT NULL`, `updated_at BIGINT NOT NULL` |
| `runs` | `id TEXT PK` (16 byte base64url), `account_id BIGINT NOT NULL → accounts`, `status TEXT NOT NULL` (`open`/`finished`/`abandoned`/`rejected`), `setup_json TEXT NOT NULL`, `data_version TEXT NOT NULL`, `created_at BIGINT NOT NULL`, `finished_at BIGINT`, `result_json TEXT` |

**Migration 2 (GĐ 4d):**

| Thay đổi | Cột |
|---|---|
| `runs` thêm | `loadout_json TEXT` (null với phiếu cũ → chạy lại không loadout), `starter_deck BIGINT NOT NULL DEFAULT 0` |
| Bảng mới `pulls` | `id BIGINT GENERATED ALWAYS AS IDENTITY PK`, `account_id BIGINT NOT NULL → accounts`, `banner_id TEXT NOT NULL`, `count BIGINT NOT NULL`, `seed BIGINT NOT NULL`, `results_json TEXT NOT NULL`, `created_at BIGINT NOT NULL`; chỉ mục `(account_id, created_at)` |

Thời gian lưu dạng ms UTC từ `clock()` (cột `BIGINT`). Mọi thao tác "đọc hồ sơ
→ hàm thuần → ghi hồ sơ (+ bảng `runs`)" chạy trong một transaction async;
khoá lạc quan của hồ sơ vẫn là `rev` + `If-Match` như cũ.

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
  trống, chỉ **Trận lẻ**; Lượt chơi, Cốt truyện, xếp/xóa deck, Tu Luyện, nâng cấp trang
  bị bị khóa.
- Công cụ debug sửa hồ sơ (+XP, mở hết lá, xóa hồ sơ) đã bỏ (hồ sơ chỉ đổi trên
  server); sửa trận bằng debug trong lượt chơi làm server từ chối kết quả (có cảnh báo).

---

## 7. Triển khai Internet (GĐ 5e)

Một VPS duy nhất chạy server + Caddy đứng trước làm reverse proxy; Postgres là
nguồn chân lý duy nhất nên không scale ngang (Supabase hoặc Postgres tự host).
File tĩnh của client do Caddy phục vụ (không cần `@fastify/static`). Phương án
PaaS: Vercel (client) + Render (server) + Supabase — `deploy/vercel-render.md`.

```text
Internet ──HTTPS/WSS──> Caddy ──> 127.0.0.1:8787  (node apps/server/dist/main.js, systemd)
                          │
                          └─ file tĩnh: apps/client/dist  (mọi route ngoài /api/*)
```

- `Caddy` tự xin/gia hạn HTTPS (Let's Encrypt); chuyển mọi request `/api/*` (gồm nâng
  cấp WebSocket `/api/ws`) tới server, còn lại phục vụ `apps/client/dist`.
- `deploy/`: `Caddyfile`, `vong-nguyet.service` (systemd), `README.md` hướng dẫn cài
  Node 22 → `pnpm install --frozen-lockfile` → `pnpm build` → chạy, sao lưu/khôi phục.
  File mẫu không chứa bí mật hay tên miền thật.

### 7.1 Biến môi trường

`config.ts` đọc và kiểm bằng zod khi khởi động; ở production thiếu biến bắt buộc →
lỗi rõ và không lắng nghe.

| Biến | Mặc định | Production | Ý nghĩa |
|---|---|---|---|
| `PORT` | `8787` | `8787` | Cổng server |
| `HOST` | `127.0.0.1` | `127.0.0.1` | Chỉ lắng nghe loopback (Caddy lo TLS) |
| `DATABASE_URL` | — | bắt buộc ở mọi chế độ | Chuỗi Postgres — Supabase pooler 6543; dev dùng project Supabase riêng (`apps/server/.env`) |
| `NODE_ENV` | — | `production` | Bật chế độ production (kiểm `Origin`, giới hạn tần suất) |
| `TRUST_PROXY` | — | `1` | Tin `X-Forwarded-For` của Caddy → IP thật cho giới hạn tần suất |
| `ALLOWED_ORIGINS` | — | bắt buộc | Danh sách origin `https://...` phân tách bằng dấu phẩy |
| `BACKUP_DIR` | — | tùy chọn | Thư mục nhận dump `pg_dump`; trống → tắt sao lưu định kỳ (Supabase có managed backups) |

`NODE_ENV` khác `production` (dev/test): `TRUST_PROXY`, `ALLOWED_ORIGINS`,
`BACKUP_DIR` không bắt buộc; không có `ALLOWED_ORIGINS` thì bỏ kiểm `Origin`,
không có `BACKUP_DIR` thì tắt sao lưu định kỳ. `DATABASE_URL` bắt buộc cả dev
(test dùng `pg-mem`, không đụng env).

### 7.2 Giới hạn tần suất (`rate-limit.ts`)

Cửa sổ trượt trong bộ nhớ, viết tay — không thêm thư viện. IP lấy từ
`request.ip` (đã qua `TRUST_PROXY`). Chỉ áp khi `NODE_ENV=production` — dev/test
không giới hạn (giới hạn IP cần `TRUST_PROXY` mới có nghĩa).

| Đối tượng | Giới hạn | Vượt → |
|---|---|---|
| `POST /api/auth/register` | 5 / giờ / IP | `429 { error: "rate limited" }` |
| `POST /api/auth/login` | 20 / phút / IP (ngoài khóa tài khoản sẵn có) | `429` |
| Nâng cấp `GET /api/ws` | 3 kết nối / IP / 10 giây | `429` (từ chối trước khi nâng cấp) |
| Tin nhắn WebSocket | 30 tin / giây / kết nối (đã có ở §8.1) | đóng `4429` |

### 7.3 Kiểm `Origin`

Khi `ALLOWED_ORIGINS` được đặt (production): header `Origin` có mặt phải thuộc danh
sách, áp cho nâng cấp WebSocket (origin lạ → từ chối nâng cấp, `403`) và mọi route
đổi hồ sơ (POST/PATCH/DELETE — `403 { error: "forbidden origin" }`). Request không
mang `Origin` (curl, client không phải trình duyệt) vẫn được phục vụ — `Origin` là
rào chống CSRF/cross-site, không phải xác thực.

### 7.4 Sao lưu / khôi phục

- `backup.ts`: khi `BACKUP_DIR` được đặt, `scheduler` spawn `pg_dump` mỗi 6 giờ
  ra `BACKUP_DIR/vong-nguyet-<ISO>.sql`; sau mỗi lần dọn bản cũ, chỉ giữ **14**
  bản mới nhất (≈ 3,5 ngày). Lỗi `pg_dump` chỉ log, không fatal. Với Supabase
  (không có `pg_dump` trên Render) để trống `BACKUP_DIR` và dùng managed
  backups: Dashboard → Database → Backups.
- Khôi phục (trong `deploy/README.md`): `psql "$DATABASE_URL" -f <dump>.sql`
  khi server dừng, hoặc restore snapshot trên Supabase Dashboard.
- Bản sao lưu nằm ngoài repo; thư mục backup thêm vào `.gitignore` không cần thiết
  vì `BACKUP_DIR` trỏ ra ngoài.

### 7.5 Log

Fastify logger JSON ra stdout (systemd gom qua `journalctl -u vong-nguyet`). Không
bao giờ log token phiên, mật khẩu (kể cả băm), nội dung body của route auth, hay
payload tin nhắn trận. Log WS chỉ ở mức sự kiện (kết nối/đóng/mã đóng), không log
nội dung tin.

### 7.6 Build client production

`VITE_API_BASE` rỗng → client gọi cùng origin `/api/*` (không cần CORS, không cần
biến khác). Lớp socket tự chọn `wss://` khi trang chạy `https://` (§8.1). Caddy phục
vụ `apps/client/dist` như static SPA: route không khớp file thật rơi về
`index.html`.

---

## 8. Kết nối realtime (GĐ 5c)

### 8.1 Kết nối

- `GET /api/ws` nâng cấp WebSocket (`@fastify/websocket`). Tin nhắn đầu tiên phải là
  `hello { token, dataVersion }` trong 10 giây; sai token → đóng `4401`; lệch
  `dataVersion` → `4409`. Token **không** đi trong URL (tránh lọt vào log proxy).
- Một kết nối mỗi tài khoản: kết nối mới cùng tài khoản đóng kết nối cũ (`4000
  "replaced"`) và nhận lại trận đang chơi qua `welcome.activeMatch` (§8.4).
- Server gửi `ping` mỗi 20 giây; client trả `pong`; không trả lời 2 lần → coi mất
  kết nối (§8.4).
- Tin nhắn JSON ≤ 16 KB, kiểm bằng zod (`realtime/protocol.ts`); sai cấu trúc →
  `error { error: "bad message" }`, không đóng. Quá 30 tin/giây → đóng `4429`.

| Mã đóng | Nghĩa |
|---|---|
| `4000` | `replaced` — kết nối khác của cùng tài khoản thay thế |
| `4401` | `unauthorized` — token sai/hết hạn hoặc thiếu `hello` |
| `4409` | `outdated client` — `dataVersion` lệch |
| `4429` | `rate limited` — quá 30 tin/giây |

### 8.2 Tin nhắn (spec `17` §5.2)

Client → server: `hello`, `queue.join`, `queue.leave`, `room.create`, `room.join`,
`room.leave`, `practice.start`, `match.action { matchId, seq, action }`,
`match.resign`, `match.emote`, `match.sync { matchId }`, `pong`.

Server → client: `welcome { account, activeMatch?, serverTime }`, `queue.status`,
`room.created` / `room.updated`, `match.start` (MatchSnapshot), `match.snapshot`
(MatchSnapshot, trả lời `match.sync` hoặc action trùng seq), `match.events
{ matchId, eventSeq, nextActionSeq, events, view, deadline }`, `match.rejected
{ matchId, seq, nextActionSeq, reason }`, `match.end { matchId, result, reason,
rating?, rewards?, profileRev? }`, `match.emote`, `error`, `ping`.

- `seq` trong `match.action` = số Action của riêng người đó đã được chấp nhận + 1;
  trùng (`seq < nextActionSeq`) → không áp lại, server trả `match.snapshot` hiện
  tại; nhảy cóc → `match.rejected "bad seq"` kèm `nextActionSeq` mong đợi.
- `nextActionSeq` trên MatchSnapshot / `match.events` / `match.rejected` là seq
  kế tiếp server chấp nhận **của riêng người nhận** — mỗi client thấy seq của
  chính mình; client coi action đang chờ đã được chấp nhận khi
  `nextActionSeq > seq đang chờ`.
- `eventSeq` tăng dần mỗi `match.events`; client thấy lỗ hổng → chờ snapshot kế
  hoặc kết nối lại.
- `deadline` = thời điểm hết lượt (ms UTC server); client bù lệch giờ bằng
  `serverTime` trong `welcome`.

### 8.3 Phòng trận (`match-room.ts`)

- Giữ `state` đầy đủ, nhật ký Action, đồng hồ, kết nối từng người. Mọi Action xử
  lý tuần tự trong phòng (Node đơn luồng; không `await` giữa đọc/ghi state).
- Mọi frame `match.*` định tuyến theo `matchId` trên tin + tư cách ghế của tài
  khoản — frame mang `matchId` cũ chỉ chạm vào phòng nó nêu tên (đã kết thúc →
  bỏ qua), không bao giờ áp lên trận mới của account; `match.sync` cũng bị từ
  chối (`error "no match"`) khi account không ngồi trong phòng đó.
- `match.action`: kiểm `seq` → quyền (PvP: đúng lượt; co-op: chưa `done`) →
  `applyAction`. Lỗi luật → `match.rejected`. Thành công → ghi nhật ký, gửi mỗi
  người `redactEvents(events, i)` + `viewFor(state, i)`, đặt lại đồng hồ khi đổi
  lượt.
- `match.sync`: trả `match.snapshot` của chính ghế đó — kể cả trên phòng đã kết
  thúc còn giữ lại (~60 s), để client kết nối lại muộn vẫn lấy được trạng thái
  chung kết.
- Schema action của `match.action` (realtime) gồm mọi loại của `02` §3, kể cả
  **[Nguyệt Luân mới]** `discardCard` / `bloodPact`; trường `player` trong action
  **không tin client** — server gắn theo seat của kết nối trước khi `applyAction`.
  Lệnh `xa_than` / `huyet_te` chỉ có hiệu lực đúng pha của nó (`01` §7.5), nên
  action gửi sai pha → `match.rejected` (T325).
- Trận kết thúc → ghi bản ghi + cập nhật hồ sơ (Elo, Vinh Dự, thưởng co-op) trong
  **một transaction** → `match.end` → xóa phòng khỏi bộ nhớ sau 60 giây.

### 8.4 Mất kết nối và kết nối lại

- Mất kết nối giữa trận: phòng giữ nguyên, đồng hồ lượt **vẫn chạy**; người kia
  nhận `match.events` kèm `playerDisconnected`.
- Kết nối lại trong `reconnectSeconds`: `welcome.activeMatch` mang snapshot đầy
  đủ (góc nhìn + `eventSeq` + `nextActionSeq` + `deadline`); client dựng lại màn
  trận, đồng bộ lại seq action và bỏ action chưa được server chấp nhận (hiện
  "Thao tác chưa được xác nhận, hãy thử lại."). Client chỉ giữ tối đa một action
  chờ xác nhận; `seq` chỉ bị tiêu thụ khi frame thực sự rời socket — tin trận
  đấu không bao giờ nằm trong outbox offline.
- Quá hạn → Action hệ thống `forfeit { reason: "disconnect" }`. Tải lại trang =
  kết nối lại (token trong `localStorage`).

### 8.5 Đấu Tập (`practice.start`)

- Server tạo phòng với một người chơi máy (`bot-player.ts`) dùng `pvpBot` /
  `coopBot` trên **góc nhìn** của nó; máy "nghĩ" 600–1200 ms/Action qua
  `scheduler`. Deck máy PvP: một đội ngẫu nhiên (seed trận), Bộ cơ bản, trang bị
  PvP cơ bản ngẫu nhiên.
- Không thưởng, không Elo, không nhiệm vụ/thành tựu. Bản ghi vẫn lưu
  (`mode: "practice"`).

### 8.6 Lưu trận — Migration 3

| Bảng | Cột |
|---|---|
| `matches` | `id TEXT PK`, `mode TEXT` (`ranked`/`private`/`practice`/`coop`/`coop_private`/`coop_practice`), `data_version TEXT`, `seed INTEGER`, `setup_json TEXT`, `actions_json TEXT` (`{ player, action }[]`), `status TEXT` (`playing`/`finished`/`void`), `result_json TEXT`, `created_at`, `finished_at` |
| `match_players` | `match_id → matches`, `account_id → accounts` (null với máy), `slot INTEGER`, `result TEXT`, `rating_before INTEGER`, `rating_after INTEGER`; PK `(match_id, slot)`; chỉ mục `(account_id, match_id)` |

- Ghi `matches` lúc bắt đầu (`playing`) và kết thúc (`finished`). Server khởi
  động: mọi trận `playing` → `void` (không Elo, không thưởng).
- `replayMatch(data, setup, actions)` dựng lại trận để debug và test (T237).

### 8.7 Route mới (5c)

| Route | Kết quả |
|---|---|
| `GET /api/ws` | Nâng cấp WebSocket (§8.1) |

### 8.8 Hàng chờ xếp hạng và route Đấu Trường (5d)

`realtime/queue.ts` (spec `17` §6.1): `queue.join { mode, deckId }` cần deck hợp lệ
PvP (`validateDeck` chế độ pvp — lỗi → `error "invalid deck"` kèm `errors`) và
không đang ở phòng/trận khác. Mỗi giây (`scheduler`) ghép cặp có |Δ Điểm| nhỏ
nhất trong khoảng `±100 + 50 × (giây chờ của người chờ lâu hơn / 10)`; không ghép
lại một đối thủ trong 2 trận xếp hạng gần nhất của 10 phút qua. `queue.leave` rời
hàng chờ; `queue.status { mode, waitingSeconds }` (spec §5.2) báo trạng thái — gửi
ngay khi vào hàng (`waitingSeconds: 0`) rồi mỗi giây trong khi chờ; rời hàng chờ
không có tin xác nhận (client tự chuyển trạng thái).

Trận `ranked` kết thúc (`§8.3`): `ratingChange` cho từng phía + `applyPvpResult`
(`14` §14) + `match_players` trong **một transaction**; `match.end` mang
`rating: { before, after }`, `rewards: { honor: số Vinh Dự nhận được }`,
`profileRev` (revision mới — client làm mới hồ sơ). Trận `private`/`practice`
gửi `match.end` không có `rating`/`rewards`.

| Route | Kết quả |
|---|---|
| `GET /api/arena/me` | `{ arena, tier, honorToday: { gained, cap } }` của tài khoản |
| `GET /api/arena/history?page=` | 20 trận gần nhất của mình: mode, đối thủ, kết quả, Δ Điểm, lúc đấu |
| `GET /api/arena/leaderboard` | Top 50 `rating` (tên, điểm, bậc, thắng/thua) + dòng của mình |
| `POST /api/shop/honor/:itemId/buy` | `buyHonorItem` (`14` §14.4); `If-Match` bắt buộc; 200 → hồ sơ mới |

### 8.9 Liên Thủ (GĐ 6b.1)

- `queue.join { mode: "coop" }` — hàng chờ co-op riêng (`CoopQueue`, `queue.ts`):
  FIFO, ghép hai người đầu hàng; deck kiểm `validateDeck` chế độ pve (mỗi người
  một đội 3 Hero). Trận dựng bằng `createCoopCombat` (encounter
  `coopConfig.encounterId` = `enc_coop_01`), `mode: "coop"`.
- `room.create { mode: "coop" }` / `room.join` — phòng riêng co-op
  (`coop_private`): hai người mỗi người một seat, không thưởng.
- `practice.start { mode: "coop" }` — `coop_practice`: seat 1 là `coopBot`
  (đồng đội máy), không thưởng.
- Phòng co-op trong `match-room.ts`: góc nhìn `coopViewFor` — tay đồng đội lộ bài,
  chồng cả hai seat và RNG ẩn (T262); event qua `coopRedactEvents` cùng quy ước
  PvP. Cả hai seat act trong lượt chung; seat đã `done` bị từ chối (`"already
  done"`). Hết 45 s (`coopConfig.turnSeconds`) server tự gửi `endTurn
  { system: true }` cho từng seat chưa Xong — `coopEndTurn` tự chọn Chiêm Bài
  `options[0]` nếu đang chọn (T259). `match.resign` và quá hạn kết nối lại →
  Action hệ thống `forfeit`: Hero seat đó ngã, đồng đội đánh tiếp (T261).
- Kết thúc (`§8.3`): `applyCoopResult` (`14` §15) cho **từng ghế người** trong một
  transaction; `match.end` mang `result` của đội cộng `rewards`/`profileRev` riêng
  ghế đó — ghế bỏ cuộc luôn `result: "lost"`, `rewards: null`. `coop_private` /
  `coop_practice` gửi `match.end` không `rewards`.

| Route | Kết quả |
|---|---|
| `GET /api/coop/me` | `{ clearsToday, rewardClaimsLeft }` của tài khoản trong kỳ ngày hiện tại |

---

## 9. Cốt truyện (GĐ 7c)

Luật: `14` §16; dữ liệu `story.json`: `02` §1.16; đặc tả: `18` §4. Trận Cốt truyện chạy
trên client nhưng chỉ có giá trị sau khi server **chạy lại** (`replayStoryCombat`)
xác nhận — cùng mô hình phiếu của Lượt chơi (§4), trên bảng riêng. Cốt truyện cần đăng
nhập; client ẩn chế độ khi mất kết nối (§6).

### 9.1 Phiếu Cốt Truyện — Migration 4

| Bảng | Cột |
|---|---|
| `story_tickets` | `id TEXT PK` (16 byte base64url), `account_id BIGINT NOT NULL → accounts`, `stage_id TEXT NOT NULL`, `status TEXT NOT NULL` (`open`/`finished`/`abandoned`/`rejected`), `setup_json TEXT NOT NULL` (`StorySetup`), `loadout_json TEXT NOT NULL`, `data_version TEXT NOT NULL`, `created_at BIGINT NOT NULL`, `finished_at BIGINT`, `result_json TEXT`; chỉ mục `(account_id, status)` |

- Mỗi tài khoản tối đa **một** phiếu `open`: cấp phiếu mới → phiếu `open` cũ →
  `abandoned` (trong cùng transaction).
- Hạn phiếu = `TICKET_TTL_MS` của `runs` (7 ngày): phiếu `open` quá hạn →
  `410 "ticket expired"`.
- `data_version` của phiếu khác `dataVersion` hiện tại → `409 "outdated client"`.
- Phiếu không `open` → `409 "ticket closed"`; phiếu lạ / của tài khoản khác →
  `404 "unknown ticket"`.

### 9.2 Route

| Route | Kết quả |
|---|---|
| `GET /api/story` | `{ cleared: string[]; unlocked: string[] }` — `unlocked` từ `unlockedStageIds`, gồm mọi màn đang mở kể cả màn đã qua |
| `POST /api/story/:stageId/tickets` | `201 { ticketId, setup, loadout }` — body `{ deckId }` hoặc `{ deckId: "starter", heroIds }` như `POST /api/runs`; `setup` (StorySetup: `stageId`, `seed` do server sinh, `heroIds`, `deckCardIds`) và `loadout` là ảnh chụp lúc cấp |
| `POST /api/story/tickets/:id/finish` | `{ profile, rev, won, rewards }` — body `{ actions }` (tối đa `MAX_STORY_ACTIONS = 2000`) |
| `POST /api/story/tickets/:id/abandon` | `204` — đóng phiếu `open` thành `abandoned` |

`POST /api/story/:stageId/tickets` theo thứ tự: `stageId` lạ → `404 "unknown stage"`;
body hỏng → `400`; màn chưa mở (`storyStageUnlocked` = false) → `403 "stage locked"`;
deck không hợp lệ (`validateDeck`) → `400 "invalid deck" { errors }`; `buildLoadout` lỗi
→ `400 <error>`; hợp lệ → chụp `setup` + `loadout`, đóng phiếu cũ, ghi phiếu `open`.

`POST /api/story/tickets/:id/finish` theo thứ tự: phiếu → `openTicket` (404/409/410
trên); `actions` quá `MAX_STORY_ACTIONS` → `400`; `replayStoryCombat` trả `{ ok: false }`
→ phiếu `rejected` (ghi `result_json { step, reason }`) và `422 "replay failed"`;
`state.status` chưa `won`/`lost` → `422 "combat not finished"`, phiếu **vẫn `open`**;
hợp lệ → trong một transaction: `applyStoryResult` (`14` §16.3, cần `If-Match` như mọi
route đổi hồ sơ), phiếu `finished` (ghi `result_json { won }`), trả hồ sơ mới + `won` +
`rewards`.
