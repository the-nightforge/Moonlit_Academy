# Đề xuất cải thiện màn hình Tu Luyện

Ngày khảo sát: 13/10/2026. Worktree `mastery-ui`, nhánh `codex/mastery-ui`, nền `main` tại `07522b0`.

Mục tiêu: tìm Hero có lượt mở, đọc đủ hiệu ứng của lá trước khi chọn, hiểu tiêu hao và kết quả mở. Tài liệu dựa trên mã `mastery-scene.ts`, luật `meta/profile.ts`, cấu hình và dữ liệu hiện hành. [Bản xem trước tương tác](mockup.html) dùng dữ liệu minh họa, được làm ở bước đề xuất. Màn game đã triển khai sau khi duyệt; xem [kết quả và kiểm chứng](implementation.md).

## Tham chiếu UI

- **Honkai: Star Rail — Vết Tích của Seele:** đã xem ảnh trong [hướng dẫn Eurogamer](https://www.eurogamer.es/honkai-star-rail-seele-mejor-build-materiales-ascension-habilidades-equipo-cono-de-luz-eidolon). Lựa chọn nằm ở vùng chính; tên, tác dụng, vật liệu và điều kiện nằm trong cột bên phải. Áp dụng việc giữ chi tiết luôn hiện khi chọn. Không dùng cây nối nút: sáu lá khóa của Vòng Nguyệt có thể chọn tùy ý, không có quan hệ cha con. Ảnh là tham chiếu lịch sử, không xác nhận giao diện phiên bản hiện hành.
- **Marvel Snap — xác nhận nâng cấp Psylocke:** đã xem ảnh trong [phân tích tháng 05/2023 của Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2023/5/23/marvel-snap-the-definitive-deconstruction). Lá nổi bật, chi phí và kết quả gắn với hành động xác nhận. Áp dụng ảnh lá, tên Hero và số lượt còn lại trong popup. Không áp dụng Booster, tiền nâng cấp, Collection Level hay chữ đè lên hình. [Hồ sơ của người thiết kế Tiffany Smart](https://www.tiffanysmart.com/work/marvel-snap) cũng nêu ưu tiên thị giác cho lá và thao tác gần nửa dưới điện thoại; trang được đọc qua bản trích xuất, ảnh portfolio không tải được trong trình duyệt.
- **Genshin Impact — công bố Training Guide ngày 28/02/2024:** đã xem ảnh hướng dẫn trên [bản lưu Traveler.gg](https://traveler.gg/developers-discussion-02-28-2024/), trong đó việc cần làm nằm sát nhân vật và có điểm điều hướng. Trang [HoYoverse chính thức](https://genshin.hoyoverse.com/en/news/detail/122658) trả trang trắng; ảnh Talent động từ HoYoLAB không tải được nên không coi ảnh đó là bằng chứng thị giác. Áp dụng lối dẫn đến hoạt động kiếm kinh nghiệm khi thiếu lượt mở, thay cho tooltip ở nút vô hiệu hóa.

Kết luận áp dụng cho Vòng Nguyệt là đề xuất của người review, không khẳng định các game tham chiếu có cùng hệ thống Tu Luyện.

## Review từng vùng

| Phần | Hiện tại trong mã | Đề xuất | Tác dụng |
|---|---|---|---|
| Header | Header chung, thiếu ngữ cảnh của trang | Giữ quay lại, tên Tu Luyện và icon tiền tệ thật | Nhất quán màn trước; tiền không xuất hiện trong chi phí mở lá |
| Danh sách Hero | Hàng chữ cao 76, cách 90; không cuộn | Cột cuộn độc lập, chân dung nguyên ảnh 2:3, tên, icon Tu Luyện + cấp, badge còn lượt | 20 Hero không vượt màn; nhận diện bằng hình |
| Chọn Hero | Hình chữ nhật tương tác chưa bo tròn | Nút viền bo tròn; viền vàng, nền và tên trong chi tiết | Trạng thái không chỉ phụ thuộc màu |
| Hero mặc định | Id đầu; `owned[0]` có thể lỗi khi rỗng | Giữ Hero từ màn trước, sau đó ưu tiên Hero có lượt mở; kiểm tra sở hữu; rỗng có lối đến Triệu Hồi | Giữ ngữ cảnh và tránh crash |
| Kinh nghiệm | Chuỗi “XP tổng / mốc kế”, không thanh | Thanh kinh nghiệm trong cấp, cấp hiện hành / tối đa; viết “kinh nghiệm” đầy đủ | Dễ thấy khoảng cách đến lượt mở tiếp |
| Cấp tối đa | Ghi XP tối đa | Ghi “Đã đạt cấp tối đa”, vẫn hiện lượt chưa tiêu | Cấp tối đa không đồng nghĩa mở đủ lá |
| Lượt mở | Chấm và câu nhỏ ở từng Hero | Trên nhóm lá: “Đã mở n / 6” và icon + n lượt mở | Tách rõ cấp, lượt có thể tiêu và số lá đã mở |
| Lá khóa | Sáu hàng tên, cost, dấu tích | Sáu ô có artwork sẵn; tên riêng ngoài hình; icon Nguyệt Lực + số; khóa hoặc đã mở | Đọc đúng lá trước khi quyết định; hình không bị che |
| Hiệu ứng | Rê chuột để xem tooltip | Cột chi tiết giữ khi chọn lá: cost, hiệu ứng đầy đủ, nhánh và giới hạn bản | Chạm và bàn phím đều đọc được |
| Từ khóa | Trong tooltip dùng chung | Icon, tên, giải thích cơ chế trong chi tiết | Thông tin thêm hữu ích; không tooltip chỉ lặp tên |
| Mở khóa | Sáu nút giống nhau, lý do disabled giống nhau | Một nút cuối cột chi tiết; ô lá dùng để chọn | Ít lặp chữ, giảm nhầm lá |
| Thiếu lượt | Lý do trong tooltip; chỉ nhắc Tầm Nguyệt | Lý do trực tiếp, lối đến Tầm Nguyệt; nhắc cấp và lượt từ Tinh Hồn | Biết làm gì tiếp; phản ánh đủ nguồn lượt |
| Xác nhận | Popup chữ tên lá + dùng 1 lượt | Ảnh đủ hình, lá, Hero, dùng 1 lượt, lượt còn lại; Hủy và Mở khóa | Kiểm tra lựa chọn trước khi tiêu lượt |
| Sau mở | Render lại; toast chỉ nêu thành tựu | Giữ Hero, lá, cuộn; tên lá vừa mở + lượt còn lại; dấu đã mở; lối vào xếp bộ bài | Nhận biết thành công và nơi sử dụng |
| Đang gửi / lỗi | Scene chưa khóa gửi; phản hồi có thể render sau khi rời | Khóa thao tác gửi; lỗi tại chi tiết, cập nhật revision; chặn phản hồi theo scene và phiên tài khoản | Tránh gửi trùng và UI cũ |
| Viewport | Tọa độ cố định, danh sách không thích ứng | Máy tính ba vùng; màn vừa lưới hai cột; điện thoại Hero ngang, nội dung dọc | Chữ đọc được, không thu nhỏ cả scene |
| Bàn phím | Pointer là luồng chính | Focus rõ, tên đầy đủ, Enter, Escape và trả focus về lá | Điều khiển bằng bàn phím và công cụ hỗ trợ |

## Bố cục chọn

Chọn **Hero + lưới sáu lá + chi tiết**. Đây là đề xuất có phạm vi trong luồng Tu Luyện hiện có. Máy tính: hành động cuối cột chi tiết, hiệu ứng dài cuộn bên trên. Điện thoại: cuộn dọc, nút mở rộng tối thiểu 44 điểm ảnh. Không đặt chữ lên chân dung hoặc dựng cây kỹ năng.

Hai hướng khác: danh sách hàng kèm chi tiết (đọc tên nhanh nhưng bộ sáu artwork khó quét); trang Hero với tranh lớn giữa màn (đẹp nhưng chiếm vùng quyết định lá). Bố cục chọn dành diện tích cho việc lựa chọn và đọc hiệu ứng.

Ưu tiên Hero có lượt khi chọn mặc định; không đảo danh sách trong lúc đang mở. Tìm kiếm, lọc và sắp xếp nâng cao chỉ bổ sung nếu cuộn cùng badge chưa đủ; bản đề xuất không thêm các điều khiển này.

## Luật dữ liệu phải giữ

- Mốc thực tế trong `meta-config.json`: **45, 165, 345, 585, 885, 1245**. Không dùng dãy minh họa cũ trong `docs/14-meta-rules.md`.
- Cấp bằng số mốc đã vượt. Trong cấp: đã tích lũy = tổng kinh nghiệm − mốc cấp trước; cần = mốc cấp sau − mốc cấp trước. Tổng 240 ở cấp 2: **75 / 180**, còn **105**. Bản xem trước ban đầu: tổng 345, cấp 3, **0 / 240**.
- Lượt mở: `max(0, min(cấp Tu Luyện + bonusUnlocks, số lá khóa) - số lá đã mở)`. Có lượt từ Tinh Hồn, trần sáu lá. Không tạo vật liệu mới hay tính phí Nguyệt Ngọc.
- Không gán thứ tự mở bắt buộc, mốc cấp riêng cho từng lá hoặc quan hệ cha con. Nhánh lấy từ dữ liệu Hero, dùng để mô tả.
- Chọn lá chưa mở + có lượt → xác nhận → `POST /profile/unlock`. Trước gửi kiểm tra lại Hero, lá và lượt. Máy chủ quyết định kết quả; giao diện không tự cấp lá hoặc thành tựu.
- Mở lá bổ sung vào danh sách có thể xếp bộ bài; không tự sửa các bộ bài đã lưu. Điều hướng xếp bộ bài không tự thay bộ bài.
- Tầm Nguyệt là lối dẫn trực tiếp đến kinh nghiệm, không nói là nguồn duy nhất: Cốt Truyện cũng cấp kinh nghiệm qua luật story.

## Assets và rule thị giác

Dùng `heroes/<id>.webp` (2:3), `cards/art_<keyword>.webp` hoặc artwork được chỉ định (2:3), `nav_mastery`, `moon_full`, `lock`, `check`, `nav_back`, `action_close`, `mode_run`, `nav_banners`, icon tiền và từ khóa. Artwork dùng chung minh họa cơ chế, không giả thành hình riêng của lá; khi triển khai dùng thứ tự fallback của `cardArtCandidates`.

Đã kiểm tra 20 chân dung và artwork của sáu lá mỗi Hero có asset hợp lệ. Không cần gen mới cho đề xuất. Nếu cần tranh riêng từng lá sau này, đó là phần bổ sung artwork.

Ảnh có chiều cao tự tính theo chiều rộng, viền trực tiếp sát ảnh, tối đa một điểm ảnh khoảng trống. Không viền quanh hộp rộng chứa ảnh fit giữa; tên, số, khóa ở vùng riêng. Các nút chọn, mở, hủy, đóng, quay lại và disabled có viền bo tròn. Hành động icon-only có tên truy cập đầy đủ; điều kiện và hiệu ứng giữ chữ vì icon không diễn đạt chính xác.

## Bản xem trước

`mockup.html`, `mockup.css`, `mockup.js`: chuyển Hero/lá, xác nhận mở trong dữ liệu minh họa, bật danh sách 20 Hero, chọn tám trạng thái. Thanh trạng thái ở ngoài khung game, không đưa vào sản phẩm. JSON và assets tải qua máy chủ tĩnh; không gọi API tài khoản; reload đặt lại dữ liệu.

Bản xem trước chưa chứng minh HTTP, revision, session hoặc điều hướng thật. Khi triển khai cần kiểm chứng riêng các phần đó và shared renderer/popup theo `docs/ui-rules.md`.

## Kiểm chứng bản đề xuất

- Worktree mới: cài dependency từ lockfile bằng cache offline; **317 kiểm tra client / 38 tệp nền qua** trước tạo bản xem trước. Chưa sửa mã sản phẩm nên không xem đây là kiểm chứng triển khai Tu Luyện mới.
- `node --check docs/mastery-ui/mockup.js`: cú pháp hợp lệ.
- Trình duyệt: **1280 × 720**, **900 × 650**, **450 × 800** không tràn ngang; ảnh tải đầy đủ. Tỉ lệ nội dung ảnh sau trừ viền khớp nguồn, sai số đo dưới 0.000001. Nút có viền và bo tròn 10 điểm ảnh, kể cả disabled.
- Sáu lá hiện trọn ở khung máy tính; khung vừa cuộn lá riêng, hành động nằm trong viewport. Điện thoại cuộn dọc và thanh Hero cuộn ngang; nút mở cao hơn 44 điểm ảnh. Popup điện thoại hiện đủ hình, tiêu hao, lượt còn lại và hai nút xác nhận/hủy.
- Đã chuyển cả tám trạng thái; thiếu lượt, ngoại tuyến, đang gửi đều khóa nút mở; cấp tối đa còn lượt vẫn mở được; mở đủ có lối đến xếp bộ bài; rỗng có Triệu Hồi.
- Danh sách 20 Hero cuộn và chọn được Hero cuối. Chọn lá cập nhật mô tả/từ khóa. Enter mở popup, Escape đóng, focus trở lại điều khiển. Xác nhận minh họa mở đúng một lá, **2 → 1** lượt, số đã mở **1 → 2**; Hủy giữ nguyên số lượt.
- Không có tooltip `title` lặp lại; không còn chữ viết tắt kinh nghiệm hoặc máu trong phần game của bản xem trước. Asset dùng chung được giữ đầy đủ, không mờ hay che hình.

Ảnh dưới đây là **bản đề xuất với dữ liệu minh họa**, chưa phải màn hình production.

![Bố cục chính](preview-ready.jpg)
![Xác nhận mở](preview-confirm.jpg)
![20 Hero và cấp tối đa](preview-many.jpg)
![Màn hình vừa](preview-narrow.jpg)
![Điện thoại](preview-phone.jpg)
![Xác nhận trên điện thoại](preview-phone-confirm.jpg)
![Chi tiết trên điện thoại](preview-phone-detail.jpg)
