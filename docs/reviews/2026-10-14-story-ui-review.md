# Review và cải thiện màn Cốt Truyện

Ngày 2026-10-14. Worktree `story-ui`, nhánh `codex/story-ui`, bắt đầu từ `0cd0a2b`.

## Mục tiêu và phạm vi

Màn chọn chương/màn dễ nhận ra tiến độ và hành động tiếp theo; phần thưởng rõ, phù hợp desktop và điện thoại. Cải thiện cả hội thoại trước/sau trận vì đây là luồng trực tiếp của Cốt Truyện và renderer cũ còn crop portrait. Áp dụng `docs/ui-rules.md`: full hình đúng tỉ lệ, border sát hình, mọi nút bo tròn có viền, icon có tên truy cập đầy đủ, không tooltip lặp và không viết tắt.

Hai chương và 16 màn lấy từ dữ liệu hiện có. Không thay luật, phần thưởng, quyền mở màn, nội dung lời thoại hay API. Tiến độ chỉ đọc từ server; màn đã qua vẫn không có hành động đánh lại, phù hợp hành vi UI cũ.

## Tham khảo các game tương tự

| Nguồn chính thức | Cơ sở đã xem | Bài học áp dụng |
|---|---|---|
| [Hearthstone — Book of Heroes](https://news.blizzard.com/en-us/article/23509389/who-dares-enter-the-forbidden-library), [GIF của Blizzard](https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/ux/UXVQ9M5HPOBJ1598637574873.gif) | Bài viết mô tả chuỗi tám boss tuyến tính và thưởng hoàn thành. Đã xem GIF Jaina trong trình duyệt: nhân vật và khung chương là điểm nhận diện rõ. Đây là ảnh quảng bá, không phải UI chọn màn. | Dùng chương có danh tính rõ, giữ thứ tự tám màn và đặt thưởng chương cạnh tiến độ. Dùng portrait có sẵn của Vọng Nguyệt, không sao chép hình game tham khảo. |
| [Honkai: Star Rail — bản cập nhật 3.6, Fate’s Atlas / Story Recap](https://hsr.hoyoverse.com/en-us/news/159638) | Nội dung chính thức được công cụ tìm kiếm đọc: nút truyện và danh mục đoạn truyện để xem lại. Trang động khi mở chỉ trả Loading. Chưa kiểm tra trực tiếp bố cục Fate’s Atlas. | Phân biệt chọn/xem chi tiết một màn với hành động tiếp tục. Áp dụng cách tổ chức thông tin theo nút truyện; không bổ sung tính năng phát lại trong lượt này. |
| [Slay the Spire — trang Steam do Mega Crit phát hành](https://store.steampowered.com/app/646570/Slay_the_Spire/) | Đã đọc mô tả hành trình và chọn đường từ trang sản phẩm. Gallery không mở được trong trình duyệt do lỗi kết nối; không dùng nó làm bằng chứng đã quan sát UI. | Dùng số thứ tự và trạng thái để nhận ra vị trí trong hành trình. Cốt Truyện của Vọng Nguyệt tuyến tính, nên không thêm đường rẽ hoặc bản đồ ngẫu nhiên. |

Các giải pháp bố cục, màu và kích thước bên dưới là thiết kế riêng cho Vọng Nguyệt. Nguồn tham khảo hỗ trợ cách tổ chức hành trình và nhận diện chương; không xác nhận giao diện mới nhất của các game năm 2026.

## Review từng vùng và thay đổi đã làm

| Vùng | Vấn đề ở bản cũ | Bản mới |
|---|---|---|
| Khung màn | Canvas cố định 1280 × 720, hàng màn đặt bằng tọa độ; khó đọc trên điện thoại. | DOM responsive có cuộn; desktop ba vùng chương/hành trình/chi tiết. 900 pixel dùng hai cột; điện thoại đưa chi tiết và tiếp tục trước danh sách màn. |
| Header | Ví tiền và nhiều số dư không liên quan phí vào màn. | Tiêu đề, số chương/màn từ dữ liệu và nút quay lại bằng icon. |
| Chọn chương | Nút chữ ghép tên, mũi tên và số lượng trong một dòng. | Thẻ chương có tên đầy đủ, tiến độ và thanh tiến độ; lựa chọn có viền vàng. Chương khóa vẫn xem được chi tiết, không được vào trận. |
| Tiến trình | Tám hàng giống nhau, trạng thái phụ nhỏ ở mép phải. | Tám nút có số thứ tự; xanh ngọc cho đang mở, check cho đã qua, lock cho chưa mở. Viền chọn bổ sung cho border của nút. |
| Chi tiết màn | Tên, trạng thái, thưởng lặp trong mỗi hàng. | Một vùng chi tiết cho màn đang chọn, portrait và tên địch lấy từ encounter thật; số lượng địch trùng được nhóm bằng ×. |
| Hành động chính | Click vùng hàng không có control bàn phím riêng; viền vuông. | Nút Tiếp tục có tên truy cập chứa cả nhãn nhìn thấy và tên màn. View và scene đều kiểm tra quyền mở từ server trước khi chuyển. |
| Màn khóa | Chỉ ghi Chưa mở, chưa giải thích điều kiện. | Hiển thị tên màn trước hoặc chương trước cần hoàn thành; nút vào màn khóa có border và góc bo. |
| Thưởng lần đầu | Chuỗi chữ nhiều tiền và “XP”; khó quét nhanh. | Icon Nguyệt Ngọc, Huyền Thiết, kinh nghiệm Tu Luyện với số liệu cấu hình; full tên qua alt. Màn đã qua ghi Đã nhận. |
| Thưởng chương | Tên Hero nằm trong heading dài và lặp ở màn cuối. | Portrait Hero và điều kiện hoàn thành chương. Desktop ở cạnh chương; màn hẹp có vùng thưởng dưới nút chính. Đây là thưởng Hero theo quy tắc server, không cam kết Hero mới khi người chơi đã sở hữu. |
| Tải / lỗi / đăng nhập | Text giữa canvas và restart toàn scene. | Vùng trạng thái dễ đọc, retry tại chỗ; lỗi không để lộ tiến độ chưa xác nhận. Callback kiểm tra vòng đời scene và thế hệ tài khoản trước khi nhận dữ liệu. |
| Focus / điện thoại | Các hàng canvas chỉ xử lý pointer. | Nút native có focus; giữ control đang chọn sau render. Chọn màn ở phần danh sách điện thoại cuộn đến chi tiết tương ứng. |
| Hội thoại / portrait | `Math.max` và `setCrop` cắt ảnh vào khung 160 × 200. | Vùng portrait riêng với chiều cao tự nhiên và contain, tên và lời thoại bên cạnh/bên dưới; không đặt text lên ảnh. |
| Hội thoại / thao tác | Click toàn scene dễ tiến lời thoại ngoài ý muốn; control nhỏ khi co canvas. | Nút Tiếp tục/Bỏ qua rõ, bo tròn có viền; Space/Enter được giữ. Phím trên button dùng hành vi native để không tiến hai lần. |
| Hội thoại / khả năng truy cập | Lời thoại canvas không có vùng thông báo. | Speech region tồn tại ổn định, `aria-live="polite"` và atomic; focus của nút tiếp tục được giữ khi đổi lời thoại. |
| Thuật ngữ | Thưởng có “XP”; gợi ý “Click hoặc Space”. | Kinh nghiệm Tu Luyện viết đầy đủ; gợi ý Phím cách và các nhãn Tiếp tục, Bỏ qua. |

## Assets

Dùng portrait Hero, kẻ địch và các assets `mode_story`, `nav_back`, `lock`, `check`, `action_reset`, `cur_moonJade`, `cur_darkIron`, `nav_mastery` đã có. Mỗi ảnh có border riêng sát nội dung, contain và padding bằng không; chữ nằm ngoài ảnh. Không cần sinh bitmap mới để đáp ứng bố cục này. Nền và phân cấp panel dùng CSS nhẹ.

## Kiểm chứng

- Baseline: 42 file / 344 test client đạt.
- Năm test tiến độ mới đã thất bại trước triển khai, sau đó đạt: chọn chương/màn đang mở, không suy diễn quyền mở, đã qua ưu tiên trước unlocked, điều kiện chương khóa, sửa lựa chọn cũ và nội dung trống.
- Bản cuối: 43 file / **349 test client đạt**; **2 test story server đạt**; workspace typecheck và client build đạt. `git diff --check` sạch. Vite vẫn có cảnh báo bundle lớn.
- **10/10 kiểm tra DOM trên trình duyệt thật đạt**: tiếp tục đúng màn, khóa thao tác màn chưa mở, focus chọn màn, điều kiện chương khóa, thưởng đã nhận, retry, tỉ lệ portrait, callback hội thoại, border/radius và vùng live/focus ổn định.
- Viewport đã kiểm tra: 375 × 667, 450 × 800, 900 × 720, 1280 × 720. Không tràn ngang tại các trạng thái được đo. Nút Tiếp tục có đáy khoảng **641 pixel** trên điện thoại 375 × 667 và 450 × 800 ở màn Nhập Học và fixture Huyền Vũ Thí Võ.
- 900 × 720: cột hành trình khoảng 485 pixel, chi tiết 326 pixel. Đã đo các hình hiển thị: full tỉ lệ tự nhiên sau khi trừ border thực tế, contain và padding 0. Các nút bình thường/được chọn/khóa được kiểm tra border và radius.
- Đã dùng máy chủ pg-mem riêng, API thật và tài khoản dùng một lần: nạp tiến độ, vào Nhập Học, Space → 2/4, Enter → 3/4 rồi 4/4, kết thúc đến chọn bộ bài, quay lại và Bỏ qua đến cùng điểm chuyển. Điểm đích chọn bộ bài trong harness là probe xác nhận scene và `pendingStageId`, không phải trận chiến thật.
- Fixture renderer kiểm tra chương hai, hoàn thành hai chương, tải, lỗi/retry và chưa đăng nhập. Không coi các trạng thái fixture là tiến độ đã đạt bằng chơi thật. Chưa chạy một trận Cốt Truyện hoàn chỉnh trong lượt UI này; test server hiện có kiểm tra thắng, phát thưởng một lần và replay sai bị từ chối.
- Review mã độc lập phát hiện hai vấn đề khả năng truy cập: label-in-name của Tiếp tục và thông báo lời thoại mới. Cả hai đã sửa và kiểm tra DOM lại.

## Ảnh minh chứng

Desktop, điện thoại, chương khóa và hai ảnh hội thoại lấy từ scene thật với máy chủ thử nghiệm. Hoàn thành và lỗi dùng fixture renderer; bảng điều khiển QA đã ẩn trước khi chụp.

![Cốt Truyện — desktop](story-ui/story-desktop.jpg)

![Cốt Truyện — điện thoại](story-ui/story-mobile.jpg)

![Chương chưa mở — điện thoại](story-ui/story-locked-mobile.jpg)

![Hội thoại — desktop](story-ui/story-dialogue-desktop.jpg)

![Hội thoại — điện thoại](story-ui/story-dialogue-mobile.jpg)

![Thưởng đã nhận — fixture](story-ui/story-complete-mobile.jpg)

![Lỗi tải tiến độ — fixture](story-ui/story-error-mobile.jpg)
