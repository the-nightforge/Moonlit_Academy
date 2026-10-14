# Review overlay thoại Cốt Truyện

Ngày: 2026-10-14. Nhánh: `codex/dialogue-ui`. Quy tắc áp dụng: [ui-rules.md](../ui-rules.md).

## Tham khảo và hướng thiết kế

Đã xem trực tiếp ảnh giao diện trong [bài giới thiệu Epic Seven của GameWith](https://gamewith.jp/gamedb/4934/articles/44122) và [bài Kafka trong Honkai: Star Rail của Esports.gg](https://esports.gg/news/honkai-star-rail/everything-to-know-about-kafka-in-honkai-star-rail/). Đây là ảnh tham khảo bố cục, không phải xác nhận giao diện mới nhất năm 2026.

Epic Seven gợi ý tách tên người nói, lời thoại và nhóm điều khiển nhỏ. Honkai: Star Rail gợi ý dùng tên người nói nổi bật và tập trung vào nội dung đang đọc. Bản triển khai dùng thứ bậc này với màu xanh đêm và vàng của Vọng Nguyệt. Khung cảnh và lời thoại nằm trong vùng riêng để toàn bộ hình luôn nhìn thấy theo yêu cầu của dự án. Không sao chép artwork của game tham khảo.

## Review từng phần UI và thay đổi đã triển khai

| Phần | Kết quả |
| --- | --- |
| Tiêu đề | Tên màn viết đầy đủ, nhãn Cốt Truyện nhỏ phía trên. Tên dài được xuống dòng; font tiêu đề hỗ trợ dấu tiếng Việt. |
| Điều khiển trên | Lịch sử dùng icon có sẵn; bỏ qua dùng ký hiệu » với tên truy cập đầy đủ. Nút 44 pixel, có viền và góc bo, không thêm tooltip lặp lại. |
| Ngữ cảnh | Hiển thị Trước trận hoặc Sau trận, số lời thoại và thanh tiến độ mảnh. Thanh tiến độ có thuộc tính truy cập tương ứng. |
| Khung cảnh | Mỗi màn dùng đúng hình cốt truyện đang có. Ảnh giữ tỷ lệ gốc, hiện đầy đủ, viền sát hình; không có chữ hoặc nút đè lên hình. |
| Chân dung | Hero và địch dùng ảnh có sẵn, kích thước tự co theo viewport. Viền ôm hình, không crop, không có khoảng đệm trong viền. |
| Người dẫn chuyện | Dùng icon Cốt Truyện và tên Người dẫn chuyện; không lộ mã speaker nội bộ. Caller cũ thiếu stage context vẫn hiển thị lời thoại bình thường. |
| Tên và lời thoại | Tên màu vàng, nội dung màu sáng trong vùng riêng cạnh chân dung. Giữ xuống dòng, escape nội dung HTML, mở rộng thuật ngữ qua displayText; không clamp hoặc cắt lời thoại dài. |
| Nút tiếp tục | Nút chính có viền, bo tròn và mũi tên. Lời cuối trước trận ghi Chọn bộ bài; lời cuối sau trận ghi Về Cốt Truyện để chỉ đúng đích đến. |
| Bàn phím | Phím cách hoặc Enter tiến một lời; giữ phím không chạy qua nhiều lời. Khi focus vào nút, dùng kích hoạt native để tránh gọi hai lần. Không tiến hội thoại phía sau popup. |
| Gợi ý thao tác | Gợi ý bàn phím nhỏ ở footer, ẩn với thiết bị cảm ứng có con trỏ coarse. Giữ chữ cho hành động cần nói rõ đích đến. |
| Lịch sử hội thoại | Native dialog chỉ chứa lời đã hiện, không tiết lộ lời chưa đọc. Có tên, nội dung đầy đủ, đánh dấu lời hiện tại và vùng cuộn riêng. Đóng popup trả focus về nút lịch sử. |
| Chuyển ngữ cảnh | Đổi màn hoặc chuyển trước/sau trận xóa transcript cũ và đóng popup. Render lại không nhân đôi dòng; quay về chỉ số trước loại bỏ phần tương lai. |
| Khởi tạo và đóng | Nút bị vô hiệu hóa trước khi có lời thoại. Destroy gỡ keyboard listener, đóng dialog và trả lại trạng thái cuộn của body. |
| Responsive | Desktop giới hạn chiều rộng nội dung; điện thoại giảm chân dung, khoảng cách và cỡ chữ. Nội dung dài cuộn dọc tự nhiên; footer không phủ lên ảnh hoặc lời thoại. |

Tái sử dụng 16 hình màn, ảnh hero/địch và các icon `nav_history`, `mode_story`, `action_close`. Không cần tạo thêm ảnh raster. CSS giới hạn trong overlay; không sửa renderer Cốt Truyện dùng chung.

## Kiểm chứng

- Client: 367 bài kiểm tra trong 46 file đều đạt, gồm 9 bài trên DialogueView thật với happy-dom. Đã xác nhận các bài mới thất bại trước khi triển khai và đạt sau khi sửa; trường hợp giữ Enter cũng có kiểm chứng lỗi trước bản sửa.
- Typecheck toàn workspace đạt; production build client đạt. Build vẫn báo kích thước chunk JavaScript lớn hơn 500 kilobyte.
- 22 kiểm tra trình duyệt native đều đạt tại 1280 × 720, 900 × 720, 450 × 800 và 375 × 667. Kiểm tra ảnh, border, nút, focus, popup, bàn phím, đích nút cuối và nội dung dài.
- Audit toàn bộ 161 lời thoại, 18 người nói, 16 màn ở 375 × 667 và 1280 × 720: không có lỗi ảnh/viền, chồng nội dung hoặc tràn ngang. Ở 375 × 667, cạnh dưới nút đầu tiên là 653,2 pixel, nằm trong viewport.
- 11 kiểm tra hồi quy màn Cốt Truyện đạt, gồm compatibility với caller hội thoại cũ.
- Chạy DialogueScene thật trong Phaser HEADLESS với scene đích dùng probe: hoàn tất trước trận, hoàn tất sau trận, bỏ qua sau trận và màn không có lời thoại đều chuyển đúng một lần, đóng overlay, không thay đổi profile. Kết quả sau trận tiêu thụ lastStory và chuyển thông báo từ receipt được fixture cung cấp.
- Reviewer độc lập kiểm tra source, test và ảnh desktop/mobile/history; không phát hiện vấn đề cần sửa. Các lệnh test và kiểm tra trình duyệt do agent triển khai chạy, reviewer không chạy lại.

Phạm vi kiểm tra route dùng receipt có cấu trúc kết quả đã xác thực được seed trong fixture; không chơi hết trận hoặc gọi backend settlement. Logic finish, bỏ qua và thưởng trong Scene giữ nguyên.

Bằng chứng: [desktop checks](dialogue-ui/dialogue-1280-checks.txt), [mobile checks](dialogue-ui/dialogue-375-checks.txt), [450 pixel](dialogue-ui/dialogue-450-checks.txt), [900 pixel](dialogue-ui/dialogue-900-checks.txt), [audit mobile](dialogue-ui/dialogue-frame-375.json), [audit desktop](dialogue-ui/dialogue-frame-1280.json), [hồi quy Cốt Truyện](dialogue-ui/dialogue-story-regression.txt), [route Scene](dialogue-ui/dialogue-scene-audit.json).

## Ảnh kiểm chứng

Desktop:

![Nhân vật và lời thoại trên desktop](dialogue-ui/dialogue-actor-desktop.jpg)

Điện thoại:

![Nhân vật và lời thoại trên điện thoại](dialogue-ui/dialogue-actor-mobile.jpg)

Lịch sử:

![Popup lịch sử trên điện thoại](dialogue-ui/dialogue-history-mobile.jpg)

Người dẫn chuyện:

![Người dẫn chuyện trên điện thoại](dialogue-ui/dialogue-narrator-mobile.jpg)
