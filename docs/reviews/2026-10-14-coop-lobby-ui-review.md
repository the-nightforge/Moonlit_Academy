# Liên Thủ: review UI và bản triển khai

Ngày: 2026-10-14. Nhánh: `codex/coop-lobby-ui`, worktree riêng từ main `987424e`.

Mục tiêu: người chơi nhìn thấy đội hình, chọn cách phối hợp và biết trạng thái chờ trước khi vào trận. Dùng assets hiện có, giữ luật và phần thưởng thật của game; tuân thủ toàn bộ `docs/ui-rules.md`.

## Tham khảo và cách áp dụng

- [Hearthstone Battlegrounds Season 7 — Blizzard](https://news.blizzard.com/en-us/article/24064742/announcing-battlegrounds-season-7): thông báo Duos mô tả việc mời bạn hoặc tìm một đồng đội ngẫu nhiên. Áp dụng nguyên tắc phân biệt hai đường vào trận ngay ở sảnh. Đây là nguồn thiết kế lịch sử năm 2024, không phải khẳng định UI hiện tại năm 2026.
- [Across the Obelisk — Paradox](https://www.paradoxinteractive.com/games/across-the-obelisk/about): co-op deckbuilder đặt việc xây bộ bài và phối hợp đội hình vào trung tâm trải nghiệm. Từ đặc điểm đó, bản Liên Thủ ưu tiên xem ba nhân vật và bộ bài trước thao tác vào trận. Đây là suy luận thiết kế cho Vọng Nguyệt, không sao chép bố cục từng pixel.
- Cơ chế của Vọng Nguyệt lấy từ `docs/17-pvp-coop-spec.md`, `packages/data/coop-config.json` và protocol máy chủ: bộ bài PvE đã lưu, hai người, lượt chung 45 giây, tự vào trận khi đủ người. Không thêm nút sẵn sàng, nút bắt đầu hay tính năng lobby chưa có trong protocol.

Không lấy assets của các game tham khảo. Các biểu tượng Liên Thủ, phòng riêng, Đấu Tập, đổi bộ bài, chỉnh sửa, quay lại, đóng, sao chép, làm mới và tiền tệ đã có đủ; không cần sinh ảnh mới.

## Review từng phần nhỏ

| Phần UI | Vấn đề cần giải quyết | Bản triển khai và lý do |
|---|---|---|
| Khung màn hình | Bố cục Phaser theo tọa độ cố định khó chứa tên dài, danh sách bộ bài và form trên điện thoại | Lớp DOM toàn màn hình; desktop chia đội hình và cách chơi, dưới 720 pixel xếp dọc. Phần nội dung tự cuộn, không thu nhỏ chữ để ép tất cả vào một màn. |
| Header | Người chơi cần nhận ra chế độ và đường quay lại nhanh | Tiêu đề Liên Thủ, dòng “Phối hợp hai người”; nút quay lại dùng icon và tên truy cập đầy đủ. Tiền tệ dùng icon đã có. Nút luật mở thông tin cơ chế thay cho một đoạn hướng dẫn dài thường trực. |
| Lượt thưởng | Số chưa tải dễ bị hiểu nhầm là còn đủ lượt hoặc đã hết | Đọc `/coop/me`, hiển thị `— / 3` khi chưa biết. Hết lượt vẫn cho chơi, có thông báo không nhận thêm thưởng; mô tả nút tìm đồng đội cũng đổi theo trạng thái hết lượt. Thắng thường hiển thị 40 Nguyệt Ngọc và 3 Nguyệt Trần từ cấu hình. |
| Đội hình | Cần nhận ra bộ bài và nhân vật trước khi ghép trận | Tên bộ bài, ba hình đầy đủ và tên nhân vật tách bên dưới. Không chồng chữ lên hình. Border 1 pixel theo đúng kích thước ảnh; phần khoảng trống bố cục nằm ngoài border. |
| Trạng thái bộ bài | Dùng deck đầu danh sách ngầm có thể khác lựa chọn của người chơi | Chỉ dùng `session.selectedDeckId` khớp một bộ bài đã lưu. Chưa chọn thì yêu cầu chọn rõ ràng. Dùng `validateDeck` PvE thật; deck lỗi có lý do và khóa cả ba đường vào trận. |
| Thông tin bộ bài | Tổng số ô và số lá trong chồng có thể bị lẫn | Hai giá trị viết riêng: số ô bộ bài và số lá trong chồng. Không viết tắt tên cơ chế. Nút chỉnh sửa chỉ giữ icon dễ nhận biết, với tên truy cập chứa tên bộ bài. |
| Chọn bộ bài | Danh sách dài không nên bị cắt ở vài deck đầu | Dialog có tìm kiếm theo tên bộ bài hoặc nhân vật, danh sách cuộn và trạng thái hợp lệ. Đã kiểm tra tài khoản có tám bộ bài, tìm bộ thứ tám và chọn đúng. Tìm không có kết quả có thông báo riêng. |
| Ba cách chơi | Tìm người, mời bạn và chơi với máy cần phân biệt cả cách vào lẫn thưởng | Tìm đồng đội là hành động chính; Phòng riêng ghi mã phòng và không có thưởng; Đấu Tập ghi đồng đội máy và không có thưởng. Dùng icon chế độ có sẵn; giữ chữ cho khác biệt icon không diễn đạt chính xác. |
| Hàng chờ | Nút có thể bị bấm lặp, hoặc bộ bài bị thay đổi trong khi đã gửi | Chuyển sang panel chờ với thời gian và một nút hủy. Khóa chọn/sửa deck trong hàng chờ. Escape hủy chờ; phản hồi `queue.status` trễ sau hủy không dựng lại hàng chờ. |
| Nhập mã phòng | Form Phaser và xử lý mã thiếu chuẩn hóa dễ khó dùng trên điện thoại | Input native, sáu ký tự, tự viết hoa; nút vào phòng chỉ mở khi mã hợp lệ. Enter gửi cùng luồng với nút. Thông báo mã không tồn tại/hết hạn được dịch rõ ràng, không dùng thông báo lỗi chung cho mọi mã. |
| Phòng đang chờ | Không nên dựng trạng thái đồng đội giả hoặc nút thao tác không được server hỗ trợ | Hiển thị mã thật, nút sao chép, username/trạng thái thật và ô chờ người thứ hai. Có một nút rời phòng; trận tự bắt đầu khi đủ hai người. Không có nút sẵn sàng giả. |
| Sai chế độ phòng | Mã phòng Đối Kháng có thể vô tình bắt đầu một trận khác từ Liên Thủ | `room.join` nhận thêm chế độ mong muốn tùy chọn. Máy chủ từ chối sai chế độ trước khi lấy chỗ hoặc bắt đầu trận. Client cũ không gửi chế độ vẫn tương thích. Regression test dùng WebSocket thật chứng minh từ chối sai mã và vẫn vào được với client cũ. |
| Mất kết nối và tải hình | Ý định vào trận gửi offline có thể bị replay vào lúc người chơi đã hủy hoặc rời màn hình | Thêm `sendLobby`: chỉ gửi khi socket thực sự mở, không đưa vào outbox. Mất kết nối xóa trạng thái chờ/phòng tại client, khóa vào trận và hướng dẫn thử lại. Tải combat assets có gate thật và nút tải lại khi lỗi. |
| Editor và vòng đời | Sửa bộ bài từ lobby cần trở về đúng nơi; callback cũ không được ghi vào scene mới | Lưu hoặc thoát editor trở lại Liên Thủ. Callback API/assets/socket có guard tài khoản, socket và lần mở scene; shutdown gỡ listeners, DOM và gửi leave một lần khi cần. |
| Bàn phím, focus và border | Focus hoặc disabled không được làm mất viền; popup phải đóng đúng và trả focus | Nút tối thiểu 44 pixel, border 1 pixel và radius 12 pixel ở cả trạng thái khóa. Icon đơn 42 pixel trong nút 44 pixel. Dialog native có Escape, focus trap và trả focus về nút mở; không có tooltip chỉ lặp lại nhãn. |

## Kiểm tra đã thực hiện

### Tự động

- Client: toàn bộ 42 file, **341 test đạt**.
- Server: toàn bộ 16 file, **69 test đạt**.
- `pnpm -r typecheck`: đạt cho data, rules, client và server.
- `pnpm --filter client build`: đạt. Vite vẫn báo cảnh báo kích thước bundle trên 500 kilobyte như cấu trúc bundle hiện có.
- Sau chỉnh chữ/icon cuối: client typecheck, build và 14 test liên quan flow/socket chạy lại đều đạt. Lượt kiểm tra cuối sau mọi thay đổi tiếp tục đạt toàn bộ 341 test client, typecheck client và build.
- `git diff --check`: đạt.

Test mới kiểm tra deck đã lưu/validation PvE, gate kết nối và assets, thưởng chưa tải/hết lượt, mã phòng và đồng hồ, request lặp, phản hồi chờ trễ, room lifecycle, lỗi giao thức và transport không replay offline. Test server mới kiểm tra mode phòng và tương thích client cũ.

### Trình duyệt với máy chủ cục bộ

Mở scene thật qua entry kiểm tra không commit trong `.sdd-work`. Tài khoản và dữ liệu dùng PostgreSQL giả lập trong bộ nhớ, không đụng tài khoản người chơi thật.

- Tìm kiếm/chọn bộ bài thứ tám, khóa deck khi tìm, hủy bằng nút và Escape.
- Mã năm ký tự bị khóa; mã sáu ký tự chữ thường được chuẩn hóa; Enter gửi yêu cầu; mã không tồn tại báo đúng lỗi.
- Tạo phòng, sao chép mã, rời phòng; hai tài khoản vào cùng trận Liên Thủ, thấy đội hình đồng đội; sau kết thúc quay lại sảnh.
- Đấu Tập vào trận thật với đồng đội máy “Đồng Hành”.
- Vào editor, thoát trở lại Liên Thủ; đổi tên, lưu và dùng, trở lại sảnh với tên mới.
- Popup tìm deck không có kết quả; Escape đóng popup và trả focus. Input search native dùng Escape đầu tiên để xóa nội dung khi đang có chữ, Escape tiếp theo đóng dialog.
- Viewport 1280 × 720, 900 × 720, 450 × 800 và 375 × 667. Không tràn ngang; tỉ lệ nội dung ba portrait khớp 1024:1536, sai số chỉ do làm tròn pixel. 375 pixel có cuộn dọc để giữ chữ, hình và vùng bấm đủ lớn.

Các trạng thái khó tạo ổn định bằng tài khoản thật được kiểm tra riêng bằng **fixture của renderer**, không coi là mô phỏng kết nối máy chủ: chưa có deck, deck thiếu lá, offline, lỗi/đang tải hình, hết thưởng, lỗi API thưởng và nút thử lại. Đã kiểm tra hết thưởng vẫn mở tìm người và không còn ghi “có thưởng” trên nút. Tính đúng đắn của gate/transport được kiểm tra bằng test tự động; reconnect thật đã được quan sát khi máy chủ thử nghiệm khởi động lại.

Reviewer độc lập đã kiểm tra implementation và kiểm tra lại các sửa lỗi: không còn finding chặn hoàn tất. Finding border của icon chỉnh sửa đã được sửa thành nút icon có viền sát ảnh.

## Ảnh minh chứng

Ảnh lobby và popup dưới đây là scene thật. Ảnh hết thưởng là fixture có đánh dấu, không phải dữ liệu thưởng của tài khoản thật.

![Sảnh Liên Thủ desktop](coop-lobby-ui/coop-lobby-desktop.jpg)

![Sảnh Liên Thủ điện thoại](coop-lobby-ui/coop-lobby-mobile.jpg)

![Đang tìm đồng đội](coop-lobby-ui/coop-queue-desktop.jpg)

![Phòng riêng đang chờ](coop-lobby-ui/coop-room-desktop.jpg)

![Nhập mã phòng trên điện thoại](coop-lobby-ui/coop-private-mobile.jpg)

![Luật trên điện thoại](coop-lobby-ui/coop-rules-mobile.jpg)

![Hết lượt thưởng — fixture renderer](coop-lobby-ui/coop-cap-fixture.jpg)

![Hai tài khoản vào trận riêng thật](coop-lobby-ui/coop-private-match.jpg)

![Đấu Tập với đồng đội máy thật](coop-lobby-ui/coop-practice-match.jpg)

Hai ảnh chiến đấu có nút entry kiểm tra ở mép dưới; đây là công cụ cục bộ ngoài bản build sản phẩm. Phạm vi thay đổi là sảnh Liên Thủ và đường trở về editor, không thiết kế lại màn chiến đấu trong lượt này.
