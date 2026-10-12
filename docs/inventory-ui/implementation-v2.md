# Kho đồ: cải thiện sau review 50 thành phần

Triển khai phương án A trên `codex/inventory-ui`. Giữ lưới 4×3, tận dụng toàn bộ 25 artwork Binh Khí, 16 artwork Nguyệt Bảo và icon có sẵn. Không cần tạo bitmap mới.

## Những thay đổi đã chọn

- Khung collection có nền navy; tab, trang và cấp đang xem có underline vàng/chữ sáng. Nút phụ dùng viền xanh xám; selected và keyboard focus có dấu riêng.
- Danh mục ghi rõ số loại đã có. Bộ lọc đếm theo query và rarity trước ownership; nhãn sort có chiều. Xóa lọc giữ sort; offline có lời giải thích riêng.
- Art tile cao hơn, contain toàn hình; rarity có dải màu và tên; TL/CM và khả năng nâng có vị trí cố định. Món chưa có dùng art dịu hơn.
- Detail giữ tên, rarity, cấp sở hữu; ba tab Hiệu ứng / Các cấp / Bộ bài. Artwork có nút mở toàn hình; Hero bản mệnh có portrait và tên. Glossary nằm trong vùng cuộn.
- Nội tại đọc từ hooks đã áp dụng ở cấp đang xem; cơ chế không hỗ trợ đầy đủ quay về mô tả gốc và lịch sử. Timeline cho phép mở từng mốc, phân biệt tích lũy Binh Khí với cấp thay thế của Nguyệt Bảo.
- Footer cố định đặt cấp nâng, delta, vật liệu, số đang có/còn lại và hành động cạnh nhau. Xem trước TL5 vẫn nâng đúng cấp đang sở hữu; max, chưa có, thiếu, offline và pending có nhãn riêng. Kết quả thông báo tên món/cấp.
- Popup lá bài preload emblem và ghi cấp xem trước; không gán người mang giả từ Hero bản mệnh. Bộ bài mở bản sao ở đúng slot và có đường quay lại Kho đồ.
- Thao tác canvas có nút HTML tương ứng cho Tab/Enter và tên truy cập. Vùng cuộn ẩn các target ngoài mask, popup ẩn thao tác nền. Cửa sổ hẹp fit toàn layout; vẫn dùng master/detail A.

## Phạm vi thẩm mỹ

B/C (3 cột hoặc drawer) là phương án thay thế có điều kiện, chưa chọn. Chưa thêm animation hay thumbnail tạo riêng: artwork hiện có đủ cho bản A. Ảnh hẹp là 900×650; đây chưa phải chứng minh usability trên điện thoại hoặc kết quả nghiên cứu người chơi.

## Kiểm chứng

Lượt cuối 12/10/2026: **305/305 test client**, **19/19 browser Kho đồ + 4/4 browser bộ bài**, **typecheck workspace** và **build workspace** đều đạt. Backend browser là pg-mem disposable, không dùng tài khoản thật. Reviewer độc lập không có Critical; 4 Important được tái hiện RED rồi sửa và chạy GREEN/suite cuối. Build còn cảnh báo chunk lớn sẵn có; chưa đổi kiến trúc tải bundle.

Lệnh: pnpm --filter client test; pnpm typecheck; pnpm build; Playwright armory-ui.spec.ts + armory-polish.spec.ts --workers=1; deck.spec.ts lọc native name typing / equipment preview / pending save / offline save --workers=1. Browser URL kiểm thử 127.0.0.1:5197, backend 8797.

Không tuyên bố đây là usability study hoặc nghiệm thu điện thoại. Minor để sau: cách chạm mở tên/delta bị rút gọn; bản hiện tại dùng hover.

Ảnh UI thật được lưu cạnh tài liệu: polish-weapons.png, polish-relics.png, polish-card.png, polish-art.png và polish-narrow.png.
