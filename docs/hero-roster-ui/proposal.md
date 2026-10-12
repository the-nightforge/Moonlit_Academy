# Đề xuất cải thiện Kho Hero

Ngày: 12/10/2026. Worktree: `hero-roster-ui`. Nhánh: `codex/hero-roster-ui`.

## Mục tiêu và phạm vi

Người chơi nhận diện hero qua portrait, tìm hero nhanh và đọc tiến trình Tinh Hồn mà không phải quét một khối chữ dài. Giữ phong cách cổ phong, nền chàm và điểm nhấn vàng của Vọng Nguyệt. Ưu tiên assets đã có; chỉ tạo thêm nếu có thiếu hụt phục vụ thiết kế được chọn.

Thiết kế đã được duyệt và **triển khai trong màn hình Phaser** trên nhánh `codex/hero-roster-ui`. Ảnh `implemented.png` chụp client thật với tài khoản kiểm thử. Mockup HTML giữ lại làm tư liệu thiết kế; trạng thái sở hữu, tiền tệ, Tinh Hồn và chấm mở lá trong mockup là dữ liệu minh họa. Client thật đọc dữ liệu và hồ sơ hiện có, dùng endpoint đổi dạng hiện có.

## Tham khảo UI

Các nguồn dưới đây là screenshot và tài liệu tham khảo; không khẳng định chúng là giao diện phiên bản game mới nhất.

