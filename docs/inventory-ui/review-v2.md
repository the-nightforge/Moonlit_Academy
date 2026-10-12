# Review chi tiết UI Kho đồ — vòng 2

Ngày 12/10/2026. Đối tượng review: bản đã triển khai tại commit `037104a`, nhánh `codex/inventory-ui`. Đây là đề xuất cải thiện tiếp theo; chưa sửa mã sản phẩm ở vòng này.

## Kết luận và mục tiêu

Giữ bố cục lưới bên trái, chi tiết bên phải. Ưu tiên làm rõ trạng thái chọn, tăng khả năng nhận diện vật phẩm, và đặt lợi ích nâng cấp sát chi phí. Thành công là người chơi trả lời được ba câu hỏi: “Mình có món nào?”, “Món này làm gì / đang dùng ở đâu?”, “Nâng cấp này đổi gì và tiêu bao nhiêu?”.

Phạm vi là màn Kho đồ hiện có với 25 Binh Khí, 16 Nguyệt Bảo, Tinh Luyện/Cộng Minh 1–5, trang bị theo bộ bài. Tận dụng art và icon trong repo. Những đánh giá về độ dễ đọc dưới đây là nhận định thiết kế từ ảnh/code, chưa phải kết quả nghiên cứu người dùng.

Điểm tốt cần giữ: tìm không dấu; bộ lọc/trang/lựa chọn riêng cho hai nhóm; tên không bị art che; xem toàn bộ art; preview cấp không thay cấp sở hữu; chi phí lấy từ rules; footer nâng cấp cố định; chống gửi trùng; cập nhật profile sau phản hồi muộn; deck link mở bản sao để chỉnh sửa. Các lỗi mask vùng chi tiết và phản hồi nâng cấp muộn đã được sửa ở vòng trước, không tính là lỗi còn tồn tại.

## Bằng chứng và game tham khảo

