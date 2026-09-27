# Triển khai miễn phí: Vercel (client) + Render (server)

Phương án thay cho VPS/Caddy trong `deploy/README.md`: **Vercel** phục vụ client
tĩnh (build Vite), **Render** chạy `node apps/server/dist/main.js` (HTTP + WebSocket
`/api/ws` + SQLite). Client nối server qua `VITE_API_BASE`; server chỉ nhận `Origin`
trong `ALLOWED_ORIGINS`.

## Giới hạn gói free — đọc trước

- **SQLite không bền.** Gói free của Render không có ổ đĩa gắn kèm — DB nằm trong
  filesystem tạm, **mất hồ sơ/tài khoản mỗi lần deploy lại hoặc restart**. Chấp
  nhận được để thử nghiệm; muốn giữ dữ liệu: nâng lên gói trả phí (~$7/tháng) và
  gắn disk, hoặc đợi triển khai VPS (Task 18).
- **Ngủ sau ~15 phút không dùng.** Web service free ngủ đông; request đầu tiên
  sau đó mất ~30–60 giây khởi động lại và mọi WebSocket đang mở bị đứt (client
  tự nối lại / rejoin trận nếu còn hạn).
- Render hỗ trợ WebSocket qua WSS — không cần cấu hình thêm.

## Bước 1 — Backend lên Render

1. Push nhánh này lên GitHub. Vào <https://render.com>, đăng ký (free), **New →
   Blueprint** và trỏ tới repo — Render đọc `render.yaml` ở gốc và tạo sẵn web
   service `vong-nguyet` với đủ env (trừ `ALLOWED_ORIGINS` — điền ở bước 3).
   - *Không dùng Blueprint:* **New → Web Service** → chọn repo, rồi điền tay:
     Runtime `Node`, Build Command `corepack enable && pnpm install
     --frozen-lockfile && pnpm build`, Start Command `node
     apps/server/dist/main.js`, Health Check Path `/api/health`, và các biến môi
     trường giống `render.yaml`.
2. Đợi deploy xong (log phải có `server listening on ...`). Copy domain dạng
   `https://vong-nguyet.onrender.com`. Kiểm tra:
   `curl https://<domain>/api/health` → `{"ok":true,"dataVersion":"..."}`.
3. **Giữ dữ liệu (tùy chọn, gói trả phí):** service → **Disks → Add Disk**, name
   `vong-nguyet-data`, Mount Path `/var/data`, size 1 GB; rồi sửa env
   `DB_PATH=/var/data/vong-nguyet.db`, `BACKUP_DIR=/var/data/backups`.

## Bước 2 — Client lên Vercel

1. Vào <https://vercel.com>, đăng ký (free), **Add New → Project** → import repo.
2. **Root Directory:** `apps/client`. Vercel tự nhận Vite + pnpm workspace
   (install từ gốc repo, build trong `apps/client`). Không cần `vercel.json`.
3. **Environment Variables:** `VITE_API_BASE=https://<domain-render>` (domain ở
   bước 1.2, không có dấu `/` cuối).
4. **Deploy.** Copy domain dạng `https://<app>.vercel.app`.

## Bước 3 — Nối hai phía

1. Quay lại Render → service → **Environment** → điền
   `ALLOWED_ORIGINS=https://<app>.vercel.app` (đúng domain Vercel, không có `/`
   cuối). Save → Render tự redeploy.
2. Mở `https://<app>.vercel.app`, đăng ký tài khoản, vào game.
   - `ALLOWED_ORIGINS` so khớp **chính xác** — domain preview của Vercel
     (`*-abc123.vercel.app`) sẽ bị 403 trên API ghi/WS. Muốn dùng preview thì
     thêm domain đó vào danh sách (phân tách dấu phẩy).

## Bước 4 — Kiểm tra sau triển khai (`17` §10)

- [ ] `GET /api/health` qua HTTPS trả `ok:true`.
- [ ] Đăng ký 2 tài khoản từ 2 mạng/thiết bị khác nhau.
- [ ] Một trận xếp hạng qua hàng chờ; một trận Đấu Tập; một trận co-op nếu muốn.
- [ ] Tải lại trang giữa trận → rejoin được.
- [ ] Deploy lại → chấp nhận mất dữ liệu nếu chưa gắn disk (bản free).

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Render "no open ports detected" | Bản cũ bind `127.0.0.1` — code hiện tại mặc định `0.0.0.0` ở production; nếu đặt `HOST` tay thì phải là `0.0.0.0` |
| `missing production env: ...` | Thiếu `DB_PATH`/`TRUST_PROXY=1`/`ALLOWED_ORIGINS`/`BACKUP_DIR` |
| Client báo 403 / WS không mở | `ALLOWED_ORIGINS` sai domain Vercel (lệch subdomain, thừa `/` cuối) |
| Request đầu chậm ~1 phút | Service free vừa thức giấc — bình thường |
| Mất tài khoản sau deploy | Free tier không có disk — hệ quả đã nêu trên |

Sang VPS sau này (Task 18): làm theo `deploy/README.md`, kiến trúc không đổi —
chỉ khác Caddy thay Vercel/Render và SQLite nằm trên ổ VPS.
