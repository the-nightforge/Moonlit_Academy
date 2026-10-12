# Review chi tiết UI Kho Hero

Ngày: 12/10/2026. Đối tượng: màn hình trong worktree `hero-roster-ui`, nhánh `codex/hero-roster-ui`.

Đây là review và đề xuất, chưa triển khai thêm. Căn cứ: ảnh `implemented.png`, ảnh kiểm tra nội dung dài `overflow-check.png`, mã dựng màn hình và widgets. Tab Tổng quan được đánh giá trực tiếp trên ảnh; Tinh Hồn, Lá chủ lực và các trạng thái tương tác được đối chiếu thêm với mã dựng UI. Các kết luận về tốc độ tìm hero và khả năng hiểu giao diện là nhận định thiết kế, chưa có đo lường người chơi.

## Nhận định

Bố cục lưới + portrait + hồ sơ đã phù hợp với bộ sưu tập 20 hero. Cần nâng độ rõ của thông tin, cách biểu thị trạng thái và liên hệ giữa thao tác với kết quả. Nên giữ bố cục này cho vòng tiếp theo, tập trung cải thiện từng thành phần trước khi thay toàn bộ layout.

Ưu tiên cao nhất: tên hero không phụ thuộc hover; nội dung quan trọng không chìm vào nền; xem art không bị hiểu thành đổi dạng; điều kiện thăng cấp có đơn vị và ngữ cảnh; hành động đổi dạng dễ tìm; tooltip có nút đóng nằm cùng khung.

## UI tham khảo và bài học áp dụng

