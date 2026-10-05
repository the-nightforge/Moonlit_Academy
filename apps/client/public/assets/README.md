# Assets

Vite serve thư mục này tĩnh — Phaser load qua đường dẫn `/assets/...`
(ví dụ `this.load.image("m05", "/assets/heroes/m05.webp")`).

Mọi file `.png/.jpg/.webp` đã được Git LFS theo dõi tự động. `.svg` đi git thường
(file text nhỏ). Ảnh runtime dùng **WebP**: art painterly (`heroes`, `enemies`,
`backgrounds`, `summons`, `gacha`) ở lossy ~q85, icon `ui/` ở lossless — giữ
alpha. Master PNG gốc lưu ngoài `public/` (`.sdd-work/asset-masters/`).

## Quy ước đặt tên — luôn khớp ID trong `data/*.json`

Đuôi `.webp` / `.png` / `.jpg` / `.svg` đều được — client tự quét thư mục này lúc
build/dev (key texture `<thư mục>:<tên file>`, ví dụ `ui:moon_full`), không cần
khai báo gì thêm.

| Thư mục | File | Nội dung | Tỉ lệ / size gợi ý |
|---|---|---|---|
| `heroes/` | `<heroId>.webp` | Splash art nửa người (doc 08) | 2:3, ~768×1152 |
| `heroes/` | `<heroId>_up.webp` | Dạng thăng cấp của Hero đó | 2:3, ~768×1152 |
| `cards/` | `<cardId>.webp` | Art riêng của lá (nếu có — fallback dùng art Hero) | 2:3, ~550×825 |
| `enemies/` | `<enemyId>.webp` | Kẻ địch / boss | ~1024×1024 hoặc 2:3 |
| `backgrounds/` | theo pha/bối cảnh | Nền trận | 1280×720 |
| `ui/` | `moon_<phaseId>`, `moon_blood`, `status_<statusId>`, `intent_<kind>`, `node_<nodeType>`, `cur_<currency>` (key trong `ProfileCurrencies`) + icon chung (`gear`, `lock`…) | Icon giao diện | SVG viewBox 24×24, `width/height` 48 (Phaser rasterize 48px) |

## Ví dụ

```
heroes/m05.webp           # Hoắc Liệt (thường)
heroes/m05_up.webp        # Hoắc Liệt — Liệt Hỏa (thăng cấp)
heroes/f04.webp           # Ôn Như Ý
heroes/m06.webp           # Tô Dạ
cards/m05_ho_gam.webp     # art lá Hổ Gầm (tùy chọn)
enemies/puppet_guard.webp
enemies/shadow_fox.webp
```

## Hero trong prototype

Hiện dùng: `m05`, `f04`, `m06` — ưu tiên 3 file này trước.
Giai đoạn 2 thêm: `f03`, `f02`.

## Lưu ý

- Art **bắt buộc** có nền hoặc trong suốt phù hợp hiển thị trên panel tối
  (nền UI hiện là `#141b33`).
- Icon `ui/` vẽ trên nền trong suốt — không tô màu nền giả (vd. hình tròn
  `#0b1026` để "khoét"), vì icon còn đặt trên panel/thẻ màu khác.
- Combat scene preload toàn bộ manifest; thiếu file thì fallback về shape/text.
