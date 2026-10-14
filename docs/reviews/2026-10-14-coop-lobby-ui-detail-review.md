# Review chi tiết màn Liên Thủ — lượt hoàn thiện tiếp theo

Ngày 2026-10-14. Đánh giá bản `ec5e6f9` trên `codex/coop-lobby-ui`.

## Phạm vi và cơ sở

Review dựa trên ảnh màn hình đã lưu trong `docs/reviews/coop-lobby-ui`, mã của lobby, cấu hình và protocol thật. Lượt này đề xuất thay đổi, chưa sửa mã sản phẩm. Không chạy lại phiên chơi hoặc bộ test của lượt triển khai trước. Kích thước và tiêu chí bên dưới là mục tiêu thiết kế cần kiểm tra khi triển khai, không phải kết quả đo của một bản mới.

Ảnh `coop-lobby-desktop.jpg` đang thể hiện trạng thái **chưa chọn bộ bài**. Dùng ảnh hàng chờ và phòng riêng để đánh giá đội hình desktop đã chọn; ảnh điện thoại thể hiện đội hình đã chọn. Không coi các ảnh này là cùng một trạng thái.

Nhận định chính: bản hiện tại có nền tảng tương tác tốt, ảnh đầy đủ và control có border. Cần cải thiện thứ bậc thông tin, thời gian tìm thấy hành động chính trên điện thoại, thông tin thưởng và phản hồi ở gần thao tác. Phong cách hiện hơi giống bảng quản trị vì các panel/viền nhỏ có sức nặng gần nhau.

Quy ước: **P1** cần xử lý trong lượt hoàn thiện kế tiếp vì ảnh hưởng thao tác hoặc hiểu đúng thông tin; **P2** cải thiện nhận diện và mỹ thuật. Đây là ưu tiên thiết kế, không phải mức độ lỗi bảo mật.

## 1. Tham khảo game tương tự

