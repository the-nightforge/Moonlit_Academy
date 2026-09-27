# Triển khai miễn phí: Vercel (client) + Render (server) + Supabase (DB)

**Vercel** phục vụ client tĩnh (build Vite), **Render** chạy
`node apps/server/dist/main.js` (HTTP + WebSocket `/api/ws`), **Supabase**
chạy Postgres — server nối qua `DATABASE_URL` (driver `postgres`/postgres.js).
Client nối server qua `VITE_API_BASE`; server chỉ nhận `Origin` trong
`ALLOWED_ORIGINS`.

Dùng **hai project Supabase**: `vong-nguyet-prod` cho Render, `vong-nguyet-dev`
cho `pnpm dev` ở máy — dữ liệu dev không đụng production.

## Giới hạn gói free — đọc trước

- **Render ngủ sau ~15 phút không dùng** — request đầu mất ~30–60 giây khởi
  động, WebSocket đang mở bị đứt (client tự nối lại / rejoin trận nếu còn hạn).
- **Supabase free ngừng project sau ~1 tuần không hoạt động** — Dashboard có
  nút "restore/pause"; mở lại là chạy.
- Render free **không có `pg_dump`** trong image — không đặt `BACKUP_DIR`; sao
  lưu dùng **Supabase managed backups** (Dashboard → Database → Backups, giữ
  7 ngày trên gói free).
- Render hỗ trợ WebSocket qua WSS — không cần cấu hình thêm.

## Bước 0 — Supabase (database)

1. <https://supabase.com> → đăng ký → **New project**:
   - `vong-nguyet-prod` (production) và `vong-nguyet-dev` (máy dev). Nhớ mật
     khẩu database đặt lúc tạo.
2. Với **mỗi** project: **Connect** (nút trên cùng) → chọn **Transaction
   pooler** (port `6543`) → copy chuỗi dạng
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`,
   thay `<password>` thật.
   - *Phải là pooler 6543, không phải direct 5432* — server mở nhiều kết nối,
     Supabase free chỉ cho ít kết nối trực tiếp.
3. Dev: copy `apps/server/.env.example` → `apps/server/.env`, điền
   `DATABASE_URL` của project **dev** → `pnpm dev`. Server tự chạy migrations
   khi khởi động (bảng `schema_version` ghi version đã áp).
4. Kiểm tra schema vào được: Dashboard → **Table Editor** thấy `accounts`,
   `sessions`, `profiles`, `runs`, `pulls`, `matches`, `match_players`.

## Bước 1 — Backend lên Render

1. Push nhánh lên GitHub. <https://render.com> → **New → Blueprint** → trỏ repo
   — Render đọc `render.yaml` và tạo web service `vong-nguyet`.
2. **Environment** → điền `DATABASE_URL` = chuỗi pooler của project **prod**
   (`sync: false` trong blueprint nghĩa là điền tay — giữ bí mật).
   - *Không dùng Blueprint:* **New → Web Service** → Node, Build
     `corepack enable && pnpm install --frozen-lockfile && pnpm build`, Start
     `node apps/server/dist/main.js`, Health Check `/api/health`, env như
     `render.yaml`.
3. Đợi deploy (log có `server listening on ...`). Copy domain
   `https://vong-nguyet.onrender.com`. Kiểm tra:
   `curl https://<domain>/api/health` → `{"ok":true,"dataVersion":"..."}`.
   - Thiếu env → server thoát ngay với `missing production env: ...` trong log.

## Bước 2 — Client lên Vercel

1. <https://vercel.com> → **Add New → Project** → import repo.
2. **Root Directory:** `apps/client` (Vercel tự nhận Vite + pnpm workspace).
3. **Environment Variables:** `VITE_API_BASE=https://<domain-render>` — không
   dấu `/` cuối.
4. **Deploy** → copy domain `https://<app>.vercel.app`.

## Bước 3 — Nối hai phía

1. Render → **Environment** → `ALLOWED_ORIGINS=https://<app>.vercel.app`
   (đúng domain, không `/` cuối) → Save → redeploy.
2. Mở `https://<app>.vercel.app`, đăng ký tài khoản, vào game.
   - `ALLOWED_ORIGINS` so khớp **chính xác** — domain preview của Vercel
     (`*-abc123.vercel.app`) bị 403 trên API ghi/WS. Muốn dùng preview thì
     thêm vào danh sách (phân tách dấu phẩy).

## Bước 4 — Kiểm tra sau triển khai (`17` §10)

- [ ] `GET /api/health` qua HTTPS trả `ok:true`.
- [ ] Đăng ký 2 tài khoản từ 2 mạng/thiết bị khác nhau.
- [ ] Một trận xếp hạng qua hàng chờ; một trận Đấu Tập; một trận co-op.
- [ ] Tải lại trang giữa trận → rejoin được.
- [ ] Redeploy Render → **dữ liệu vẫn còn** (Postgres nằm ở Supabase).
- [ ] Supabase Dashboard → Table Editor thấy rows `accounts`/`profiles` mới.

## Sao lưu & khôi phục

- **Supabase free:** Dashboard → Database → Backups — snapshot ngày, giữ 7
  ngày, restore bằng 1 click (hoặc qua support ticket cho point-in-time).
- **Muốn dump tay:** chạy `pg_dump "<DATABASE_URL>" --file dump.sql` trên máy
  có cài Postgres client (máy dev/WSL — không phải Render shell free).
- **`BACKUP_DIR`** chỉ còn ý nghĩa khi self-host (VPS sau này): đặt thư mục →
  server tự `pg_dump` mỗi 6 h, giữ 14 bản.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Render "no open ports detected" | Bản cũ bind `127.0.0.1` — production mặc định `0.0.0.0`; nếu đặt `HOST` tay phải là `0.0.0.0` |
| `missing production env: ...` | Thiếu `DATABASE_URL`/`TRUST_PROXY=1`/`ALLOWED_ORIGINS` |
| `too many clients` / timeout DB | Đang dùng direct connection 5432 — đổi sang pooler 6543 |
| Client báo 403 / WS không mở | `ALLOWED_ORIGINS` sai domain Vercel (lệch subdomain, thừa `/` cuối) |
| Request đầu chậm ~1 phút | Service free vừa thức giấc — bình thường |
| `password authentication failed` | Sai mật khẩu trong `DATABASE_URL`, hoặc chuỗi chưa thay `<password>` |

Sang VPS sau này (Task 18): làm theo `deploy/README.md` — kiến trúc giữ nguyên
(Caddy thay Vercel/Render), có thể trỏ `DATABASE_URL` về cùng project Supabase
hoặc Postgres tự cài; đặt `BACKUP_DIR` để bật `pg_dump` định kỳ.