| Nguồn | Quan sát trong screenshot | Bài học cho Vọng Nguyệt |
| --- | --- | --- |
| [Reverse: 1999 — screenshot roster từ trang Steam](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3092660/ss_9b9dacd92ca434e8be20c8a979d9ee0788ba9325.1920x1080.jpg?t=1740046707), [trang game](https://store.steampowered.com/app/3092660/Reverse_1999/) | Portrait dạng thẻ, tên và cấp ở chân thẻ; Level/Rarity/Bond tập trung trên thanh đầu danh sách. | Giữ chân thẻ đọc được và đặt sắp xếp cùng nhóm duyệt hero. |
| [Honkai: Star Rail — screenshot Character Data Bank trên HoYoLAB](https://www.hoyolab.com/article/18132510) | Lưới portrait, tên dưới portrait, nhóm phân loại ở bên trái và tổng số đã ghi nhận. | Dùng nhóm lọc rõ nghĩa, giữ chỉ báo tổng số gắn với danh sách; tên phải là thông tin cố định. |
| [AFK Journey — screenshot Resonating Hall](https://reviewsbysupersven.com/wp-content/uploads/2024/10/Afk-Journey-1.png), [bài có ảnh](https://reviewsbysupersven.com/afk-journey-review/) | Khu vực hero được chia nhóm trên nền sáng đọc được; portrait có badge cấp và trạng thái đặt tại vị trí nhất quán. | Tách nền đọc thông tin khỏi background trang trí; badge trạng thái phải có vị trí và ý nghĩa ổn định. |

Đây là tư liệu các phiên bản khác nhau, không xác nhận UI mới nhất. Ảnh AFK được xem trực tiếp trong trình duyệt; tư liệu Steam và HoYoLAB đối chiếu qua kết quả ảnh và nguồn đã dùng ở vòng thiết kế trước. Các đề xuất dưới đây là suy luận thiết kế cho game này, không phải khẳng định game tham khảo có tất cả các tính năng đó. Không sao chép cơ chế sao, cấp hay phe từ game khác.

## Review từng thành phần

P1 = sửa ở vòng tiếp theo vì ảnh hưởng đọc hiểu hoặc thao tác chính. P2 = cải thiện độ nhất quán và chất lượng hoàn thiện. Các kích thước dưới đây là mục tiêu ở vùng thiết kế 1280×720, cần kiểm tra lại khi dựng thật.

### A. Bố cục, nền và chữ

**01 — Nền hồ sơ / P1.** Chữ bên phải đặt trực tiếp trên mái, hoa và chi tiết kiến trúc; độ tương phản phụ thuộc vị trí background. Thêm panel chàm gần đặc sau toàn bộ hồ sơ, padding 16px; giữ background rõ hơn ở vùng trống và portrait. Hiệu ứng cần đạt: đổi background vẫn đọc rõ HP, trạng thái và mô tả.

**02 — Hệ màu / P2.** Vàng đang biểu thị tên hero, lựa chọn, độ hiếm Legendary, mốc tiếp theo, Tinh Hồn 6 và CTA. Dành vàng cho CTA và thành tựu; dùng viền sáng trung tính cho hero đang chọn, nhãn màu riêng cho độ hiếm, badge riêng cho Tinh Hồn 6. Mỗi trạng thái có thêm hình/nhãn, không chỉ màu.

**03 — Cỡ chữ / P1.** Badge rarity 10px, trạng thái thẻ 11px và nhiều chú thích 12px hơi nhỏ. Mục tiêu: tên thẻ 14–15px, trạng thái 12–13px, nội dung hồ sơ 14–15px; tên hero 28–30px. Tăng độ sáng chữ phụ, giảm số dòng hướng dẫn lặp để có đủ diện tích.

**04 — Khoảng cách / P2.** Chuẩn hóa nhịp 8/16/24px cho nhãn, hàng thông tin và khoảng giữa nhóm. Giữ mép trái tên, mô tả, tab và footer cùng trục. Không tăng khoảng trống bằng cách giảm diện tích đọc của hồ sơ.

### B. Header và toolbar

**05 — Tiêu đề và bộ đếm / P2.** `Kho Hero` ở giữa, `Đã sở hữu 3/20` ở mép trái xa tiêu đề. Đưa bộ đếm thành dòng phụ cạnh tiêu đề của vùng bộ sưu tập; bộ đếm kết quả lọc nằm ngay phía trên lưới. Nhờ vậy người chơi phân biệt tổng sở hữu với số kết quả.

**06 — Nút quay về và tiền tệ / P2.** Dùng `nav_back` và icon tiền tệ sẵn có ở khoảng 20–24px, chữ số rõ; thống nhất với các màn hình khác. Tránh thêm icon trang trí cho mọi nhãn. Nút quay về có vùng bấm khoảng 40–44px cao.

**07 — Vị trí sắp xếp / P1.** Search/lọc ở trên lưới nhưng sort ở góc phải trên hồ sơ. Đặt sort trong header của lưới hoặc một hàng công cụ chung gắn rõ với lưới. Không ép bốn control vào 548px bằng cách làm chữ nhỏ; có thể dùng hàng phụ ngắn cho sort.

**08 — Tìm kiếm / P2.** Thêm nhãn `Tìm Hero`, icon tìm kiếm nhỏ và nút xóa query hiện khi có nội dung. Giữ tìm không dấu. Focus có viền đủ rõ; Enter không rời màn hình, Esc bỏ focus trước. Placeholder không phải nhãn duy nhất.

**09 — Bộ lọc sở hữu / P2.** Ba lựa chọn thường dùng nên thử nhóm nút `Tất cả · Đã sở hữu · Chưa sở hữu` để thấy trạng thái ngay. Tạm giữ dropdown nếu không đủ rộng. Khi đang lọc, hiện chip tóm tắt và `Xóa lọc` ngay cả khi còn kết quả; hiện tại reset nổi bật nhất khi kết quả rỗng.

**10 — Bộ lọc phe / P2.** Nhãn `Phe` nhưng lựa chọn mặc định `Tất cả các viện` không bao quát `Trung lập`. Đổi thành `Tất cả phe`; dùng đúng tên Viện cho từng lựa chọn. Có thể bổ sung vai trò từ `hero.archetype` vào hồ sơ trước, chỉ thêm lọc vai trò khi có nhãn chuẩn và nhu cầu thực tế.

**11 — Dropdown / P2.** Input/select native có thể mang menu và focus theo hệ điều hành. Đánh giá độ thống nhất trên Windows và trình duyệt đích; nếu giữ native, đồng bộ border, padding, font và focus với nút Phaser. Nếu làm control riêng, cần giữ thao tác keyboard và nhãn truy cập.

### C. Thẻ trong lưới

**12 — Crop portrait / P2.** Crop hiện lấy tâm ảnh, dễ cắt mất mặt/tóc với nhân vật có bố cục lệch. Đặt điểm neo riêng cho từng art và preview thẻ trước khi chốt. Mục tiêu là nhận ra mặt hero nhanh; portrait lớn có thể giữ crop khác với thumbnail.

**13 — Tên hero / P1.** `Thẩm Nguyệt H…` bị cắt; tooltip đã giúp nhưng hover không thuận tiện trên cảm ứng. Dùng tối đa 2 dòng, vùng tên có chiều cao cố định và tăng band chân thẻ vừa đủ. Giữ tên đầy đủ trong hồ sơ. Kiểm tra toàn bộ 20 tên ở cỡ thẻ cuối cùng.

**14 — Độ hiếm / P2.** Chữ `Legendary/Epic/Rare` nhỏ đặt trên art nhiều chi tiết, đồng thời khác ngôn ngữ với phần còn lại. Dùng badge nền gần đặc; chốt bộ nhãn độ hiếm thống nhất toàn game. Độ hiếm là dữ liệu riêng, không dùng số sao Tinh Hồn để biểu thị nó.

**15 — Hero chưa sở hữu / P1.** Art giảm alpha xuống 0.48 và bị tint khiến 17/20 hero trong tài khoản mới trông chìm. Thử mức sáng khoảng 65–75%, dùng lock nhỏ trên badge `Chưa sở hữu`; giữ tên đủ sáng. Người chơi vẫn nên muốn khám phá hero bị khóa.

**16 — Trạng thái chọn / P2.** Viền ngoài và dấu ✓ đã phân biệt được, nhưng cùng vàng với khung Tinh Hồn 6. Dùng viền sáng trung tính cho lựa chọn; Tinh Hồn 6 giữ khung vàng kèm dấu 6/6. Bố trí badge mở lá riêng để không chồng dấu chọn.

**17 — Chấm mở lá / P1.** Chấm vàng không cho biết số lượt và lời giải thích ở tận chân màn hình. Dùng badge có số lượt khi đủ chỗ, tooltip `Có 2 lượt mở lá`; CTA cũng hiện số tương ứng. Số lấy từ `pendingUnlocks`, không suy ra chỉ từ Tinh Hồn.

**18 — Tiến trình trên thẻ / P2.** `Tinh Hồn 0 / 6` lặp dài trên mỗi thẻ. Thử icon nhỏ + `0/6`; tooltip giải thích đầy đủ. Hero chưa sở hữu chỉ cần nhãn khóa, không cần một hàng sao rỗng giả tiến trình.

**19 — Hover và focus / P2.** Tile hiện có cursor và click nhưng thiếu phản hồi hover rõ ràng. Thêm tăng sáng nhẹ/border khi hover, focus riêng cho keyboard. Tránh phóng to làm thẻ đè hàng xóm. Hướng mũi tên chuyển focus, Enter chọn hero là cải thiện hữu ích cho desktop.

### D. Portrait lớn và thông tin đầu hồ sơ

**20 — Vai trò của portrait / P2.** Khối 270×478 tôn art tốt; giữ ở vòng này. Nếu text vẫn chật sau chỉnh typography, thử giảm rộng 20–30px để tăng hồ sơ. Không bỏ portrait lớn chỉ để chứa thêm lời hướng dẫn.

**21 — Xem art và đổi dạng / P1.** `Dạng thường / Thăng cấp` trên portrait có thể được hiểu là đổi trạng thái chơi, trong khi nó chỉ đổi ảnh. Đổi thành `Xem art: Thường | Thăng cấp`; hiện riêng `Dạng đang dùng: Liệt Hỏa/Bất Diệt` trong hồ sơ. Art `_up` hiện là art thăng cấp cơ bản, chưa phải art riêng của dạng thứ hai.

**22 — Nhãn trên art / P2.** `HỒ SƠ NHÂN VẬT` viền đen đặt trực tiếp lên vùng sáng, nhìn nặng và không mang thêm nhiều thông tin. Bỏ nhãn hoặc đặt trên một dải mỏng; đưa tên/dạng ảnh xuống chân portrait. Thử dùng segmented control nhỏ thay hai button lớn che chân art.

**23 — Tóm tắt hero / P1.** Hiện phe, độ hiếm và HP nhưng chưa nêu vai trò/lối chơi. Bổ sung vai trò từ dữ liệu sau khi có nhãn chuẩn, cùng một câu tóm tắt dựa trên nội dung hero được biên tập. Đây là nội dung mô tả mới cần duyệt; không suy ra vai trò bằng icon hoặc con số tự tạo.

**24 — Tinh Hồn ở header / P2.** Dòng `Tinh Hồn 0/6` và sáu sao đang lặp nhau. Gộp thành một nhóm ngắn với 6 dấu tiến trình hoặc nút đánh số, có tooltip từng mốc. Nút mốc dẫn sang tab Tinh Hồn tương ứng; trạng thái đạt/chưa đạt có thêm hình và nhãn.

### E. Tabs và nội dung hồ sơ

**25 — Hình thức tab / P2.** Ba tab đang giống ba button hành động. Dùng tab trên cùng một thanh, nhấn tab chọn bằng underline/fill nhẹ; CTA giữ hình khối đậm hơn. Bảo toàn việc chỉ nội dung bên dưới thay đổi.

**26 — Điều kiện thăng cấp / P1.** `Ngưỡng hiện tại: 15` chưa nói 15 gì. Hiện cả điều kiện và đơn vị lấy từ `levelUp.counter` và ngưỡng theo hồ sơ. Với Hoắc Liệt (`damageTaken`), có thể viết `Thăng cấp khi mất tổng 15 HP trong trận`; Tinh Hồn 2 hiển thị ngưỡng 11. Cần kiểm tra thuật ngữ cho từng counter trong rules trước khi biên tập toàn bộ hero.

**27 — Tab Tổng quan / P1.** Chia thành 3 khối: điều kiện thăng cấp, hiệu ứng dạng đang dùng, mốc Tinh Hồn tiếp theo. Tách số/keyword quan trọng bằng nhãn; rút câu hướng dẫn chung xuống tooltip trợ giúp. Khi hero chưa sở hữu, ghi rõ đây là thông tin xem trước ở tiến trình cơ bản.

**28 — Tab Tinh Hồn / P1.** Sáu mốc hiện là đoạn chữ nối tiếp rồi mới đến chọn dạng; hành động cần dùng có thể nằm dưới vùng cuộn. Dùng 6 hàng mốc với số và trạng thái; đặt nhóm chọn dạng ở đầu tab hoặc phần cố định có thể thấy ngay. Mốc 6 ghi rõ phần thưởng là khung, đúng dữ liệu hiện có.

**29 — Chọn dạng / P1.** Dùng hai thẻ lựa chọn có tên, trạng thái đang dùng và mô tả ngắn; khóa dạng thứ hai kèm `Cần Tinh Hồn 5`. Khi lưu, giữ vị trí panel, chỉ hiện trạng thái `Đang lưu…` tại nhóm này; khi thành công, xác nhận ngắn ngay bên lựa chọn. Lỗi có thể hiện tại nhóm để thử lại; giữ thông báo modal nếu cần cho lỗi toàn phiên.

**30 — Tab Lá chủ lực / P2.** Hàng text hiện ít gợi cảm giác game thẻ bài. Dùng thumbnail card qua renderer hiện có, cost, tên và nhãn `Đang dùng`/`Mở ở Tinh Hồn 4`. Ưu tiên thấy cả bản thường và bản + trong vùng tab; phần giải thích dài mở khi chạm.

**31 — Tooltip lá / P1.** Popup tạo ở x=582 với bề rộng khoảng 340, nhưng nút `Đóng lá` cố định ở x=1007; nút đóng nằm ngoài popup và dễ bị hiểu là control hồ sơ. Đặt X bên trong góc trên popup; Esc đóng popup trước, có thể click ngoài để đóng. Giữ khả năng xem lá bằng click/chạm, hover có độ trễ ngắn và đóng khi bắt đầu cuộn.

**32 — Vùng cuộn / P2.** Mask đã cắt đúng nhưng chỉ có chữ hướng dẫn và hai nút ▲/▼; chưa biết đang ở đâu. Thêm scrollbar với thumb phản ánh vị trí và gradient nhẹ ở cạnh còn nội dung. Vô hiệu nút khi đã tới đầu/cuối. Tooltip hover không nên khiến wheel toàn màn hình ngừng phản hồi.

### F. Footer, phân trang và trạng thái đặc biệt

**33 — CTA Tu Luyện / P1.** Giữ CTA vàng và vị trí cố định. Dùng `Tu Luyện · 2 lượt mở lá` khi có lượt; với hero chưa sở hữu, đưa Triệu Hồi thành hành động nổi bật hơn và giữ lý do Tu Luyện bị khóa ngay bên nút. Không viết `Nhận Hero này` nếu Triệu Hồi không bảo đảm hero được chọn.

**34 — Kích thước nút / P1.** Scene truyền height 42/fontSize 15 cho CTA, nhưng `addButton` hiện vẫn tạo rectangle cao 34 và text 13; option chưa được áp dụng. Muốn CTA lớn thực sự cần widget hỗ trợ hoặc variant dùng riêng cho màn này. Mục tiêu vùng bấm 40–44px ở design size, không chỉ tăng khung vẽ.

**35 — Phân trang / P2.** Hai nút rộng chiếm đáng kể chân lưới; wheel trên lưới lại đổi trang mà không có gợi ý. Với 20 hero, dùng `‹ 1 2 ›` và bộ đếm kết quả. Chọn rõ một mô hình: giữ phân trang bằng control, hoặc chuyển sang cuộn liên tục; tránh wheel đổi trang liên tiếp theo từng sự kiện nhỏ.

**36 — Khi chọn hero bị lọc khỏi lưới / P2.** Giữ hồ sơ là quyết định hợp lý nhưng dễ mất liên hệ với kết quả. Hiện nhãn nhỏ `Hero đang xem nằm ngoài bộ lọc` kèm `Hiện trong danh sách`, hoặc ít nhất giữ tên lựa chọn ở phần tiêu đề hồ sơ. Không âm thầm đổi hero đang xem.

**37 — Trạng thái rỗng và thiếu ảnh / P2.** Rỗng: nêu tiêu chí không khớp và đưa `Xóa lọc` rõ ràng; bộ lọc đang hoạt động vẫn nhìn thấy. Thiếu ảnh: giữ tên/độ hiếm/tiến trình, dùng silhouette hoặc nền phe thay glyph ❖ như art hoàn chỉnh. Nếu lỗi mạng, phân biệt `Chưa tải được ảnh` với `Chưa sở hữu`.

**38 — Viewport nhỏ / P2.** Kiểm tra trước tiên 1280×720, 1366×768 và 1920×1080, thêm mức scale trình duyệt thường dùng. Nếu hỗ trợ màn hẹp, cần layout riêng lưới → hồ sơ thay vì thu nhỏ mọi chữ. Screenshot ở nhiều tỷ lệ không đồng nghĩa đã có trải nghiệm mobile; đây là hạng mục riêng nếu được chọn.

## Assets và công sức

- Dùng lại 20 art thường và 20 art thăng cấp; chỉnh focal point/crop bằng trình bày, chưa cần vẽ lại art.
- Dùng lại `nav_back`, `nav_mastery`, `nav_banners`, `cur_moonJade`, `cur_moonStar`, `cur_honor`, `lock`, `check` ở kích thước đọc được. Các icon có nhiều họa tiết vàng; không thu icon 256px xuống 8–12px để biểu thị tiến trình.
- Frame, tab, scrollbar, focus ring, pip tiến trình và gradient nên dựng bằng Phaser để dễ điều chỉnh và sắc nét; không cần ImageGen cho các phần này.
- Dùng renderer card hiện có cho thumbnail và popup lá.
- Chỉ cân nhắc gen thêm khi đã xác định thiếu asset cụ thể: art riêng cho dạng thứ hai hoặc placeholder có art direction thống nhất. Chưa cần gen ở vòng cải thiện này.

## Thứ tự thực hiện đề xuất

1. **Đọc và hiểu:** panel nền, typography, tên hero 2 dòng, trạng thái khóa, điều kiện thăng cấp có ngữ cảnh, phân biệt xem art/đổi dạng.
2. **Thao tác:** gom toolbar, chọn dạng dễ thấy, nút đóng trong popup, CTA có số lượt, vùng bấm thực sự lớn hơn, scrollbar.
3. **Hoàn thiện:** crop theo hero, badges, icon, tab style, hover/focus, trạng thái lựa chọn ngoài bộ lọc và nội dung phụ.

Hai hướng khác để cân nhắc: lưới rộng mở hồ sơ riêng giúp thẻ lớn hơn nhưng tăng số lần mở/đóng; danh sách portrait nhỏ giúp hồ sơ rộng hơn nhưng giảm khả năng nhìn bộ sưu tập. Với 20 hero và assets hiện có, giữ ba vùng rồi cải thiện các điểm trên có phạm vi hợp lý nhất.

## Tiêu chí đánh giá vòng UI tiếp theo

- Đọc đầy đủ 20 tên và nhận ra hero chưa sở hữu mà không cần hover.
- Khi tìm/lọc/sắp xếp, biết đang có bao nhiêu kết quả và hero nào đang được xem.
- Khi nhìn hồ sơ, hiểu điều kiện thăng cấp và dạng đang dùng mà không cần mở tab khác.
- Tại Tinh Hồn 5, nhìn thấy thao tác chọn dạng ngay khi mở tab.
- Mô tả dài và popup không che CTA; người chơi đóng popup bằng control gắn với popup.
- Đạt cỡ chữ và vùng bấm đã chọn ở các viewport đích; keyboard và cảm ứng có cách tiếp cận tương đương hover.
- Các mục trên là tiêu chí để kiểm thử thiết kế, chưa phải kết quả đã đạt của màn hình hiện tại.
