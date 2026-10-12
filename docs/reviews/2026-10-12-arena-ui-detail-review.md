# Review chi tiết UI Đấu Trường

Ngày: 2026-10-12. Trạng thái: đã triển khai phần polish trên nhánh hiện tại; xem nghiệm thu cuối tài liệu. Các mục “Hiện tại” bên dưới mô tả bản trước thay đổi.

## Phạm vi và cơ sở

Rà lobby Đấu Trường hiện tại, preview bộ bài, chọn chế độ, hàng chờ, phòng riêng, modal chọn bộ bài, lịch sử, bảng xếp hạng, tooltip, loading/error và chuyển động. Giữ bố cục ba cột; dùng art anime và asset WebP đã có.

Đã đối chiếu mã trên nhánh hiện tại với ảnh nghiệm thu trong `output/arena-ui-redesign`: lobby 1280×720, 1280×900, 1920×1080; selector; practice; private; phòng thật; queue; history; leaderboard; empty/invalid deck; profile error và modal loading/error/empty. Các ảnh danh sách và hàng chờ sử dụng dữ liệu mẫu, không phản ánh số người online hoặc lịch sử tài khoản thật. Ảnh phòng thật và lobby cuối có hạng 1020, Vinh Dự 20. Lượt review này không chạy lại phiên tương tác trực tiếp hay đo hiệu năng mới.

Các nguồn tham khảo là thiết kế nhà phát triển đã công bố, không phải xác nhận UI mới nhất của từng game:

