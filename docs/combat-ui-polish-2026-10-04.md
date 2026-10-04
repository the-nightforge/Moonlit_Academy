# Chỉnh UI chiến đấu — 04/10/2026

Thực hiện trong checkout hiện tại `main`, nền `e93a3a3`, chưa commit. Giữ các thay đổi ảnh có sẵn của người dùng; 110 file trong `public/assets` khớp SHA-256 trước/sau. Không đổi luật, RNG, mạng hoặc phần thưởng.

## Kết quả theo yêu cầu

| Yêu cầu | Thay đổi |
|---|---|
| Tooltip/modal mềm hơn | Panel nền navy bo góc, viền nhẹ dùng chung cho tooltip, tooltip cuộn, modal xác nhận, inspector và các hàng Chọn Pha. Vùng input/mask vẫn dùng hình chữ nhật để giữ thao tác đúng. |
| Cài đặt hết tràn | Bảng riêng với ba hàng: tốc độ1×/2×, giảm chuyển động, âm thanh với−/+/tắt tiếng. Nút đóng ở dưới; chỉnh tùy chọn ngay trong bảng, giữ cùng layer/modal. Lưu trên máy và áp dụng qua cơ chế cũ. Esc/Enter đóng, hotkey combat bị chặn khi bảng mở. |
| Hero/quái địch ở giữa | Tâm nhóm địch ở640, thay tâm610 cũ. Bố cục hero ít hơn ba cũng được căn giữa. Anchor chung vẫn phục vụ renderer, target và animation. |
| Tách chồng bỏ/chồng rút | Tăng khoảng cách anchor và tách vùng bấm/tooltip riêng. Bấm đúng inspector cho từng chồng ở mọi ghế; giữ kín thứ tự chồng rút. |
| Bỏ text pha hiện tại | Hiểu "Bot text" là "Bỏ text". Bỏ nhãn tên pha/decree dưới trăng; thông tin đầy đủ vẫn nằm trong hover. Badge Huyết Nguyệt giữ nguyên. |
| Tên hero trong mô tả | Tên chủ lá ở đầu vùng giấy; bên dưới tối đa ba dòng chữ11px. Dấu… chỉ xuất hiện khi cần cắt, nằm trên dòng thứ ba. Song Hành giữ đủ hai tên với∞; Binh Khí dùng⚔. Hover giữ category/tên đầy đủ. |
| Dải8 pha dọc bên phải | Icon có texture ởy200..536, giữa Nguyệt Lực và nút lượt. Pha hiện tại có aura xanh/tím và sparkle thay vòng vàng. Giảm chuyển động dùng hiệu ứng tĩnh; tween thuộc HUD và được dọn khi HUD hủy. Tài nguyên PvP đối thủ chuyển sang vùng trái để không đè dải pha. |

## Bằng chứng

- Toàn bộ client:23 file, **218/218 test đạt**, `client-final.log`. Sau sửa cuối chỉ ảnh hưởng phần heading/body bài, chạy lại model bài **13/13 đạt**, `card-final.log`.
- Typecheck và build client trên source cuối: **exit0**, `typecheck-final.log` / `build-final.log`.
- Browser ban đầu ổn định:5/5 đạt, gồm cài đặt, pha/bài và actual pile clicks cho PvE/PvP/co-op. Sau chỉnh vùng giấy,4/4 ca ở1280×720 và1024×576 đạt. Sau sửa hai finding về heading/chiều rộng,2/2 ca bài cuối đạt; output gốc trong `final-card-browser.log`.
- Đã xem trực tiếp ảnh settings1024, board1024, compact categories1024 và inspector PvE. Reviewer xem thêm ảnh1280 và source/lifecycle.
- Review độc lập đầu phát hiện hai P2: heading Song Hành bị thu quá nhỏ; reusable body rộng94px trên vùng giấy86px. Đã sửa và scoped review **SPEC PASS / QUALITY PASS**, không còn finding trong scope.
- Red hợp lệ: tâm nhóm610 và pile overlap; rail ngang; body vượt vùng giấy; heading quá nhỏ. Các lần bấm sai bánh răng, thiếu gắn NetMatch trong fixture và HMR chen vào test được ghi là lỗi harness, không dùng làm bằng chứng lỗi sản phẩm.

Log/report/review nằm trong [thư mục bằng chứng](D:/Source/VongNguyet/.sdd-work/combat-ui-polish). Source chính: [layout](D:/Source/VongNguyet/apps/client/src/ui/combat-layout.ts), [settings](D:/Source/VongNguyet/apps/client/src/ui/combat-settings-dialog.ts), [moon HUD](D:/Source/VongNguyet/apps/client/src/ui/moon-hud.ts), [card view](D:/Source/VongNguyet/apps/client/src/ui/combat-card-view.ts).

All-mode pile/centering browser dùng1280×800; settings/cards được kiểm trực tiếp ở1280×720 và1024×576. Không chạy lại các gate online/server/data/rules không bị thay đổi. Ảnh board/compact có một số text fixture để chứng minh ba dòng và dấu…; dữ liệu lá trong sản phẩm không bị sửa.

## Ảnh minh chứng

![Cài đặt ở1024×576](D:/Source/VongNguyet/.sdd-work/combat-ui-polish/screenshots/settings-1024.png)

![Bố cục combat và mô tả ba dòng](D:/Source/VongNguyet/.sdd-work/combat-ui-polish/screenshots/board-1024.png)

![Normal/Song Hành/Binh Khí và nội dung dài](D:/Source/VongNguyet/.sdd-work/combat-ui-polish/screenshots/compact-categories-1024.png)

## Quyết định

1. Dùng yêu cầu UI trực tiếp làm design cho sửa hiện có; hiểu "Bot text" là bỏ text. Nếu khác ý định, cần chỉnh nhãn/lựa chọn visual tương ứng.
2. Sửa trong checkout hiện tại theo ủy quyền nhánh hiện tại trước đó, không thao tác Git. Nếu cần checkout riêng, phải chuyển diff.
