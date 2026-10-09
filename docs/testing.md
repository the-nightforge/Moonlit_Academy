# Tổ chức và chạy test

Test đặt trong `test/` hoặc `e2e/` của từng package, dùng tên chức năng mà suite kiểm tra. Không đặt tên theo giai đoạn triển khai, review hoặc redesign. `blood-moon-phase.test.ts` và `moon.test.ts` vẫn hợp lệ vì pha trăng là chức năng của game.

## Nhóm test và helper

| Phạm vi | Tổ chức |
| --- | --- |
| Rules | `hero-cards`, `combat-bot`, `guard`, `moon-choice`, `summons`, `charm`, `seal`, `revive`; các trường hợp damage, status, keyword, Huyết Nguyệt, chồng bài và thăng cấp nằm trong suite tương ứng. |
| Server | `test/helpers.ts` dựng app và tài khoản; `test/helpers/realtime.ts` dùng chung websocket, hello và scheduler. |
| Client | `test/helpers/async.ts` xử lý microtask; `action-result.ts` xác nhận action thành công trước khi đọc state fixture. |
| E2E | `helpers/combat.ts` xử lý canvas, scene và caption; `helpers/online.ts` dựng trạng thái online; `helpers/multiplayer.ts` dùng chung API, tài khoản, deck, phiên trình duyệt và vào lobby. |

Quy ước helper rules:

- `playCardById` nhận card definition ID; `playCardAction` nhận instance ID. Cả hai trả nguyên `ActionResult` để kiểm tra thao tác bị từ chối.
- `playCardInstance` và `playTestCard` ném lỗi nếu fixture không đánh được bài, giữ cả state và events. `playCardState` chỉ lấy state thành công.
- `injectCard` có tham số seat; `cardsInHand` và `takeCards` thao tác trên tay/chồng rút của seat 0.
- Fixture của mỗi test dùng dữ liệu riêng từ `makeTestCombat`/`testData`. Không sửa trực tiếp các định nghĩa fixture dùng chung.
- Giữ helper riêng khi ý nghĩa khác nhau: loadout của simulation PvP/Co-op, tài khoản đã có tiến độ story, probe của từng chức năng. Không gộp chỉ vì phần thân giống nhau nhưng dữ liệu bao quanh khác nhau.

Multiplayer giữ tốc độ playback mặc định. Các fixture online khác tiếp tục dùng tốc độ 2× và tắt âm thanh. Helper chờ vào scene tối đa 90 giây vì preload toàn bộ art có thể vượt 15 giây; các assertion hành vi giữ nguyên. Vào menu bằng caption đang render để test không lệ thuộc tọa độ của bố cục cũ.

Các suite multiplayer đăng ký `test.afterEach(closeMultiplayerPages)` để đóng context tạo thủ công, kể cả khi test thất bại. Khi mở hoặc reload trang, helper đưa trang lên foreground trước khi chờ scene. Nếu scene không sẵn sàng, log ghi trạng thái loader, game loop và visibility để phân biệt lỗi tải asset với sai scene.

`sendMatchAction` chờ server phản hồi trước khi bước sau đọc snapshot. `resolveMatchChoice` trả lời lựa chọn của chính seat đang điều khiển. Test Liên Thủ chờ playback của cả hai seat hết bận trước vòng tiếp theo và trước assertion VFX, tránh tích lũy animation từ nhiều lượt.

## Lệnh kiểm tra

Chạy từ root:

```powershell
pnpm test
pnpm typecheck
```

Để giảm timeout do tải CPU khi xác minh trên máy chậm, chạy từng package với ít worker:

```powershell
pnpm -r --workspace-concurrency=1 test --maxWorkers=2
pnpm --filter server test --maxWorkers=1
```

Lệnh thứ hai xác minh server riêng; test production tạo nhiều tài khoản qua hash mật khẩu thật có thể vượt deadline 5 giây khi chạy cạnh suite khác. Không chạy simulation rules đồng thời với Chromium.

`client typecheck` kiểm tra cả `src`, unit tests, E2E và cấu hình Playwright qua `tsconfig.test.json`. Node types dùng phiên bản đã có trong lockfile.

Chạy E2E với backend pg-mem trong bộ nhớ ở terminal riêng:

```powershell
pnpm --filter server dev:test
```

Terminal thứ hai:

```powershell
pnpm --filter client dev
```

Terminal thứ ba, trong `apps/client`:

```powershell
$env:COMBAT_REVIEW_FIXTURE = '1'
pnpm exec playwright test --workers=1
```

`COMBAT_REVIEW_FIXTURE` cho phép test Arena dùng endpoint fixture của backend test để bổ sung Vinh Dự. Chạy một worker để các giao dịch pg-mem không chồng nhau. Backend này không cần PostgreSQL bên ngoài và không dùng dữ liệu tài khoản thật.

Các simulation tốn thời gian được bật riêng bằng `PLAYTEST_COOP`, `PLAYTEST_PVP`, `PLAYTEST_STORY`, `PLAYTEST_GEAR`. Chúng giữ trạng thái skip của lượt kiểm tra mặc định; economy simulation vẫn chạy mặc định.

## Rà soát ngày 2026-10-09

- Trước/sau refactor: **1.071 unit/integration test đạt**, **4 simulation được skip theo cấu hình có sẵn**, không mất tên case hoặc thay đổi trạng thái case.
- Playwright discovery giữ đủ **89 case** sau đổi tên và gộp helper.
- E2E chạy theo các batch nối tiếp: **84 đạt, 3 skip có điều kiện, 2 chưa đạt**. 28 case đầu có bằng chứng terminal; các batch sau lưu báo cáo JSON trong `output/test-audit/`.
- Ba case chèn art thủ công giữ điều kiện skip khi file art thật đã tồn tại, tránh ghi đè asset trong workspace.
- Cả 4 package đạt typecheck, bao gồm test client.
- Review độc lập xác nhận assertion được giữ nguyên; các assertion đăng ký/lưu deck được chuyển vào helper dùng chung.

Hai lỗi E2E còn lại giữ nguyên test và assertion:

1. `coop.spec.ts`: phòng riêng Liên Thủ — playback vẫn `busy` sau 60 giây khi chờ hai seat hết animation. Test đấu tập Liên Thủ đã đạt sau khi chờ board ổn định. Helper ghi thêm trạng thái queue, server/rendered state và game loop khi timeout để tiếp tục chẩn đoán.
2. `pvp.spec.ts`: phòng riêng PvP — bước chọn bài đã được xử lý, nhưng sau reload trang không vào `deck-select` trong 90 giây. Lượt cuối chưa có `window.__vn.game` tại thời điểm timeout. Chưa xác định nguyên nhân khởi động lại; không tăng timeout tiếp hoặc bỏ assertion.

Source production không thay đổi trong đợt rà soát này. Kết quả unit/integration cuối xác minh theo từng package; server đạt 60/60 khi chạy một worker sau một timeout do chạy cạnh suite khác.