| Game / nguồn chính thức | Điểm có cơ sở trong nguồn | Áp dụng vào Vọng Nguyệt |
| --- | --- | --- |
| [MTG Arena — Play Blade, 2021](https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-alchemy-2021-12-02) | Wizards mô tả danh sách chế độ dễ thành khối chữ khó đọc; bản mới dùng panel trực quan, tab Find Match và Last Played | Phân biệt lựa chọn chế độ với hành động vào trận; tăng nhận diện bằng art trong danh sách deck |
| [Hearthstone — Ranked overhaul, 2020](https://hearthstone.blizzard.com/en-us/news/23319441/welcome-to-the-year-of-the-phoenix-staging) | League, rank và sao biểu đạt từng bước tiến lên | Làm rõ hạng hiện tại, ngưỡng kế tiếp và phần còn thiếu; giữ hệ điểm hiện có của Vọng Nguyệt |
| [Legends of Runeterra — Open Beta Patch Notes, 2020](https://playruneterra.com/en-us/news/open-beta-patch-notes/) | Hiển thị champion của deck khi chờ trận; portrait trong deck inspect mở card text và bài liên quan | Art hero phải giúp nhận diện và xem thông tin tại chỗ, kể cả khi deck đã khóa |
| [MARVEL SNAP — Friendly Battles, 2023](https://marvelsnap.com/patch-notes-january-31-2023/) | Đấu với bạn bè qua mã; ghi nhận vấn đề thông báo mã sai chưa đủ rõ | Mã phòng cần nhãn, sao chép và phản hồi lỗi ngay gần input |

Kích thước, màu và giải pháp cụ thể bên dưới là nhận định thiết kế dành cho Vọng Nguyệt, không phải thông số lấy từ các game tham khảo.

## Kết luận

Bố cục đã giải quyết được vấn đề lớn: ba nhóm thông tin rõ, art hero sắc nét, deck không còn tràn danh sách ở lobby, các modal có phân trang, nút vào trận có vị trí cố định. Nên giữ nền và vị trí ba panel.

Phần còn yếu là thứ bậc nút, thông tin trang bị, nhận diện deck trong modal và cách phản hồi trạng thái. Hai điểm cần xử lý sớm có căn cứ từ mã: nút ba chấm thực hiện ngắt kết nối ngay; cập nhật timer queue dựng lại toàn màn hình, làm mất tooltip và khởi động lại pulse.

Quy ước: **P0** là thao tác gây bất ngờ hoặc cập nhật làm gián đoạn tương tác; **P1** là cải thiện khả năng đọc và sử dụng; **P2** là hoàn thiện mỹ thuật/VFX. Đây là ưu tiên cho lượt polish, không phải đánh giá lỗi bảo mật hay lỗi backend.

## 1. Header, nền và panel — AR-01 · P1/P2

**Hiện tại:** nền thư viện hợp phong cách; header gọn. Ba panel cùng độ đậm, border và chiều cao. Nền và viền lặp khá nhiều khiến các vùng đều có sức nặng tương đương.

**Đề xuất:**

- Giữ nền `backgrounds/home.webp`, lớp phủ navy và art hero hiện tại. Không blur hình hero hoặc tăng độ trong suốt panel đến mức chữ lẫn vào nền.
- Cho panel bộ bài border sáng hơn nhẹ; panel hạng và chế độ giảm độ sáng border. Mục tiêu là art đội hình dẫn mắt, CTA dẫn thao tác.
- Thống nhất nhãn nhóm 13–14 px, tên deck 20 px, tên hero 14 px, thông tin phụ tối thiểu 13 px trên vùng thiết kế 1280×720.
- Vàng dùng cho hạng và CTA; xanh ngọc cho trạng thái hợp lệ. Hover/focus cần khác trạng thái đang chọn bằng độ dày hoặc nét viền bổ sung.

**Đạt khi:** nhìn ở 1280×720 vẫn đọc được thông tin phụ; art giữ độ sắc nét; nền không cạnh tranh với tên deck và CTA. Nền Đấu Trường riêng chỉ là lựa chọn P2 sau cùng.

## 2. Currency header — AR-02 · P1

**Hiện tại:** ba chip chỉ có icon và số, chưa có giải thích khi hover/focus tại Arena. Vinh Dự số dư ở header dễ bị đọc cùng nghĩa với lượng kiếm hôm nay ở panel trái.

**Đề xuất:** giữ ba chip nhỏ và asset hiện có; thêm tooltip tên tiền tệ, số đầy đủ khi số được rút gọn. Chip Vinh Dự ghi rõ “Số dư Vinh Dự”. Duy trì thứ tự cố định giống Home.

**Đạt khi:** người chơi phân biệt được số dư với giới hạn kiếm hôm nay; giá trị lớn không tràn chip và có thể đọc đầy đủ.

## 3. Huy hiệu, điểm và tiến độ hạng — AR-03 · P1

**Hiện tại:** huy hiệu 116 px đẹp; tên hạng và điểm rõ. Câu mục tiêu ở y=352, thanh ở y=399 khá tách nhau; thanh không có mốc đầu/cuối nên khó hiểu phần vàng tương ứng với khoảng nào.

**Đề xuất:**

- Gom thành một cụm: “Tiến tới Tú Tài” → thanh bo góc cao 8–10 px → “Còn 80 điểm · Mốc 1.100”.
- Giữ giá trị điểm hiện tại dưới tên hạng. Tooltip giải thích thanh tính từ ngưỡng hạng hiện tại tới hạng kế tiếp.
- Không đổi công thức: Đồng Sinh có ngưỡng 0, Tú Tài 1100, nên thanh gần đầy tại 1020 là đúng dữ liệu. Chỉ làm rõ cách đọc.
- Hạng cao nhất dùng nhãn tĩnh; không vẽ tiến độ hoặc quà giả. Không thêm sao, mùa giải hoặc điều kiện tụt hạng của Hearthstone vào luật Vọng Nguyệt.

**Đạt khi:** các mốc 0/1000/1099/1100/1600 diễn đạt đúng; tên hạng dài không chen vào thành tích.

## 4. Thành tích và Vinh Dự hôm nay — AR-04 · P1

**Hiện tại:** ba số Thắng/Thua/Hòa cùng màu, chưa có đường phân nhóm với phần hạng. “20 / 120” có nhãn nhưng thiếu cảm giác tiến độ.

**Đề xuất:** thêm divider mảnh giữa tiến độ hạng và thành tích; giữ chữ Thắng/Thua/Hòa, dùng màu nhẹ ở số. Vinh Dự hôm nay thành một cụm riêng: icon 28–32 px, nhãn 13 px, “20 / 120”, thanh ngắn và dòng “Còn có thể nhận 100 hôm nay”. Khi đạt cap thay bằng “Đã đạt giới hạn hôm nay”.

Không thêm tỷ lệ thắng vì chưa cần thêm một số cạnh tranh với ba số đã có. Nếu thêm về sau phải định nghĩa cách tính với trận hòa.

**Đạt khi:** số dư, lượng kiếm hôm nay và điểm xếp hạng không bị đọc lẫn; không hiểu cap là phần thưởng chắc chắn sẽ nhận.

## 5. Tên deck, Đổi bộ bài và Chỉnh sửa — AR-05 · P1

**Hiện tại:** “Đổi deck”, “BỘ BÀI XUẤT TRẬN”, “Chọn bộ bài đã lưu” dùng thuật ngữ không nhất quán. Tên deck hai dòng có thể sát mép trên art.

**Đề xuất:** dùng “Bộ bài” trong nội dung UI: “Đổi bộ bài”, tooltip “Chỉnh sửa bộ bài”. Giữ tên tối đa hai dòng và tooltip đầy đủ; dành khoảng cách tối thiểu 12 px tới art. Giữ icon sửa `action_edit.webp` và hit area 44×44. Đổi bộ bài vẫn có chữ để thao tác chính dễ nhận ra.

Khi khóa do queue/phòng, thêm một dòng ngắn sát cụm nút hoặc tooltip đúng nguyên nhân: “Đang tìm trận — bộ bài đã khóa” / “Rời phòng để đổi bộ bài”.

**Đạt khi:** tên dài không ép art hoặc tên hero; thay đổi thuật ngữ không làm đổi ID/deck đang chọn.

## 6. Ba thẻ hero và xem chi tiết — AR-06 · P1

**Hiện tại:** art sắc nét, frame gọn. Tên 13 px hơi nhỏ; tương tác hiện tại chỉ cung cấp tooltip tên nếu bị rút gọn, art không mở thông tin hero.

**Đề xuất:**

- Giữ crop và tỉ lệ art. Tên tăng lên 14 px, có khoảng đệm hai bên; vẫn một dòng và tooltip nếu dài.
- Hover/focus toàn thẻ cho viền sáng nhẹ; bấm/Enter mở preview hero chỉ đọc, có tên và kỹ năng liên quan. Dùng mẫu tooltip/card preview hiện có.
- Trong preview chiến đấu xếp hạng, chỉ trình bày thông tin đúng luật PvP; không lấy chỉ số tăng từ PvE làm sức mạnh xuất trận. Thông tin thăng cấp phải ghi rõ điều kiện áp dụng nếu hiển thị.
- Xem chi tiết vẫn dùng được khi deck bị khóa; khóa chỉnh sửa không nên khóa đọc thông tin.

**Đạt khi:** ba hero có thứ bậc tên đồng đều, nhận ra được bằng art và đọc thông tin không phải rời lobby; không thêm hoạt ảnh zoom liên tục.

## 7. Vũ khí và Nguyệt Bảo — AR-07 · P1, ưu tiên cao

**Hiện tại từ mã:** vũ khí nằm ngoài frame hero, icon 34 px và tên 11 px rộng 99 px. Nguyệt Bảo chỉ có tối đa hai thumbnail 28 px bên phải dòng tổng kết, không có nhãn/tooltip. Ảnh lobby chính đang dùng deck chưa trang bị, nên nhận định về trạng thái có trang bị cần kiểm tra trực quan thêm khi triển khai.

**Đề xuất:**

- Gom vũ khí thành hàng cùng trục dưới từng hero: art 32–36 px + tên 13 px, vùng thông tin có nền nhẹ. Giữ nguyên kích thước art hero; có thể dùng phần trống bên dưới frame hiện tại.
- Slot trống ghi “Chưa trang bị”, không lặp một câu dài và rất nhỏ ở ba vị trí.
- Tách Nguyệt Bảo thành cụm có nhãn riêng dưới đội hình: hai slot 36–40 px, tooltip tên và tác dụng. Hit area tối thiểu 44×44 dù hình nhỏ hơn.
- Dùng nguyên art `weapons/*`, `relics/*`; thiếu hình vẫn có tên và vùng trống rõ. Không biểu diễn vũ khí Tinh Luyện PvE như mức thực tế của PvP.

**Đạt khi:** test deck có 0/1/3 vũ khí, 0/1/2 Nguyệt Bảo, tên dài và art lỗi; biết trang bị thuộc hero nào mà không phải đoán.

## 8. Tổng kết bộ bài và hợp lệ — AR-08 · P1

**Hiện tại:** “18 ô deck · 54 lá trong chồng bài” là thông tin đúng nhưng mang cách gọi nội bộ. Trạng thái hợp lệ và lỗi nằm dưới, tooltip có giải thích luật PvP.

**Đề xuất:** thử wording “18 mục bài · 54 lá khi vào trận”, kèm tooltip giải thích số bản. Chốt thuật ngữ theo luật thực tế trước khi thay chữ; không gọi 18 là số lá. Trạng thái gọn thành chip icon + “Hợp lệ PvP”. Deck lỗi dùng chip “Cần sửa” và action “Xem lỗi”; modal lỗi có nút “Chỉnh sửa bộ bài” đưa tới editor hiện có.

Giữ lỗi chi tiết trong modal, trình bày mỗi lỗi bằng hàng có chiều cao theo nội dung; tránh khoảng cách cố định nếu câu lỗi xuống nhiều dòng.

**Đạt khi:** phân biệt số mục với số bản; từ lỗi tới editor là một thao tác rõ, không cần tự tìm icon sửa ở màn sau.

## 9. Chọn chế độ và CTA — AR-09 · P1, ưu tiên cao

**Hiện tại:** chế độ đang chọn và CTA cùng dùng kiểu primary; các nút đều cao 40 px, font 14 px. Nút chọn Xếp hạng ở đầu panel có sức nặng tương đương nút Tìm trận ở dưới.

**Đề xuất:**

- Giữ ba lựa chọn xếp dọc. Chế độ đang chọn dùng nền xanh sáng nhẹ + vạch cạnh hoặc dấu `check.webp`; không dùng mức nhấn vàng giống CTA.
- CTA giữ vị trí, tăng cao 52 px, chữ 16–17 px; vàng ngà đậm hơn ở border/fill, chữ tương phản. Chỉ CTA hợp lệ được nhấn mạnh.
- Mô tả chế độ tách hai ý dễ đọc, ví dụ “Đấu với người chơi” và “Có thay đổi điểm xếp hạng”. Đấu tập/phòng riêng giữ đúng luật thưởng thực tế.
- Minh họa 96 px hiện tại đủ; không cần gen banner hoặc tăng icon đến mức lấn CTA.
- Đang gửi yêu cầu: thay nhãn CTA thành “Đang tìm trận…” / “Đang vào phòng…” tương ứng, đồng thời khóa hành động. Không đưa spinner và thông báo tiến độ ở một vùng cách xa nút.
- Lý do không thể chơi phải dễ đọc ngay dưới CTA, font 13–14 px; lỗi deck có đường dẫn tới sửa.

**Đạt khi:** người chơi phân biệt “đang chọn chế độ” với “bắt đầu”; enabled/disabled/pending rõ ngay tại nút, không phụ thuộc hover.

## 10. Hàng chờ và cập nhật timer — AR-10 · P0/P1

**Hiện tại:** timer server, nút hủy và lời nhắc đổi sang đấu tập sau 90 giây đều đúng luồng. Tuy nhiên, mỗi `queue.status` gọi `render()`, `render()` hủy tooltip và mọi object trong root. Server gửi trạng thái theo nhịp 1 giây; pulse alpha có duration 1100 ms rồi yoyo, nên bị tạo lại trước khi hoàn tất nhịp trong điều kiện nhận đều. Đây là suy luận có căn cứ từ mã, chưa có video đo riêng trong lượt review này.

**P0:** chỉ cập nhật text thời gian khi nhận tick; giữ thẻ, modal, focus, tooltip và tween đang chạy. Chỉ cập nhật cấu trúc khi trạng thái thay đổi, ví dụ bắt đầu/dừng queue hoặc vượt mốc 90 giây. Không dùng việc dựng lại toàn scene để cập nhật một con số.

**P1:** tách “Đang tìm đối thủ” và timer thành hai dòng, số thời gian đủ rõ và không làm text co giãn khi đổi phút. Hủy tìm trận là nút phụ rõ ràng; “Chuyển sang Đấu tập” nhỏ hơn về độ nhấn, luôn có dòng “Sẽ hủy tìm trận xếp hạng”.

**Đạt khi:** chờ 30 giây thấy pulse đủ chu kỳ; tooltip và focus không đóng/mất mỗi giây; mở lịch sử trong lúc queue không làm modal nhấp nháy. Vẫn lấy thời gian từ server và không thêm ETA/số người online giả.

## 11. Phòng riêng — AR-11 · P1

**Hiện tại:** tạo/join đã gom đúng; input native hỗ trợ nhập mã. Phòng đang chờ chỉ có mã lớn và hai dòng người chơi; thiếu nhãn trên mã và khung phân biệt hai slot.

**Đề xuất:**

- Trước khi vào: phân hai nhóm bằng nhãn “Tạo phòng” và “Tham gia bằng mã”; divider “hoặc” nhẹ. Mã dùng font monospace, giãn ký tự vừa phải, focus ring đồng bộ với canvas.
- Có mã hợp lệ: tăng nhấn nút Vào phòng để người đang nhập biết bước tiếp theo. Tạo phòng trở về kiểu phụ trong tình huống này.
- Trong phòng: nhãn “MÃ PHÒNG”, mã và icon copy trong cùng hàng; feedback “Đã sao chép” đặt sát mã, không tận cuối panel. Lỗi copy hiển thị ở cùng vùng.
- Hai slot người chơi có nền riêng, nhãn “Bạn”/“Đối thủ”; tên dài rút gọn và có tooltip. Dùng hình hero đầu bộ bài cho người chơi của mình nếu cần avatar; đối thủ chỉ dùng art khi dữ liệu cho phép, không giả lập đội hình họ.
- Dòng “Tự vào trận khi đủ 2 người” nổi bật hơn hiện tại. Nút Rời phòng là secondary, không cạnh tranh với mã.
- Lỗi mã đặt dưới input và giữ giá trị vừa nhập. Không thêm nút Ready/Start vì server hiện tự vào trận khi đủ người.

**Đạt khi:** mã sáu ký tự dễ đọc/sao chép; người chơi hiểu đang chờ ai và lúc nào bắt đầu; lỗi không làm mất mã hoặc thay đổi phòng ngoài ý muốn.

## 12. Footer và nút ba chấm — AR-12 · P0/P1

**Hiện tại:** Lịch sử/BXH/Shop đều là nút lớn cùng mức nhấn. Nút `action_more.webp` ở góc dưới phải thực hiện Ngắt kết nối ngay và về Home, không mở menu. Ý nghĩa hình ba chấm không phù hợp với hành động hiện tại.

**P0:** bỏ nút ngắt kết nối thường trực vì đã có Back. Nếu cần giữ cho hỗ trợ lỗi, ba chấm phải mở menu thật với dòng “Ngắt kết nối và về trang chủ”; bấm dòng đó mới thực hiện. Không gọi nó là đăng xuất tài khoản vì hành động hiện tại không logout auth.

**P1:** gom Lịch sử/BXH thành nhóm điều hướng, Shop thành nhóm phụ; giảm fill/border thay vì tăng thêm nút. Giữ icon raster và tên cho ba mục này. Trạng thái kết nối thường có thể nhỏ/gọn; mất kết nối phải có banner ngắn sát panel vào trận, không chỉ ở mép dưới.

**Đạt khi:** icon ba chấm không gây chuyển màn bất ngờ; trạng thái mất kết nối được nhận ra ngay gần CTA; Back vẫn hoạt động đúng khi queue/phòng/modal đang mở.

## 13. Modal chọn bộ bài — AR-13 · P1, ưu tiên cao

**Hiện tại:** tìm kiếm và phân trang hoạt động; hàng 40 px có tên deck 15 px và ba tên hero 11 px. Nhiều deck tương tự nhau khiến danh sách trông như bảng dữ liệu, khó nhận diện nhanh.

**Đề xuất:** giữ list, không chuyển sang grid lớn. Mỗi hàng có ba portrait hero 32 px bên trái, tên deck 15–16 px, mô tả 13 px và trạng thái bên phải. Tăng hàng lên khoảng 56 px, khoảng cách 6 px; sáu hàng nằm trong viewport 360 px. Deck đang chọn có `check.webp` + nhãn “Đang dùng”, không chỉ đổi màu border.

Giữ tìm theo tên deck/hero. Tận dụng art đã tải; art chưa có dùng placeholder tĩnh và chữ, không yêu cầu tải toàn kho hero mới mở được modal. Nút trang trước/sau có thể dùng `left`/`right` từ `nav_back.webp` với tooltip, hit area 44×44; giữ chỉ báo phạm vi và số mục. Không thêm favorite, sort hay dữ liệu sử dụng gần đây vào đợt này.

**Đạt khi:** nhận ra deck bằng đội hình; tên dài không lấn ba portrait/trạng thái; chuột, wheel và bàn phím chọn đúng ID trong 25+ deck.

## 14. Modal lịch sử — AR-14 · P1

**Hiện tại:** cột và màu kết quả đã rõ. Ngày/giờ 12 px nhỏ; điểm tăng/giảm cùng màu chữ thường. Các chế độ chỉ thể hiện bằng text dù đã có icon riêng.

**Đề xuất:** giữ bảng, tăng hàng 44 px nếu cần. Kết quả dùng chip có chữ, điểm +/− màu đi cùng dấu; chế độ icon 20–24 px + chữ. Cột số căn phải, tên căn trái. Thời gian hiển thị “Hôm nay · 23:40” hoặc ngày ngắn 13 px, tooltip chứa timestamp đầy đủ và năm; tính theo múi giờ hiện tại.

Có thể thêm filter client “Tất cả / Xếp hạng / Đấu tập / Phòng riêng” trên dữ liệu API đã trả, kèm nhãn rõ nếu chỉ là lịch sử gần đây. Không hứa lọc toàn bộ lịch sử nếu server không hỗ trợ. Không thêm nút replay khi chưa có dữ liệu replay.

**Đạt khi:** nhìn nhanh thấy kết quả, đối thủ và đổi điểm; trạng thái hòa/đang chưa có kết quả/null delta không bị biến thành thua hoặc 0 điểm.

## 15. Modal bảng xếp hạng — AR-15 · P1

**Hiện tại:** top 3 dùng cùng một nền nhấn; dòng “Bạn” được ghim nhưng là một câu dài, không thẳng cột với bảng. Phần đủ 5 trận đã có dữ liệu thật.

**Đề xuất:** giữ bảng thay vì làm podium lớn. Top 1/2/3 phân biệt bằng cỡ/chất liệu chữ vị trí hoặc ba sắc gold/silver/bronze nhẹ; giữ số thứ tự. Huy hiệu 28 px tăng vừa phải nếu hàng đủ chỗ. Dòng Bạn dùng lại các cột vị trí/tên/hạng/điểm/thành tích; chưa đủ điều kiện dùng một hàng hướng dẫn riêng “1/5 trận · Cần 4 trận nữa” và tiến độ tĩnh.

Nếu mình có trong danh sách hiện tại, đánh dấu cả hàng đó bằng viền nhẹ; ghim hàng Bạn không nên thay thế nhận diện trong bảng. Không gắn nhãn mùa giải hoặc thưởng thứ hạng khi endpoint chưa có.

**Đạt khi:** tìm thấy mình ngay; số điểm và W/L căn cột; top 3 vẫn đọc được nếu không phân biệt màu.

## 16. Loading, empty và lỗi — AR-16 · P1

**Hiện tại:** các trạng thái đã tách logic tốt. Modal loading/empty là một dòng giữa panel lớn; profile error được rút gọn và có tooltip, không còn tràn layout ở ảnh cuối.

**Đề xuất:**

- Loading giữ header/cột và 3–4 hàng placeholder tĩnh; chữ “Đang tải…” ngắn. Reduced motion không shimmer.
- Empty lịch sử dùng `nav_history.webp`, câu “Chưa có trận nào” và lời hướng dẫn ngắn; ẩn hai nút phân trang khi không có dữ liệu. Empty search có nút xóa tìm kiếm bằng icon close sẵn có, khác vị trí nút đóng modal.
- Chưa có deck: dùng `action_new.webp` hoặc art hero có sẵn thay icon đấu trường lặp với panel phải; “Tạo bộ bài” là hành động được nhấn lúc này.
- Lỗi có câu ngắn hiểu được + Thử lại; chi tiết dài mở ở tooltip/panel chi tiết. Lỗi liên quan mã ở input, lỗi tải art ở vùng tải, mất kết nối ở gần CTA.
- Khi dữ liệu hạng tải lại thất bại, nói rõ đang hiển thị dữ liệu gần nhất. Không biến mọi lỗi hồ sơ thành lý do chặn tìm trận nếu protocol vẫn cho phép.

**Đạt khi:** lỗi có chỗ xử lý cụ thể; empty không giống màn hình hỏng; nội dung dài không che nút. Không sửa lỗi protocol đã được xử lý trong lượt trước dựa trên ảnh cũ.

## 17. Tooltip, focus và ngôn ngữ — AR-17 · P1

**Hiện tại:** đã có Tab/Enter/Escape, native input và focus restore cho control có tên. Text info chưa có tên ổn định như nút; cập nhật scene có thể làm mất logical focus của text đó. Tooltip hiện có panel bo góc.

**Đề xuất:** gán nhận diện ổn định cho các mục xem thông tin; hover/focus/Enter đọc cùng nội dung; click có thể giữ preview cho tới Escape/click ngoài. Tooltip quan trọng 13–14 px, border dịu và padding 12–14 px; clamp trong viewport. Không làm mọi nút chữ ngắn hiện lại một tooltip trùng nguyên label; dành tooltip cho icon, nội dung rút gọn, luật và trạng thái khóa.

Chuẩn hóa “Bộ bài”, “Nguyệt Bảo”, “Vinh Dự”, “Xếp hạng” trên lobby và modal. Placeholder mã/phần tìm kiếm không thay nhãn trường. Nhãn và trạng thái phải có chữ đi cùng màu/icon.

**Đạt khi:** đọc tooltip ít nhất 5 giây trong queue không bị đóng bởi tick; Tab trong modal không lọt về lobby; native field và canvas cùng ngôn ngữ focus. Khả năng dùng bàn phím hiện có không đồng nghĩa đã xác nhận hỗ trợ trình đọc màn hình toàn bộ canvas.

## 18. Animation/VFX — AR-18 · P2, sau AR-10

**Hiện tại từ mã:** mở màn fade 200 ms; chuyển mode fade 140 ms; queue alpha pulse; reduced motion có hỗ trợ. Chưa xác nhận toàn bộ cảm giác chuyển động bằng video trong lượt này.

**Đề xuất:**

- Giữ fade mở màn 180–220 ms, không bay cả panel. Chỉ crossfade phần nội dung chế độ; ba nút lựa chọn đứng yên.
- Hover art hero tăng border/glow nhẹ, không scale crop/hitbox. Nút bấm có một nhịp sáng 80–120 ms.
- Queue dùng quầng xanh lam chậm 1,8–2,4 giây sau khi timer được cập nhật độc lập; không dùng ánh vàng mạnh như CTA.
- Đối thủ vào phòng: nhấn sáng slot một lần; không trì hoãn `match.start` để chờ hiệu ứng.
- Có thể count-up điểm sau trận 250–400 ms khi dữ liệu thật đã về; reduced motion đổi trực tiếp. Không chạy lại ở mọi lần render hoặc mở modal.
- Không thêm particle nền liên tục trong đợt polish này. `halo_legendary.webp` mang nghĩa độ hiếm gacha, không nên gắn mặc định lên mọi hạng.

**Đạt khi:** animation không khởi động lại theo timer, không dời nút, reduced motion diễn đạt đủ trạng thái. Báo cáo kiểm tra trước ghi nhận full-motion combat khoảng 2–4 FPS và cảnh báo texture trùng nhưng chưa xác định nguyên nhân; đây là giới hạn hiệu năng cần điều tra riêng, không phải kết luận lobby/VFX gây ra.

## Asset cần dùng

| Phần | Dùng lại | Gen mới |
| --- | --- | --- |
| Nền, rank, currency | `backgrounds/home.webp`, `ui/rank_*.webp`, `ui/cur_*.webp` | Không |
| Mode và queue | `mode_arena.webp`, `mode_practice.webp`, `mode_private.webp` | Không |
| Hero, weapon, Nguyệt Bảo | `heroes/*`, `weapons/*`, `relics/*` | Không; nâng cách trình bày và tương tác |
| Chọn deck, chỉnh sửa, copy, close, pagination | `action_new.webp`, `action_edit.webp`, `action_copy.webp`, `action_close.webp`, `nav_back.webp`, `check.webp` | Không |
| History/BXH/shop, empty states | `nav_history.webp`, `nav_leaderboard.webp`, `nav_shop.webp` | Không |
| Border, slot, badge, progress, glow | Component/panel hiện có và primitive của renderer | Không cần hình nền từng panel hoặc SVG |
| Nền Đấu Trường riêng, nếu chọn về sau | Nền home tiếp tục là phương án chính | Tùy chọn `backgrounds/arena.webp`, anime, navy/vàng ngà, tâm bố cục ít chi tiết, không chữ/logo |

Đợt cải thiện đề xuất không thiếu asset bắt buộc. Chỉ gen WebP mới khi có mục đích chưa được hình hiện tại đáp ứng; không gen lại toàn bộ icon vì thay bố cục.

## Thứ tự đề xuất triển khai

1. **Sửa thao tác trước:** AR-10 cập nhật queue độc lập; AR-12 sửa ý nghĩa nút ba chấm; giữ tooltip/focus ổn định theo AR-17.
2. **Cải thiện khả năng đọc:** AR-09 CTA/phân biệt mode; AR-07 trang bị; AR-05/06/08 thông tin bộ bài; AR-13 modal chọn deck.
3. **Hoàn thiện dữ liệu phụ:** AR-02/03/04 rank/currency/Vinh Dự; AR-11 phòng riêng; AR-14/15 history/BXH; AR-16 trạng thái.
4. **Polish:** AR-01 border/nền và AR-18 motion. Nền riêng có thể để sau.

## Điều kiện kiểm tra khi triển khai

- 1280×720, 1280×900, 1920×1080: art sắc nét; không tràn tên, thiết bị, trạng thái hoặc nút. Kiểm tra thêm viewport nhỏ nếu xác định hỗ trợ; không coi ba kích thước này là bằng chứng mobile responsive.
- Deck 0/1/25+, tên hai dòng; hero tên dài; đầy/thiếu trang bị; art chưa tải/lỗi; valid/invalid và modal lỗi nhiều dòng.
- Queue 0/30/89/90/120 giây; mở modal/tooltip khi đang chờ; hủy/chuyển chế độ vẫn đúng server; nút không nhảy vị trí.
- Private mã thiếu/sai/đủ; copy thành công/thất bại; tên dài; đủ người chuyển trận không bị VFX chặn.
- API loading/error/retry/empty; mất kết nối; dữ liệu hạng cũ; phân trang giữ đúng phạm vi và lựa chọn.
- Keyboard-only, focus sau tick/đóng modal, reduced motion; không coi kiểm tra ảnh tĩnh là kiểm tra animation.

## Kết quả triển khai

Thực hiện theo phê duyệt “Làm theo đề xuất đi”, giữ bố cục ba cột, art sắc nét và các asset WebP hiện có.

| Mục | Thay đổi đã thực hiện |
| --- | --- |
| AR-01/02 | Phân cấp border, tăng khả năng đọc chữ, thứ tự tiền tệ cố định và tooltip số dư |
| AR-03/04 | Cụm mục tiêu hạng, tiến độ và điểm còn thiếu; lượng Vinh Dự hôm nay và phần còn có thể nhận |
| AR-05/06/07/08 | Thống nhất “Bộ bài”; preview Hero với thông tin Thức Tỉnh; vũ khí/Nguyệt Bảo có tooltip theo PvP; số ô/bản và trạng thái hợp lệ |
| AR-09/10 | Chế độ chọn khác CTA chính; nút chính 52 px; timer cập nhật tại chỗ, giữ modal/tooltip/focus và hiệu ứng; chuyển Đấu tập sau 90 giây |
| AR-11/12 | Mã phòng có nhãn/focus/lỗi tại chỗ, copy phản hồi tại mã, slot Bạn/Đối thủ lấy đúng danh tính; bỏ nút ngắt kết nối tức thì gây bất ngờ |
| AR-13/14/15 | Selector có ba portrait và dấu chọn; lịch sử lọc trong các trận đã tải, ngày/giờ và màu kết quả; top ba khác màu, dòng bản thân thẳng cột |
| AR-16/17/18 | Placeholder/empty/error rõ hơn, sửa bộ bài từ danh sách lỗi; tooltip/focus ổn định; fade nội dung chế độ, quầng xanh hàng chờ và nhấn sáng slot người mới, tôn trọng giảm chuyển động |

Nền Đấu Trường riêng và count-up điểm là hai gợi ý tùy chọn, chưa thêm. Không thay luật, API hoặc protocol; chưa commit/push.

Đã xem ảnh 1280×720, 1280×900, 1920×1080 và trạng thái selector, đầy trang bị, tên dài, phòng riêng, queue, lịch sử, BXH, bộ bài lỗi/trống, hồ sơ lỗi, modal loading/error/empty. Đây không phải xác nhận responsive mobile. Lịch sử/BXH/timer trong ảnh dùng dữ liệu mẫu.

Kiểm tra trình duyệt xác nhận tooltip Hero/trang bị, lọc lịch sử, chuyển sang sửa bộ bài, phân trang, bàn phím/input, timer không đóng thông tin và pulse không khởi động lại. Review độc lập tìm thấy một lỗi khóa Cửa hàng sau xác nhận queue; đã tái hiện bằng kiểm thử và sửa.

Luồng máy chủ thật đã xác nhận xếp hạng/cập nhật điểm và Vinh Dự, phòng riêng bằng mã và khôi phục cùng trận, bot đấu tập hoàn tất đổi bài và tiến vòng. Dùng thiết lập giảm chuyển động/tốc độ 2. Một lần chờ kết thúc trận sau khôi phục bị timeout; không coi kiểm tra này là xác nhận playback/settlement sau recovery hoặc sửa hiệu năng combat full-motion.

Plan và bằng chứng: `docs/superpowers/plans/2026-10-12-arena-detail-polish.md`, `output/arena-detail-polish/verification.md`; ảnh nghiệm thu trong cùng thư mục output.

Kết quả cuối: Client 283 test qua, typecheck/build qua; Data 50 qua; Rules 727 qua / 4 bỏ qua. Sáu trường hợp Arena UI và hai trường hợp Home liên quan đã qua. Server 59 qua / 1 lỗi: test trang bị PvE T205 tại `apps/server/test/gear.test.ts:31` mong tạo lượt trả 201 nhưng nhận 400; chạy riêng vẫn tái hiện. Không sửa server/luật trong đợt UI này; không ghi nhận toàn bộ workspace test là xanh.
