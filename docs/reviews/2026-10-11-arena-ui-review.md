# Đề xuất cải thiện UI Đấu Trường

Ngày rà soát: 2026-10-11. Phạm vi: lobby Đấu Trường, chọn deck, tìm trận, phòng riêng, lịch sử và bảng xếp hạng. Thiết kế đã được duyệt và triển khai trên nhánh hiện tại; ba icon mới dùng WebP nền trong suốt theo yêu cầu. Kết quả kiểm tra và giới hạn playback được ghi trong `output/arena-ui-redesign/verification.md`.

## Mục tiêu

Người chơi nhìn thấy ngay hạng hiện tại, bộ bài chuẩn bị xuất trận và chế độ đã chọn; vào trận qua một hành động chính rõ ràng. Đồng bộ với home và màn chỉnh deck: xanh đen, vàng ngà, art anime, panel bo góc. Dùng lại component và PNG/WebP hiện có; chỉ gen hình khi kho asset chưa có hình phù hợp về ý nghĩa.

## Cơ sở tham khảo

Các nguồn dưới đây là ví dụ thiết kế được nhà phát triển công bố, không phải khẳng định mọi game vẫn dùng nguyên UI này ở phiên bản hiện tại.

- **MTG Arena — Play Blade:** phân nhóm chế độ bằng tab, panel trực quan, tách việc chọn chế độ khỏi thao tác tìm trận. Wizards nêu rõ vấn đề danh sách chế độ thành một khối chữ khó đọc. Áp dụng vào Vọng Nguyệt: chọn chế độ trong panel riêng, một nút xuất trận nổi bật. [Bài công bố và ảnh Find Match](https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-alchemy-2021-12-02).
- **Hearthstone — hệ thống Ranked:** hạng và tiến độ tiến lên được diễn đạt qua league/rank và sao. Áp dụng nguyên tắc thể hiện mục tiêu kế tiếp bằng huy hiệu và tiến độ; Vọng Nguyệt vẫn dùng điểm và ngưỡng hạng hiện có. [Công bố Ranked Mode Overhaul](https://hearthstone.blizzard.com/en-us/news/23319441/welcome-to-the-year-of-the-phoenix-staging).
- **Legends of Runeterra — deck inspect:** patch notes công bố thao tác bấm portrait champion để xem bài và các bài liên quan. Áp dụng nguyên tắc nhận diện đội hình bằng art và xem chi tiết tại chỗ. [Open Beta Patch Notes](https://playruneterra.com/en-us/news/open-beta-patch-notes/).

Các lựa chọn kích thước, màu, bố cục và hiệu ứng bên dưới là đề xuất dành riêng cho Vọng Nguyệt.

## Hiện trạng đã kiểm tra

Đọc `apps/client/src/scenes/arena-scene.ts`, UI dùng chung, cấu hình PvP và xử lý realtime. Chụp UI hiện tại ở 1280×720 bằng dữ liệu mẫu trong một trình duyệt riêng. Không dùng tài khoản thật, không tạo trận, không thay đổi dữ liệu backend.

Ảnh nằm trong `output/arena-ui-review/`: `current-lobby.png`, `current-eight-decks.png`, `current-leaderboard.png`.

1. Lobby dùng nền màu phẳng, nhiều khoảng trống giữa deck và các nút, thiếu art nhận diện so với home.
2. Chỉ số hạng, thắng/thua và Vinh Dự là các dòng chữ nhỏ ở góc trái; thiếu huy hiệu và mục tiêu hạng tiếp theo.
3. Mỗi deck là một hàng chữ gồm tên deck, ba hero và lỗi PvP. Tên dài sẽ cạnh tranh với phần lỗi bên phải.
4. Danh sách deck không có viewport cuộn. Hàng thứ 8, tại y=462, bị các nút ở y=470 che; đã xác nhận bằng ảnh.
5. Xếp hạng, tạo phòng, vào phòng, đấu tập, lịch sử, bảng xếp hạng và shop đặt gần nhau như các hành động tương đương.
6. Header dùng ký tự thay icon tiền tệ; nút back, panel và modal chưa đồng bộ với HomeControls/roundedPanel.
7. Hàng chờ chỉ thêm chữ và nút hủy. Deck và các hành động chuyển chế độ vẫn hiện như lúc sẵn sàng.
8. Sau 90 giây, UI gợi ý đấu tập “trong lúc chờ”, nhưng `practice.start` gọi `queue.leave` tại backend. Nội dung cần nói rõ rằng đổi sang đấu tập sẽ hủy hàng chờ.
9. Lỗi kết nối/tìm trận đặt vào status rồi render lại có thể bị dòng trạng thái kết nối thay thế. Cần giữ lỗi trong trạng thái riêng và hiển thị ổn định.
10. Lịch sử và bảng xếp hạng là các chuỗi chữ trong modal lớn; thiếu cột, huy hiệu, hàng nổi bật và vùng cuộn. Client hiện chỉ vẽ 14 hoặc 12 hàng đầu.

## Bố cục đề xuất

Thiết kế theo vùng 1280×720; căn giữa khi cửa sổ rộng/cao hơn, nền phủ kín viewport.

| Vùng | Kích thước gợi ý | Nội dung |
| --- | --- | --- |
| Header | y=16–72 | Back dạng icon, tên Đấu Trường, currency chip đồng bộ home |
| Trái | x=40, y=100, w=264, h=500 | Huy hiệu, tên hạng, điểm, tiến độ hạng tiếp theo, thành tích và Vinh Dự hôm nay |
| Giữa | x=328, y=100, w=528, h=500 | Deck đang chọn, ba hero có art, số ô deck, trang bị và trạng thái hợp lệ; nút Đổi deck và icon chỉnh sửa |
| Phải | x=880, y=100, w=360, h=500 | Chọn Xếp hạng / Đấu tập / Phòng riêng; nội dung chế độ và nút hành động chính |
| Thanh dưới | y=624–696 | Lịch sử, Bảng xếp hạng, shop Vinh Dự; trạng thái kết nối nhỏ |

Panel bo 14–18 px, border xanh xám; vàng nhạt dùng cho hạng, lựa chọn và CTA chính. Chữ chính 16–18 px; thông tin phụ 13–14 px. Khu vực bấm icon tối thiểu 44×44 px; tooltip có cả hover lẫn keyboard focus.

### Hạng và Vinh Dự

- Huy hiệu 104–120 px từ `rank_*`; tên hạng và điểm cùng trục căn giữa.
- Bên dưới: “Còn 100 điểm đến Tú Tài” khi có 1000 điểm và ngưỡng kế tiếp 1100.
- Thanh tiến độ tính theo ngưỡng trong dữ liệu `tiers`, không hard-code. Hạng cao nhất hiển thị “Hạng cao nhất” thay thanh giả.
- Thành tích xếp thành ba mục Thắng / Thua / Hòa. Tỷ lệ thắng, nếu hiển thị, cần nêu cách tính và xử lý khi chưa có trận.
- Icon Vinh Dự cùng giá trị hôm nay/cap lấy từ API; khi đạt cap hiển thị “Đã đạt giới hạn hôm nay”. Số dư Vinh Dự nằm ở currency chip để tránh nhầm số dư với lượng kiếm hôm nay.
- Tooltip giải thích luật xếp hạng hiện có; không thêm mùa giải hay quà hạng khi backend chưa cung cấp.

### Deck chuẩn bị xuất trận

- Thay toàn bộ danh sách dài ở lobby bằng một deck preview có ba hero, tên deck tối đa hai dòng và nhãn “Hợp lệ PvP” hoặc “Cần chỉnh sửa”.
- Dùng art hero gốc/roundedArtTexture, không blur art; tên hero nằm trong vùng thông tin riêng của từng thẻ.
- Dùng `summarizeDeck(..., { mode: 'pvp' })` và `validateDeck(..., { mode: 'pvp' })` cho thông tin preview; không lấy chỉ số nâng cấp PvE để gợi ý sức mạnh PvP.
- Đổi deck mở selector cuộn/tìm kiếm, tái sử dụng cách trình bày modal home; chỉ liệt kê deck đã lưu được phép dùng tại lobby.
- Nút Đổi deck giữ chữ để dễ nhận ra; chỉnh sửa dùng `action_edit` với tooltip.
- Lỗi ngắn hiển thị dưới preview, chi tiết mở khi bấm. Không dồn tên hero và lỗi vào một hàng.
- Chưa có deck: minh họa bằng art có sẵn, câu hướng dẫn ngắn và nút “Tạo deck”; vô hiệu hóa tìm trận với lý do rõ ràng.

### Chế độ và phòng riêng

- Ba lựa chọn có icon, tiêu đề và mô tả ngắn. Xếp hạng là lựa chọn mặc định, không tự tìm trận khi chuyển tab.
- Xếp hạng: “Đấu với người chơi, thay đổi điểm xếp hạng”. CTA “Tìm trận xếp hạng”.
- Đấu tập: “Luyện với máy, không đổi điểm và không nhận Vinh Dự”. CTA “Bắt đầu đấu tập”.
- Phòng riêng: gom Tạo phòng và Nhập mã vào cùng nội dung. Mã dùng input thật, tự viết hoa và giới hạn 6 ký tự theo luồng hiện có.
- Đã tạo/vào phòng: thay nội dung bằng mã phòng, icon sao chép mã, hai slot người chơi và số người 1/2 hoặc 2/2. Trạng thái chờ đối thủ rõ ràng; rời phòng nằm trong panel này.
- Không thêm nút “Sẵn sàng” hay “Bắt đầu” nếu protocol hiện tại tự vào trận khi đủ người.
- Đưa Ngắt kết nối vào thao tác phụ/kết nối, tránh nút đỏ lớn chiếm góc màn hình thường trực.

### Tìm trận và các trạng thái chặn

- CTA biến thành timer “Đang tìm đối thủ · 01:24” và nút “Hủy tìm trận”, tại cùng vị trí; tránh nhảy layout.
- Khóa đổi deck và chỉnh sửa trong lúc tìm trận; preview vẫn giữ bộ bài đã gửi.
- Chuyển chế độ phải rời hàng chờ đúng luồng. Sau 90 giây, đề xuất “Chuyển sang Đấu tập — sẽ hủy tìm trận”.
- Hiển thị loading/error/tải lại tại panel tìm trận; phần tài khoản và deck vẫn xem được.
- Giữ thời gian chờ từ server; không đưa ETA giả hoặc số người online chưa có dữ liệu.
- Kết nối mất: vô hiệu hóa hành động vào trận, hiện banner và trạng thái tự kết nối lại. Lỗi gần nhất không bị render xóa.

### Lịch sử và bảng xếp hạng

- Tái sử dụng modal bo góc, backdrop che đúng toàn bộ viewport, close bằng `action_close`.
- Lịch sử chia cột: kết quả, đối thủ, chế độ, thay đổi điểm, thời gian. Màu đi cùng chữ Thắng/Thua/Hòa để không phụ thuộc vào màu.
- Bảng xếp hạng chia cột: vị trí, tên, huy hiệu hạng, điểm và thành tích. Dòng của người chơi luôn có vùng riêng ở dưới; top 3 có nhấn màu vừa phải.
- Cho cuộn các mục API đã trả về; chỉ làm phân trang phía server nếu endpoint đã hỗ trợ. Không âm thầm cắt danh sách ở client.
- Trạng thái chưa đủ 5 trận hiển thị thành hướng dẫn ngắn cùng tiến độ, tránh khoảng trống khó hiểu.
- Giữ loading, empty, error và nút thử lại riêng cho từng modal. Tên dài rút gọn có tooltip đầy đủ.

## Asset dùng lại

Đã kiểm tra tên file tồn tại trong kho; đã xem trực tiếp art nền home, icon Đấu Trường, huy hiệu Đồng Sinh và icon Lịch Sử.

| Công dụng | Asset / component sẵn có |
| --- | --- |
| Nền lobby | `backgrounds/home.webp`; lớp phủ xanh đen khoảng 60–70%, chỉnh theo bản preview |
| Chế độ xếp hạng | `ui/mode_arena.webp` |
| Huy hiệu | `ui/rank_dong_sinh.webp`, `rank_tu_tai.webp`, `rank_cu_nhan.webp`, `rank_tien_si.webp`, `rank_trang_nguyen.webp` |
| Deck preview | `heroes/*`, art vũ khí/nguyệt bảo; `roundedArtTexture`, `summarizeDeck` |
| Currency | `ui/cur_honor.webp`, `cur_moonJade.webp`, `cur_moonStar.webp` |
| Lịch sử / shop | `ui/nav_history.webp`, `nav_shop.webp` |
| Back / close / edit / copy / more | `ui/nav_back.webp`, `action_close.webp`, `action_edit.webp`, `action_copy.webp`, `action_more.webp` |
| Trạng thái hợp lệ / khóa | `ui/check.webp`, `lock.webp`; luôn đi cùng chữ giải thích |
| Modal, nút và tooltip | `roundedPanel`, `HomeControls`, bộ icon raster đã có |

Không cần gen lại logo, huy hiệu hạng, hero, panel nền hoặc khung nút. Các hình này giữ đúng phong cách hiện tại và có vai trò phù hợp.

## Asset thiếu cần gen

Chỉ đề xuất ba icon mới cho phương án trên:

| File đích đề xuất | Hình cần thể hiện |
| --- | --- |
| `ui/mode_practice.webp` | Hình nhân tập luyện gỗ với đao tập và huy hiệu trăng nhỏ; nhận ra là luyện tập, khác icon xếp hạng |
| `ui/mode_private.webp` | Cổng trăng nhỏ với hai thẻ mời/ấn phù, thể hiện phòng đấu giữa bạn bè |
| `ui/nav_leaderboard.webp` | Cúp nguyệt vàng trên ba bậc, thể hiện bảng xếp hạng |

Thông số chung: WebP nền trong suốt, 512×512, vật thể giữa hình, chừa mép 8–12%, silhouette rõ ở kích thước 32–56 px. Art anime cel-shading, vàng ngà/xanh navy/ngọc xanh giống `mode_arena` và `rank_*`; bóng gọn, chi tiết lớn, không chữ, không watermark. Dùng ảnh sẵn làm style reference khi gen. Không dùng SVG hoặc emoji thay ba hình thiếu này.

Gacha halo/dust có thể xem xét dùng lại cho hiệu ứng sau khi kiểm tra màu và mức nổi bật; không cần gen VFX mới ở bước đầu. Halo vàng của gacha không nên mặc định dùng cho hạng thấp.

## Animation và VFX

- Mở màn: fade 180–220 ms; giữ vị trí các phần chính để không gây cảm giác layout trôi.
- Hover: border sáng hơn và icon nâng/scale rất nhẹ; không dịch hitbox hoặc chữ.
- Chuyển chế độ: crossfade nội dung 120–160 ms, panel giữ kích thước.
- Tìm trận: quầng sáng xanh lam nhẹ quanh icon xếp hạng, pulse chậm; không quét sáng liên tục trên nút hủy.
- Đối thủ vào phòng: một nhịp sáng ở slot đối thủ; nhường chuyển màn cho sự kiện match.start.
- Hỗ trợ reduced motion: tắt pulse/chuyển động, vẫn có trạng thái tĩnh và chữ rõ ràng.

## Ưu tiên thực hiện

**P0 — khả năng sử dụng:** bố cục ba vùng; deck preview + selector cuộn; một CTA chính; hàng chờ/chuyển chế độ; lỗi/loading/kết nối ổn định; nền và controls dùng lại. Kiểm tra 0/1/8/nhiều deck, deck lỗi, tên dài, mất kết nối, lỗi tải art và phòng riêng.

**P1 — hình thức và đọc thông tin:** gen ba icon còn thiếu; huy hiệu và tiến độ hạng; currency chip; modal lịch sử/bảng xếp hạng theo cột; tooltip và thao tác bàn phím.

**P2 — hoàn thiện:** animation nhẹ và VFX tìm trận, test reduced motion, tinh chỉnh nền/ánh sáng. Chỉ cân nhắc nền Đấu Trường riêng sau khi bản dùng nền home đã được xem thực tế.

## Điều kiện đạt

- 1280×720, 1280×900 và 1920×1080: không chồng vùng nội dung, không crop nút chính; background phủ kín.
- Số deck không làm thay đổi chiều cao vùng xuất trận; chọn deck giữ đúng ID đã chọn.
- Không có SVG/emoji thay cho icon hình đã được chỉ định; PNG/WebP giữ tỉ lệ và alpha.
- Không hứa đấu tập đồng thời chờ xếp hạng; timer lấy từ server, đổi chế độ rời queue đúng cách.
- Hạng/tiến độ/Vinh Dự lấy từ dữ liệu thật, không thêm quà hoặc mùa giải chưa có.
- Tooltip, Tab, Enter, Escape, input mã phòng và close hoạt động nhất quán; lỗi vẫn đọc được sau render.
- Khi asset mới lỗi tải, UI vẫn hiển thị tên chế độ và lý do trạng thái; không dùng icon nét làm fallback.

