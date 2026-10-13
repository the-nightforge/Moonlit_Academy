# Đề xuất cải thiện màn hình Nhiệm vụ

Ngày khảo sát: 13/10/2026. Worktree `missions-ui`, nhánh `codex/missions-ui`, nền `main` tại `c506f9f`.

Mục tiêu: người chơi nhận ra ngay việc có thể nhận thưởng, biết phải làm gì tiếp theo và đọc được điều kiện thành tựu. Đây là tài liệu khảo sát và đề xuất ban đầu, trước khi triển khai. Màn hình game đã được thực hiện sau khi duyệt; xem [kết quả triển khai và kiểm chứng](implementation.md). Bản xem trước dùng dữ liệu minh họa, không gọi máy chủ.

## Tham chiếu và cách áp dụng

- **Hearthstone, màn Quests trong công bố hệ thống tiến trình năm 2020**: đã xem ảnh chính thức. Mỗi thẻ đặt điều kiện, tiến độ và phần thưởng trong cùng một vùng; nhiệm vụ ngày và tuần được tách rõ. Áp dụng sự liên kết điều kiện → tiến độ → thưởng và chỉ báo nhóm. Không áp dụng nền giấy, viền đồ sộ hay ô trống chiếm chỗ. Đây là tham chiếu lịch sử, không khẳng định là giao diện hiện hành. [Nguồn Blizzard](https://news.blizzard.com/en-us/article/23534414/revamping-progression-rewards-in-hearthstone).
- **Marvel Snap, bản phác thảo Missions trong hồ sơ của người thiết kế Tiffany Smart**: đã xem ảnh Missions cạnh Main Menu và Matchmaking. Danh sách dọc có số tiến độ ở cạnh điều kiện, thưởng thẳng cột và dấu hoàn thành dễ quét mắt. Áp dụng nhịp hàng đều, vị trí thưởng cố định và trạng thái rõ. Không sao chép kiểu chữ nghiêng, hình đa giác, thông tin chồng lên hình hay hệ thống mốc thưởng của Snap. Đây là bản phác thảo thiết kế, không phải ảnh xác nhận phiên bản game mới nhất. [Hồ sơ người thiết kế](https://www.tiffanysmart.com/work/marvel-snap).
- **Marvel Snap, bản cập nhật 19/07/2022** nêu mục tiêu giảm số lần chạm trong giao diện nhiệm vụ. Từ đó đề xuất nhận toàn bộ các thưởng đã đủ điều kiện trong nhóm đang mở. Đây là suy luận cho Vòng Nguyệt, không đưa thêm nhiệm vụ hoặc thưởng. [Thông báo chính thức](https://marvelsnap.com/patch-notes-july-19-2022/).

Ba hướng đã cân nhắc: danh sách kèm thanh tổng quan (chọn, hợp điều kiện dài); ba thẻ lớn kiểu Hearthstone (đẹp với 3 nhiệm vụ nhưng khó mở rộng 8 thành tựu); bảng dữ liệu sát nhau (quét nhanh nhưng thiếu phân biệt hành động và khó chạm). Bản đề xuất chọn danh sách với khoảng cách vừa đủ, dùng phong cách xanh đêm và vàng của assets hiện tại.

## Review từng phần

Đối chiếu `apps/client/src/scenes/missions-scene.ts`, dữ liệu `packages/data/missions.json`, `achievements.json` và `packages/rules/src/meta/economy.ts`.

| Phần | Hiện tại | Đề xuất | Lý do / ưu tiên |
|---|---|---|---|
| Thanh đầu | Header chung, đơn vị thưởng trong hàng là ký tự ◆ | Giữ nút quay lại; dùng icon tiền tệ thật, số lượng rõ, không tooltip lặp | Nhất quán kho đồ, nhận diện đúng loại tiền. Cao |
| Chuyển nhóm | Ba tab ngang, không số thưởng chờ nhận | Thanh nhóm bên trái; ở màn hẹp chuyển thành tab ngang. Tên Hằng ngày / Hằng tuần / Thành tựu viết đầy đủ | Không dựa vào icon mơ hồ để phân biệt kỳ. Cao |
| Chỉ báo nhóm | Không có | Ngày/tuần: số nhiệm vụ đang có thể nhận; thành tựu: số đã đạt / tổng | Có lý do để chuyển tab. Không đếm nhiệm vụ chưa xong là thưởng chờ nhận. Cao |
| Thời gian làm mới | Dòng nhỏ giữa màn | Gắn dưới tiêu đề nhóm, 04:00 và giờ Việt Nam; thành tựu ghi tự nhận, không làm mới | Đọc cùng ngữ cảnh. Từ `resetUtcHour=21` và `weekKey`, kỳ tuần bắt đầu thứ Hai 04:00 giờ Việt Nam. Vừa |
| Tổng quan | Không có | Số hoàn thành / tổng; tổng thưởng trong kỳ ở chân danh sách | Phân biệt hoàn thành với đã nhận. Không thêm điểm hoạt động hay rương mốc. Vừa |
| Khung hàng | Hàng cố định 76px / 54px, hình chữ nhật, ít phân cấp | Hàng có góc bo; chiều cao đáp ứng nội dung; cột hình, điều kiện, tiến độ, thưởng, hành động tách biệt | Tránh đè chữ dài lên cột thưởng. Cao |
| Icon loại việc | Chưa có | `mode_run`, `nav_heroes`, `node_boss`, `nav_banners`, `nav_mastery`, `seal` | Quét nhanh, toàn bộ hình trong viền đúng tỉ lệ. Vừa |
| Tên / điều kiện | Tên và mô tả không giới hạn vùng chữ | Tên 16–17px, điều kiện 13px; xuống dòng trong cột, không rút gọn nội dung | Điều kiện tiếng Việt quan trọng hơn trang trí. Cao |
| Thanh tiến độ | Tách khá xa điều kiện | Tiến độ X / Y cạnh điều kiện; thanh 7px có viền, nền và số rõ | Nhìn được tiến độ ngay cả khi không phân biệt màu. Cao |
| Thưởng | `+20 ◆` | Icon Nguyệt Ngọc + số, cùng một cột cố định | Ít chữ, không dùng ký tự thay loại tiền. Cao |
| Chưa hoàn thành | Nút Nhận bị vô hiệu hóa; tooltip lặp “Chưa hoàn thành” | Thay bằng nút icon dẫn đến hoạt động phù hợp, accessible name đầy đủ | Cho biết hành động tiếp theo; bỏ tooltip không thêm thông tin. Cao |
| Có thể nhận | Nhận ở cùng vị trí với nút bị khóa | Icon rương, viền vàng, nền sáng vừa; hàng có viền nổi hơn | Phân biệt khả dụng mà không chỉ dựa vào màu. Cao |
| Đã nhận | Cả hàng xanh, nhãn Đã nhận | Dấu kiểm + nhãn Đã nhận gần tiến độ, màu dịu; không còn nút hành động | Không tạo tương tác giả; không làm hàng biến mất. Cao |
| Thứ tự | Theo dữ liệu | Có thưởng → đang làm → đã nhận; giữ thứ tự ổn định trong nhóm | Ưu tiên mục có hành động. Sau nhận giữ neo cuộn và focus, không nhảy dưới con trỏ. Cao |
| Nhận nhiều thưởng | Từng yêu cầu riêng | Nút Nhận tất cả khi có ít nhất 2 nhiệm vụ đủ điều kiện; icon, số thưởng dự kiến và tên rõ | Giảm thao tác. Chỉ thưởng hiện có, chỉ nhóm đang mở. Vừa |
| Thành tựu | Không có tiến độ; chỉ Đã đạt / Chưa đạt | Hiện số khi tính được: Tu Luyện cao nhất / 6, Hero sở hữu / tổng, tầng Bộ cơ bản / 8, lá khóa đã mở / tổng của Hero sở hữu | Không vẽ tiến độ giả cho điều kiện hạ boss với đội. Cao |
| Thành tựu tự thưởng | Một dòng chú thích | Giữ chú thích một lần, không nút nhận; dấu kiểm khi đã tự nhận | Phù hợp logic `grantAchievements`. Cao |
| Thành tựu sưu tập | “Sở hữu cả 5 Hero.” | “Sở hữu toàn bộ 20 Hero.” với tổng lấy từ dữ liệu khi hiển thị | Hiện có 20 Hero; logic yêu cầu tất cả. Đây là sửa nội dung, không hạ điều kiện. Cao |
| Danh sách thành tựu | Tọa độ cố định, không vùng cuộn | Vùng cuộn độc lập, thumb rõ, không đè chân trang; giữ vị trí khi đổi tab | Đáp ứng màn hẹp và dữ liệu tăng. Cao |
| Ngoại tuyến | Chưa chặn trước khi gọi | Banner ngắn; vô hiệu hóa nhận đơn / nhận tất cả, giữ viền nút; vẫn xem được dữ liệu có sẵn | Nêu nguyên nhân ngay trên màn, tránh lặp tooltip. Cao |
| Đang nhận | `busy=true` nhưng chưa render lại | Khóa nhận ngay, trạng thái “Đang nhận thưởng…”; nút vẫn có viền và góc bo | Ngăn bấm lặp, có phản hồi ngay. Cao |
| Lỗi | Alert chung rồi render | Thông báo ngắn, tiến độ / cuộn còn nguyên, có thể thử lại; dùng thông báo modal hiện có nếu lỗi cần xử lý riêng | Không mất ngữ cảnh và không giả báo nhận thành công. Cao |
| Không có dữ liệu | Khoảng trống | Icon `seal` và một câu theo nhóm; không nút nhận giả | Trạng thái rõ mà ít chữ. Vừa |
| Bàn phím / chạm | Các nút dùng renderer chung | Điều khiển có tên đầy đủ, focus rõ, vùng chạm tối thiểu 44px, cuộn tới mục đang focus | Không phụ thuộc hover hoặc chuột. Cao |

## Assets và rule hình

Tái sử dụng toàn bộ từ `apps/client/public/assets/ui/`:

| Vai trò | Assets |
|---|---|
| Quay lại | `nav_back.webp` |
| Nhóm ngày / tuần / thành tựu | `moon_full.webp`, `nav_history.webp`, `star.webp` |
| Lượt chơi / đội hình / boss / quay | `mode_run.webp`, `nav_heroes.webp`, `node_boss.webp`, `nav_banners.webp` |
| Tu Luyện / sưu tập | `nav_mastery.webp`, `nav_heroes.webp`, `seal.webp` |
| Thưởng và trạng thái | `cur_moonJade.webp`, `cur_moonStar.webp`, `node_treasure.webp`, `check.webp`, `lock.webp` |

Không cần sinh ảnh mới ở phương án này. Nền dùng màu và gradient, tránh đưa thêm hình không có vai trò. Không lấy ảnh tham chiếu của game khác làm asset.

Border đặt trên hộp có đúng kích thước hình sau khi contain, tối đa 1px khoảng trong. Không dùng ô cố định có hai dải trống bên trong viền. Với nút icon vuông hiện có, border nút chính là border ôm icon; không thêm hai lớp viền. Text luôn nằm riêng. Tất cả nút, kể cả disabled, có border nhìn thấy và góc bo 8–10px. Không tooltip chỉ lặp accessible name hay nội dung đã có.

## Ràng buộc hành vi khi triển khai

- Chỉ có 3 nhiệm vụ ngày (tổng 50 Nguyệt Ngọc), 3 nhiệm vụ tuần (180), 8 thành tựu (1200 thưởng một lần). Đọc từ dữ liệu, không hard-code tổng trong game.
- Nút đến hoạt động: lượt chơi / tầng / boss → màn chọn đội hình hiện có; Hero → danh sách Hero; quay → Cầu Duyên. Chỉ điều hướng, không tự bắt đầu lượt chơi, quay, tiêu tiền hay thay đội hình.
- Máy chủ chỉ có `POST /missions/:id/claim`. Nhận tất cả chạy tuần tự qua `mutate`, lấy lại điều kiện từ profile sau mỗi phản hồi; không gửi song song vì revision. Chỉ báo thành công cho thưởng đã thật sự nhận. Nếu một mục lỗi thì giữ kết quả đã nhận, dừng và cho thử lại phần còn đủ điều kiện.
- Tính trạng thái qua `missionProgress` và dry-run `claimMission`, không chỉ dùng profile chưa roll kỳ. Khi qua mốc làm mới, quay lại scene hoặc lấy lại focus cần cập nhật từ máy chủ và tính lại. Không thêm countdown ở lượt thiết kế này để tránh timer không đồng bộ.
- Ràng buộc vòng đời request với scene: phản hồi trễ không được dựng lại scene đã đóng hoặc đè tab mới. Hủy listener / điều khiển native khi shutdown.
- Cộng thưởng thành tựu do rules thực hiện; màn chỉ đọc kết quả, không cộng lại. Tính số lá khóa bằng giao với lockedCardIds thực tế, tránh đếm dữ liệu thừa.

## Bản xem trước và giới hạn

Mở `mockup.html` qua máy chủ HTTP từ gốc repo. Máy chủ xem trước hiện dùng `http://127.0.0.1:5201/docs/missions-ui/mockup.html`.

Có thể chuyển cả 3 nhóm, chọn 6 trạng thái bằng thanh ngoài màn game, thử nhận đơn / nhận tất cả và đặt lại dữ liệu minh họa. Điều hướng chỉ hiển thị phản hồi mô phỏng. Trạng thái đang nhận được chọn thủ công, không là request thật. Các số tiến độ thành tựu là minh họa; production phải lấy profile và dữ liệu.

Ảnh đính kèm: `preview-daily.jpg`, `preview-achievements.jpg`, `preview-narrow.jpg`. Kiểm tra trình duyệt: icon tải đủ, không tràn ngang, tên nút đầy đủ, border/góc bo còn ở trạng thái disabled. Không thay đổi mã sản phẩm hoặc dữ liệu nhiệm vụ trong bước đề xuất này.

Kiểm tra ngày 13/10/2026: bản xem trước đã được mở trong trình duyệt ở khung mặc định và 900 × 650; ảnh tải đầy đủ, tỉ lệ gốc và hiển thị đều 1:1, không tràn ngang, tất cả nút có viền và góc bo 10px. Đã thử 6 trạng thái nhóm nhiệm vụ; nhận tất cả hai mục minh họa cộng đúng 40 Nguyệt Ngọc (2400 → 2440). Kiểm tra cú pháp JavaScript của mockup thành công. Bộ kiểm tra client nền trước khi tạo tài liệu: 308 kiểm tra thành công. Đây không phải xác nhận logic mới trong game vì chưa thay mã sản phẩm.
