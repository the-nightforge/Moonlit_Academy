# Kết quả sửa màn hình chiến đấu — 04/10/2026

Nhánh `feature/combat-ui-layout-assets`, nền `138cc0d`. Các thay đổi được giữ trong working tree để xem lại; không commit, merge hoặc push. Các thay đổi có sẵn của người dùng được giữ nguyên.

## Các lỗi đã sửa

| Review | Kết quả |
|---|---|
| F01 | Phản hồi profile/thông báo của tài khoản cũ không ghi đè phiên mới. Guard401 kiểm cả token và thế hệ đăng nhập, kể cả lúc đăng nhập mới đang chờ. |
| F02 | Kết nối mới nhận được snapshot và settlement của trận cũ đang chờ, đồng thời vẫn khôi phục trận hiện tại. |
| F03/F14 | Co-op hiển thị thắng/thua đúng cả hai ghế; terminal events chuyển sang trạng thái chờ settlement. Người đã bỏ trận không nhận âm thanh thắng. |
| F04 | Âm thanh rút bài và kết quả hòa dùng cue riêng, không triệt tiêu nhau. |
| F05/F06 | Summon tái tạo cùng ID lấy lại HP/trạng thái sống đúng; phase boss được cập nhật theo từng event. |
| F07/F08 | Summon co-op thuộc hàng đồng minh; hai summon cùng ghế không chồng nhau. Giáp và status có vùng riêng. |
| F09/F11 | Chữ mô tả lá không đè tên chủ lá; tooltip bài đồng đội dùng đúng giá hiệu lực và lý do giảm giá. |
| F10/F13 | Icon, mép và số đếm chồng rút mở đúng inspector. Lá đã chọn giữ độ nâng khi chuột rời đi. |
| F12 | Kiểm tra Chọn Pha chờ intro hoàn tất; kiểm tra summon dùng vị trí thật và thực thi hồi sinh/hành động tiếp theo. |
| F15/F16 | Reduced motion bỏ lunge nhưng giữ impact; timing đo tới cleanup, routine≤3000ms và lifecycle dài≤5000ms trên scheduler kiểm thử. |
| F17 | Nút kết thúc lượt thể hiện đang xử lý/mất kết nối và chặn thao tác lặp. Khi vào lại scene, nút mới không còn gắn vào root đã hủy. |

Review độc lập phát hiện thêm race401 và lifecycle của root cũ; cả hai đã có kiểm thử đỏ→xanh và review lại đạt. Gate tổng thể phát hiện thêm trường hợp hai summon cùng ghế; đã sửa và review lại với các assertion cũ được giữ nguyên.

## Bộ ảnh cuối cùng

Đủ **57/57**:20 hero thường,20 thăng cấp,15 quái và2 summon. Có44 file được bổ sung. Theo phản hồi của người dùng, **31 ảnh mới đã được gen lại** theo nét anime và màu của mẫu cũ:7 hero thường +7 thăng cấp tương ứng +15 quái +2 summon. Giữ13 bản thăng cấp dựa trên hero có sẵn và toàn bộ13 ảnh thường cũ.

Ảnh mới được tạo bằng công cụ OpenAI, dùng ảnh cũ từ Leonardo.AI làm mẫu phong cách. Prompt, ảnh tham chiếu, tên nguồn, kích thước và SHA-256 nằm trong [provenance](D:/Source/VongNguyet/docs/combat-generated-assets.json). Cả44 file khớp hash với output gốc. Chân dung mới1024×1536, summon1254×1254; ảnh cũ giữ độ phân giải gốc.

Đã kiểm sáu contact sheet ở136×196,100×148,80×108 và đối chiếu thường/thăng cấp. Khuôn mặt và đạo cụ chính đọc được ở kích thước game; không thấy chữ hoặc khung UI bị bake vào ảnh. Các kiểm tra inventory dương đạt6/6 và không có trùng texture key.

![Ảnh mẫu cũ và31 ảnh được gen lại](D:/Source/VongNguyet/apps/client/test-results/combat-art/new-art-overview.png)

