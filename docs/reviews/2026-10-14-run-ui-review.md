# Review và cải thiện Tầm Nguyệt

Ngày 2026-10-14. Worktree `run-ui`, nhánh `codex/run-ui`, bắt đầu từ `9b845da`.

## Phạm vi

Cải thiện màn hành trình đang chơi: bản đồ, chọn Lõi, Nghỉ Chân, Kho Báu, xem bộ bài, Kỳ Vật/Lõi và kết quả. Giữ luật tạo bản đồ, số tầng, hồi máu, giới hạn bộ bài, encounter và phần thưởng hiện có. Không thay màn chọn bộ bài hoặc renderer combat trong lượt này.

Áp dụng đầy đủ `docs/ui-rules.md`: ảnh nguyên tỉ lệ, full hình trong border sát ảnh, chữ/control nằm riêng; mọi nút có border và góc bo; dùng icon có tên truy cập đầy đủ; không tooltip lặp hoặc thuật ngữ viết tắt.

## Tham khảo

| Game và nguồn | Quan sát | Áp dụng |
|---|---|---|
| [Slay the Spire — Mega Crit trên Steam](https://store.steampowered.com/app/646570/Slay_the_Spire/), [ảnh bản đồ trong bài của ojisan](https://blog.ojisan.io/slay-the-spire/) | Đã xem trực tiếp [ảnh bản đồ](https://blog.ojisan.io/static/c6626a2612f945eda086862dacfb5938/21b4d/map.png) trong trình duyệt: đường nối nét đứt, icon loại điểm, điểm chọn có dấu nhấn, legend bên phải và tài nguyên trên đầu. Trang sản phẩm chính thức mô tả hành trình thay đổi và chọn đường. | Giữ bản đồ phân nhánh đúng dữ liệu, nhấn điểm có thể đi và đường đã đi, dùng icon và một legend. Xem trước một điểm tách khỏi hành động đi tới. |
| [Monster Train — trang Steam của nhà phát hành](https://store.steampowered.com/app/1102190/Monster_Train/), [review có ảnh bản đồ](https://etoile-et-champignon.fr/critique-de-monster-train-un-deck-builder-tres-accrocheur/) | Đã xem đầy đủ [ảnh bản đồ Plaines calcinees](https://etoile-et-champignon.fr/buh45ks/uploads/2021/01/monster-train-1536x864.jpg): đường ray phân nhánh trên phong cảnh, điểm thưởng/nâng cấp nhận diện bằng hình, tài nguyên và vật phẩm thành dải trên đầu. | Hành trang dùng icon và số lượng; thông tin đầy đủ mở trong dialog. Thêm phong cảnh riêng để tạo cảm giác hành trình, nhưng giữ hình riêng với chữ/control theo rule của dự án. |

Ảnh tham khảo là các bản chụp có sẵn trong bài viết, không phải kiểm tra giao diện game mới nhất năm 2026. Không đưa hình hoặc assets của hai game vào sản phẩm.

## Review từng phần UI

| Vùng nhỏ | Vấn đề trước | Thay đổi |
|---|---|---|
| Khung màn | Canvas 1280 × 720, tọa độ cố định và khó đọc trên điện thoại. | DOM responsive có cuộn. Desktop chia đội hình/bản đồ/chi tiết; điện thoại đưa chi tiết trước bản đồ và toolbar vừa một hàng ở 375 pixel. |
| Header | Không có tiêu đề hành trình rõ; thông tin nằm rải rác. | Tầm Nguyệt, tầng hiện tại từ position và tổng tầng thực; icon hành trang và bộ bài. |
| Đội hình | Chỉ có tên và chuỗi số máu nhỏ. | Portrait full tỉ lệ, tên đầy đủ, máu và meter có tên truy cập; trạng thái Đã ngã. Điện thoại giữ số máu và thanh máu trên hàng riêng. |
| Điểm bản đồ | Emoji trên vòng tròn, chỉ điểm có thể đi nhận pointer. | Icon sẵn có trong nút native 54 pixel, bo góc/viền rõ. Tất cả điểm xem được; chỉ điểm luật cho phép mới có Tiếp tục hoạt động. |
| Đường nối | Mọi đường cùng màu, không thể nhận ra lộ trình đã chọn. | Đường đã đi lấy từ action đã ghi của ticket; nhấn kết nối từ vị trí hiện tại. Không đánh dấu tất cả điểm ở tầng trước là đã đi. |
| Số tầng / legend | Chữ loại điểm lặp và dễ lẫn với hình. | Số tầng trên một cột, legend bằng icon + tên đầy đủ; tên/đường/trạng thái đầy đủ trong accessible name của điểm. |
| Xem trước | Chạm điểm là vào trận ngay, không có vùng chi tiết. | Chọn điểm chỉ xem; hiển thị phong cảnh riêng, loại điểm, đối thủ thật và số lượng, ý nghĩa phần thưởng. Tiếp tục gửi đúng một action qua rules/recording hiện có. |
| Thưởng Lõi | Thẻ chữ vuông, khó quét nhanh hoặc so sánh trên điện thoại. | Ba thẻ đầy đủ hiệu ứng, icon và control bo góc; điện thoại xếp dọc. Lõi hết có bước Tiếp tục riêng. |
| Kỳ Vật vừa nhận | Text dài ở giữa canvas. | Vùng nhận Kỳ Vật riêng với tên và hiệu ứng đầy đủ. Kho báu đã biết rỗng không dùng Kỳ Vật cũ làm thưởng mới; khôi phục không rõ receipt ghi Kỳ Vật gần nhất. |
| Nghỉ Chân / hồi máu | Dự báo ba Hero ghép thành một dòng dài. | Ba cột dự báo theo `restHealAmounts`, bao gồm Hero đã ngã; nút Hồi máu rõ. |
| Nghỉ Chân / bỏ lá | Lưới button tên lá có thể tràn dưới màn, không có chi tiết hoặc xác nhận. | Thẻ có hình full, tên, giá Nguyệt Lực và số bản; confirm native có hiệu ứng và số lá còn lại. Chỉ bỏ một bản. Khi tối thiểu, mọi nút bỏ bị khóa nhưng còn border. |
| Bộ bài | Overlay toàn màn, chữ nhỏ, bấm bất kỳ đâu để đóng. | Dialog có nút Đóng/Escape, nhóm bản trùng nhưng giữ số lượng, hình và text hiệu ứng đầy đủ. |
| Hành trang | Dòng Kỳ Vật/Lõi dài, tooltip chỉ dùng được hover. | Nút icon và tổng số lượng; dialog chia Kỳ Vật/Lõi, tên và hiệu ứng đầy đủ, dùng được bàn phím/touch. |
| Kết quả | Text thưởng và lỗi có thể chồng lên nhau; “XP” viết tắt. | Receipt riêng chỉ hiện sau ghi nhận; icon tiền và kinh nghiệm Tu Luyện, trạng thái gửi/lỗi/tải lại. Khi đang gửi, khóa điều hướng kết thúc. |
| Focus / thông báo | Canvas thiếu control native và vùng thông báo. | Giữ focus khi chọn điểm, chuyển tới control tiếp theo sau lựa chọn và gửi lại; live region ổn định. Dialog mở không bị cướp focus khi request hoàn tất. |
| Vòng đời / kết quả muộn | Callback có thể render scene đã đóng; helper gửi kết quả có thể xóa ticket mới hoặc ghi receipt của tài khoản cũ. | Scene kiểm tra thế hệ, tài khoản và run; helper kiểm tra tài khoản/ticket/run trước retry, xử lý lỗi hoặc ghi receipt/lưu trữ. Không đổi hợp đồng API. |

## Assets

Tái sử dụng `mode_run`, `node_combat`, `node_elite`, `node_rest`, `node_treasure`, `node_boss`, `nav_heroes`, `moon_full`, `check`, các icon tiền/Tu Luyện và portrait/hình lá hiện có. Worktree mới cần `git lfs checkout` để vật chất hóa các ảnh từ cache local; con trỏ LFS đã được kiểm tra trước khi khôi phục.

Tranh hành trình mới sinh bằng **built-in image_gen**, lưu tại `apps/client/public/assets/run/journey.webp`. [Prompt đầy đủ](run-ui/journey-prompt.json), [metadata](run-ui/journey-asset.json). PNG gốc giữ trong generated_images của Codex. Chuyển WebP chất lượng 88, effort 6 bằng sharp, không resize/crop: giữ **1774 × 887**, tỉ lệ **2:1**; **3.020.658 → 395.192 byte**, giảm khoảng **86,92%**. Ảnh không có UI/chữ và hiển thị trong vùng riêng.

## Kiểm chứng

- Baseline **349 test client** đạt.
- Năm test model mới đã thất bại trước triển khai, sau đó đạt: đường hợp lệ, xem điểm tương lai, action thật tạo đường đã đi, lựa chọn cũ và giữ dữ liệu, nhóm lá không mất bản.
- Hai test phản hồi muộn đã thất bại với helper cũ, sau đó đạt; một test phản hồi hiện hành tiếp tục đạt.
- Bản cuối **357/357 test client** (45 file), **6/6 test server run**, workspace typecheck và client build đạt. Build vẫn có cảnh báo bundle lớn.
- **17/17 kiểm tra trình duyệt** đạt tại **375 × 667, 450 × 800, 900 × 720, 1280 × 720**. Bao gồm ảnh/border, xem điểm khóa, focus, action chính xác, dialog, hồi máu, hủy/xác nhận bỏ lá, giới hạn bộ bài, chọn Lõi, kho báu rỗng, ghi nhận/retry và receipt/live region.
- Ba hồi quy UI đã tái hiện trước sửa: focus sau lựa chọn, thưởng kho báu rỗng, focus sau pending → settled. Review lại không còn vấn đề trong phạm vi.
- Mười một trạng thái fixture trên điện thoại đều được đo: map, đường đã đi, thưởng, hết Lõi, nghỉ, tối thiểu, kho báu, thắng, thua, đang gửi, lỗi. Mọi hình nhìn thấy tải thành công, full tỉ lệ sau trừ border, contain/padding 0; mọi button hiện diện có border/radius; không tràn ngang.
- Nút Tiếp tục ở fixture đầu hành trình có đáy **628,6 pixel** trên 375 × 667 và **666,2 pixel** trên 450 × 800.
- Probe dùng **RunScene thật và rules/recording thật**: bấm Tiếp tục vào `f1n0` → trạng thái combat, **1 action ghi nhận**, `session.state` là combat đã tạo, view cũ gỡ khỏi DOM. Điểm đích là CombatProbe cục bộ để kiểm tra scene transition; chưa chạy trọn trận hoặc cả hành trình bằng thao tác chơi.
- Kết quả/thưởng trong ảnh minh chứng là fixture có kiểm soát, không phải phần thưởng thực nhận trên tài khoản. Test server hiện có kiểm tra replay/ticket/phát thưởng. Không chạy lại toàn bộ mô phỏng luật chơi vì lượt này không thay rules hoặc dữ liệu cân bằng.

## Ảnh minh chứng

Bảng điều khiển đã ẩn trước khi chụp.

![Bản đồ desktop](run-ui/run-desktop.jpg)

![Điểm đến điện thoại](run-ui/run-mobile.jpg)

![Chọn Lõi](run-ui/run-reward-desktop.jpg)

![Nghỉ Chân](run-ui/run-rest-mobile.jpg)

![Xác nhận bỏ một lá](run-ui/run-remove-confirm-mobile.jpg)

![Kết quả](run-ui/run-result-mobile.jpg)