| Nguồn | Đã quan sát / độ tin cậy | Điều học được và cách áp dụng |
| --- | --- | --- |
| [Honkai: Star Rail — Inventory / Light Cones](https://imgix.bustle.com/uploads/image/2023/5/9/4834c05f-88c9-40c4-87b6-6a63f23317c7-light-cones.jpg), [bài chứa ảnh](https://www.inkl.com/news/honkai-star-rail-superimpose-guide-how-to-make-your-light-cones-more-powerful) | Đã mở và xem trực tiếp ảnh 2023. | Màu nền độ hiếm, cấp ở một vị trí cố định, viền chọn sáng và portrait người dùng đồ giúp quét lưới. Panel phải có tên, điều kiện hiệu lực, hiệu ứng với số được nhấn màu, hành động ở đáy. Áp dụng thứ bậc và dấu sử dụng; không sao chép số chỉ số, sức chứa, khóa hay salvage. |
| [AFK Journey — Equipment / Forge](https://www.talkandroid.com/81779-equipment-guide-afk-journey-afk2/), [ảnh Forge](https://www.talkandroid.com/wp-content/uploads/2024/03/Forge-equipment-in-afk-journey-461x1024.jpg) | Đã mở và xem trực tiếp ảnh trong bài 13/03/2024. | Hai phía hiện tại / sau nâng, giá và CTA nằm trong cùng hộp. Áp dụng “Tinh Luyện 3 → 4”, hiệu ứng thay đổi và giá sát nhau. Hệ theo class và tái chế đồ khác Vọng Nguyệt, không đưa vào đề xuất. |
| [Genshin Impact — ảnh kho vũ khí trên HoYoLAB](https://www.hoyolab.com/article/27128157), [ảnh được lập chỉ mục](https://upload-os-bbs.hoyolab.com/upload/2024/04/13/382835893/cb7e61e565349d18836ddcafce5869ed_3902331970328733674.jpg) | Tìm được qua image search; trang/ảnh trực tiếp không tải được. Chỉ dùng bố cục tổng quát từ ảnh lập chỉ mục, độ tin cậy thấp hơn hai nguồn trên. | Art + cấp + độ hiếm theo vị trí nhất quán, grid đi cùng panel món đang chọn. Không lấy ý nghĩa icon khóa từ mô tả của công cụ tìm kiếm, vì khóa đồ và chưa sở hữu là hai trạng thái khác nhau. |

Các ảnh này là ví dụ thiết kế ở thời điểm chụp, không đại diện cho UI mới nhất năm 2026. Mọi đề xuất bên dưới là suy luận thiết kế cho Vọng Nguyệt, không phải tuyên bố rằng game tham khảo có chính xác các tính năng đó.

Đã đối chiếu 4 ảnh sản phẩm `production-weapons.png`, `production-relics.png`, `production-card.png`, `production-art.png` với `armory-scene.ts`, `equipment-presentation.ts`, `equipment-art.ts`, `widgets.ts`, `card-tooltip.ts`, `attack-style.ts` và dữ liệu weapons/relics. Ảnh dùng tài khoản fixture (96 Huyền Thiết, 18 Nguyệt Trần), không phải dữ liệu người chơi. Đoạn nội tại lặp nhiều lần ở nền ảnh art là fixture kiểm tra overflow (`repeat(30)` trong e2e), không phải lỗi nội dung dữ liệu thật.

## Cách đọc ưu tiên

- **P1:** ảnh hưởng trực tiếp việc hiểu trạng thái hoặc quyết định nâng cấp; nên làm trước.
- **P2:** giảm thao tác, tăng dễ đọc và nhất quán; làm sau khi P1 ổn.
- **P3:** hoàn thiện thẩm mỹ, chuyển động; không cần để giải quyết tác vụ chính.
- **Giữ:** đã phù hợp, kiểm tra lại khi thay layout.

P1 ở đây là mức ưu tiên thiết kế, không phải mức nghiêm trọng của lỗi server hay bảo mật. “Quan sát” có ảnh/code làm bằng chứng; “cần thử” là giả thuyết chưa kiểm tra trên thiết bị hoặc người dùng.

## Review 50 phần UI nhỏ

### A. Khung màn hình, header và danh mục

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 01 | **Background:** dùng art Home dưới lớp tối; phần grid vẫn nhìn rõ cảnh, nhất là lúc còn một kết quả. | Giữ art, thêm nền navy thống nhất dưới vùng collection; giảm chi tiết cảnh ở khu vực đọc. Chỉ để cảnh tạo không khí ở rìa. | P2 |
| 02 | **Hệ viền:** Quay lại, tab chưa chọn, nút art, số trang và CTA cùng có vàng. | Vàng cho CTA chính và dấu đang chọn; viền hành động phụ xanh xám. Độ hiếm dùng dải màu riêng, không biến toàn bộ vật phẩm legendary thành nút hành động. | P1 |
| 03 | **Tên màn và phụ đề:** “Kho đồ”, “Binh Khí & Nguyệt Bảo” đã đúng; phụ đề lặp tên tabs. | Giữ tên 27–28px; phụ đề có thể đổi thành “Bộ sưu tập trang bị”. Không tăng thêm hàng header. | P3 |
| 04 | **Quay lại:** nút rộng 116px, có `nav_back` nhưng chưa dùng. | Dùng icon mũi tên sẵn có + nhãn; viền trung tính. Giữ target Home (`deck-select`) hiện tại. | P2 |
| 05 | **Vật liệu ở header:** icon/name/value rõ, nhưng cả hai luôn giống mức nổi bật. | Làm sáng vật liệu của danh mục đang xem; vật liệu còn lại dịu hơn. Có tooltip tên; số lớn định dạng phân tách, không cắt sát mép phải. | P2 |
| 06 | **Tabs Binh Khí / Nguyệt Bảo:** DOM button sáng hơn khi active, nhưng khác ngôn ngữ panel tabs. | Chuẩn hóa selected bằng nền sáng vừa, chữ sáng, underline vàng. Dùng icon category kiểu vector nếu cần; vẫn giữ nhãn chữ. | P1 |
| 07 | **Đếm sở hữu:** `3/25 sở hữu`, `2/16 sở hữu` là count loại, không phải số bản hay dung lượng. | Viết “Binh Khí · Đã có 3/25”; tooltip giải thích là số loại đã có. Dữ liệu đếm giữ nguyên. | P2 |

### B. Tìm, lọc và sắp xếp

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 08 | **Search:** tìm không dấu hoạt động; placeholder mô tả kỹ thuật nhập liệu. | Placeholder “Tìm trang bị…”; icon kính lúp vector, giữ tìm không dấu. Dùng nút xóa query rõ khi có chữ; giữ ô focus sau render. | P2 |
| 09 | **Rarity dropdown:** “Mọi độ hiếm” rõ, nhưng phân loại chỉ màu ở tile. | Menu dùng tên độ hiếm đầy đủ; kết quả luôn có nhãn/mã độ hiếm. Chữ đủ đọc khi dropdown có giá trị dài. | P2 |
| 10 | **Sort:** lựa chọn “Độ hiếm” chưa nói chiều, “Sở hữu trước” không thể hiện tie-break theo tên. | “Hiếm cao → thấp”, “Cấp cao → thấp”, “Tên A–Z”, “Đã có trước”. Không tự đổi thuật toán theo tên nhãn mới. | P2 |
| 11 | **Ownership chips:** bốn nút có chữ rõ; nâng được chỉ thể hiện điều kiện tài nguyên/online, không có số. | Thêm số vào nhãn: “Đã có (3)”, “Nâng được (2)”. Count xét query + rarity, trước ownership; tránh count tự co về chính kết quả đã lọc. | P2 |
| 12 | **Bộ lọc có tác dụng:** đổi query/rarity xong không có mô tả tóm tắt; clear tận đáy. | Dòng “Hiển thị 1/25 · Truyền thuyết · Đã có”; nút “Xóa lọc” gần toolbar, có thể giữ clear ở empty state. Không thêm hàng chip dài tràn grid. | P2 |
| 13 | **Reset:** “Xóa lọc” hiện reset cả sort về mặc định, dễ bất ngờ. | Tách ý nghĩa: “Xóa lọc” xóa query/rarity/ownership và giữ sort; muốn reset sort thì dùng “Đặt lại tất cả”. Ghi rõ hành vi được chọn. | P2 |
| 14 | **Lọc Nâng được khi offline:** helper `enabled` false làm kết quả rỗng, có thể giống không đủ vật liệu. | Hiển thị giải thích “Đang mất kết nối; kết nối lại để kiểm tra nâng cấp”. Không đánh đồng với thiếu nguyên liệu; không cho thao tác nâng offline. | P1 |

### C. Tile vật phẩm và điều hướng grid

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 15 | **Thumbnail:** khung art 132×76, art dọc contain thành hình chỉ khoảng 50px ngang; nhiều món có nền hoa/cảnh giống nhau. | Tăng vùng art dọc lên khoảng 90–100px cao trong tile 144×148–152 (mốc thử nghiệm), tiết kiệm khoảng trống toolbar để giữ 4×3. Contain toàn ảnh; không kéo giãn/cắt vũ khí. Nếu vẫn khó nhận diện mới cân nhắc thumbnail riêng cho món khó nhất. | P1 |
| 16 | **Rarity dot:** chấm bán kính 4px, không có tên trong tile. | Thêm dải dưới art hoặc đường viền góc mang màu rarity + nhãn rút gọn có tooltip; màu không phải dấu hiệu duy nhất. Không dùng sao vì rarity hiện là 4 loại, không phải cấp sao. | P1 |
| 17 | **Tên:** 13px, xuống 12px nếu cao; có full name ở panel. | Giữ tên ngoài art, tối đa 2 dòng; thống nhất 13–14px ở desktop. Trường hợp tên dài dùng ellipsis có tap/hover để đọc đủ thay vì giảm chữ từng món. | P2 |
| 18 | **Cấp:** “Tinh Luyện 3/5” ở cùng baseline là đúng, nhưng dài cho tile. | Tile có “TL 3/5” / “CM 2/5” kèm tooltip đầy đủ; panel giữ thuật ngữ đầy đủ. Không đổi nhãn thành Lv. để tránh lẫn với cấp Hero. | P2 |
| 19 | **Badge nâng được/tối đa/chưa có:** font 10px đè góc art; `Chưa có` lặp dòng dưới. | Dành vị trí badge cố định ngoài chủ thể art. “↑ Nâng được” chỉ món đủ điều kiện; “Tối đa” trung tính; trạng thái chưa có chỉ viết một lần. | P2 |
| 20 | **Chưa sở hữu:** art alpha 0.65 nhưng card/frame vẫn gần giống owned. | Giảm saturation hoặc phủ lớp dịu, thêm “Chưa có” đọc được; giữ art nhận diện. Icon khóa nếu dùng phải có chú thích, không gợi một chức năng khóa đồ chưa tồn tại. | P2 |
| 21 | **Selected vs keyboard focus:** chọn có viền bạc, focus có viền vàng; sau click hai viền cùng xuất hiện. | Selected = một viền vàng + check nhỏ; focus = vòng sáng ngoài có khoảng cách. Hover = nâng sáng nền. Không chồng hai khung cạnh sát nhau. | P1 |
| 22 | **Tooltip hover tile:** lặp lại tên/rarity, bật ngay khi rê. | Delay ngắn khoảng 250–350ms để tránh chớp lúc di chuột qua grid; dùng để đọc tên đầy đủ, không che hàng kế. Chạm chọn vẫn đọc được panel. | P3 |
| 23 | **Trang và số kết quả:** trang hiện tại dùng `enabled=false`, nên có giao diện disabled giống nút mũi tên bị chặn. | Trang hiện tại là selected sáng/chữ rõ; mũi tên đầu/cuối mới dùng disabled. Có “Trang 1/3 · 25 kết quả”. Giữ số trang gọn với 25/16 món. | P1 |
| 24 | **Selection ngoài kết quả/trang:** giữ đúng món đang xem, nhưng “Đang xem” vẫn xuất hiện khi món nằm trang khác; chỉ kiểm tra toàn bộ filtered list. | Nếu ngoài filter: banner “Món đang xem nằm ngoài bộ lọc” + “Xóa lọc”. Nếu cùng filter nhưng khác trang: “Đang xem món ở trang 1” + “Đến món”. Không tự đổi selection sau khi người chơi đang xem preview. | P2 |

### D. Header chi tiết, artwork và ngữ cảnh dùng đồ

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 25 | **Tên và rarity detail:** tên 25px nổi bật, rarity luôn màu vàng dù món rare/epic. | Giữ tên; màu nhãn rarity theo loại, thêm icon category nhỏ. Tên dài có tap để đọc đủ, không chỉ hover. | P2 |
| 26 | **Owned level / đang xem:** “Tinh Luyện 3/5” và “Đang xem” có cùng mức chữ nhỏ. | Badge “Đã có · Tinh Luyện 3/5” ổn định; bỏ “Đang xem” nếu không có cảnh báo cần nói. Preview level là trạng thái khác, ở khu nội dung. | P2 |
| 27 | **Detail tabs:** tab active gọi `addButton(..., enabled=false)`; chữ mờ, trong khi tabs inactive có viền vàng. Quan sát được cả weapons/relics. | Dùng `addTab` có sẵn hoặc tab style tương đương: active chữ sáng + underline vàng; inactive nền phẳng/viền xám. Không dùng disabled để biểu diễn selected. | P1 |
| 28 | **Art lớn trong panel:** vùng 186×200 dùng contain nên hình dọc khoảng 133px rộng, còn khá nhiều khung rỗng. | Tăng tỷ lệ khung sang portrait (ví dụ 178×240), cân lại metadata dưới; toàn vật phẩm nhìn được. Không hi sinh chiều rộng text dưới 330px chỉ để art lớn. | P2 |
| 29 | **Nút Xem art:** button riêng lặp affordance hình, toàn bộ ảnh chưa clickable. | Cho click/tap art để mở, thêm icon phóng ở góc và nhãn nhỏ “Phóng to”; có hit area tối thiểu khoảng 44px. Giữ nhãn text cho khả năng khám phá. | P2 |
| 30 | **Bản mệnh Hero:** portrait 24×30 rất nhỏ, tên và giải thích chung tách 3 dòng. | Một chip portrait 32–36px + “Bản mệnh: Hoắc Liệt”; dưới là lợi ích bản mệnh cụ thể ở cấp đang xem. Phân biệt bản mệnh với Hero thực tế dùng món trong deck. | P2 |
| 31 | **Nguyệt Bảo context:** câu 2-slot/mọi trận quan trọng nhưng font nhỏ ở cột art. | Giữ một câu ngắn “Nguyệt Bảo dùng cho cả đội · tối đa 2 món/bộ bài”, định nghĩa đầy đủ ở tooltip/info. Không biến thành equip toàn tài khoản. | P2 |

### E. Hiệu ứng, cấp xem trước và lịch sử cấp

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 32 | **Cấp xem trước 1–5:** cấp chọn bị mờ vì dùng disabled; không đánh dấu cấp sở hữu trên từng mốc. | Segmented control: cấp đang xem sáng, cấp sở hữu có dấu “Đã có”/check. Nhãn “Xem trước TL 5”; nút “Về cấp đang có”. Tất cả mốc vẫn xem được, không khóa preview theo sở hữu. | P1 |
| 33 | **Binh Khí card vs nội tại:** tên lá bài, cost/copies, text, nâng tiếp và lịch sử nội tại cùng một luồng paragraph. | Tách block “Lá Binh Khí” và “Nội tại”; cost thành chip, copies thành “2 lá trong bộ bài”. Giúp hiểu copies là số lá chiến đấu, không phải bản trang bị để nâng. | P1 |
| 34 | **Nội tại gốc + changes:** trình bày an toàn theo dữ liệu nhưng người chơi phải tự tổng hợp, nhất là TL5. | Mặc định nội tại hiệu lực ở cấp đang xem; lịch sử gốc/các thay đổi ở accordion. Chỉ tạo tóm tắt khi dựng được từ hooks/signatureHooks; chưa có resolver chuẩn thì vẫn giữ base + changes với nhãn rõ, không lấy refinement prose cuối thay toàn bộ nội tại. | P1 |
| 35 | **Lợi ích nâng:** hiện “NÂNG 3 → 4” trong vùng scroll, xa footer; bị cuộn khỏi màn ở tab Các cấp/Sử dụng. | Hộp cố định ngay trên chi phí: “TL3 → TL4 · Sát thương 7 → 9 (+2)”. Relic CM2→3: “Giáp cả đội mỗi lần trăng đổi pha: 3 → 4”. Dùng cấp sở hữu làm gốc dù preview là TL5. | P1 |
| 36 | **Nhấn số / từ khóa:** mọi prose hầu như cùng màu, “damage” trộn tiếng Anh. | Nhấn số thay đổi và keyword với màu/chip vừa phải; thống nhất “sát thương” ở lớp trình bày khi có bản dịch đúng. Dùng glossary trong data; không sửa rules bằng thay chuỗi mù. | P2 |
| 37 | **Tab Các cấp:** weapon lặp full card và base ở từng cấp; relic đã có câu “thay thế toàn bộ”. | Timeline 5 mốc, current/đã đạt/future khác hình; mặc định mỗi mốc chỉ delta, mở rộng để đọc full hiệu ứng. Relic vẫn nhắc thay thế, không mô tả như cộng dồn. | P2 |
| 38 | **Scroll:** thanh 4/6px và nút ▲▼ 34×30; dấu “Cuộn để xem thêm” luôn khá nhỏ. | Vùng kéo trong suốt rộng 20–24px quanh thumb; nút chạm khoảng 44px; fade đáy chỉ khi còn nội dung bên dưới. Giữ mask/hit clipping và footer đã đúng. | P2 |

### F. Nâng cấp và trạng thái hành động

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 39 | **Chi phí:** `96 / 65` chưa tự giải thích thứ tự; tên vật liệu và cấp ở phía trái. | “Cần 65 Huyền Thiết” nổi bật cạnh CTA; dòng nhỏ “Đang có 96 · Còn 31 sau nâng”. Thiếu thì “Thiếu 14”, không chỉ đỏ tỷ lệ. Dùng giá từ helper/server, không hardcode ví dụ. | P1 |
| 40 | **Nút Nâng Cấp:** rộng 462px, nằm ổn định nhưng nhãn chung kể cả preview cấp khác. | “Nâng lên Tinh Luyện 4” / “Nâng lên Cộng Minh 3”. Một click = một cấp, target luôn owned+1; busy giữ chiều rộng, dùng “Đang nâng…”. Không thêm nâng tất cả ở vòng này. | P1 |
| 41 | **Triệu Hồi:** xuất hiện cạnh Nâng Cấp cho cả món đã có; kéo chú ý khỏi tác vụ. | Món đã có: hành động phụ nhỏ/outline. Món chưa có: panel nói “Chưa sở hữu”, CTA Triệu Hồi là chính, nâng chỉ là thông tin. Không hứa chắc banner sẽ cho đúng món nếu chưa xác minh loot pool. | P2 |
| 42 | **Feedback nâng / lỗi:** toast có tên món nhưng không nêu cấp/chi phí kết quả; lỗi dùng errorText. | Thành công “Xích Diệm Thương · TL3 → TL4”, nhấn cấp mới và delta. Lỗi gần footer + thử lại khi phù hợp, không chỉ toast biến mất. Giữ chống trùng và đồng bộ profile đã có. | P2 |
| 43 | **Max / unowned / offline / thiếu / busy:** reason đã có nhưng CTA vẫn ghi Nâng Cấp ở max/unowned. | Nhãn theo trạng thái: “Đã tối đa”, “Chưa sở hữu”, “Cần kết nối”, “Thiếu nguyên liệu”, “Đang nâng…”. Lý do đọc được ngay; không cần hover để biết. | P1 |

### G. Deck đang dùng, popup và hỗ trợ nhập liệu

| # | Phần UI / hiện trạng | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 44 | **Tab Sử dụng:** truy vấn deck thật, tên/hero và mở deck; từ “Sử dụng” khá chung, không có count ở tile. | Đổi “Bộ bài (2)”; danh sách có portrait Hero đang mang + deck name. Tile có “Dùng trong 2 bộ bài” hoặc icon/count. Một món có thể nằm nhiều deck, không dựng một equipped owner toàn cục. | P2 |
| 45 | **Đi tới deck:** mở `structuredClone`, đúng; quay về Kho đồ phải qua Home, không có context truyền. | Deep link tới đúng slot trang bị trong deck builder; có đường “Về Kho đồ” bảo toàn query/tab/selected. Đây là thay đổi phối hợp điều hướng cần test; giữ copy deck và hành vi lưu hiện tại. | P2 |
| 46 | **Popup lá bài thiếu emblem:** ảnh có ô xanh/đen ở góc phải; preload Kho đồ chỉ tải `card_*`, `kw_*` và vài icon, còn `cardIconOf` có thể trả `ui:intent_attack`, `ui:moon_full`, `ui:seal`... | Preload đầy đủ key có thể được card renderer dùng từ assets sẵn có; fallback khi texture thiếu. Test vào Kho đồ từ phiên mới chưa ghé Combat, kiểm tra texture và screenshot, không chỉ pageerror. | P1 |
| 47 | **Popup card context:** body gắn tên Hero bản mệnh, dễ hiểu nhầm lá chỉ dùng bởi Hero đó; cấp xem trước ở dòng cuối. | Header popup “Liệt Diệm · Xem TL3”; metadata “Bản mệnh Hoắc Liệt” riêng, không coi là người mang hiện tại. Thêm nút close có hit area 44px; giữ keyword glossary. | P2 |
| 48 | **Popup art:** mở toàn ảnh, nút đóng và Esc tốt; chưa có tên/rarity, popup bắt đầu khá cao. | Header nhỏ tên món, close góc + Esc, footer gọn; contain toàn art và fit vào visibleWorld ở cả cửa sổ thấp. Không lấy phần text lặp trong fixture làm lý do sửa data. | P2 |
| 49 | **Keyboard / accessibility:** arrows/Enter hoạt động trên canvas; HTML có aria-label nhưng grid/tabs/actions phần canvas không có tên DOM tương đương; ArrowLeft/Right hiện dịch tuyến tính nên có thể sang hàng khác. | Focus rõ và chỉ dẫn ngắn; xác định wrap theo hàng hay tuyến tính rồi áp nhất quán. Bổ sung DOM semantic đồng bộ cho controls quan trọng và live status số kết quả/nâng; test keyboard Tab có thể tới CTA. Không coi thêm aria cho search là hoàn tất accessibility. | P2 |
| 50 | **Cửa sổ nhỏ/touch/chuyển động:** layout cố định 1280×720; resize e2e chỉ chứng minh ô search nằm trong màn, chưa đo toàn grid/CTA. | Cần thử 1280×720, 900×650 và landscape thấp; không kết luận đã lỗi cắt màn chỉ từ code. Nếu chữ/hit quá nhỏ, chuyển master/detail hoặc drawer. Sau đó thêm chuyển selection nhẹ 100–150ms và tôn trọng giảm chuyển động; không animation làm trì hoãn nâng. | P2 cho viewport, P3 cho motion |

## Phương án thiết kế đề xuất

**A — chỉnh thứ bậc trên layout hiện có (khuyến nghị):** giữ 4×3, panel phải và API; sửa tab/page/preview states, tăng khả năng nhận diện tile, hợp nhất lợi ích và giá nâng, sửa preload icon. Tận dụng toàn bộ 41 artwork. Hiệu quả trực tiếp với phạm vi thay đổi nhỏ nhất.

**B — lưới tile art lớn hơn, 3 cột:** nhìn art tốt hơn nhưng tăng số trang và giảm khả năng so sánh nhiều món; chỉ chọn nếu thử A vẫn không nhận diện tốt.

**C — màn danh sách và detail drawer riêng khi hẹp:** phù hợp cửa sổ nhỏ/touch, nhưng cần điều hướng, back/focus và bảo toàn trạng thái mới. Chỉ làm khi xác nhận thiết bị/cửa sổ mục tiêu yêu cầu.

Wireframe chữ cho A; đây là sơ đồ thứ bậc, chưa phải mockup pixel đã kiểm thử:

```text
‹ Quay lại     Kho đồ                          Huyền Thiết   Nguyệt Trần
[Binh Khí · Đã có 3/25] [Nguyệt Bảo · Đã có 2/16]
[Tìm trang bị…] [Mọi độ hiếm] [Đã có trước]
[Tất cả] [Đã có (3)] [Nâng được (2)] [Chưa có]

┌ LƯỚI 4×3 ───────────────────┐ ┌ Xích Diệm Thương · Truyền thuyết ──────┐
│ art portrait chứa toàn món │ │ Đã có · Tinh Luyện 3/5                 │
│ tên / rarity / cấp         │ │ [Hiệu ứng] [Các cấp] [Bộ bài (2)]      │
│ dấu chọn + dấu đang dùng   │ │ art       Xem cấp [1][2][3][4][5]       │
│                           │ │ bản mệnh  Lá Binh Khí · Nội tại        │
│                           │ │           chi tiết/glossary cuộn       │
│                           │ ├───────────────────────────────────────┤
│ kết quả / trang / xóa lọc   │ │ TL3 → TL4 · Sát thương 7 → 9 (+2)      │
└───────────────────────────┘ │ Cần 65 Huyền Thiết · Có 96 · Còn 31   │
                              │ [Nâng lên Tinh Luyện 4] [Triệu Hồi]    │
                              └───────────────────────────────────────┘
```

Số “Bộ bài (2)” và count nâng trong sơ đồ là minh họa layout, phải tính từ profile thật khi triển khai. Delta Xích Diệm Thương và giá 65/96 dựa trên dữ liệu/fixture được quan sát; không dùng làm giá cố định cho mọi profile/món.

## Assets: tận dụng trước, tạo mới có điều kiện

| Nhu cầu | Có sẵn / hướng xử lý |
| --- | --- |
| Art món | 25 weapons + 16 relics; dùng cùng file ở tile/detail/full view với contain. |
| Chi phí | `cur_darkIron.webp`, `cur_moonDust.webp`. |
| Điều hướng / feedback | `nav_back.webp`, `action_close.webp`, `action_edit.webp`, `action_reset.webp`, `check.webp`, `lock.webp`; icon khóa cần nhãn đúng ý nghĩa. |
| Card emblem | `intent_attack.webp`, `intent_special.webp`, `moon_full.webp`, `moon_blood.webp`, `seal.webp`, `shield.webp`, nhóm status icon. Có file, thiếu ở preload chứ không thiếu artwork. |
| Glossary | Toàn nhóm `kw_*`; tái dùng trong popup/tooltip. |
| Search, filter, zoom, category | Dùng SVG hoặc nét code phù hợp hệ icon; đây là hình đơn giản, chưa cần gen raster. |
| Thumbnail riêng | Chưa cần tạo. Nếu thử vùng art lớn vẫn không nhận diện được một số món: lập danh sách cụ thể, tạo derivative từ art gốc, giữ thiết kế vật phẩm; kiểm tra nhỏ trước khi tạo cả bộ. |

## Thứ tự triển khai và tiêu chí chốt

1. **P1: trạng thái selected và asset lỗi** — #02, #06, #21, #23, #27, #32, #46. Kiểm tra ảnh active/inactive/disabled/focus cạnh nhau; entry mới không có missing texture.
2. **P1: quyết định nâng** — #14, #33–35, #39–40, #43. Thấy cấp sở hữu, delta, giá và trạng thái cùng lúc ở cả ba detail tabs. Preview TL5 không đổi giá/target TL3→4. Tóm tắt nội tại phải đối chiếu hooks; chưa làm được không che bản gốc.
3. **Nhận diện và tác vụ phổ biến** — #15–20, #08–13, #24–26, #28–31, #36–38, #41–45, #47–48. Giữ 4×3 nếu vùng art lớn và text vẫn đủ; test tên dài, 0/1/12/25 kết quả và cùng món trên nhiều deck.
4. **Thiết bị/nhập liệu** — #49–50. Kiểm tra toàn bộ bounds và thao tác trên viewport nhỏ, không chỉ ô search; keyboard focus, Tab tới action, touch mở/đóng popup và cuộn. Sau đó mới polish #01, #03–05, #07, #22 và motion.

Các case phải giữ: owned TL1–4, max TL5, chưa có, đủ/thiếu vật liệu, offline, request pending, lỗi server, phản hồi thành công sau rời/re-enter scene, preview khác owned, query giữ nguyên, item rời khỏi filter sau nâng, modal mở khi resize, tên dài, prose dài và deck link không sửa bản đã lưu. Kiểm tra pixel giúp bắt missing icon và selected dùng style disabled mà kiểm tra pageerror không bắt được.

Tiêu chí thử với người chơi: chỉ đúng tab/cấp đang xem trong vài giây; nhận diện món theo art/tên mà không mở từng popup; nói đúng “nâng cấp nào, tăng gì, tiêu gì, còn bao nhiêu” trước khi click. Đây là mục tiêu thử nghiệm, chưa có số đo hoàn thành tác vụ để khẳng định tăng hiệu quả.

## Các điểm chạm mã dự kiến

- `apps/client/src/scenes/armory-scene.ts`: preload, states và layout, tile/tab/preview/footer/popup.
- `apps/client/src/ui/widgets.ts`: đã có `addTab`; ưu tiên dùng hoặc bổ sung selected-specific helper, không đổi style của mọi button gây ảnh hưởng các scene khác.
- `apps/client/src/ui/equipment-presentation.ts`: counts, giá/còn lại, resolver/diff dữ liệu thật; giữ authoritative rules.
- `apps/client/src/ui/equipment-art.ts`: thay kích thước khung theo layout; giữ contain toàn artwork.
- `apps/client/src/ui/card-tooltip.ts`, `combat-card-view.ts`: context popup/fallback icon nếu cần; test cả các scene dùng chung.
- `apps/client/test/equipment-presentation.test.ts` và `apps/client/e2e/armory-ui.spec.ts`: bổ sung regression có ý nghĩa cho thay đổi được chọn; không thêm test chỉ lặp màu/style triển khai.

## Hình hiện tại dùng để review

### Binh Khí

![Kho đồ Binh Khí hiện tại](C:/Users/Hienq/.codex/worktrees/inventory-ui/VongNguyet/docs/inventory-ui/production-weapons.png)

### Nguyệt Bảo

![Kho đồ Nguyệt Bảo hiện tại](C:/Users/Hienq/.codex/worktrees/inventory-ui/VongNguyet/docs/inventory-ui/production-relics.png)

### Popup lá bài — emblem cần sửa

![Popup lá bài hiện tại](C:/Users/Hienq/.codex/worktrees/inventory-ui/VongNguyet/docs/inventory-ui/production-card.png)

### Popup artwork — nền có prose fixture kiểm tra overflow

![Popup artwork hiện tại](C:/Users/Hienq/.codex/worktrees/inventory-ui/VongNguyet/docs/inventory-ui/production-art.png)