![Combat với bộ ảnh cuối](D:/Source/VongNguyet/apps/client/test-results/combat-visual/1280x720/default.png)

## Bằng chứng kiểm tra

- Unit toàn workspace: **1031 passed,3 skipped**. Data49 và rules712/3skip trong `full-test.log`; client211 và server59 trong `client-server-final.log` sau sửa layout. Không lặp lại các suite không bị thay đổi.
- Typecheck và build client/server: đạt trên source cuối, log `typecheck-final.log` / `build-final.log`.
- Gate offline chính thức: **15/15 đạt**, `offline-final.log`. Preview khởi động mới bằng cấu hình sản phẩm, nạp bộ ảnh cuối. Bốn viewport, hand0/1/8/10, dense status, menu thu nhỏ/mở lại, summon/revive, playback lock, inspector và phase7a/7b.
- Kiểm tra bổ sung: cả hai ghế co-op ở bốn viewport; giá partner; selected/body ở hai kích thước compact; Bách Chiến thật2hit qua resize; Tiên Tri thật4 lựa chọn và event `cardChosen`; scene reuse. Xem `implementation-report.md` và các log kiểm hẹp.
- VFX:14 attack style +spell qua renderer/runtime thật ở1×,2×,reduced motion;3 matrix test đạt. Đây là45 probe renderer, không phải45 trận chơi.
- Online: **cả sáu ca đã đạt qua gate đầu và các lượt chạy hẹp** trên API disposable pg-mem: hai đấu tập, PvP tải lại, private co-op/Hợp Kích tải lại, settlement/duplicate-frame và ranked/shop. Không coi lượt sáu ca đầu có bốn lỗi là một lượt xanh toàn bộ.
- Ranked/shop cuối: `arena-budget.log`, **1/1 đạt, exit0**, khoảng5 phút. Sáu trận thắng và cap120 Vinh Dự/ngày được xác minh ở283.451s; tải lại và vào shop ở295.184s; mua150 Vinh Dự nhận160 Ngọc ở296.246s, số dư Vinh Dự50. Test có xử lý khôi phục trận terminal nếu còn trong retention, nhưng log không ghi riêng nhánh điều kiện đó có chạy hay không. Giới hạn tổng tăng từ300s lên600s sau khi lượt trước hết tổng300s giữa trận thứ sáu; giữ nguyên thời gian chờ từng bước và toàn bộ assertion.
- Review độc lập: `independent-review.md`, `scoped-review.md`, `verification-review.md` và `arena-final-review.md` dưới [thư mục bằng chứng](D:/Source/VongNguyet/.sdd-work/combat-review-fixes). Các thay đổi cuối của arena đạt cả spec và quality, không còn finding trong phạm vi đã review.

## Giới hạn của bằng chứng

Không truy cập DB production. Nhánh test topup cho PostgreSQL dev riêng cần URL được cấu hình rõ ràng và chưa chạy trên PostgreSQL thật; gate online dùng pg-mem. Bộ dữ liệu hiện tại có menu Tiên Tri4 lá vừa viewport; chưa chứng nhận một menu production dài đến mức phải cuộn. Timing là timeline scheduler tới drain, không phải đo FPS. Ba test rules được skip theo cấu hình có sẵn.

## Các quyết định đã thực hiện

1. Sửa trong nhánh hiện tại theo yêu cầu. Nếu cần checkout riêng, phải chuyển diff sang đó.
2. Giữ thay đổi chưa commit để xem lại, vì không có yêu cầu tích hợp và metadata Git chỉ đọc. Người dùng cần commit sau khi duyệt.
3. Dùng review và ba plan đã có làm phạm vi sửa được chấp thuận. Nếu thiết kế không khớp ý định, cần chỉnh lại phần tương ứng.
4. Root xử lý ảnh; một implementer giữ quyền sửa source. Chi phí khi ảnh chưa khớp phong cách là gen/chỉnh thêm; đợt31 ảnh đã được làm lại theo phản hồi.
