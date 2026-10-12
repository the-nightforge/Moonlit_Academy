# Áp dụng quy chuẩn UI ngày 12/10/2026

Quy chuẩn chung nằm trong [docs/ui-rules.md](../ui-rules.md); AGENTS.md yêu cầu mọi lần sửa UI phải đọc và tuân theo. Thay đổi thực hiện trong worktree inventory-ui, nhánh codex/inventory-ui.

## Thay đổi

- Kho đồ dùng toàn bộ ảnh với đúng tỉ lệ, có khoảng đệm trong viền. Nhãn độ hiếm, tên, cấp, dấu chọn và vùng ảnh tách riêng. Popup xem ảnh không cắt cạnh hay đặt chữ lên ảnh.
- Bộ hiển thị ảnh dùng chung chuyển từ crop sang contain. Ảnh lá bài có vùng riêng bên trên tên và mô tả; ảnh thay thế khi thiếu asset cũng nằm trong vùng này. Thumbnail ở bộ bài, danh sách Hero và các consumer dùng chung hưởng quy chuẩn chứa toàn bộ ảnh.
- Kho đồ thay các thao tác phổ biến và bộ lọc sở hữu bằng icon sẵn có. Mỗi nút có viền, kể cả nút trong suốt hoặc bị khóa, và giữ tên truy cập đầy đủ. Thông tin món nằm ngoài bộ lọc hoặc ở trang khác vẫn có nhãn ngắn bên cạnh icon.
- Bỏ tooltip tile lặp lại thông tin. Giữ phần giải thích cơ chế và giá trị đầy đủ bị rút gọn. Mô tả lá bài quá dài được đưa vào vùng cuộn; chỉ bổ sung khi mặt bài không hiển thị hết.
- Cấp trang bị dùng “Tinh Luyện”, “Cộng Minh”; văn bản hiển thị dùng “máu”, “hình trang bị”, “hình nhân vật”. Dữ liệu và luật game giữ nguyên.
- Danh sách Hero tách header, ảnh, caption; nút tile/tab/badge/thanh cuộn có viền. Ảnh thiếu có placeholder vừa khung. Nền ở Kho đồ, Hero và bộ bài giữ đúng tỉ lệ.
- Tooltip dùng mask Graphics với filter WebGL hoặc geometry mask Canvas. Vùng cuộn của lá bài bắt đầu dưới ảnh cố định; cuộn không vẽ chữ lên ảnh. Popup lấy kích thước từ panel nền, không từ toàn bộ nội dung bị cuộn.

Tận dụng 25 ảnh Binh Khí, 16 ảnh Nguyệt Bảo, ảnh Hero và icon hiện có. Không cần tạo asset mới.

## Kiểm chứng

Các log giữ trong .superpowers/sdd/2026-10-12-ui-rules. Test đã tái hiện crop, chữ che ảnh, mất đoạn cuối mô tả, placeholder vượt khung và chữ cuộn che ảnh trên Canvas/WebGL trước khi sửa. Kiểm tra ảnh dọc/ngang/vuông và ảnh của toàn bộ 41 món; trạng thái sở hữu/chưa có/tối đa, xem trước cấp, offline/pending, popup, thao tác phím và cửa sổ hẹp được kiểm tra qua các suite liên quan.

Kết quả cuối: **308/308 test client**, **17 trường hợp browser liên quan**, **typecheck workspace** và **build workspace** đạt. Browser chạy với backend pg-mem dùng tài khoản kiểm thử. Lượt trận đấu 1280 đạt với timeout mặc định 180 giây; lượt chạy nhanh 90 giây trước đó hết thời gian. Hai renderer đều kiểm tra thực tế cuộn và so sánh pixel ảnh trước/sau. Log cuối: client-final.log, typecheck-final.log, build-final.log, final-browser.log, final-renderer.log và combat-final.log. Các log thất bại trước sửa được giữ để truy vết.

## Rà soát độc lập

Đã sửa các finding về nhãn che ảnh, mất thông tin ngoài bộ lọc/trang, glossary còn viết tắt, icon chồng chữ, placeholder nhỏ và mask Canvas. Reviewer xác nhận không còn Important trong phần được rà soát sau các sửa này. Kiểm thử browser và build là trách nhiệm của lượt triển khai.

Không thay luật nâng cấp, cân bằng game hoặc logic server. Những màn hình không dùng component được sửa chưa được kiểm toán toàn bộ trong lượt này; quy chuẩn vẫn áp dụng cho mọi thay đổi UI sau này.

## Ảnh kiểm chứng

- rules-weapons.png
- rules-relics.png
- rules-art.png
- rules-card.png
- rules-heroes.png
- rules-narrow.png
