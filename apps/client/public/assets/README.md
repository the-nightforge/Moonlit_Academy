# Assets

Vite serve thư mục này tĩnh — Phaser load qua đường dẫn `/assets/...`
(ví dụ `this.load.image("m05", "/assets/heroes/m05.png")`).

Mọi file `.png/.jpg/.webp` đã được Git LFS theo dõi tự động.

## Quy ước đặt tên — luôn khớp ID trong `data/*.json`

Đuôi `.png` / `.jpg` / `.webp` đều được — client tự quét thư mục này lúc
build/dev, không cần khai báo gì thêm.

| Thư mục | File | Nội dung | Tỉ lệ / size gợi ý |
|---|---|---|---|
| `heroes/` | `<heroId>.png` | Splash art nửa người (doc 08) | 2:3, ~768×1152 |
| `heroes/` | `<heroId>_up.png` | Dạng thăng cấp của Hero đó | 2:3, ~768×1152 |
| `cards/` | `<cardId>.png` | Art riêng của lá (nếu có — fallback dùng art Hero) | 2:3, ~550×825 |
| `enemies/` | `<enemyId>.png` | Kẻ địch / boss | ~1024×1024 hoặc 2:3 |
| `backgrounds/` | theo pha/bối cảnh | Nền trận | 1280×720 |
| `ui/` | icon, khung, nút | PNG nhỏ, sẽ thay emoji dần | — |

## Ví dụ

```
heroes/m05.png            # Hoắc Liệt (thường)
heroes/m05_up.png         # Hoắc Liệt — Liệt Hỏa (thăng cấp)
heroes/f04.png            # Ôn Như Ý
heroes/m06.png            # Tô Dạ
cards/m05_ho_gam.png      # art lá Hổ Gầm (tùy chọn)
enemies/puppet_guard.png
enemies/shadow_fox.png
```

## Hero trong prototype

Hiện dùng: `m05`, `f04`, `m06` — ưu tiên 3 file này trước.
Giai đoạn 2 thêm: `f03`, `f02`.

## Lưu ý

- Art **bắt buộc** có nền hoặc trong suốt phù hợp hiển thị trên panel tối
  (nền UI hiện là `#141b33`).
- Chưa có code nào load ảnh — client hiện vẽ bằng shape/text. Khi ảnh đủ,
  sẽ thêm bước preload + thay panel bằng sprite.
