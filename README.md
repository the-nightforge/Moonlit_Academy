# Vọng Nguyệt Thư Viện

> Webgame thẻ bài cổ phong 2D — **Hero Deckbuilder** nơi chu kỳ mặt trăng thay đổi luật chơi mỗi lượt.

Vọng Nguyệt Thư Viện là dự án cá nhân, phi thương mại (không có nạp tiền thật). Người chơi lập đội **3 Hero** cùng một **deck 18 lá**, đi qua các lượt chơi roguelike, thu thập Hero và trang bị qua gacha, rồi thử sức ở **Đấu Trường PvP** hoặc cùng đồng đội hạ boss trong chế độ **Liên Thủ (co-op)**.

| | |
|---|---|
| **Thể loại** | Hero Deckbuilder 2D + Roguelike + Gacha + PvP + Co-op realtime |
| **Nền tảng** | Trình duyệt (desktop) |
| **Ngôn ngữ** | TypeScript (strict) toàn bộ dự án |
| **Trạng thái** | Giai đoạn 6 hoàn tất — còn bước 5e.2 (triển khai Internet thật) |

---

## Mục lục

- [Điểm nổi bật](#điểm-nổi-bật)
- [Tính năng hiện có](#tính-năng-hiện-có)
- [Kiến trúc](#kiến-trúc)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Các lệnh thường dùng](#các-lệnh-thường-dùng)
- [Kiểm thử](#kiểm-thử)
- [Dữ liệu game](#dữ-liệu-game)
- [Tài nguyên hình ảnh](#tài-nguyên-hình-ảnh)
- [Triển khai](#triển-khai)
- [Tài liệu thiết kế](#tài-liệu-thiết-kế)
- [Quy tắc phát triển](#quy-tắc-phát-triển)
- [Lộ trình](#lộ-trình)

---

## Điểm nổi bật

Game được xây trên ba trụ cột thiết kế (chi tiết ở `docs/00-gdd.md`):

1. **Nguyệt Luân** — thanh 8 pha trăng tự tiến mỗi vòng. Mỗi pha đổi luật: Trăng Non tăng damage sát thủ, Trăng Tròn nhân đôi hồi máu, Hạ Huyền tăng giáp… Một số lá bài có thể đẩy trăng tiến/lùi hoặc gọi **Huyết Nguyệt**.
2. **Lore thành cơ chế** — mỗi Hero **thăng cấp trong trận** khi đạt điều kiện gắn với tính cách của họ; các cặp Hero có quan hệ đặc biệt mở khóa **lá Song Hành**.
3. **Chơi cùng nhau** — PvP 1v1 trên nền trang bị chuẩn hóa (Đấu Trường Công Bằng) và co-op 2 người đánh boss Nguyệt Thực.

### Vòng chiến đấu

- Đầu trận rút 6 lá, được **Đổi Bài** tối đa 2 lá.
- Mỗi vòng nhận **Nguyệt Lực** (3 ở vòng 1, +1 mỗi vòng, tối đa 8) cộng **Nguyệt Lực Dự Trữ** mang sang từ lượt trước (tối đa 3).
- Rút bù đủ 6 lá. Chồng bài không xáo lại — hết cả chồng lẫn tay là thua (**Cạn Bài**).
- Mỗi lá thuộc về một Hero; Hero ngã thì lá của họ thành **Tàn Chiêu**, nên phải cân nhắc bảo vệ ai.
- Kẻ địch dùng cùng đường cong Nguyệt Lực và **báo trước chuỗi chiêu** (tối đa 3) qua biểu tượng ý định.

Toàn bộ luật chính xác nằm trong `docs/01-combat-rules.md`.

---

## Tính năng hiện có

| Nhóm | Nội dung |
|---|---|
| **Chiến đấu** | Luật đầy đủ: Nguyệt Luân 8 pha, Huyết Nguyệt, trạng thái, Phản Đòn, cướp buff, thăng cấp (2 dạng), lá Song Hành, boss hành động theo pha, 21 từ khóa |
| **Roguelike** | Bản đồ 8 tầng sinh theo seed (trận thường, Tinh Anh, Nghỉ Chân, Kho Báu, Boss), Kỳ Vật và Lõi trong lượt chơi |
| **Tiến trình** | Tài khoản, hồ sơ lưu trên server, Tu Luyện mở khóa lá, xếp và lưu tối đa 30 deck, nhiệm vụ, thành tựu |
| **Gacha & trang bị** | 3 banner (Hero, Binh Khí, Nguyệt Bảo), bảo hiểm (pity), Tinh Hồn 0–6, Tinh Luyện R1–R5, Cộng Minh 1–5, cửa hàng |
| **PvP — Đấu Trường** | Trận xếp hạng Elo với 5 bậc (Đồng Sinh → Trạng Nguyên), Vinh Dự và cửa hàng Vinh Dự, Phòng riêng, Đấu Tập với bot, hẹn giờ lượt, kết nối lại |
| **Co-op — Liên Thủ** | Lượt đồng thời, Hợp Kích (đòn phối hợp), Boss Nguyệt Thực 4 giai đoạn, phòng riêng, đồng đội máy, thưởng theo ngày |

**Nội dung hiện tại** (trong `packages/data/`): 5 Hero, 68 lá bài, 7 kẻ địch, 9 trận, 10 Binh Khí, 8 Nguyệt Bảo, 10 Kỳ Vật, 16 Lõi, 3 Hợp Kích.

---

## Kiến trúc

Dự án là một **pnpm monorepo** với nguyên tắc cốt lõi: **luật chơi là code thuần, tất định, dùng chung cho client lẫn server.**

```text
                     ┌─────────────────────────────┐
                     │   packages/data             │
                     │   JSON nội dung + schema zod│
                     └──────────────┬──────────────┘
                                    │ GameData
                     ┌──────────────▼──────────────┐
                     │   packages/rules            │
                     │   Luật thuần, RNG có seed   │
                     │   applyAction(state, action)│
                     │     → { state, events }     │
                     └───────┬──────────────┬──────┘
                             │              │
          Action / Event     │              │   replayRun, applyPvpResult,
      ┌──────────────────────▼───┐      ┌───▼──────────────────────────┐
      │  apps/client             │ HTTP │  apps/server                 │
      │  Vite + Phaser 4         │◄────►│  Fastify 5 + WebSocket       │
      │  Hiển thị, input,        │  WS  │  Trọng tài hồ sơ, phiếu      │
      │  animation theo event    │      │  lượt chơi, phòng PvP/co-op  │
      └──────────────────────────┘      └──────────────┬───────────────┘
                                                       │ postgres.js
                                              ┌────────▼────────┐
                                              │ Postgres        │
                                              │ (Supabase)      │
                                              └─────────────────┘
```

| Gói | Công nghệ | Vai trò |
|---|---|---|
| `packages/rules` | TypeScript thuần | Toàn bộ luật chiến đấu, roguelike, PvP, co-op và meta (hồ sơ, kinh tế, gacha, Elo). Không phụ thuộc DOM, mạng, file system; không dùng `Math.random()` hay `Date.now()` |
| `packages/data` | JSON + zod | Nội dung game và schema kiểm tra khi nạp; tính `dataVersion` (FNV-1a 64 bit) để client và server khớp phiên bản dữ liệu |
| `apps/client` | Vite 8, Phaser 4 | Chỉ gửi `Action`, nhận `CombatEvent[]` rồi phát animation theo thứ tự. Mọi con số hiển thị lấy từ state |
| `apps/server` | Node 22, Fastify 5, `@fastify/websocket`, `postgres` | Tài khoản, hồ sơ, phiếu lượt chơi, gacha, hàng chờ xếp hạng, phòng trận realtime. Bundle bằng Vite SSR build |

**Tính tất định:** mọi yếu tố ngẫu nhiên dùng RNG có seed nằm trong `CombatState`. Cùng seed + cùng chuỗi hành động luôn cho ra cùng kết quả — đây là nền tảng để server **chạy lại (`replayRun`)** lượt chơi của client trước khi trao thưởng, và để kiểm thử bằng bộ ghi vàng (golden record).

---

## Cấu trúc thư mục

```text
.
├── CLAUDE.md                 # Quy tắc bắt buộc cho AI hỗ trợ code
├── README.md
├── package.json              # Script gốc: dev, build, test, typecheck
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── render.yaml               # Render Blueprint cho server
├── docs/                     # Tài liệu thiết kế và đặc tả (00–18)
│   └── superpowers/plans/    # Kế hoạch triển khai chi tiết từng giai đoạn
├── deploy/                   # Caddyfile, systemd unit, hướng dẫn triển khai
├── data/                     # Dữ liệu prototype GĐ 1 (lịch sử — không còn dùng)
├── packages/
│   ├── data/                 # *.json nội dung game + src/schema.ts, load-game-data.ts
│   └── rules/
│       ├── src/
│       │   ├── apply-action.ts, turn.ts, effects.ts, moon.ts, …   # chiến đấu PvE
│       │   ├── run/          # bản đồ và state machine lượt chơi roguelike
│       │   ├── pvp/          # luật PvP, góc nhìn/ẩn thông tin, bot, replay
│       │   ├── coop/         # lượt đồng thời, Hợp Kích, boss, bot đồng đội
│       │   ├── meta/         # hồ sơ, deck, kinh tế, gacha, Elo, Vinh Dự, thưởng
│       │   └── types/        # CombatState, Action, CombatEvent, kiểu tĩnh…
│       └── test/             # Vitest: kịch bản T01…, mô phỏng cân bằng, golden
└── apps/
    ├── client/
    │   ├── src/scenes/       # login, deck, run, combat, gacha, arena, coop-lobby…
    │   ├── src/ui/           # event-animator, widgets, theme, card-tooltip
    │   ├── src/net/          # WebSocket và giao thức trận realtime
    │   ├── public/assets/    # Art (Git LFS) — xem README riêng trong thư mục
    │   └── e2e/              # Playwright: arena, pvp, coop
    └── server/
        ├── src/routes/       # auth, profile, runs, gacha, shop, arena, coop
        ├── src/realtime/     # hub, hàng chờ, phòng trận, bot, protocol
        └── test/             # Vitest trên pg-mem (Postgres trong bộ nhớ)
```

---

## Bắt đầu nhanh

### Yêu cầu

- **Node.js ≥ 20** (khuyên dùng **22**, trùng với môi trường production)
- **pnpm 10** — bật qua Corepack: `corepack enable`
- **Git LFS** — để tải art (`git lfs install` trước khi clone)
- Một database **Postgres**. Khuyên dùng một project **Supabase** riêng cho dev (gói free là đủ)

### 1. Cài đặt

```bash
git clone https://github.com/the-nightforge/Moonlit_Academy.git
cd Moonlit_Academy
pnpm install
```

### 2. Cấu hình server

```bash
cp apps/server/.env.example apps/server/.env
```

Mở `apps/server/.env` và điền `DATABASE_URL` của project Supabase **dev**:

- Supabase Dashboard → **Connect** → **Transaction pooler** (cổng `6543`, *không* dùng direct `5432`).
- Chuỗi có dạng `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`.

Server tự chạy migration khi khởi động (bảng `schema_version` ghi phiên bản đã áp). Hướng dẫn đầy đủ: `deploy/vercel-render.md`, Bước 0.

> ⚠️ **Không bao giờ commit `.env`** và không dùng chung database dev với production.

### 3. Chạy

```bash
pnpm dev
```

- Client (Vite): <http://localhost:5173>
- Server (Fastify): <http://localhost:8787> — kiểm tra bằng `curl http://localhost:8787/api/health`

Vite proxy mọi request `/api/*` (kể cả WebSocket `/api/ws`) sang server, nên không cần cấu hình CORS khi dev.

> Nếu không kết nối được server, client chuyển sang **chế độ offline**: chỉ chơi được **Trận lẻ**; lượt chơi, deck và Tu Luyện bị khóa.

---

## Các lệnh thường dùng

Chạy ở thư mục gốc:

| Lệnh | Tác dụng |
|---|---|
| `pnpm install` | Cài đặt toàn bộ workspace |
| `pnpm dev` | Chạy client và server song song (chế độ theo dõi thay đổi) |
| `pnpm build` | Build server (`apps/server/dist/`) và client (`apps/client/dist/`) |
| `pnpm test` | Chạy toàn bộ test (Vitest) |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript mọi gói |
| `pnpm --filter rules test` | Chỉ test bộ luật |
| `pnpm --filter data test` | Chỉ test nạp và kiểm dữ liệu |
| `pnpm --filter server dev` | Chỉ chạy server (cổng 8787) |
| `pnpm --filter server test` | Chỉ test server |
| `pnpm --filter server start` | Chạy bản server đã build |
| `pnpm --filter client dev` | Chỉ chạy client |

---

## Kiểm thử

Dự án coi test là điều kiện bắt buộc trước khi hoàn thành bất kỳ thay đổi nào.

- **`packages/rules/test`** — kiểm thử luật theo các kịch bản đánh mã trong `docs/06-test-scenarios.md` và các file đặc tả giai đoạn (`T01`, `T11`, …, `T330`), cùng:
  - **Golden record** (`golden.test.ts`): ghi lại kết quả các trận và lượt chơi mẫu, phát hiện mọi thay đổi hành vi ngoài ý muốn.
  - **Mô phỏng cân bằng** (`*-sim.test.ts`, `playtest.test.ts`): bot tự chơi hàng loạt trận để đo tỉ lệ thắng, kinh tế, PvP và co-op.
- **`packages/data/test`** — mọi file JSON phải qua schema zod; `dataVersion` ổn định.
- **`apps/server/test`** — test tích hợp HTTP và WebSocket trên `pg-mem`, không cần database thật. `clock` và `random` được thay bằng bản giả để kết quả tất định.
- **`apps/client/e2e`** — test end-to-end bằng Playwright cho Đấu Trường, PvP và Liên Thủ:

  ```bash
  # Terminal 1 — server đã build
  pnpm --filter server build && pnpm --filter server start
  # Terminal 2 — client
  pnpm --filter client dev
  # Terminal 3
  cd apps/client && npx playwright test
  ```

---

## Dữ liệu game

Mọi nội dung nằm trong `packages/data/*.json` — **không hardcode số liệu trong code**.

| File | Nội dung |
|---|---|
| `heroes.json` | Hero: HP, phe, archetype, lá kỹ năng, điều kiện và dạng thăng cấp |
| `cards.json` | Lá bài: chi phí, loại, hiệu ứng (`Effect` dạng discriminated union) |
| `keywords.json` | Từ khóa và mô tả hiển thị |
| `enemies.json`, `encounters.json` | Kẻ địch, chuỗi chiêu, trận đấu |
| `moon-phases.json` | 8 pha Nguyệt Luân và luật của từng pha |
| `weapons.json`, `relics.json` | Binh Khí và Nguyệt Bảo |
| `run-config.json`, `run-relics.json`, `run-augments.json` | Cấu hình lượt chơi roguelike, Kỳ Vật, Lõi |
| `banners.json`, `economy-config.json`, `missions.json`, `achievements.json` | Gacha, kinh tế, nhiệm vụ, thành tựu |
| `combat-config.json`, `meta-config.json` | Hằng số chiến đấu và tiến trình |
| `pvp-config.json` | Chỉ số chuẩn hóa, bậc hạng, cửa hàng Vinh Dự, hẹn giờ |
| `coop-config.json`, `coop-combos.json` | Cấu hình Liên Thủ và Hợp Kích |

**Thêm hiệu ứng mới** = thêm loại `Effect` vào schema (`packages/data/src/schema.ts`) → xử lý trong `packages/rules` → viết test. ID dữ liệu dùng `snake_case` chữ thường (ví dụ `m05_liet_hoa_xung_phong`).

> Mọi thay đổi dữ liệu sẽ đổi `dataVersion`. Client và server phải cùng phiên bản; server trả `409 outdated client` nếu lệch.

---

## Tài nguyên hình ảnh

Art đặt trong `apps/client/public/assets/` (`heroes/`, `cards/`, `enemies/`, `backgrounds/`, `ui/`) và được **Git LFS** theo dõi tự động. Tên file phải khớp ID trong dữ liệu (ví dụ `heroes/m05.png`, `heroes/m05_up.png` cho dạng thăng cấp). Client tự quét thư mục lúc dev/build — không cần khai báo thêm.

Quy ước kích thước và đặt tên: `apps/client/public/assets/README.md`. Lore và prompt vẽ nhân vật: `docs/08-character-prompts.md`.

---

## Triển khai

Có hai phương án, đều dùng Postgres làm nguồn dữ liệu duy nhất (server không scale ngang):

| Phương án | Thành phần | Hướng dẫn |
|---|---|---|
| **PaaS miễn phí** | Vercel (client tĩnh) + Render (server, `render.yaml`) + Supabase (DB) | `deploy/vercel-render.md` |
| **VPS tự quản** | Caddy (HTTPS tự động + file tĩnh + reverse proxy) + systemd + Postgres/Supabase | `deploy/README.md` |

### Biến môi trường server

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Mọi môi trường | Chuỗi kết nối Postgres (Supabase Transaction pooler, cổng 6543) |
| `NODE_ENV` | — | `production` bật kiểm tra bắt buộc bên dưới |
| `TRUST_PROXY` | Production (`=1`) | Tin `X-Forwarded-For` từ reverse proxy để giới hạn tần suất đúng IP |
| `ALLOWED_ORIGINS` | Production | Danh sách origin `https://…` phân tách dấu phẩy; origin lạ bị từ chối `403` |
| `PORT` / `HOST` | — | Mặc định `8787` / `127.0.0.1` (production: `0.0.0.0`) |
| `BACKUP_DIR` | — | Bật `pg_dump` định kỳ mỗi 6 giờ (DB tự host). Bỏ trống khi dùng Supabase |

Ở production, server **từ chối khởi động** nếu thiếu biến bắt buộc.

### Biến môi trường client

| Biến | Mô tả |
|---|---|
| `VITE_API_BASE` | Để trống → gọi cùng origin `/api/*` (Caddy). Đặt `https://…` khi client và server ở hai domain khác nhau (Vercel + Render) |

### Bảo mật đã có sẵn

- Mật khẩu băm `scrypt` + so sánh `timingSafeEqual`; database chỉ lưu SHA-256 của token phiên.
- Khóa tài khoản 5 phút sau 5 lần đăng nhập sai.
- Giới hạn tần suất: đăng ký 5/giờ/IP, đăng nhập 20/phút/IP, nâng cấp WebSocket 3 lần/10 giây/IP, 30 tin nhắn/giây/kết nối.
- Server là trọng tài: thưởng chỉ trao sau khi `replayRun` xác nhận lượt chơi; client không thể tự sửa hồ sơ.
- Log JSON không bao giờ chứa token, mật khẩu hay payload tin nhắn trận.

---

## Tài liệu thiết kế

Tài liệu nằm trong `docs/` và là **nguồn chân lý** cho luật chơi.

| File | Nội dung |
|---|---|
| `00-gdd.md` | Thiết kế tổng thể: thế giới, phe, danh sách Hero, các chế độ chơi |
| `01-combat-rules.md` | **Đặc tả luật chiến đấu chính xác** (PvE, PvP, co-op) |
| `02-data-schema.md` | Kiểu dữ liệu TypeScript, hệ thống hiệu ứng, API bộ luật |
| `03-prototype-content.md` | Nội dung prototype, bản dễ đọc để cân bằng |
| `04-glossary.md` | Thuật ngữ tiếng Việt ↔ tên trong code |
| `05-ui-combat-screen.md` | Bố cục màn hình chiến đấu, tương tác, animation |
| `06-test-scenarios.md` | Kịch bản test có kết quả mong đợi (mã `T…`) |
| `07-implementation-plan.md` | Kế hoạch code theo từng bước, từ giai đoạn 0 đến 6 |
| `08-character-prompts.md` | Lore và prompt art của 20 nhân vật |
| `09-combat-depth-spec.md` | Đặc tả giai đoạn 2 — chiều sâu chiến đấu (Song Hành, từ khóa) |
| `10-roguelike-spec.md` | Đặc tả giai đoạn 3 — bản đồ nút, Kỳ Vật, roguelike |
| `11-run-rules.md` | Luật lượt chơi roguelike |
| `12-moon-economy-spec.md` | Đặc tả giai đoạn 4a — kinh tế Nguyệt Lực theo vòng |
| `13-card-pools-spec.md` | Đặc tả giai đoạn 4b — pool lá, Tu Luyện, xếp deck |
| `14-meta-rules.md` | Luật hồ sơ, Tu Luyện, deck, kinh tế, gacha, Elo, thưởng |
| `15-server-gacha-spec.md` | Đặc tả giai đoạn 4 — server, gacha, trang bị |
| `16-server-api.md` | Server, API HTTP, lưu trữ, realtime, triển khai |
| `17-pvp-coop-spec.md` | Đặc tả giai đoạn 5–6 — PvP, co-op, triển khai Internet |
| `18-content-spec.md` | Đặc tả giai đoạn 7 — đủ 20 Hero, Cốt truyện, trang bị |
| `playtest-notes.md` | Ghi chú chơi thử và các lần chỉnh số |
| `combat-visual-assets.md` | Kiểm kê asset chiến đấu và icon UI |

**Khi tài liệu mâu thuẫn**, thứ tự ưu tiên là:

```text
06-test-scenarios  >  01-combat-rules  >  02-data-schema  >  03-prototype-content  >  00-gdd
```

Tài liệu càng chi tiết càng được ưu tiên. Phát hiện mâu thuẫn thì sửa tài liệu trước, sau đó mới sửa code.

---

## Quy tắc phát triển

Tóm tắt các quy tắc bắt buộc (đầy đủ trong `CLAUDE.md`):

1. **`packages/rules` là code thuần** — không import Phaser, DOM, `window`, mạng, file system; không `Math.random()`, không `Date.now()`.
2. **Mọi yếu tố ngẫu nhiên dùng RNG có seed**, trạng thái RNG nằm trong `CombatState`.
3. **Hàm thuần, không mutate** — `applyAction(state, action)` trả về state mới + danh sách event.
4. **Client không tự tính luật** — chỉ gửi `Action` và phát animation từ `CombatEvent[]`.
5. **Nội dung nằm trong dữ liệu** — không hardcode số liệu lá bài, Hero, kẻ địch.
6. **Luật theo `docs/01-combat-rules.md`** — tài liệu không nói rõ thì hỏi, không tự đoán.
7. **Test trước khi báo xong** — chạy `pnpm test` và `pnpm typecheck`.
8. **Làm từng bước nhỏ** theo `docs/07-implementation-plan.md`.
9. **Server là trọng tài của hồ sơ** — hồ sơ chỉ đổi qua hàm thuần trong `packages/rules/src/meta/`.

### Quy ước code

- Code, tên biến, comment: **tiếng Anh**. Chữ hiển thị cho người chơi: **tiếng Việt**, lấy từ dữ liệu.
- Thuật ngữ theo đúng `docs/04-glossary.md`.
- `PascalCase` cho type, `camelCase` cho hàm/biến, `snake_case` cho ID dữ liệu.
- Ưu tiên discriminated union (`Effect`, `Action`, `CombatEvent`) và `switch` đầy đủ có kiểm tra `never`.
- Không thêm thư viện mới khi chưa được duyệt.

---

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Dựng monorepo, client khởi động | ✅ |
| 1 | Prototype chiến đấu offline | ✅ |
| 2 | Chiều sâu: Phản Đòn, Huyết Nguyệt, Song Hành, boss | ✅ |
| 3 | Roguelike: bản đồ, Kỳ Vật, Lõi | ✅ |
| 4a–4b | Kinh tế Nguyệt Lực, pool lá, Tu Luyện, xếp deck | ✅ |
| 4c–4e | Server, tài khoản, gacha, Tinh Hồn, Binh Khí, Nguyệt Bảo | ✅ |
| 5 | PvP: Đấu Trường Công Bằng, Elo, Vinh Dự, realtime | ✅ (trừ 5e.2) |
| 6 | Co-op Liên Thủ: lượt đồng thời, Hợp Kích, Boss Nguyệt Thực | ✅ |
| 5e.2 | Triển khai Internet thật | ⏳ Hoãn |

---

<sub>Dự án cá nhân, phi thương mại. Không có hệ thống thanh toán.</sub>
