# Plan — Làm lại UI Gacha theo mô hình Genshin Wish Simulator

> Tham khảo: `github.com/jaihysc/Genshin-Impact-Wish-Simulator` (Svelte).
> Phạm vi: chủ yếu `apps/client` scene/UI — kết quả vẫn do
> `POST /api/gacha/pull` trả về, client chỉ render. Trạng thái: **đã duyệt
> 2026-10-06** — toàn bộ đề xuất §5a–h được chấp nhận; 5e (Nguyệt Ước) và 5f
> (Túi đồ) triển khai theo phase riêng sau khi có spec rules/API. Banner xoay
> tua: **3 splash riêng** theo từng tướng tuần (không composite runtime).

## 1. Điểm cốt lõi học được từ repo tham khảo

| Pattern | Cách repo làm | Áp dụng cho mình |
|---|---|---|
| **Full-bleed banner art** | Art banner phủ kín màn (`background-size: cover`), UI nổi trên art — art chính là màn hình | Banner splash 16:9 làm nền toàn scene; panel trái/phải biến thành cụm nút/label nổi có nền mờ |
| **Meteor cinematic** | `Meteor.svelte` — full-screen, 1 sao băng (x1) hoặc mưa sao (x10), **màu theo rarity cao nhất**: 3★ lam, 4★ tím, 5★ vàng. Có nút **Skip** | "Nguyệt tinh lạc": vệt sáng từ góc trời rơi vào đàn triệu hồi, màu theo max rarity (lam → tử → kim). Legendary thêm halo + rune |
| **Reveal theo từng thẻ** | `WishResult` (x1) / `WishListResult` (x10 lưới 10 thẻ), lật tuần tự, skip>8 thì hiện luôn | Giữ lật tuần tự; thêm **auto-speed** khi x10: thẻ sau mở nhanh hơn, legendary ép màn chậm lại để tạo nhịp |
| **Banner drawer** | `BannerList` overlay liệt kê mọi banner dạng card, click đổi | Cột trái hiện tại → **overlay/drawer** chọn banner, giải phóng màn cho art |
| **Footer 2 cụm** | Footer trái: Shop / Details / History; Footer phải: số jade + Wish×1 + Wish×10 (nút có icon + giá) | Giữ nguyên pull bar hiện có nhưng tách: nav (Tỉ lệ/Nhật ký/Shop) trái, giá + ×1/×10 phải |
| **History theo banner** | Bảng history lọc theo loại banner, phân trang | Server đã hỗ trợ `?banner=` — chỉ thêm tab lọc trong modal Nhật ký |
| **Inventory** | Gallery item đã quay được | Scene "Túi đồ" mới — đã duyệt, phase P6 |
| **Epitomized Path** | Banner vũ khí: chọn trước 1 legendary mục tiêu, trượt 2 lần → lần 3 chắc chắn | "Nguyệt Ước" cho Binh Khí Các — đã duyệt, **đổi rules**, phase P6 có spec riêng |

## 2. Bố cục màn mới (design 1280×720, EXPAND)

```
┌──────────────────────────────────────────────────────────────┐
│ [←]  TR_TRIỆU HỒI          [moonJade 960] [moonStar 320]  ⚙ │ ← header 56px, nền gradient tối dần
│ ┌──────────────────────────┐                                  │
│ │                          │                                  │
│ │      BANNER SPLASH       │   [≡ Đổi duyên]  ← nút mở drawer │
│ │      (full 1280×720,     │                                  │
│ │      item art nổi bên)   │   ┌──────── pity mini ────────┐  │
│ │                          │   │ ◆ Legendary  34/80 ▓▓▓░   │  │
│ │   tên banner + tướng     │   │ ◇ Epic        7/10 ▓▓▓▓   │  │
│ │   tuần nổi trên art      │   │ ⏳ Đổi tướng sau 5d 14h   │  │
│ │                          │   └───────────────────────────┘  │
│ └──────────────────────────┘                                  │
│ [Tỉ lệ & vật phẩm] [Nhật ký] [Cửa hàng]   1☾ [Quay ×1] [×10] │ ← footer 88px
└──────────────────────────────────────────────────────────────┘
```

