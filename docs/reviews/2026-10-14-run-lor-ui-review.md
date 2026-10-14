# Tầm Nguyệt — giao diện theo PvE Legends of Runeterra

Triển khai trên worktree `codex/run-ui`, tiếp nối `20c96ff`. Yêu cầu mới: “Thiết kế UI giống pve của lor đi”.

## Tham khảo và hướng áp dụng

[Hướng dẫn chính thức The Path of Champions của Riot](https://support.riotgames.com/en-us/legends-of-runeterra/gameplay/guide-to-the-path-of-champions), bài có ngày 16-12-2022, cung cấp [ảnh bản đồ hành trình](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/b57121be03612133e9a02b1c47df2bbd431b682a-1543x602.png). Đã xem trực tiếp ảnh: đường đi ngang phân nhánh, huy hiệu điểm gặp gỡ, đường nối đứt, điểm hiện tại phát sáng và thủ lĩnh có viền vàng. Đây là tham khảo bố cục, không khẳng định ảnh này đại diện bản game mới nhất.

Tầm Nguyệt áp dụng bản đồ ngang và ngôn ngữ huy hiệu xanh lam–vàng. Địa hình là đường đồng mức vẽ bằng giao diện; ảnh cảnh nằm riêng trong bảng chi tiết. Quyết định này đáp ứng `docs/ui-rules.md`: không đặt nút hoặc chữ che lên ảnh. Không nhập tài sản của Riot, không thêm cửa hàng, tiền tệ hay tiến trình chưa có trong luật game.

## Review từng phần và kết quả

| Phần UI | Thay đổi và hành vi |
|---|---|
| Bố cục desktop | Bản đồ lớn bên trái, chi tiết điểm đến bên phải, đội hình dưới bản đồ. Cả thanh máu nằm trong viewport 1280 × 720. |
| Bản đồ | Hành trình từ trái sang phải, các tầng uốn nhẹ theo địa hình; giữ đầy đủ node và cạnh từ dữ liệu thật. |
| Đường nối | Nét đứt cho đường chưa đi, nét liền xanh cho đoạn đã ghi nhận, đường từ vị trí hiện tại sáng xanh lam. |
| Huy hiệu | Khung nút tròn có viền; icon hình chữ nhật bên trong giữ toàn bộ ảnh và viền sát ảnh. Không cắt ảnh thành hình tròn. |
| Trạng thái | Đã đi qua có dấu kiểm, hiện tại có dấu hình thoi, có thể đi có điểm sáng. Chọn xem dùng viền vàng; chọn xem không tự áp dụng hành động. |
| Thủ lĩnh | Huy hiệu lớn 76 pixel, viền vàng và khoảng cách an toàn với các điểm khác. |
| Tầng | Số tầng phía trên đường đi; tên đầy đủ, tầng, nhánh và trạng thái nằm trong accessible name của từng nút. |
| Cuộn bản đồ | Cuộn ngang riêng trong khung, hai nút mũi tên bo tròn có viền; focus bàn phím làm hiện trọn điểm cần xem. Giữ vị trí cuộn khi xem chi tiết. |
| Đội hình | Ba chân dung đầy đủ, tên, số máu và thanh máu; không đặt số/chữ lên chân dung. |
| Chi tiết điểm đến | Cảnh 2:1 trong viền riêng, kẻ địch và số lượng lấy từ encounter thật. Chỉ điểm hợp lệ có nút tiếp tục bật. |
| Chọn Lõi | Ba thẻ xanh lam–vàng đồng bộ; desktop 720 pixel hiện đầy đủ ba lựa chọn. Điện thoại xếp dọc, mô tả đầy đủ. Kỳ Vật đã nhận nằm trong phiếu riêng. |
| Nghỉ Chân | Giữ số hồi máu từ luật, xác nhận bỏ một lá và khóa thao tác khi đạt bộ bài tối thiểu. Áp dụng cùng màu và viền. |
| Kho Báu và kết quả | Giữ phân biệt nhận mới/hết Kỳ Vật; kết quả chưa được xác nhận không hiện thưởng. Nút gửi lại và khóa rời màn khi đang gửi giữ nguyên. |
| Hộp thoại | Ảnh lá bài hiển thị đủ, nội dung riêng, nút đóng/hủy/xác nhận có viền và bo tròn. |
| Typography | Tiêu đề dùng Times New Roman để chữ tiếng Việt có dấu không bị tách do font Georgia thiếu glyph. |
| Điện thoại | Toolbar một hàng, đội hình gọn, chi tiết trước bản đồ. Nút tiếp tục nằm trọn màn hình 375 × 667. |

## Assets

Tái sử dụng `assets/run/journey.webp` đã tạo ở bản Tầm Nguyệt trước, icon `node_*`, `mode_run`, chân dung hero/kẻ địch và hình lá bài hiện có. Không cần sinh thêm ảnh trong lượt chỉnh này. Viền ảnh không bo góc để không che pixel ở bốn góc; nút và khung bên ngoài vẫn bo tròn.

## Kiểm chứng

- `pnpm --filter client test`: **358 tests, 45 files, pass**, gồm 6 bài kiểm tra model bản đồ và kiểm tra vòng đời gửi kết quả hiện có.
- `pnpm typecheck`: cả workspace pass.
- `pnpm --filter client build`: pass; còn cảnh báo kích thước chunk lớn đã có trong client.
- Browser native: **21 kiểm tra pass tại 1280 × 720**, **20 tại 375 × 667 và 450 × 800**, **19 tại 900 × 720**; khác nhau ở kiểm tra kích thước áp dụng riêng từng viewport.
- 11 trạng thái tại 375 pixel: map, path, reward, empty, rest, minimum, treasure, won, lost, sending, error. Không tràn ngang trang; ảnh sau tải có tỷ lệ gốc, contain, padding bằng không, viền sát và không bo che góc; tất cả button có viền và bo tròn. Bằng chứng: [audit](run-ui/run-lor-states.json).
- Đã thấy kiểm tra mới thất bại trước khi sửa: hướng đường đi ngang, focus/cuộn, toolbar điện thoại, thanh đội hình desktop, ảnh bị che góc và thẻ Lõi desktop vượt màn hình.
- Review độc lập đã xác nhận không còn finding sau sửa viền góc ảnh và kiểm tra bố cục thẻ Lõi/font tiếng Việt.

Phạm vi kiểm chứng của lượt này là renderer và client; không chạy trận hoàn chỉnh hoặc gửi kết quả tới backend thật. Không thay đổi RunScene, run-session hay luật game trong diff này.

## Ảnh kiểm chứng

![Bản đồ desktop](run-ui/run-lor-desktop.jpg)

![Chọn Lõi desktop](run-ui/run-lor-reward-desktop.jpg)

![Điện thoại](run-ui/run-lor-mobile.jpg)

![Xác nhận bỏ lá](run-ui/run-lor-remove-mobile.jpg)

Chi tiết kết quả tương tác: [desktop](run-ui/run-lor-browser-checks.txt), [điện thoại](run-ui/run-lor-mobile-checks.txt).
