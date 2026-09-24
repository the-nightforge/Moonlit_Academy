# 05 — Màn hình chiến đấu (Prototype)

Prototype dùng **art tạm**: hình chữ nhật màu + tên. Mục tiêu là đọc được trạng thái trận và chơi được, chưa cần đẹp.

## 1. Thông số chung

- Độ phân giải thiết kế: **1280 × 720** (ngang), Phaser Scale Mode `FIT`, căn giữa.
- Nền: màu xanh đêm đậm. Màu nền thay đổi nhẹ theo pha trăng (Trăng Tròn sáng hơn, Trăng Non tối hơn).
- Phông chữ: một font sans-serif có hỗ trợ tiếng Việt, kèm fallback.

## 2. Bố cục

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Vòng 3                    ( 🌔 Trăng Khuyết Đầu )                  [⚙]     │  ← Thanh trên
│                    🌒 🌓 [🌔] 🌕 🌖 🌗 🌘 🌑   → kế tiếp: 🌕 hồi ×2          │  ← Nguyệt Luân
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│          ⚔ 9 → Tô Dạ                    ✦ Suy Yếu → Hoắc Liệt              │  ← Ý định
│        ┌────────────────┐              ┌────────────────┐                  │
│        │ Khôi Lỗi       │              │ Ảnh Hồ         │                  │  ← Kẻ địch
│        │ Canh Thư       │              │                │                  │
│        │ ██████░░ 30/42 │              │ ████████ 24/24 │                  │
│        │ 🛡 8  [Dấu 2]  │              │                │                  │
│        └────────────────┘              └────────────────┘                  │
│                                                                            │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │ Hoắc Liệt ★  │     │ Ôn Như Ý     │     │ Tô Dạ        │               │  ← Hero
│   │ ██████ 28/40 │     │ █████ 25/30  │     │ ███░░ 14/28  │               │    ★ = đã thăng cấp
│   │ 🛡 5 [Khiêu 1]│    │ [Hồi 2]      │     │ [Ẩn 1]       │               │
│   │ Liệt Hỏa 12/15│    │ Bách Thảo 1/3│     │ Vô Nguyệt 0/1│               │  ← tiến độ thăng cấp
│   └──────────────┘     └──────────────┘     └──────────────┘               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  ◉◉○        ┌────┐┌────┐┌────┐┌────┐┌────┐                  [Rút 7] [Bỏ 3] │
│  Nguyệt     │ 2  ││ 1  ││ 0  ││ 1  ││ 2  │                                 │  ← Bài trên tay
│  Lực 2/3    │Liệt││Thảo││Trấn││Ảnh ││Đoạt│                  [ KẾT THÚC ]   │
│             │Hỏa ││Dược││Bắc ││Bộ  ││Mệnh│                  [   LƯỢT   ]   │
│             └────┘└────┘└────┘└────┘└────┘                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

## 3. Thành phần

### Lá bài
- Kích thước ~110 × 160. Hiện: chi phí (góc trên trái), tên, dòng mô tả ngắn, **viền màu theo chủ** (M05 đỏ, F04 xanh lá, M06 tím xám).
- Chi phí thực tế khác chi phí gốc → hiện màu xanh (rẻ hơn) và gạch chi phí gốc.
- **Không đánh được** (thiếu Nguyệt Lực, chủ Đóng Băng): làm mờ 50%.
- **Tàn Chiêu**: xám hoàn toàn, có dấu nứt hoặc chữ "Tàn Chiêu".
- Hover: phóng to 1.2×, nhấc lên, hiện mô tả đầy đủ.
- **Lá Song Hành [GĐ2]:** viền hai màu (màu của cả 2 Hero), nhãn nhỏ "Song Hành". Thành Tàn Chiêu khi một trong hai Hero ngã; mờ khi một trong hai Hero Đóng Băng.
- **Lá cần Huyết Nguyệt [GĐ2]:** khi không Huyết Nguyệt thì làm mờ như lá không đánh được (lý do lấy từ `rules`).

### Hero / Kẻ địch
- Thanh HP có số, giáp (🛡 + số), danh sách trạng thái dạng nhãn ngắn kèm số (`Ẩn 1`, `Hồi 3`, `Yếu 2`, `Phản 2` **[GĐ2]**). Hover nhãn → hiện mô tả trạng thái.
- Nhãn trạng thái hiển thị **theo thứ tự `statuses[]`** — đây là thứ tự bị Cướp buff **[GĐ2]**.
- Hero: dòng tiến độ thăng cấp (`Liệt Hỏa 12/15`). Đã thăng cấp → dấu ★ và viền vàng.
- Hero ngã: xám, chữ "Ngã".
- Kẻ địch Ẩn Thân: bán trong suốt.