- **Không còn 3 panel** — art là nền; mọi khối UI là "glass panel" (`fillAlpha` + `strokeRoundedRect`) nổi trên art, mờ ~0.72 giữ text đọc được.
- **Pity mini** thu gọn góc phải-giữa; bấm vào → modal pity chi tiết.
- **Drawer banner**: bấm "≡ Đổi duyên" → panel trượt từ trái 340px, liệt kê 4 banner dạng card (thumbnail 280×84 + tên + tag "ĐANG MỞ"/đếm ngược). Giữ cả chọn nhanh bằng ↑↓.
- **Footer**: trái = 3 nav nút nhỏ; phải = nút ×1 / ×10 kèm icon `cur_moonJade` + giá `160`/`1600`; jade không đủ → nút đỏ nhạt + tooltip "Thiếu X — đổi tại Cửa hàng" (→ modal đổi, §5d).

### Thứ tự render một lượt quay

1. Bấm Quay → nút disable, API pull (giữ nguyên).
2. **Cinematic** full-screen: màn tối, vệt sáng màu `maxRarity` cắt ngang, va vào vị trí đàn → flash + `camera.shake` (epic: 150ms/0.004; legendary: 220ms/0.007 + halo). Nút **Bỏ qua** góc trên-phải.
3. **Reveal**: x1 → card lật 1 thẻ lớn giữa màn; x10 → lưới 5×2 lật tuần tự (interval 120→70ms, legendary dừng 400ms + glow). Footer hiện tóm tắt `N Legendary · N Epic · N Rare · N Common` + tổng `moonDust` nhận được.
4. Bấm bất kỳ / "Xong" → về màn chính, pity bar cập nhật.

## 3. Tổ chức code (tách `gacha-scene.ts` ~1k dòng thành modules)

```
src/scenes/gacha-scene.ts        # orchestrator: preload, selectBanner, doPull, Esc
src/scenes/gacha/                # thư mục mới
  banner-drawer.ts               # overlay chọn banner
  banner-stage.ts                # nền splash + tên + caption + entrance anim
  pull-cinematic.ts              # vệt sáng + flash + shake theo rarity
  result-grid.ts                 # lưới x10 / card x1 + lật + summary footer
  pity-widget.ts                 # mini panel + tick countdown (time.addEvent)
  rates-modal.ts                 # modal "Tỉ lệ & vật phẩm" (port từ scene)
  history-modal.ts               # modal Nhật ký + tab lọc banner
  convert-modal.ts               # đổi moonStar→jade khi thiếu (đã duyệt)
```

Scene giữ đúng contract API hiện tại (`api GET /gacha/state`, `POST /gacha/pull`, `GET /gacha/history?banner=`); mọi hàm render nhận `data + profile` thuần, không gọi API bên trong component.

## 4. Asset còn thiếu — danh sách cho Codex gen

Quy ước có sẵn: art `.webp` painterly, icon `ui/` có thể `.webp`/`.svg`, key texture `thư_mục:tên_file`. Nguồn gốc **không đụng** `weapons/`,`relics/` (đủ dùng làm thumbnail trong lưới kết quả).

| Ưu tiên | File đề xuất | Size / tỉ lệ | Dùng cho |
|---|---|---|---|
| **P0** | `gacha/banner_heroes.webp` | 16:9, 1280×720 | Splash banner Triệu Hồi Anh Hùng — nhóm 3 tướng base (m05 trung tâm) |
| **P0** | `gacha/banner_nguyet_tuong_m01.webp`, `gacha/banner_nguyet_tuong_m08.webp`, `gacha/banner_nguyet_tuong_f08.webp` | 16:9, 1280×720 **mỗi file** | Splash riêng theo tướng tuần — mỗi file là một tác phẩm hoàn chỉnh (nền cổng trăng + tướng đó làm chủ thể). Scene map `featuredEntry.heroId → gacha:banner_nguyet_tuong_<heroId>` |
| **P0** | `gacha/meteor_head.webp` + `gacha/meteor_tail.webp` | head ~96×96 đuôi vệt ~512×64, **grayscale sáng để tint** | Vệt sáng cinematic — tint lam `#7fb4ff` / tím `#c89cff` / kim `#ffcf6e` theo rarity, không cần 3 file |
| **P0** | `gacha/frame_rare.webp`, `frame_epic.webp`, `frame_legendary.webp` | 2:3, ~550×825 | Khung thẻ kết quả theo rarity (hiện tô màu phẳng bằng graphics) |
| **P1** | `gacha/halo_legendary.webp` | 512×512, radial | Vòng sáng/rune sau thẻ legendary khi reveal — **đã gen 2026-10-06** |
| **P1** | `gacha/banner_weapons.webp`, `gacha/banner_relics.webp` | upscale/redraw 16:9 1280×720 | `weapon_banner.webp`/`relic_banner.webp` hiện tồn tại nhưng chỉ ~khung nhỏ; cần bản full-screen |
| **P1** | `ui/icon_history.webp`, `ui/icon_shop.webp`, `ui/icon_drawer.webp`, `ui/icon_camera.webp` | 48×48 | Icon nút nav/drawer/chụp ảnh (nếu §5 duyệt) |
| **P2** | `gacha/dust_mote.webp` | 32×32 glow tròn | Hạt sáng nổi nền — **đã gen 2026-10-06**, scene ưu tiên sprite mới, fallback `spark` |
| **P2** | `audio/gacha_cast.mp3`, `audio/rarity_rare.mp3`, `audio/rarity_epic.mp3`, `audio/rarity_legendary.mp3`, `audio/ui_flip.mp3` | <1s–2s | SFX quay + sting theo rarity — **chưa có thư mục audio**, cần confirm thêm `audio/` vào pipeline |
| **P2** | `ui/epitomized_moon.webp` | 96×96 | Icon "Nguyệt Ước" — **đã gen 2026-10-06**, dùng trong panel và modal chọn mục tiêu |