| Nguồn chính thức | Đã xem / điều có cơ sở | Bài học áp dụng vào Liên Thủ |
|---|---|---|
| [Hearthstone Battlegrounds Duos — Blizzard, Season 7](https://news.blizzard.com/en-gb/article/24064742/announcing-battlegrounds-season-7) và [GIF menu trong bài](https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/L7KB2H9WC9AS1711663782854.gif) | Đã xem cả khung menu thường và Duos trong GIF. Nút Play nổi bật bên phải; thông tin phụ nhỏ hơn. Bài viết mô tả hai đường chơi: mời bạn hoặc tìm đồng đội ngẫu nhiên. | Hành động vào trận cần mạnh hơn thông tin ví tiền và tình trạng bộ bài. Hai đường tìm người/mã phòng phải rõ từ đầu. Giữ hình nhân vật của Vọng Nguyệt hiển thị đầy đủ theo quy tắc riêng. |
| [Legends of Runeterra — United Front, 2021](https://playruneterra.com/fr-fr/news/game-updates/co-op-with-your-friends-starting-jan-13/) và [hình thông báo chính thức của Riot](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/a7bfa09e7ed732b3a79aa90d32a494c0be6b2030-1920x1080.jpg) | Bản văn được công cụ tìm kiếm đọc từ trang Riot; trang động không trả đủ nội dung khi mở. Đã xem hình thông báo qua trình duyệt. Nguồn mô tả chơi với bạn hoặc tìm người, và trao đổi thông tin để phối hợp. Hình nhấn mạnh nhân vật và mục tiêu chung. | Sảnh nên giúp nhận ra đội hình và mục tiêu đánh, không chỉ liệt kê các nút. Không suy diễn hình quảng bá này thành bố cục lobby của Riot. |
| [Across the Obelisk — Paradox](https://www.paradoxinteractive.com/games/across-the-obelisk/about), [FAQ co-op](https://www.paradoxinteractive.com/games/across-the-obelisk/faq), [ảnh chiến đấu trong trang chính thức](https://images.ctfassets.net/u73tyf0fa8v1/6IHn6r6ueIbTo4F41bCBky/ceb64d5d99e69a3064477f0c3b65a200/1_a_Co-op_Roguelite.jpg?fm=webp&q=75&w=1920) | Đã xem ảnh chiến đấu: đội người chơi là một nhóm thị giác rõ ràng bên trái, đối thủ ở bên phải; chỉ số gắn gần nhân vật. FAQ xác nhận mỗi người điều khiển nhân vật riêng trong một đội và kết hợp lớp nhân vật. | Gom ba nhân vật thành nhóm đội hình. Thông tin bổ trợ phải nằm gần người/đội liên quan. Đây là áp dụng nguyên tắc nhóm thông tin từ màn chiến đấu sang sảnh, không khẳng định đã xem lobby của game này. |

Các nguồn Hearthstone và Runeterra là thiết kế đã công bố trong các năm tương ứng, không xác nhận UI mới nhất của chúng năm 2026. Các kích thước, màu sắc, thứ tự và giải pháp cụ thể ở phần sau là đề xuất riêng cho Vọng Nguyệt.

## 2. Bố cục, header và màu sắc

### LT-01 — Hành động chính trên điện thoại · P1

**Hiện tại:** ở ảnh 375 × 667, header và ví tiền chiếm khoảng 100 pixel đầu, dải thưởng tiếp tục đến khoảng 207 pixel, đội hình đến khoảng 594 pixel. Thẻ Tìm đồng đội bắt đầu gần 607 pixel: người chơi chỉ thấy một phần nút trên màn hình đầu tiên.

**Đề xuất:** giảm chiều cao các vùng phụ trước khi giảm hình nhân vật. Bỏ ví tiền khỏi sảnh không có chi phí vào trận; gộp dải thưởng; chuyển chỉnh deck về header của đội hình và gộp trạng thái hợp lệ với hàng số lượng. Giữ đủ ba portrait. Đặt cả nút Tìm đồng đội trước Phòng riêng và Đấu Tập; khi đang chờ, đưa panel chờ/phòng lên trước đội hình trên điện thoại.

**Tiêu chí:** tại 375 × 667 và 450 × 800, với tên bộ bài dài nhất hợp lệ và trạng thái bình thường, thấy trọn vùng bấm Tìm đồng đội mà không cuộn. Khi đang chờ/phòng, thấy hủy/rời và trạng thái chính trước vùng đội hình. Không chồng thanh hành động lên ảnh.

### LT-02 — Tỉ trọng hai cột desktop · P2

**Hiện tại:** vùng đội hình gần 850 pixel, cách chơi 350 pixel ở ảnh 1280 pixel. Khi chưa chọn deck, phần trái trở thành một panel rỗng rất lớn, còn phần phải là ba thẻ đồng đều.

**Đề xuất:** giữ hai cột, đặt giới hạn chiều rộng nhóm portrait và căn giữa nhóm. Cột phải khoảng 340–380 pixel tùy viewport, có một thẻ tìm người mạnh nhất và hai lựa chọn phụ gọn hơn. Trạng thái chưa chọn deck dùng bố cục trống nhỏ, tránh ép chiều cao tối thiểu 295 pixel ở mọi kích thước.

**Tiêu chí:** bố cục không đổi hướng đọc khi chuyển từ trống sang đã chọn; nội dung 900 × 720 vẫn đọc được; không tăng cỡ ảnh bằng cách crop hoặc kéo giãn.

### LT-03 — Header và mục tiêu trận · P2

**Hiện tại:** “Phối hợp hai người” giải thích thể loại nhưng không cho biết đang đánh gì; tên Nguyệt Thực Ma Quân chỉ có trong popup luật.

**Đề xuất:** dùng một dòng mục tiêu ngắn dưới Liên Thủ: “Nguyệt Thực Ma Quân”, lấy tên từ encounter thật. Biểu tượng `node_boss` có thể hỗ trợ nếu đã có chỗ; không thêm một portrait đối thủ lớn ở đầu trang. “Hai người” và 45 giây đưa vào nội dung luật hoặc hàng thông tin gọn có ích.

**Tiêu chí:** người mới biết mục tiêu mà chưa cần mở luật. Không tạo dropdown hoặc chọn độ khó khi game hiện chỉ có một encounter.

### LT-04 — Ví tiền · P1

**Hiện tại:** số dư Nguyệt Ngọc/Nguyệt Trần ở header và icon của hai đồng tiền lặp lại ngay ở dải thưởng. Chúng chiếm một hàng riêng trên điện thoại dù Liên Thủ không cần mua lượt.

**Đề xuất:** bỏ số dư khỏi màn này; giữ các giá trị thưởng. Tiền vẫn có trên màn chính và shop. Nếu giữ ở desktop thì không để ví tiền quyết định chiều cao header trên điện thoại.

**Tiêu chí:** icon tiền chỉ gắn với thông tin có ích cho quyết định chơi; không dùng số dư để ám chỉ phí vào trận.

### LT-05 — Border, nền và bản sắc · P2

**Hiện tại:** nền navy phù hợp nhưng gần như mọi phần nhỏ đều có đường viền tương đương. Các icon mode, trạng thái, tiền và panel tạo nhiều hộp vuông nhỏ.

**Đề xuất:** phân cấp viền bằng màu: panel phụ dùng xanh mực trầm, vùng được chọn dùng vàng nhạt, Tìm đồng đội dùng xanh ngọc. Giữ nguyên border của mọi ảnh và nút; giảm độ nổi của viền ảnh trang trí thay vì bỏ viền. Dùng gradient CSS nhẹ và một vài nét trang trí ở khoảng trống, tránh nền ảnh phức tạp phía sau chữ.

**Tiêu chí:** ảnh có border sát nội dung hiển thị, nút có radius và border ở mọi trạng thái. Phân cấp vẫn nhận ra khi nhìn ảnh thu nhỏ; đường trang trí không biến thành hit target giả.

### LT-06 — Hệ chữ và độ tương phản · P1

**Hiện tại:** mô tả mode 12 pixel; tên nhân vật trên điện thoại 13 pixel; số lượng và kết nối khá nhỏ. Chữ vàng được dùng ở cả tiêu đề, tên deck và mode nên ít phân biệt mức độ quan trọng.

**Đề xuất:** giữ tiêu đề serif, chữ thông tin dùng font dễ đọc. Mô tả thiết yếu trên điện thoại tối thiểu khoảng 14 pixel, tên nhân vật khoảng 14–15 pixel; dùng màu sáng trung tính cho nội dung phụ cần đọc. Vàng ưu tiên tiêu đề/nội dung được chọn, không phủ mọi nhãn.

**Tiêu chí:** kiểm tra tương phản chữ nhỏ trên nền thực tế; tên và mô tả đầy đủ ở 375 pixel, cho xuống dòng thay vì viết tắt hoặc cắt bỏ.

## 3. Đội hình và bộ bài

### LT-07 — Nhóm ba portrait · P2

**Hiện tại:** mỗi ảnh desktop khoảng 150 × 225 pixel nhưng ba cột trải rộng gần hết panel, để khoảng trống giữa hình rất lớn. Nhìn giống ba mục độc lập hơn một đội.

**Đề xuất:** đặt nhóm portrait có chiều rộng tối đa riêng, khoảng cách giữa hình khoảng 20–28 pixel ở desktop, 8–12 pixel ở điện thoại. Căn giữa cả nhóm; giữ chiều rộng hình hiện có nếu phù hợp. Khoảng trống nằm ngoài border ảnh.

**Tiêu chí:** tỉ lệ nội dung 1024:1536 không đổi; không có khoảng hở trong khung do đặt ảnh contain vào ô rộng hơn. Không bo góc bằng cách cắt mất các góc của hình.

### LT-08 — Tên deck và vị trí hai nút · P1

**Hiện tại:** đổi deck ở góc trên phải, chỉnh deck ở góc dưới phải. Người chơi phải tìm hai khu vực để chuẩn bị cùng một đội hình.

**Đề xuất:** gom hai nút icon đổi/chỉnh vào header đội hình, cùng hàng với tên deck nếu đủ chỗ. Tên có thể xuống dòng đầy đủ. Hai nút giữ mục đích khác nhau, tên truy cập “Chọn bộ bài đã lưu” và “Chỉnh sửa [tên bộ bài]”.

**Tiêu chí:** không chồng nút lên portrait, không giảm vùng bấm dưới 44 pixel, không nhầm đổi deck với chỉnh sửa deck. Ở 375 pixel tên 24 ký tự không đẩy nút khỏi panel.

### LT-09 — Số lượng và hợp lệ · P1

**Hiện tại:** “18 / 18 ô bộ bài”, “54 lá trong chồng” ở một hàng, “Bộ bài hợp lệ” lại ở một footer cao có nút chỉnh. Trạng thái bình thường dùng nhiều chiều cao nhưng ít bổ sung thông tin.

**Đề xuất:** gộp hai số lượng thành một hàng gọn, và biểu tượng kiểm tra hợp lệ vào header hoặc hàng này. Tên truy cập của icon nói rõ bộ bài hợp lệ; chỉ hiện chữ giải thích đầy đủ khi có lỗi. Không dùng biểu tượng kiểm tra cho cả “đang chọn” lẫn “hợp lệ” trong cùng một vị trí.

**Tiêu chí:** số ô và số lá vẫn phân biệt đúng. Trạng thái lỗi có lời giải thích và nút chỉnh rõ ràng; trạng thái hợp lệ không chiếm một footer riêng trên điện thoại.

### LT-10 — Thông tin phục vụ phối hợp · P2

**Hiện tại:** người chơi thấy ba tên/hình nhưng không thấy vai trò hoặc trang bị đang dùng.

**Đề xuất:** nếu bổ sung, ưu tiên thông tin đội hình thật có giá trị: vai trò nhân vật hoặc xem trang bị tại chỗ. Đặt cạnh tên, không chồng trên hình. Chỉ dùng icon nếu nghĩa đủ rõ và có tên truy cập; nếu thiếu bộ icon vai trò đáng tin cậy, giữ tên vai trò đầy đủ trong popup xem đội hình. Không suy ra vai trò chỉ từ vũ khí hoặc dùng một icon hiệu ứng làm nghĩa khác.

**Tiêu chí:** lấy từ `archetype`/loadout thật; không tính điểm “phối hợp”, sức mạnh hoặc khuyên đội hình không có cơ sở. Đây là lựa chọn phụ sau các hạng mục P1, vì có thể làm sảnh nhiều thông tin hơn.

### LT-11 — Trạng thái chưa chọn và chưa có deck · P1

**Hiện tại:** trạng thái chưa chọn lặp “Chọn bộ bài” ở heading và nút, có thêm icon đổi deck cùng chức năng. Khi không có deck, icon đổi bị khóa vẫn xuất hiện.

**Đề xuất:** một hành động chính rõ: “Chọn bộ bài” nếu đã có deck; “Tạo bộ bài” nếu chưa có. Ẩn icon đổi chỉ trong trạng thái không có gì để đổi. Dùng icon Liên Thủ 72–88 pixel và một câu hướng dẫn, giảm khoảng rỗng. Không tự chọn deck đầu danh sách.

**Tiêu chí:** hai empty state dẫn đúng luồng, không có hai hành động cạnh tranh cùng chức năng. Nút chơi bị khóa và lý do được diễn đạt tại vùng chuẩn bị đội hình.

### LT-12 — Deck lỗi và nút bị khóa · P1

**Hiện tại:** danh sách lỗi đầy đủ có thể kéo cao đội hình và đẩy cách chơi ra khỏi viewport; màu chữ tiêu đề mode vẫn vàng cả khi nút bị khóa.

**Đề xuất:** đưa lỗi quan trọng nhất gần nút chỉnh. Nếu nhiều lỗi, có một nút mở danh sách đầy đủ thay vì đổ tất cả vào sảnh. Đổi cả chữ tiêu đề/icon emphasis theo trạng thái khóa, giữ border. Lý do khóa xuất hiện một lần, không lặp trên cả ba mode.

**Tiêu chí:** người chơi biết phải sửa gì, vẫn truy cập mọi lỗi; nút khóa phân biệt được mà không dựa riêng vào màu. Bộ bài không hợp lệ vẫn xem/chỉnh được.

## 4. Chọn cách chơi và phần thưởng

### LT-13 — Tìm đồng đội là hành động chính · P1

**Hiện tại:** ba thẻ cùng chiều cao và khung gần giống nhau; màu xanh của nút chính có tác dụng nhưng chưa tạo khác biệt mạnh.

**Đề xuất:** giữ Tìm đồng đội ở đầu với nền xanh ngọc, border vàng nhạt và nhãn rõ. Hai lựa chọn phụ thấp hơn. Dòng “Ghép với một người chơi” lặp mục đích tiêu đề; ưu tiên chỉ giữ thông tin thưởng cần thiết. Không đổi ba nút thành một dropdown làm tăng bước vào trận.

**Tiêu chí:** ở desktop/mobile, nhìn nhanh nhận ra nút tìm người. Khi hết thưởng, nút vẫn rõ là có thể chơi, không bị thiết kế giống nút disabled.

### LT-14 — Nội dung riêng từng mode · P1

**Hiện tại:** Phòng riêng và Đấu Tập đều ghi “không có thưởng”, đúng nhưng lặp nhiều chữ trong vùng nhỏ.

**Đề xuất:** giữ sự khác biệt cốt lõi: phòng theo mã; đồng đội máy. Có thể dùng badge thưởng bằng icon chung với tên truy cập đầy đủ nếu nghĩa đã rõ; nếu chưa rõ thì giữ cụm “Không có thưởng” vì đây là thông tin quyết định, không thay bằng một icon tùy ý. Dấu › chỉ cần nhẹ ở mép phải.

**Tiêu chí:** không ai hiểu nhầm phòng riêng hoặc tập được thưởng; không thêm mời bạn trong danh sách bạn bè khi backend chỉ hỗ trợ mã.

### LT-15 — Nhãn số lượt thưởng · P1

**Hiện tại:** “Lượt thưởng hôm nay 3 / 3” đang dùng `rewardClaimsLeft`; người chơi có thể đọc thành đã dùng ba lượt.

**Đề xuất:** đổi nhãn thành **“Lượt thưởng còn lại”**, giữ số thật. Có thể có ba chấm nhỏ phụ trợ khi có dữ liệu; số vẫn là thông tin chính. Khi chưa biết, hiển thị —, không bật ba chấm như còn đủ lượt.

**Tiêu chí:** 3 / 3, 2 / 3, 0 / 3 và chưa tải có nghĩa nhất quán. Hết lượt không khóa chơi.

### LT-16 — Giá trị thưởng và thắng đầu ngày · P1

**Hiện tại:** dải chính chỉ hiện 40/3; luật có thưởng thêm 10 Nguyệt Ngọc. Dải thưởng còn xuất hiện trong phòng riêng dù phòng không có thưởng, khiến người chơi phải đọc lời phủ định ở nơi khác.

**Đề xuất:** xác định rõ dải này là thưởng **qua tìm đồng đội**. Khi đang ở phòng riêng hoặc khởi chạy tập, thu gọn thành trạng thái không nhận thưởng cho cách chơi này. Nếu muốn nêu thưởng thắng đầu ngày, suy ra từ `/coop/me.clearsToday` và `rewardClaimsLeft`, cùng ngày máy chủ; có thể hiển thị “Thắng đầu ngày +10” khi đủ điều kiện biết được. Không chỉ dựa vào việc chưa thấy thông báo thưởng ở client.

**Tiêu chí:** không hứa thưởng khi chưa tải dữ liệu, hết lượt, riêng/tập hoặc bỏ cuộc. Mức 40/3 và phần cộng thêm đều lấy cấu hình; chưa có dữ liệu thì chỉ diễn đạt chính sách, không gắn trạng thái “còn” giả.

### LT-17 — Chiều cao dải thưởng · P1

**Hiện tại:** trên điện thoại, số lượt và số thưởng thành hai hàng lớn, khoảng 95 pixel tổng vùng.

**Đề xuất:** mục tiêu khoảng 52–64 pixel ở trạng thái bình thường: một hàng chính số lượt, nhóm icon thưởng gọn. Không để số dư và số thưởng ở hai vùng liền nhau. Lỗi/thông báo hết lượt có thể làm cao hơn vì thêm thông tin thật.

**Tiêu chí:** nhãn đầy đủ, icon có border sát ảnh, số không dính icon; không ép mọi thứ một hàng khi gây tràn. Đây là giảm phần phụ để giữ hình và nút chơi trên màn hình đầu tiên.

## 5. Hàng chờ, phòng riêng và phản hồi

### LT-18 — Panel hàng chờ · P1

**Hiện tại:** icon lớn, tiêu đề, timer, câu “Vào trận khi tìm được người cùng chơi” và nút hủy. Câu hướng dẫn chủ yếu lặp trạng thái. Trên điện thoại panel chờ nằm dưới đội hình.

**Đề xuất:** đưa trạng thái chờ lên trước đội hình ở điện thoại. Giữ timer, tên trạng thái, nút hủy; bỏ câu lặp. Icon có thể có chuyển động nhẹ ở vùng riêng; timer không phải đồng hồ đếm ngược hoặc thời gian chờ ước lượng.

**Tiêu chí:** thấy hủy ngay; focus trên nút hủy không bị mất khi timer tick. Không dựng lại toàn bộ sảnh mỗi giây chỉ để đổi đồng hồ. Kiểm tra cuộn popup luật trong khi đang tìm người.

### LT-19 — Vùng phòng riêng và mã · P1

**Hiện tại:** mã phòng được nhóm tốt và có sao chép; phản hồi “đã sao chép” nằm ở footer toàn màn hình, xa nút và có thể ở ngoài viewport điện thoại.

**Đề xuất:** phản hồi ngắn ngay trong vùng mã, hoặc đổi trạng thái icon sao chép sang check trong khoảng ngắn. Giữ tên truy cập và vùng thông báo cạnh control. Mã vẫn chọn được để sao chép thủ công.

**Tiêu chí:** nhìn thấy thành công/thất bại ngay tại mã, không tự thay đổi nội dung mã. Thông báo không biến mất vì một lần render không liên quan; bàn phím và clipboard thất bại đều có phản hồi.

### LT-20 — Hai ô người chơi · P2

**Hiện tại:** ô có người dùng check và “Sẵn sàng”; ô trống dùng cùng icon mode Liên Thủ. Nó biểu đạt trạng thái nhưng chưa làm nổi bật hai chỗ trong đội.

**Đề xuất:** giữ hai slot có hình thức tương tự nhau, một slot người thật và một slot chờ. Có thể dùng icon người hoặc dấu cộng trong slot trống, tên truy cập rõ; check chỉ cho trạng thái đã sẵn sàng thật. “Bạn” dùng nhãn nhỏ riêng cạnh username đầy đủ. Không làm slot trống trông như nút mời nếu không có hành động tương ứng.

**Tiêu chí:** đủ một/hai người, tên dài và disconnect đều hiển thị đúng; không chèn avatar hoặc trạng thái sẵn sàng giả.

### LT-21 — Tự bắt đầu và rời phòng · P1

**Hiện tại:** một đoạn dài gộp việc không thưởng và tự bắt đầu. Nút rời phòng có thể nằm thấp trên điện thoại.

**Đề xuất:** đặt “Trận bắt đầu khi đủ hai người” ngay dưới số slot; trạng thái không thưởng thuộc vùng thưởng. Rời phòng có border rõ, màu cảnh báo vừa phải và ở vị trí dễ thấy. Không thêm nút Bắt đầu hoặc Sẵn sàng nếu server hiện tự khởi chạy.

**Tiêu chí:** hiểu rõ việc trận có thể bắt đầu ngay khi đồng đội vào; thấy rời phòng mà không phải cuộn qua đội hình. Không yêu cầu xác nhận dư thừa cho việc rời một phòng đang chờ.

### LT-22 — Lỗi mã phòng tại chỗ · P1

**Hiện tại, theo mã:** khi gửi join thành công về mặt transport, dialog đóng ngay. Nếu máy chủ báo mã không tồn tại, lỗi nằm ở sảnh và muốn sửa phải mở lại popup, nhập lại mã.

**Đề xuất:** giữ dialog và input trong khi gửi; khóa gửi lặp và hiện trạng thái chờ ngắn trong nút. Khi join thất bại, báo lỗi dưới input, giữ nguyên mã và cho sửa. Khi join được hoặc match bắt đầu mới đóng dialog.

**Tiêu chí:** sai mã, sai chế độ, phòng đầy hoặc hết hạn đều sửa được ngay; focus ở input hoặc lỗi theo cách hợp lý. Escape trong pending phải có hành vi xác định, không để đóng popup rồi bỏ lại một request/phòng không hiển thị.

### LT-23 — Kết nối và chuẩn bị trận · P1

**Hiện tại:** trạng thái kết nối ở footer; lỗi tạo một banner dài. Lý do “Đang tải hình trận” và “Chưa tải đủ hình trận” mang màu sắc kỹ thuật.

**Đề xuất:** chuyển thông tin kết nối liên quan vào trận về gần vùng chơi. Dùng “Đang chuẩn bị trận…” cho tải assets; khi lỗi dùng một câu rõ và nút thử lại. Trạng thái bình thường nhỏ; mất kết nối phải được chú ý hơn. Không lặp cùng thông điệp ở banner, footer và cả ba nút.

**Tiêu chí:** vẫn có gate socket mở/assets đủ; không gửi request offline; retry điều kiện nào phải được hiểu ở đúng vùng đó. Không dùng tooltip nhắc lại nội dung banner.

## 6. Popup và tương tác nhỏ

### LT-24 — Popup chọn deck và mật độ hàng · P1

**Hiện tại:** dưới 420 pixel, mỗi hàng deck xếp portrait ở trên và cả khối tên/thông tin ở dưới; lặp “Bộ bài hợp lệ” cho từng hàng, nên chỉ xem được ít deck.

**Đề xuất:** thử hàng gọn khoảng 88–110 pixel trên điện thoại: ba thumbnail nhỏ đủ tỉ lệ cạnh khối tên nếu đọc được; nếu tên dài, cho hàng lớn hơn. Giữ tên nhân vật đầy đủ, có thể đưa mô tả sang hàng thứ hai. Hợp lệ dùng icon/tên truy cập, lỗi giữ chữ vì có thêm thông tin. Deck được chọn nhận viền vàng và trạng thái đang dùng rõ.

**Tiêu chí:** danh sách tám deck vẫn dễ tìm; không ép tên/portrait vào một hàng rồi viết tắt. Tất cả thumbnail có border sát ảnh, không crop để làm hàng thấp.

### LT-25 — Màu lỗi của deck trong popup · P1

**Hiện tại, theo mã:** `.cl-deck-check` có màu xanh `!important` áp dụng cả thông báo lỗi, mặc dù nội dung hàng có thể là lý do deck chưa hợp lệ.

**Đề xuất:** phân biệt trạng thái hợp lệ/lỗi theo class hoặc dữ liệu của hàng; lỗi dùng chữ và biểu tượng phù hợp, màu cảnh báo. Không khóa chọn deck lỗi nếu chọn để xem/chỉnh là luồng đã được chủ ý hỗ trợ.

**Tiêu chí:** một hàng lỗi không nhìn giống “đã kiểm tra thành công”. Không chỉ dùng màu để biểu đạt lỗi; kiểm tra cùng lúc deck đang chọn và deck lỗi.

### LT-26 — Search và trạng thái rỗng của search · P2

**Hiện tại:** input gọn và tìm theo tên deck/nhân vật; thông báo không tìm thấy chỉ có một dòng. Khi mở, native dialog thường focus nút đóng.

**Đề xuất:** desktop mở bằng bàn phím có thể focus tìm kiếm; điện thoại không tự bật bàn phím khi người chơi chỉ muốn xem danh sách. Khi không tìm thấy, thêm một nút icon xóa tìm kiếm có tên truy cập đầy đủ nếu control native không đủ rõ.

**Tiêu chí:** đóng popup trả focus đúng nút mở; không đẩy ba thumbnail ra ngoài viền khi bàn phím hiện. Escape ở search vẫn tuân hành vi native hoặc được xử lý nhất quán, không hủy nhầm queue phía sau.

### LT-27 — Popup tạo/vào phòng · P1

**Hiện tại:** tạo phòng có nút lớn ở trên, join gồm input và nút ở dưới; câu phân cách khá dài. Placeholder giống một mã có thể dùng thật.

**Đề xuất:** giữ hai vùng, giảm câu phân cách thành “Hoặc nhập mã phòng”. Label và gợi ý sáu chữ/số luôn hiện. Placeholder là ví dụ được diễn đạt rõ, không hiển thị như mã đã nhận từ hệ thống. Kiểm tra paste chuỗi có khoảng trắng: chuẩn hóa trước khi giới hạn khiến ký tự bị mất.

**Tiêu chí:** tạo/join không gửi hai yêu cầu song song; nhập, dán, bàn phím điện thoại và Enter đều dùng cùng quy tắc. Đây là hạng mục cần kiểm tra tương tác thêm, không khẳng định mọi kiểu paste đang lỗi từ ảnh tĩnh.

### LT-28 — Popup luật và thưởng · P1

**Hiện tại:** nhiều đoạn liên tiếp, lặp thông tin thưởng riêng/tập; “bấm Xong” không trùng nhãn nút “Xong lượt” đã thấy trong ảnh combat.

**Đề xuất:** chia ba nhóm gọn: phối hợp, lượt chung, thưởng. Dùng icon và câu một dòng cho thông tin cốt lõi; bảng thắng/thua/đầu ngày có icon tiền và số. Viết đúng **“Xong lượt”**. Giữ các điều kiện không nhận thưởng, vì đây là thông tin thêm có ích.

**Tiêu chí:** tại 375 × 667, đọc nhanh được luật 45 giây, tối đa ba lượt và riêng/tập không thưởng; phần dài cuộn được, nút đóng không bị cắt. Không rút tên tiền/cơ chế thành chữ viết tắt.

### LT-29 — Icon đổi deck, trợ giúp và đóng · P2

**Hiện tại:** đổi deck dùng `nav_exchange` có hình vòng xoay, dễ gần nghĩa refresh; trợ giúp là dấu hỏi đơn, các icon còn lại là assets vàng khá chi tiết.

**Đề xuất:** kiểm tra icon đổi deck bằng thử nhận diện; nếu chưa rõ, dùng hình bộ bài/hero có sẵn phù hợp hơn hoặc bổ sung một icon bộ bài riêng. Dấu hỏi có thể giữ nếu dễ hiểu, hoặc chuyển sang icon sách luật phù hợp bộ assets. Không thêm tooltip chỉ lặp nhãn.

**Tiêu chí:** tên truy cập đầy đủ; nút bo tròn và border hiện trong normal/hover/focus/disabled. Icon đơn fit vùng nội dung có viền; không thêm padding khiến hình có khoảng hở lớn trong khung.

### LT-30 — Focus, cập nhật timer và thông báo · P1

**Hiện tại, theo mã:** mỗi lần render thay toàn bộ `content.innerHTML`, rồi phục hồi focus theo `data-control`. Timer hàng chờ làm gọi render mỗi giây. Popup được giữ nhưng DOM của phần nền vẫn thay.

**Đề xuất:** cập nhật riêng timer, lượt thưởng và trạng thái cần đổi; dựng lại panel chỉ khi phase đổi. Thông báo copy gắn state để tồn tại đúng khoảng thời gian và không bị render khác xóa. Giữ focus trap native và phục hồi focus; kiểm tra hai nút cùng control trong empty state để tránh trả focus về nút không đúng.

**Tiêu chí:** đang focus hủy/copy thì tick không gián đoạn; popup luật/deck không mất cuộn; công cụ đọc màn hình không đọc lại cả sảnh mỗi giây. Đây là rủi ro UX từ cách cập nhật DOM cần kiểm tra, không khẳng định hiện có một lỗi mất focus đã tái hiện.

## 7. Assets và thứ tự thực hiện

### LT-31 — Dùng lại assets · P1/P2

| Vùng | Assets hiện có phù hợp | Cách dùng |
|---|---|---|
| Cách chơi | `mode_coop`, `mode_private`, `mode_practice` | Nhận diện ba đường vào, ảnh đầy đủ với viền sát. |
| Hành động | `nav_back`, `action_edit`, `action_copy`, `action_close`, `action_reset`, `action_new` | Quay lại, chỉnh, sao chép, đóng, thử lại và tạo mới. Không biến reset thành đổi deck nếu gây nhầm. |
| Tiền và hợp lệ | `cur_moonJade`, `cur_moonDust`, `check`, `lock` | Thưởng và trạng thái; không dùng check cho mọi loại thông tin. |
| Mục tiêu / luật | `node_boss`, `nav_history` hoặc dấu hỏi hiện có | Kiểm tra nghĩa icon trước khi dùng; sách lịch sử không mặc nhiên đồng nghĩa luật. |
| Đội hình | Ba portrait hero đang chọn | Full hình, đúng tỉ lệ, tên phía dưới. Không cần gen portrait mới. |

Chưa có một bộ icon vai trò được xác nhận và icon đổi bộ bài chuyên biệt. Nếu cần bổ sung, ưu tiên vector đơn giản theo hệ icon trước; nếu chọn bitmap phong cách game thì mới sinh mới theo brief cụ thể. Không cần sinh nền hoặc key visual lớn chỉ để hoàn thiện sảnh.

### LT-32 — Gói đề xuất và tiêu chí nghiệm thu

**Gói ưu tiên:** LT-01/04/17 đưa hành động vào viewport đầu; LT-15/16 làm rõ thưởng; LT-22 giữ lỗi join trong form; LT-25 sửa màu lỗi; LT-28 đúng nhãn Xong lượt; LT-30 cập nhật trạng thái không gián đoạn thao tác.

**Gói tiếp theo:** LT-07/08/09 gom đội hình và control; LT-13/14 phân cấp cách chơi; LT-19/20/21 phòng chờ; LT-24/26/27 popup. Làm cùng các thay đổi đầu nếu không tăng quá nhiều phạm vi.

**Gói mỹ thuật sau:** LT-02/03/05/06/10/29/31, ưu tiên dùng lại assets. Vai trò/trang bị tại chỗ là tùy chọn vì thêm thông tin và tương tác; không cần làm trước khi giải quyết nút chơi trên điện thoại.

Kiểm tra khi triển khai:

1. Viewport 375 × 667, 450 × 800, 900 × 720, 1280 × 720; thêm màn hình có bàn phím điện thoại bật để kiểm tra form.
2. Chưa chọn/có một/có tám/chưa có deck; tên tối đa, deck lỗi, deck hợp lệ và deck đang chọn.
3. Thưởng chưa biết/còn ba/còn một/hết, lỗi tải thưởng và đổi ngày máy chủ; riêng và tập không diễn đạt thưởng như được nhận.
4. Idle, gửi, queue, hủy, queue status trễ, tạo phòng, join sai/đầy/hết hạn/sai mode, hai người tự vào trận, rời phòng và mất kết nối.
5. Ảnh đúng tỉ lệ, full nội dung, border cách ảnh không quá một pixel mỗi bên. Nút có border và radius ở mọi trạng thái; focus bổ sung cho border.
6. Chuột, cảm ứng, Tab, Enter, Escape; search, paste mã, focus/scroll còn ổn định khi timer hoặc API cập nhật.
7. Không tooltip lặp nhãn; không tên cơ chế viết tắt; icon nào không đủ rõ giữ chữ đầy đủ.
8. Những số đo, màu và kích thước đề xuất phải được xác nhận bằng bản render mới. Không coi ảnh hiện có là minh chứng của các thay đổi chưa triển khai.

## 8. Ảnh hiện tại dùng làm căn cứ

![Chưa chọn bộ bài — desktop](coop-lobby-ui/coop-lobby-desktop.jpg)

![Đội hình đã chọn — điện thoại, nút chơi nằm thấp](coop-lobby-ui/coop-lobby-mobile.jpg)

![Đã chọn bộ bài và đang tìm đồng đội — desktop](coop-lobby-ui/coop-queue-desktop.jpg)

![Phòng riêng — desktop](coop-lobby-ui/coop-room-desktop.jpg)

![Popup mã phòng — điện thoại](coop-lobby-ui/coop-private-mobile.jpg)

![Popup luật — điện thoại](coop-lobby-ui/coop-rules-mobile.jpg)