| Game | Quan sát từ tư liệu | Áp dụng cho Vọng Nguyệt |
| --- | --- | --- |
| [Reverse: 1999 — Steam của nhà phát hành](https://store.steampowered.com/app/3092660/Reverse_1999/) ([screenshot roster](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3092660/ss_9b9dacd92ca434e8be20c8a979d9ee0788ba9325.1920x1080.jpg?t=1740046707)) | Portrait dạng thẻ lớn, tên và tiến trình nằm ở chân thẻ; thanh sắp xếp phía trên. | Dùng lưới portrait với tên luôn đọc được, trạng thái sở hữu ngắn gọn và bộ lọc ở đầu màn hình. |
| [Honkai: Star Rail — tư liệu Data Bank trên HoYoLAB](https://www.hoyolab.com/article/18132510) | Danh sách nhân vật dùng portrait để nhận diện nhanh. | Tách vùng duyệt bộ sưu tập khỏi hồ sơ hero được chọn; nhấn rõ lựa chọn hiện tại. Đây là hướng bố cục đề xuất, không sao chép nguyên màn hình của game. |
| [AFK Journey — phân tích kèm screenshot Resonating Hall](https://www.pocketgamer.biz/game-analysis-the-evolution-of-idle-rpg-systems/) | Lưới hero nằm cạnh khu vực quản lý; bài phân tích nhấn mạnh giảm số màn hình và thao tác quản lý. | Đặt hành động Tu Luyện cạnh hồ sơ hiện tại và đánh dấu hero có lượt mở lá; giữ Triệu Hồi trong cùng màn hình. |

## Vấn đề ở màn hình trước thay đổi

Trước thay đổi, `apps/client/src/scenes/heroes-scene.ts` có danh sách 7 dòng chữ, thiếu portrait, tìm kiếm, lọc và sắp xếp. Thông tin thăng cấp, 6 mốc Tinh Hồn, dạng thứ hai và hai lá chủ lực cùng hiện trong một khối dài. Hero khởi đầu luôn là phần tử đầu tiên trong dữ liệu.

Các chức năng hiện có cần giữ: xem hero chưa sở hữu, xem đủ 6 mốc Tinh Hồn, bonusUnlocks, ngưỡng thăng cấp theo hồ sơ, chọn dạng base/alt ở Tinh Hồn 5 qua API, tooltip lá chủ lực, Triệu Hồi, Tu Luyện và quay về Home.

## Hướng đề xuất: lưới bộ sưu tập và hồ sơ bên cạnh

Ở vùng thiết kế 1280×720:

- Header: nút quay về, “Kho Hero”, số hero đã sở hữu / tổng số, tiền tệ qua widget hiện có.
- Toolbar: tìm tên có hoặc không dấu; lọc sở hữu và phe; sắp xếp theo sở hữu, độ hiếm, Tinh Hồn hoặc tên. Các lựa chọn chỉ đổi cách trình bày trên client.
- Bên trái: lưới 4 cột × 3 hàng, 12 hero mỗi trang. Mỗi thẻ có portrait, tên, độ hiếm và trạng thái sở hữu / Tinh Hồn. Chấm vàng kèm giải thích biểu thị `pendingUnlocks > 0`; khung vàng toàn phần giữ ý nghĩa Tinh Hồn 6, lựa chọn hiện tại dùng viền ngoài / dấu chọn riêng.
- Ở giữa: portrait lớn, chuyển xem art thường và art thăng cấp. Việc xem ảnh không đổi dạng thăng cấp đã chọn trong hồ sơ.
- Bên phải: tên, phe, độ hiếm, HP, sở hữu và Tinh Hồn. Ba tab “Tổng quan”, “Tinh Hồn”, “Lá chủ lực” chia nhóm nội dung. Hành động Tu Luyện và Triệu Hồi nằm ở chân panel, không dịch vị trí theo độ dài mô tả.
- Tổng quan: thăng cấp, hiệu ứng và ngưỡng hiện tại lấy từ hero / hồ sơ. Tinh Hồn: đủ 6 mốc, đánh dấu mốc kế tiếp, số lượt mở lá thêm và lựa chọn dạng base/alt theo điều kiện hiện có. Lá chủ lực: bản thường / bản +, trạng thái đang dùng và mô tả đầy đủ qua hover hoặc chạm.
- Hero chưa sở hữu vẫn xem được art và hồ sơ; Tu Luyện khóa kèm lý do luôn hiện khi triển khai, Triệu Hồi vẫn khả dụng. Không thể đổi dạng hồ sơ của hero chưa sở hữu.
- Lọc không có kết quả: thông báo và nút xóa bộ lọc. Đổi bộ lọc đưa trang về đầu; đổi trang không làm mất hero đang xem. Ưu tiên hero sở hữu làm lựa chọn đầu tiên, không tự đổi hero khi lọc.

Mockup HTML có reflow khi màn hình hẹp để tiện đánh giá trên trình duyệt. Client thật hiện dùng Phaser với vùng thiết kế 1280×720; triển khai vẫn dùng `useDesignCamera`, kiểm tra vùng trung tâm ở các viewport khác nhau. Reflow HTML không đồng nghĩa client game đã có layout mobile.

## Hai lựa chọn khác

- **Danh sách portrait nhỏ + chi tiết:** thay đổi ít hơn, phù hợp khi ưu tiên mật độ thông tin; sức hút của bộ sưu tập thấp hơn lưới.
- **Gallery toàn màn hình, mở hồ sơ riêng:** tôn art tốt nhất nhưng thêm thao tác khi đổi hero và so tiến trình.

Khuyến nghị hướng lưới + hồ sơ bên cạnh vì bộ sưu tập hiện có 20 hero và art đầy đủ, vừa dễ duyệt vừa giữ hành động gần thông tin.

## Assets

Đã kiểm kê 20 art thường và 20 art thăng cấp trong `apps/client/public/assets/heroes/`; dùng lại `backgrounds/home.webp` với lớp phủ tối. Icon sẵn có: `ui/lock.webp`, `ui/star.webp`, `ui/nav_back.webp`, `ui/nav_mastery.webp`, `ui/nav_banners.webp`, `ui/check.webp`, icon tiền tệ.

Không cần gen mới ở vòng này. Khung, gradient, trạng thái chọn và các mốc Tinh Hồn dựng bằng Phaser. Art `_up` là minh họa thăng cấp đang có; không coi đây là art riêng cho dạng alt. Nếu sau này cần hình riêng cho alt thì đó là một đợt assets riêng cần xác định nhân vật và art direction.

## Triển khai

Đã sửa `apps/client/src/scenes/heroes-scene.ts`; tách lọc, sắp xếp, chọn hero ban đầu và phân trang vào `apps/client/src/ui/heroes-presentation.ts`. Tận dụng `matchesDeckText`, theme, header, buttons, texture manifest và rounded art texture hiện có. Preload art cho màn hình vì Home chỉ nạp art của đội hiện tại. Có fallback khi thiếu ảnh; tên và thao tác không phụ thuộc ảnh.

Giữ endpoint đổi dạng; ngăn gửi trùng khi đang chờ, hiện lỗi và bỏ qua kết quả render khi đã rời scene. Dọn wheel, resize, update, DOM fields, tooltip và mask khi scene shutdown. Nội dung dài dùng Mask filter của Phaser 4 cho WebGL và GeometryMask cho Canvas; hit test được cắt theo vùng cuộn để phần ẩn không chặn tab. Tên bị rút gọn có tooltip và vẫn nhận click chọn hero / mở lá. Không thêm dependency, không sửa dữ liệu, luật chiến đấu hay schema.

Kiểm thử: unit test lọc kết hợp và không dấu, sắp xếp, phân trang và chọn hero; E2E tìm kiếm / reset, phân trang và Tu Luyện đúng hero, hero chưa sở hữu, chọn dạng qua API, lỗi API / chặn gửi trùng, tooltip, re-entry và ảnh thiếu, click tên rút gọn, vùng hit test cuộn, mô tả dài. Test mô tả dài so sánh pixel vùng footer ở 1280×720, 1280×900 và 1920×1080.

## Kết quả kiểm tra hiện tại

- `pnpm typecheck`: qua.
- `pnpm --filter client build`: qua (cảnh báo bundle lớn có sẵn).
- `pnpm --filter client test`: 34 file, 288 test qua, gồm 5 test mới.
- E2E: 9 kịch bản đã qua trên code cuối cùng, gồm các lượt chạy riêng. Lượt toàn bộ cuối: 8 qua, test đổi dạng timeout ở bước khởi động Home (`__vn` chưa tồn tại), trước khi vào Kho Hero; chạy lại riêng test này qua (25 giây). Một lượt trước cũng có timeout khởi động ngẫu nhiên ở test khác. Chưa xác định nguyên nhân khởi động không ổn định; không coi lượt toàn bộ E2E là xanh.
- `pnpm test`: rules 727 qua, 4 bỏ qua; data 50 qua; client 288 qua; server 59 qua, 1 lỗi T205.
- T205 tại `apps/server/test/gear.test.ts:31` lỗi `expected 400 to be 201` cả trước và sau thay đổi. Test tạo deck 17 lá trong khi `validateDeck` yêu cầu `metaConfig.deckSize` (18). Test production từng timeout ở baseline khi chạy song song, nhưng đã qua ở lượt chạy toàn bộ sau đó. Các file server không được sửa trong thay đổi UI này.
- Mockup: kiểm tra bằng trình duyệt tìm “hoac liet”, bộ lọc “Chưa sở hữu”, chuyển tab và nút Tu Luyện bị khóa với hero chưa sở hữu; tất cả art đã khôi phục từ Git LFS.
- Review đã xác nhận sửa click tên rút gọn, hit test vùng cuộn và vòng đời mask. `implemented.png` là màn hình thật; `overflow-check.png` minh họa nội dung dài được cắt trước footer.

## Mở bản xem thử

Client thật: chạy backend thử nghiệm `pnpm --filter server dev:test`, sau đó chạy Vite client với `API_PROXY_TARGET` trỏ tới backend. Đăng nhập và mở Kho Hero từ Home. Chạy E2E với `VN_E2E_URL` trỏ tới URL Vite: `pnpm --filter client exec playwright test e2e/heroes-ui.spec.ts --workers 1`.

Mockup thiết kế:

Chạy từ root worktree: `pnpm --filter client exec vite <đường-dẫn-root-worktree> --host 127.0.0.1 --port 5194`.

Mở `http://127.0.0.1:5194/docs/hero-roster-ui/mockup.html`.