Tổng: **9 file P0** (banner ×4 gồm 3 splash xoay tua, meteor ×2, frame ×3). Halo thuộc P1 theo bảng trên. Nếu muốn giảm nhanh: bộ asset P0 đủ làm đầu vào cho P1–P3; frame rarity có thể giữ graphics-tô-màu tạm thời.

### Tiến độ P0 — hoàn tất 2026-10-06

- [x] 4 banner WebP 1280×720, gen theo art hero gốc: `banner_heroes` (m05 trung tâm, f01 và m04 hỗ trợ), `banner_nguyet_tuong_{m01,m08,f08}`.
- [x] 2 sprite sao băng WebP có alpha: `meteor_head` 96×96 và `meteor_tail` 512×64; ánh sáng trắng trung tính để tint theo rarity.
- [x] 3 khung WebP 550×825: `frame_rare`, `frame_epic`, `frame_legendary`, tâm trong suốt để ghép trên art thẻ.
- [x] Lưu đủ 9 asset trong `apps/client/public/assets/gacha/`, đúng key `gacha:<tên_file>` của pipeline hiện tại.
- [x] Kiểm tra file WebP, kích thước, alpha, tâm khung thẻ và sắc độ sao băng. Bộ asset runtime tổng khoảng 2,31 MB.
- Trang xem thử: `output/gacha-p0/index.html`; PNG nguồn, prompt và thông tin file nằm trong `output/gacha-p0/`.

P0 chỉ chuẩn bị asset. Các thay đổi scene để sử dụng banner, cinematic và khung thẻ mới lần lượt thuộc P1, P2 và P3; chưa triển khai trong lần thực hiện P0 này.

### Asset P1 bổ sung — 2026-10-06

- [x] Gen `gacha/banner_weapons.webp` và `gacha/banner_relics.webp` 1280×720 theo phong cách anime của các banner P0, lấy full art vũ khí và Nguyệt Bảo đang có làm mẫu.
- [x] Lưu tại `apps/client/public/assets/gacha/`, key `gacha:banner_weapons` và `gacha:banner_relics`; kiểm tra định dạng WebP và kích thước.
- Trang xem: `output/gacha-p1-banners/index.html`; PNG nguồn và prompt nằm trong cùng thư mục.

Phạm vi bổ sung này chỉ gồm hai banner được yêu cầu; các asset P1 khác và phần triển khai bố cục P1 vẫn theo phase riêng.

### Halo, icon Nguyệt Ước và hạt sáng — hoàn tất 2026-10-06

- [x] `gacha/halo_legendary.webp`: vòng sáng vàng radial 512×512 có tâm rỗng và alpha trong suốt, thay fallback `ui:moon_full` tại các điểm render Legendary đã có trên nhánh hiện tại.
- [x] `ui/epitomized_moon.webp`: icon trăng vàng ôm tinh thạch xanh tím 96×96; preload và hiển thị ở tiêu đề panel Nguyệt Ước, modal chọn mục tiêu.
- [x] `gacha/dust_mote.webp`: glow tròn 32×32 có alpha; thay sprite hạt nền bằng ảnh mới, giữ fallback `gacha:spark` khi chưa có texture.
- Trang xem: `output/gacha-missing-assets/index.html`; PNG nguồn, prompt và thông tin kích thước/alpha nằm trong cùng thư mục.
- Kiểm tra: WebP đúng kích thước và alpha; client TypeScript không có lỗi. Không thay rules/API của Nguyệt Ước.

