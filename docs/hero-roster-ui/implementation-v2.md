# Kho Hero — triển khai cải thiện sau review

Worktree `hero-roster-ui`, nhánh `codex/hero-roster-ui`. Thiết kế theo `detailed-review.md` đã được người dùng duyệt. Bố cục ba vùng giữ nguyên; không thêm dependency hoặc sinh assets mới.

## Thay đổi

- Toolbar nằm trên lưới: tìm không dấu, phe gồm Trung lập, sở hữu dạng segmented buttons có aria-pressed, sort, reset khi đang lọc. Native fields giữ thao tác keyboard và cập nhật vị trí theo camera.
- Thẻ có tên đầy đủ tối đa hai dòng với bộ dữ liệu hiện tại; art bị khóa sáng hơn, badge độ hiếm tiếng Việt có nền, lock riêng và badge số lượt mở lá. Crop thumbnail ưu tiên phần trên ảnh. Lựa chọn và khung Tinh Hồn 6 dùng dấu hiệu khác nhau; có hover và focus bằng phím mũi tên/Enter.
- Header dùng lại icon quay về/tiền tệ; bộ đếm sở hữu gắn với bộ sưu tập. Phân trang gọn, trang hiện tại sáng; wheel chỉ cuộn nội dung hồ sơ.
- Hồ sơ có panel chàm, chữ lớn/sáng hơn, metadata vai trò và nhánh lá lấy từ dữ liệu. Điều kiện thăng cấp giải thích counter, dùng đúng ngưỡng theo Tinh Hồn. Tổng quan chia nhóm điều kiện, hiệu ứng và mốc kế tiếp.
- Xem art được ghi rõ, tách khỏi dạng trong hồ sơ. Art `_up` vẫn là minh họa thăng cấp cơ bản; chưa có art riêng cho dạng thứ hai.
- Lựa chọn base/alt xuất hiện ngay đầu tab Tinh Hồn. Giữ API và điều kiện sở hữu/Tinh Hồn 5/kết nối; chặn gửi trùng, invalidation khi rời scene. Lỗi hiện ngay trong panel để thử lại, thành công cập nhật dạng từ hồ sơ server.
- Lá chủ lực có hai thumbnail qua renderer card hiện có. Hover có độ trễ; click/chạm mở popup có nút đóng trong khung, Esc/click ngoài đóng. Popup ghim chặn hành động nền và ẩn DOM toolbar.
- Nội dung dài dùng Mask filter WebGL của Phaser 4, GeometryMask Canvas, hit test clip trước topOnly. Scrollbar kéo được và nút cuộn cập nhật trạng thái đầu/cuối.
- CTA giữ vị trí cố định, hiện số lượt mở lá; hero chưa sở hữu có lý do khóa và Triệu Hồi nổi bật hơn. Widget áp dụng các options height/fontSize, giữ default cũ khi không truyền options.
- Khi hero đang xem bị lọc khỏi danh sách, có lời giải thích. Thiếu ảnh vẫn hiện tên và thông báo tải ảnh, khác với khóa sở hữu. Dọn DOM, keyboard, wheel, resize/update, tooltip timer và mask khi shutdown.

## Phạm vi trình bày

Layout dành cho vùng thiết kế 1280×720. Việc dựng layout mobile riêng, thêm nội dung mô tả lối chơi được biên tập và art dạng thứ hai vẫn là những mục phụ thuộc nhu cầu/nội dung mới trong review. Hiện dùng vai trò và nhánh lá có sẵn; không tự tạo nội dung luật hoặc suy ra tiến trình ngoài dữ liệu.

## Kiểm tra

- `pnpm typecheck`: qua toàn bộ workspace.
- `pnpm --filter client build`: qua; còn cảnh báo bundle lớn.
- Client unit tests: 289 test qua, gồm 6 test presentation của Kho Hero.
- Lượt toàn bộ 10 E2E qua. Sau khi chỉnh trạng thái trang/nút cuộn, 6 test liên quan qua (thêm keyboard, kích thước hit target và popup close/outside). Sau sửa review, 5 test liên quan qua (thêm redraw không tích lũy note và lỗi API cũ không hiện ở hero khác). Tổng cộng 14 kịch bản khác nhau đã qua qua các lượt chạy; không gọi đây là một lượt toàn bộ 14 test.
- Toàn bộ `pnpm test`: data 50 qua; rules 727 qua/4 bỏ qua; client 289 qua; server 19 timeout khi chạy song song.
- Server chạy riêng `vitest run --maxWorkers 1`: 59 qua, chỉ còn T205 tại `test/gear.test.ts:31`, nhận 400 thay vì 201. Đây là lỗi fixture đã ghi nhận trước thay đổi: deck 17 lá trong khi config yêu cầu 18. Không sửa file server/rules/data.

Các test server timeout trong lượt song song: auth T173, T174, dữ liệu phiên bản không khớp; economy starter gift; gacha T190; gear T205; production T245 register rate limit; profile đọc/lưu/xóa/unlock, T176, T181; realtime T231/T233/T232; runs T178/T179/T325, invalid deck/actions, T195 và ticket cũ không có loadout. Các trường hợp ngoài T205 đã qua khi chạy server một worker.

Ảnh `implemented-v2.png`, `forms-v2.png`, `cards-v2.png`, `popup-v2.png` là client thật với tài khoản kiểm thử. Mockup và ảnh v1 được giữ làm tư liệu vòng trước.

Review cuối xác nhận đã sửa ba điểm P2: note art được dọn khi render, điều kiện Chu Quyết nói rõ Mưu Lược và điểm đầu lượt, lỗi lưu dạng chỉ hiện cho hero tương ứng. Cả ba có test hồi quy đã quan sát thất bại trước sửa và qua sau sửa.