### Ý định
- Phía trên mỗi kẻ địch: biểu tượng theo `kind` (⚔ attack, 🛡 defend, ⚔🛡 attackDefend, ✦ debuff, ⬆ buff, ★ special) + **con số damage đã tính theo công thức hiện tại** (đã gồm Suy Yếu, Dễ Vỡ…) + tên Hero mục tiêu.
- Nếu mục tiêu đã đổi do Khiêu Khích / Ẩn Thân: hiện mục tiêu **sau khi xác định lại** (dùng cùng logic 9.3.1, gọi hàm từ `rules`, không tự tính ở client).
- Vẽ đường nối mờ từ ý định tới Hero mục tiêu khi hover kẻ địch.

### Nguyệt Luân
- Dãy 8 biểu tượng, pha hiện tại phóng to và sáng.
- Dòng "kế tiếp: [pha] [hiệu ứng]" để người chơi lên kế hoạch.
- Hover một pha → hiện hiệu ứng của pha đó.
- **Huyết Nguyệt [GĐ2]:** khi `bloodMoonRounds > 0`: nền đỏ tối, icon 🔴 **cạnh** bánh xe kèm số lượt còn lại. Pha hiện tại vẫn hiển thị và vẫn tiến bình thường.

### Màn chọn đội [GĐ2]
- Trước trận: chọn 3 trong số các Hero có trong `heroes.json` và chọn encounter.
- Hiện các lá Song Hành sẽ được thêm vào deck theo đội đang chọn.

## 4. Tương tác

| Thao tác | Kết quả |
|---|---|
| Click lá `target: none` | Đánh ngay |
| Click lá `target: enemy / ally` | Vào chế độ chọn mục tiêu: mục tiêu hợp lệ sáng lên (lấy từ `getValidTargets`), mục tiêu không hợp lệ mờ đi. Click mục tiêu để đánh |
| Kéo lá lên mục tiêu | Tương đương (làm sau, không bắt buộc ở prototype) |
| Chuột phải / Esc | Hủy chọn mục tiêu |
| Nút Kết Thúc Lượt / phím `E` | `endTurn` |
| Trong lúc phát animation | Khóa input |

Hành động bị `rules` từ chối → rung nhẹ lá bài + hiện lý do (từ `error`).

## 5. Phát animation từ event

Client giữ một **hàng đợi event**, phát lần lượt, mỗi event một animation ngắn (tổng một lượt kẻ địch không nên quá ~3 giây).

| Event | Animation gợi ý | Thời lượng |
|---|---|---|
| `cardsDrawn` | Lá bay từ chồng rút vào tay, lệch nhau | 80 ms/lá |
| `cardPlayed` | Lá bay lên giữa màn hình, phóng to, rồi mờ dần | 300 ms |
| `damageDealt` | Mục tiêu rung + chớp đỏ, số damage bay lên (hiện phần bị giáp chặn màu xám) | 350 ms |
| `hpLost` | Chớp tím, số bay lên. `cause: "reflect"`: tia phản từ mục tiêu về nguồn; `cause: "bloodMoon"`: chớp đỏ trên mọi Hero cùng lúc | 250 ms |
| `healed` | Chớp xanh lá, số `+N` bay lên | 300 ms |
| `armorGained` | Biểu tượng khiên phóng to | 200 ms |
| `statusApplied` / `statusRemoved` | Nhãn trạng thái bật ra / mờ đi. Cướp buff (`statusRemoved` rồi `statusApplied` cùng status, liên tiếp): nhãn bay từ mục tiêu sang người cướp | 150 ms |
| `moonShifted` | Bánh xe trăng xoay, màu nền đổi dần | 500 ms |
| `bloodMoonChanged` **[GĐ2]** | Bật/tắt nền đỏ, cập nhật số lượt Huyết Nguyệt | 500 ms |
| `intentRevealed` | Biểu tượng ý định bật ra | 150 ms |
| `intentExecuted` | Kẻ địch lao nhẹ về phía mục tiêu | 250 ms |
| `heroLeveledUp` | Khung Hero lật 180°, viền vàng, particle, tên dạng thăng cấp hiện giữa màn hình | 1000 ms |
| `unitDied` | Mờ dần, xám | 400 ms |
| `combatEnded` | Bảng "Thắng" / "Thua", nút Chơi lại | — |

Sau khi phát hết event, **vẽ lại toàn bộ UI từ state mới** để tránh lệch số.

## 6. Công cụ debug (chỉ bản dev)

Bảng ẩn/hiện bằng phím `` ` ``:
- Seed hiện tại + nút chơi lại với cùng seed.
- Chọn encounter.
- Nút: +3 Nguyệt Lực, rút 1 lá, đặt pha trăng bất kỳ, giết kẻ địch, đặt HP Hero, đặt `bloodMoonRounds` **[GĐ2]**.
- Log event dạng chữ.

Các nút debug gọi hàm debug riêng trong client (thao tác state trực tiếp), **không** thêm vào `Action` chính thức.