## 5. Đề xuất ngoài layout — **đã duyệt** (2026-10-06)

| # | Đề xuất | Học từ | Độ phức tạp | Phase |
|---|---|---|---|---|
| a | **History lọc theo banner** (tab: Tất cả / Tướng / Xoay tua / Binh khí / Bảo vật) | history per banner | Nhỏ — server đã hỗ trợ `?banner=` | P4 |
| b | **Countdown + teaser tướng tuần sau** | banner phase timer | Nhỏ — data rotation có sẵn | P4 |
| c | **Chụp/lưu ảnh kết quả quay** | screenshot kết quả | Vừa — `game.renderer.snapshot()` hoặc RenderTexture → `toDataURL`, nút tải `.png` | P5 |
| d | **Modal đổi moonStar → jade khi thiếu** | convert-modal | Vừa — cần endpoint đổi tiền hoặc shop mua jade bằng moonStar | P5 |
| e | **Nguyệt Ước (Epitomized Path)** cho Binh Khí Các | epitomizedPath | **Lớn — đổi rules/server/DB**: chọn trước 1 legendary vũ khí; 2 lần trượt → lần 3 chắc chắn | P6 — cần spec riêng trước |
| f | **Túi đồ (Inventory)** xem item đã quay — **scene riêng**, không gộp Nhật ký | inventory component | Vừa — cần endpoint list profile inventory + gallery | P6 |
| g | **SFX/BGM gacha** | backsound + playSfx | Nhỏ–vừa — Codex gen theo bảng asset P2, thêm thư mục `audio/` | P5 |
| h | **Cinematic tăng kịch tính theo pity cao** — pity≥70 sao bay chậm, nổ to hơn, hint kết quả trước reveal | — (ý riêng) | Nhỏ | P5 |

## 6. Phases implement (mỗi phase = 1 PR nhỏ, screenshot verify 1280×720)

- **P1 — Nền & bố cục**: full-bleed splash + glass panels + footer mới + drawer banner. Banner xoay tua load `gacha:banner_nguyet_tuong_<heroId>` theo `featuredEntry`. *Phụ thuộc asset P0 banner ×4; tạm dùng art hiện có phóng to nếu chưa gen.*
- **P2 — Cinematic**: meteor + skip + màu rarity + halo legendary. *Asset meteor/halo.*
- **P3 — Result rework**: lưới 5×2, frame rarity (tạm graphics nếu chưa gen), summary footer, moonDust toast. *Asset frame.*
- **P4 — Nav & history**: modal Nhật ký tab theo banner (5a), countdown tick mỗi phút, teaser tuần sau (5b).
- **P5 — Tiện ích**: screenshot kết quả (5c), convert modal (5d), SFX (5g), cinematic nhạy pity (5h).
- **P6 — Nguyệt Ước (5e) & Túi đồ (5f)**: phase riêng — viết spec rules/API/DB trước (epitomized-path spec doc + inventory endpoint), implement sau khi spec được duyệt.

## 7. Test & verify

- E2E `gacha-visual.spec.ts` cập nhật selector theo DOM/texture mới; giữ `gacha-history` spec.
- Unit: không đổi rules → meta-gacha 11/11 giữ nguyên; thêm test nhỏ cho helper chọn `maxRarity` nếu đặt trong `packages/rules` (khuyến nghị để client-side pure func trong scene, không cần test rules).
- Screenshot verify 4 banner × (idle / cinematic / x1 / x10 / details / history) ở 1280×720; EXPAND scale ở 1600×900 spot-check.

## 8. Quyết định đã chốt (2026-10-06)

- **Banner xoay tua**: 3 splash riêng `gacha/banner_nguyet_tuong_{m01,m08,f08}.webp` — không composite runtime.
- **§5**: toàn bộ a–h được duyệt.
- **Túi đồ (5f)**: scene riêng, không gộp Nhật ký.
- **Audio (5g)**: Codex gen SFX theo bảng P2; thêm thư mục `audio/` vào pipeline.

### Còn mở — chốt khi tới P6

- **Nguyệt Ước**: cách chọn mục tiêu trong 7 legendary vũ khí (mặc định theo Genshin: chọn 1, trượt 2 lần → lần 3 chắc chắn) — chốt trong spec P6.
- **Túi đồ**: cần endpoint `GET /api/profile/inventory` (hoặc tái dùng profile hiện có) — chốt trong spec P6.
