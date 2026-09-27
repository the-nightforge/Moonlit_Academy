# Triển khai Internet (`16` §7)

Một VPS duy nhất: **Caddy** (HTTPS tự động + file tĩnh + reverse proxy) trước
`node apps/server/dist/main.js` chạy bằng **systemd**. Database là Postgres —
dùng project Supabase sẵn có hoặc Postgres cài trên VPS — không scale ngang.

## 1. Chuẩn bị VPS (Ubuntu/Debian)

```bash
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs caddy postgresql-client   # client cho pg_dump backup
sudo corepack enable   # pnpm

sudo useradd --system --shell /usr/sbin/nologin vongnguyet
sudo mkdir -p /srv/vong-nguyet && sudo chown "$USER" /srv/vong-nguyet
```

Tên miền: trỏ bản ghi **A** về IP của VPS trước khi khởi động Caddy.

### Database: chọn một trong hai

- **Supabase** (khuyên dùng, giống môi trường Render): lấy `DATABASE_URL` pooler
  6543 theo `deploy/vercel-render.md` Bước 0; bỏ trống `BACKUP_DIR` và dùng
  managed backups của Supabase.
- **Postgres trên VPS:** `sudo apt install postgresql`, tạo role + database
  `vongnguyet`, đặt `DATABASE_URL=postgresql://vongnguyet:<pw>@127.0.0.1:5432/vongnguyet`
  và giữ `BACKUP_DIR` để server tự `pg_dump`.

## 2. Đưa code lên và build

```bash
cd /srv/vong-nguyet
git clone <repo> .          # hoặc rsync từ máy dev
pnpm install --frozen-lockfile
pnpm build                # build data → rules → server (dist/) → client (dist/)
```

## 3. Systemd

```bash
sudo cp deploy/vong-nguyet.service /etc/systemd/system/
sudoedit /etc/systemd/system/vong-nguyet.service   # sửa ALLOWED_ORIGINS
sudo mkdir -p /srv/vong-nguyet/backups
sudo chown -R vongnguyet:vongnguyet /srv/vong-nguyet
sudo systemctl daemon-reload
sudo systemctl enable --now vong-nguyet
journalctl -u vong-nguyet -f     # theo dõi log JSON
```

Biến môi trường production (server từ chối khởi động khi thiếu — `16` §7.1):
`DATABASE_URL`, `TRUST_PROXY=1`, `ALLOWED_ORIGINS` (danh sách `https://...`
phân tách dấu phẩy). `BACKUP_DIR` tùy chọn — chỉ cần khi muốn `pg_dump` định kỳ
(DB tự host); với Supabase để trống và dùng managed backups.

## 4. Caddy

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudoedit /etc/caddy/Caddyfile     # đổi tên miền + đường dẫn dist
sudo systemctl reload caddy
curl https://<tên-miền>/api/health   # {"ok":true,"dataVersion":"..."}
```

## 5. Sao lưu / khôi phục

- **Supabase:** managed backups ở Dashboard → Database → Backups.
- **Postgres tự host + `BACKUP_DIR`:** server gọi `pg_dump` mỗi 6 giờ, giữ 14
  bản `.sql` mới nhất. Nên `rsync`/`rclone` thư mục backup ra ngoài định kỳ.

Khôi phục từ một dump `.sql`:

```bash
sudo systemctl stop vong-nguyet
psql "$DATABASE_URL" -f /srv/vong-nguyet/backups/vong-nguyet-<thời-điểm>.sql
sudo systemctl start vong-nguyet
```

## 6. Cập nhật phiên bản

```bash
cd /srv/vong-nguyet && git pull
pnpm install --frozen-lockfile && pnpm build
sudo systemctl restart vong-nguyet
```

## 7. Giới hạn tần suất và Origin (đã cài sẵn trong server)

- Đăng ký 5/giờ/IP, đăng nhập 20/phút/IP, nâng cấp WebSocket 3 lần/10 giây/IP,
  tin nhắn WebSocket 30 tin/giây/kết nối.
- `ALLOWED_ORIGINS`: `Origin` lạ bị từ chối 403 trên route đổi hồ sơ và nâng cấp
  WebSocket; request không mang `Origin` vẫn qua.
