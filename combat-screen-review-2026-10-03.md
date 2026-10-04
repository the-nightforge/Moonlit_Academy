# Review màn hình chiến đấu — 03/10/2026

Màn chiến đấu có nền cổ phong, khung bài và icon khá đồng bộ. Phần cần ưu tiên hiện tại là tính chính xác của thông tin, trình tự animation và khả năng đọc trận. Thêm particle ngay lúc này sẽ làm các vấn đề đó khó nhìn hơn.

Bản review này không sửa implementation. P1 là lỗi có thể làm trận online mất đồng bộ hoặc không tiếp tục được; P2 là lỗi thông tin/tương tác/animation ảnh hưởng việc đọc trận; P3 là lỗi nhỏ hoặc phần cần hoàn thiện. Các đề xuất mỹ thuật được ghi riêng, không coi mọi khác biệt với prototype là bug.

**Phạm vi và bằng chứng**

- Đọc toàn bộ `combat-scene.ts`, `event-animator.ts`, `vfx.ts`, các helper về attack style, theme, HUD và tooltip; đối chiếu event và query trong rules, view PvP và luồng mạng liên quan.
- Chạy trận lẻ offline với đội mặc định, Đổi Bài, chọn mục tiêu, đánh Đoạt Mệnh, chuyển lượt; quan sát HP, giáp, Phản Đòn, Hộ Vệ và đổi pha.
- Kiểm tra layout tại 1280×720, 1366×768, 1024×576 và cửa sổ cao mặc định. Bố cục chính giữ được; chữ nhỏ và lượng thông tin bị giấu là điểm yếu rõ nhất.
- PvP/co-op được review bằng code và kiểm tra luồng dữ liệu; chưa chơi trực tiếp hai tài khoản online vì không có server local hoạt động. Các lỗi online dưới đây có đường đi cụ thể trong code, không phải kết quả playtest hai người.
- `pnpm test`: data 49, rules 702, client 7, server 50 — tổng 808 passed, 3 skipped. `pnpm typecheck`: tất cả package qua. Client hiện chỉ có test chọn attack style, chưa kiểm tra timeline/queue/layout.
- Luật hiện hành trong `01-combat-rules.md` giữ chuỗi chiêu địch ở trạng thái nội bộ. Vì vậy **không đánh dấu việc thiếu telegraph ý định địch là lỗi**, dù `05-ui-combat-screen.md` còn mô tả giao diện prototype cũ.

**Các lỗi cần xử lý trước**

1. **[P1] Các đợt event online chạy chồng nhau và có thể đưa UI về state cũ.**

   [combat-scene.ts:336](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:336) gọi `playEvents` độc lập cho mỗi push. Mỗi promise tự gán lại `this.state = view`, vẽ lại và mở input khi hoàn thành. Trong co-op, một người đánh lá có chuỗi animation dài, người còn lại đánh lá ngắn: đợt mới có thể xong trước, rồi đợt cũ ghi đè HP/tay bài/status của đợt mới. Rejoin cũng không vô hiệu hóa completion của đợt đang chạy. Kiểm tra bằng harness dùng chính method này cho thứ tự render `[2, 1]` khi resolve đợt mới trước đợt cũ.

   Hướng xử lý: một queue ở cấp scene, giữ thứ tự push; mỗi đợt có snapshot tương ứng. Rejoin/shutdown cần hủy hoặc làm mất hiệu lực completion cũ. Input chỉ mở khi toàn bộ queue đã hết.

2. **[P1] Kết nối lại không đồng bộ sequence hành động, có thể khiến người chơi không đánh tiếp được.**

   [match.ts:113](D:/Source/VongNguyet/apps/client/src/net/match.ts:113) phục hồi view và event sequence nhưng không phục hồi action sequence. Sequence tăng trước khi gửi; nếu mất kết nối đúng lúc một action chưa tới server, action sau dùng sequence quá cao. Handler rejection reset về cùng sequence sai nên retry không tự hồi phục. Reload trang tạo `NetMatch` với sequence 1 trong khi server đã đi xa hơn; server bỏ qua sequence cũ, scene chờ phản hồi và khóa input. Harness với NetMatch thực cho chuỗi gửi `[1, 2, 2]` ở tình huống mất action đầu.

   Hướng xử lý: snapshot chứa sequence server đang chờ; phân biệt action đang chờ xác nhận, đã chấp nhận và cần gửi lại.

3. **[P1] Trận kết thúc trong lúc mất mạng có thể không hiện kết quả khi kết nối lại.**

   [hub.ts:167](D:/Source/VongNguyet/apps/server/src/realtime/hub.ts:167) không đưa trận đã kết thúc vào `welcome.activeMatch`; [socket.ts:80](D:/Source/VongNguyet/apps/client/src/net/socket.ts:80) chỉ gọi recovery khi có field đó. Combat scene bỏ qua `welcome` không chứa trận. Khi người chơi bị xử thua do disconnect, hoặc trận kết thúc trong thời gian offline, overlay mất mạng có thể biến mất nhưng scene vẫn giữ trận cũ, không có bảng kết quả/nút về lobby. Server cũng bỏ qua action/resign của phòng đã kết thúc.

   Hướng xử lý: recovery phải trả được terminal result, hoặc chuyển scene về lobby cùng thông báo và refresh hồ sơ khi trận không còn active.

4. **[P2] Thoát bảng kết quả sớm có thể làm mất thông báo thưởng và refresh hồ sơ.**

   [combat-scene.ts:1948](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1948) cho về lobby và xóa `session.match` ngay cả khi `match.end` chưa tới. Server gửi event kết thúc trước, sau đó mới settlement DB và gửi rating/reward. Nếu settlement chậm hơn animation, người chơi về lobby trước thì frame cuối không còn match để xử lý, nên `onEnd` refresh hồ sơ không chạy.

   Hướng xử lý: nhận settlement ở lớp session độc lập scene; bảng kết quả có trạng thái đang nhận thưởng và vẫn cập nhật được nếu người chơi chuyển màn.

5. **[P2] “Tàn Chiêu” đọc nhầm chủ lá khi hai ghế dùng cùng Hero.**

   [combat-scene.ts:1539](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1539) tìm Hero chỉ theo `defId`, thiếu `hero.player === instance.player`. Trong PvP/co-op có cùng Hero ở hai ghế, Hero đầu tiên trong mảng có thể thuộc người khác: Hero đó ngã làm lá của mình bị gắn Tàn Chiêu dù chủ thật còn sống, hoặc ngược lại. Logic rules vẫn xét ghế chính xác nên phần trình bày mâu thuẫn với khả năng đánh lá.

   Hướng xử lý: dùng query `cardOwners` đã có trong rules, thống nhất với `isCardPlayable`.

6. **[P2] Thời hạn status PvP hiện số nội bộ thay vì số vòng.**

   [combat-scene.ts:1131](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1131) đưa trực tiếp `status.value` lên icon; popup ở [event-animator.ts:405](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:405) cũng dùng giá trị đó. PvP lưu duration theo nửa vòng; query `displayDuration` quy định hiển thị `ceil(value / 2)`. Vì view PvP không đổi các giá trị này, cả badge và popup đều có thể báo hai lượt cho hiệu ứng một vòng.

   Hướng xử lý: dùng helper hiển thị của rules cho duration; giữ nguyên số stack cho Strength/Burn/Reflect…

7. **[P2] Popup cộng status dùng tổng mới như lượng vừa cộng.**

   [event-animator.ts:405](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:405) hiện `+Mạnh 5` khi Strength đang 3 được cộng thêm 2, vì `statusApplied.value` là tổng mới. Ký hiệu cộng dễ khiến người chơi hiểu rằng được cộng 5.

   Hướng xử lý: hoặc ghi rõ `Mạnh → 5`, hoặc event/presentation state cung cấp delta để hiện `+Mạnh 2`.

8. **[P2] Lá đối thủ lần đầu đánh trong PvP không hiện tên, có thể dùng sai kiểu VFX.**

   [combat-scene.ts:466](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:466) truyền state trước action cho animator. View trước action đã xóa identity lá trên tay đối thủ; [event-animator.ts:283](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:283) không tìm được lá, nên label chỉ còn `◆ `. Hit sau đó thiếu card context và damaging skill có thể dùng kiểu đòn vật lý theo Hero/vũ khí. Snapshot mới có lá công khai trong discard nhưng được gán sau playback.

   Hướng xử lý: cung cấp metadata của lá đã công khai từ snapshot mới/event, đồng thời giữ state trình bày trước action cho HP/giáp.

9. **[P2] Animation rút bài và tài nguyên của ghế khác chạy ở vị trí của mình.**

   [event-animator.ts:254](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:254) bỏ qua `cardsDrawn.player`, luôn bay từ pile của mình vào hand của mình. Tương tự `moonPowerChanged` và `moonReserveChanged` của Hero dùng vị trí orb local. PvP vẫn gửi số lượng rút đã redact, còn co-op gửi event đầy đủ, nên lỗi vẫn xuất hiện.

   Hướng xử lý: context có anchor pile/hand/resource của từng ghế; own, partner và opponent có đường bay/nhãn riêng. Không tiết lộ identity lá PvP bị ẩn.

10. **[P2] Đòn nhiều hit bị gom thành đòn đồng thời.**

    [event-animator.ts:195](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:195) gom mọi damage liên tiếp cùng `sourceId`, rồi phát bằng `Promise.all`, không phân biệt target. Ví dụ Nộ Hỏa Liên Hoàn 3/5 hit: mọi hiệu ứng xuất hiện cùng lúc, damage text chồng đúng một tọa độ. Hit phá giáp và hit mất HP cũng không còn trình tự dễ đọc.

    Hướng xử lý: nhiều mục tiêu của cùng một hit có thể đồng thời; hit lặp trên cùng mục tiêu cần từng nhịp. Nên có thông tin hit/group trong presentation event thay vì suy đoán mọi chuỗi cùng source là AoE.

11. **[P2] Số damage và rung mục tiêu đến muộn so với điểm chạm.**

    [event-animator.ts:339](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:339) chờ `playAttack` xong mới rung/hiện số. Slash gọi impact trước rồi chạy phần lưỡi chém thêm 330 ms; ribbon impact rồi thu về thêm 220 ms. Do đó spark/ring và số damage lệch nhịp rõ, dù comment ghi số xuất hiện đúng lúc hit.

    Hướng xử lý: tách tín hiệu impact khỏi completion cleanup. Flash, hit reaction, damage text và cập nhật thanh HP bắt đầu ở cùng điểm impact.

12. **[P3] Hover vẫn thay đổi lá đang cast.**

    [vfx.ts:853](D:/Source/VongNguyet/apps/client/src/ui/vfx.ts:853) tween chính container interactive trên tay. `pointerout` ở [combat-scene.ts:1739](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1739) vẫn reset scale/y về hand; `pointerover` vẫn nhấc lá lên. Input lock chỉ chặn dispatch. Với lá không cần mục tiêu, di chuyển chuột trong lúc cast có thể làm lá giật vị trí hoặc scale.

    Hướng xử lý: tắt interaction/hover của lá đang cast, hoặc dùng bản sao visual tách khỏi hand container.

13. **[P3] Resize hoặc redraw trong playback phá hình đang animate.**

    [combat-scene.ts:233](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:233) render lại khi resize; toggle debug và đổi trạng thái kết nối cũng làm vậy. [combat-scene.ts:562](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:562) destroy toàn bộ children, bao gồm target của cast/lunge/death. Hình có thể biến mất, state cũ được dựng lại giữa animation. Phaser bản cài hiện tại vẫn hoàn tất tween target bị destroy, nên **không kết luận lỗi này làm promise treo vĩnh viễn**.

    Hướng xử lý: layout update và lifecycle animation dùng chung cơ chế hủy/rebuild; defer redraw hoặc hoàn tất playback một cách có kiểm soát.

**Review UI và layout**

| Thành phần | Hiện trạng | Đề xuất và ưu tiên |
|---|---|---|
| Nguyệt Luân | Chỉ một icon hiện tại; tooltip có pha/lệnh/ưu đãi. Không có cách bình thường xem 7 pha khác cùng lệnh đã bốc. | **P2:** trả lại lịch 8 pha tương tác, tên pha + tên lệnh hiện tại luôn đọc được. Lịch trăng là thông tin chung để lên kế hoạch. Nguồn: `combat-scene.ts:809`. |
| Huyết Nguyệt | Thay icon pha bằng icon đỏ; số vòng chỉ ở tooltip. | **P2:** giữ icon pha thật và thêm badge đỏ có số vòng. Người chơi vẫn cần biết pha đang chạy và thời hạn Huyết Nguyệt. Nguồn: `combat-scene.ts:813`. |
| Tay bài | Kích thước 110×160, y=680; ở 16:9 chỉ nhô phần trên. Hover nhấc lên và tooltip đầy đủ. | Peek là chủ ý, không coi là clipping bug. Tuy nhiên thao tác scan cả hand phụ thuộc hover từng lá. Cân nhắc hiện toàn bộ hand trong mulligan/choice và thêm nhãn chủ rõ ràng. |
| Chữ bài | Tên 11 px, mô tả 9 px và có thể giảm còn 6.5 px. | **P2 về khả năng đọc:** dùng mô tả rút gọn có giới hạn dòng; body 11–12 px ở kích thước thiết kế, preview lớn 13–14 px. Ở 1024×576 body hiện càng khó đọc. Nguồn: `combat-scene.ts:1665`. |
| Chi phí | Badge effective cost chính xác; cost gốc gạch khi giảm. Tooltip vẫn mở đầu bằng cost gốc. | Tooltip nên có effective cost và lý do biến đổi để khớp badge, kèm lý do không đánh được. |
| Chủ lá / Song Hành | Owner jewel và viền; Song Hành có viền thứ hai nhưng thiếu nhãn tên/biểu tượng riêng. Palette chỉ có 5/20 Hero. | Hoàn thiện palette/owner identity cho 20 Hero, nhãn Song Hành và Binh Khí rõ hơn. Nguồn: `theme.ts:82`, `combat-scene.ts:1606`. |
| Hero/kẻ địch | HP và giáp rõ; thanh máu nhỏ; max HP và tiến độ Thức Tỉnh nằm trong tooltip, tiến độ còn có nét chạy quanh khung. | Giữ badge HP/giáp; thêm progress ngắn khi chưa Thức Tỉnh để người chơi biết điều kiện còn thiếu. Nét khung khó đọc thành con số. |
| Status | Icon theo thứ tự state, tooltip dữ liệu; phần lớn status có hình riêng. | Điểm tốt. Nhưng nhiều status sẽ phủ art; cần ưu tiên vùng badge ổn định, tránh particle làm mất HP/name. Đổi đơn vị duration PvP trước khi polish. |
| Nguyệt Lực | Orb ở góc phải, arc theo cap; reserve xanh và có tooltip. | Dễ tìm nhưng rất xa hand. Có thể thêm feedback chi phí tại lá/cast để mắt không phải chạy qua lại hai góc. |
| Pile | Chồng rút/bỏ có số, tooltip tổng. | Thêm khả năng mở chồng bỏ công khai và xem deck theo luật từng mode. Không mở identity draw pile PvP bị ẩn. |
| Kỳ Vật/Lõi | Nằm trong tooltip tên encounter; trigger hiện text giữa màn. | Hiện thanh icon nhỏ, tooltip từng món và flash đúng icon khi trigger. Hiện tại chưa có cảm giác món nào vừa hoạt động. Nguồn: `combat-scene.ts:783`, `event-animator.ts:517`. |
| Chọn mục tiêu | Viền vàng mục tiêu hợp lệ, dim mục tiêu khác; Esc/right-click hủy. | Luồng cơ bản hoạt động trong playtest. Lá đã chọn nên giữ lift/preview; thêm đường aim từ lá/source tới mục tiêu đang hover để đọc hướng tốt hơn. Drag chưa có và prototype cho phép hoãn, nên không coi là bug. |
| Kết thúc lượt | Medallion + phím E, tooltip reserve; số vòng hiện trên nút. | Khi queue chạy, nút vẫn có vẻ active và thiếu nhãn đang xử lý. Cho visual busy thống nhất input lock, phân biệt enemy/opponent/partner đang hành động. |
| Co-op | 6 Hero nhỏ hơn, viền xanh phía đồng đội, hand partner dạng tile cost. | Thêm tên/chỉ báo nhóm ngay trên row. Partner tile dùng `card.cost` gốc (`combat-scene.ts:1342`), cần nói rõ hoặc hiển thị effective cost đúng ghế. Summon thứ hai có thể tiến vào vùng cột điều khiển; cần layout zone riêng. |
| Chọn Pha | Panel 212×116, mô tả wrap nhưng không tính chiều cao. | Kiểm thêm các lệnh dài; nên autosize hoặc rút gọn mô tả và mở tooltip. Đây là rủi ro từ code, chưa xác nhận bằng playtest panel này. Nguồn: `combat-scene.ts:1872`. |
| Settings | Có glyph ⚙ ở góc nhưng không có interaction/handler. | **P3:** làm settings thật hoặc bỏ glyph trang trí. Cần tốc độ animation, âm thanh và mức rung màn hình nếu bổ sung chúng. Nguồn: `combat-scene.ts:789`. |

**Review art, animation và VFX theo từng nhịp**

| Nhịp | Đánh giá hiện tại | Việc cần hoàn thiện |
|---|---|---|
| Vào trận / bốc lệnh | `create()` chỉ render; không phát `session.events` khởi tạo. Animator có `moonDecreesRolled` nhưng không thấy nhịp giới thiệu đầu trận trong luồng offline. | Một intro ngắn cho encounter/pha/lệnh, rồi mở mulligan. Không kéo dài loading. |
| Đổi Bài / rút bài | Mulligan UI rõ. Draw dùng hình chữ nhật nhỏ, bay vào các slot 70 px cố định không khớp layout hand 120 px mặc định. | Dùng card back HUD và destination thực; tách ghế như lỗi 9. |
| Cast | Có bay tới giữa màn, halo/ring/motes; màu theo tag. | Sửa hover như lỗi 12; giảm thời gian giữ ở giữa cho lá routine, giữ nhịp lớn cho lá đặc biệt. Target none cũng cần dấu nguồn dễ đọc. |
| Attack | Có 14 kiểu theo lore/vũ khí và spell fallback; đây là nền tốt để nhận dạng Hero. | Sửa multihit và impact trước. Không nhân số projectile chỉ để tăng độ mạnh; ưu tiên nhịp và hướng. |
| AoE | Damage liên tiếp có cơ chế gom. | Nhận diện đúng nhóm AoE, flash từng mục tiêu đồng thời, damage text tách vùng; không gom repeated hit như lỗi 10. |
| Damage / block | Có số HP mất riêng và số bị giáp chặn; fully blocked dùng màu xanh. | Đồng bộ hit reaction với impact. HP/giáp hiện giữ state cũ suốt batch rồi nhảy về cuối; một presentation state cập nhật theo event sẽ dễ đọc hơn, vẫn giữ rules là nguồn chân lý. |
| Heal / armor | Heal flash xanh + số; armor hiện text khiên. | Khiên gain nên pop vào đúng badge; armor removed cần nhịp riêng. Flash fixed 140×200 không khớp Hero co-op 112×162 hoặc summon 88×124. |
| HP loss đặc biệt | Chỉ bloodMoon đổi sang đỏ; decree, bloodPact, burn và loseHp đều đi qua flash tím. | Màu/shape theo cause: burn cam, bloodPact đỏ, decree trắng trăng. Giữ chữ nguyên nhân để không phụ thuộc màu. |
| Phản Đòn / cướp buff | Có beam phản và label status bay giữa hai unit. | Nền đúng ý tưởng; kiểm các chuỗi có death/trigger xen giữa để không dựa hoàn toàn vào adjacency. Không đánh dấu mọi status remove/apply gần nhau là cướp nếu bổ sung event nhóm. |
| Status lâu dài | Frost, stealth mist, burn ember, weak wisp, crack, crosshair, regen, strength rim, empower star, reflect sheen, guard barrier, charm heart. | Giữ bộ ngôn ngữ này, hạn chế tổng số effect đồng thời. Tooltip và badge phải nổi hơn particle. |
| Đổi pha | Moon wheel hiện giữa trận, quay và bay về badge. Một bước dùng khoảng 1090 ms, thêm tên pha 400 ms: khoảng 1.49 giây chưa tính overhead. | Giảm nhịp đổi pha thường xuống khoảng 0.5–0.7 giây, dùng nhịp đầy đủ cho đổi pha đặc biệt. Tên/lệnh cập nhật đúng thời điểm wheel tới badge. Nguồn: `vfx.ts:911`, `event-animator.ts:432`. |
| Nền theo pha | Khi có background art, các pha thường cùng một nền và overlay tối 0.3; `PHASE_BG` chỉ dùng khi thiếu art. | Thêm tint/lighting transition nhẹ theo pha. Huyết Nguyệt có overlay đỏ nhưng nhảy sau redraw, chưa chuyển màu liền với timeline. Nguồn: `combat-scene.ts:681`. |
| Hủy Bài / Luân Hồi | `cardDiscarded`, `cardsRecycled` trả instant. | Hủy lá thành bụi hoặc trượt vào discard; recycle từ discard về draw; đồng bộ số pile đúng nhịp. Nguồn: `event-animator.ts:293`. |
| Thức Tỉnh | Banner tên và flash vàng; render sau batch mới đổi frame/art. | Thêm transform/flip tại đúng unit, tên dạng mới dễ nhận. Hiện không có asset `_up` nào nên không có visual form mới. Không cần explosion dài cho mọi level-up. |
| Death / revive | Death burn có fade/lift/ash; revive flash vàng và chữ. | Fade chết rồi dựng lại card “Ngã” sau batch có thể tạo cảm giác xuất hiện lại. Giữ fallen visual nhất quán; revive nên đưa chính card từ trạng thái ngã về sống ở thời điểm event. |
| Summon | Vòng vàng trên owner nếu chưa có anchor summon; panel chỉ xuất hiện ở cuối batch; attack style fallback slash. | Tạo visual summon ở event `summoned`, lưu anchor để các event kế tiếp dùng được. Dùng kiểu hành động phù hợp Linh Thú thay vì slash mặc định. |
| Boss/Hợp Kích | Banner được giữ tới cuối batch và mở input trước khi banner chạy; duration mỗi banner khoảng 1.9 giây. | Gắn banner vào thời điểm trigger, tránh hai banner nối nhau che hành động lượt mới; mức độ block input phải nhất quán. Nguồn: `combat-scene.ts:326`, `combat-scene.ts:345`. |
| Camera shake | `impact` rung mỗi lần gọi, kể cả projectile phụ; đổi pha cũng gọi impact. | Có budget rung cho một action và phân cấp nhẹ/mạnh. Thêm reduced motion/mức rung. Hiện chưa có âm thanh chiến đấu; nên có cue ngắn tại cast, impact, block, heal, đổi pha, thắng/thua khi làm polish. |

**Độ hoàn thiện tài nguyên**

Workspace có art thường cho **10/20 Hero**, **0 art dạng Thức Tỉnh**, thư mục enemies chưa có art và không có art summon. Cards chưa có art riêng nhưng đã có fallback icon theo tag nên thiếu card art không phải lỗi tải bắt buộc. Trong đội mặc định, Hoắc Liệt và Ôn Như Ý có portrait; Tô Dạ và cả hai kẻ địch trận đầu chỉ là panel trống.

Unit fallback hiện chỉ có tên/HP trên panel, để lại vùng portrait trống lớn (`combat-scene.ts:846`, `coverImage:1172`). Nên dùng silhouette/emblem có tên rõ làm placeholder nhất quán trước khi đủ art. Nền hiện rất giàu chi tiết, trong khi unit/card nhỏ; thêm vùng tối nhẹ sau hai row sẽ giúp ưu tiên đối tượng chiến đấu và giảm nhiễu thị giác.

**Nhịp độ và tiêu chí nghiệm thu đề xuất**

Tổng animation lượt địch hiện không có budget chung. Một chiêu gồm intent label 550 ms, attack, damage text 350 ms, thêm status/armor; hai hoặc ba kẻ địch nối nhiều chiêu, cộng đổi pha khoảng 1.49 giây, có thể vượt đáng kể mục tiêu khoảng 3 giây của prototype. Đây là tổng từ duration code, chưa phải benchmark FPS/thời lượng đầy đủ của mọi encounter.

Nên có tốc độ 1×/2× và nhịp chuẩn: cast → impact → cập nhật số/HP → cleanup. Buff/heal routine có thể gom hợp lý, nhưng không bỏ thứ tự khi outcome phụ thuộc giáp, reflect, death hoặc revive.

Các kiểm thử cần thêm khi sửa:

- Hai push online resolve với duration khác nhau vẫn render đúng thứ tự, không mở input giữa queue.
- Rejoin trong animation vô hiệu hóa completion cũ; mất action/reload phục hồi sequence và terminal result.
- Hai ghế dùng cùng Hero: owner alive/dead, Tàn Chiêu, effective cost và targeting đều theo đúng ghế.
- PvP duration icon/popup dùng số vòng; status cộng stack không báo delta sai.
- Multi-hit một target chạy từng nhịp; AoE nhiều target cùng hit có thể chạy đồng thời.
- Opponent card công khai hiện được tên/kiểu cast; opponent draw không bay vào tay local.
- Resize, chuyển scene và hover lúc cast không làm visual giật hoặc để animation completion sửa scene mới.
- Hand 0/1/8 lá, văn bản dài, nhiều status, hai summon co-op, Chọn Pha, Huyết Nguyệt, bảng mất mạng và kết quả có thể đọc được ở các kích thước đã nêu.

**Thứ tự triển khai hợp lý**

1. Sửa queue/lifecycle/reconnect/settlement, bảo đảm state và input lock chính xác.
2. Sửa owner theo ghế, duration PvP, card reveal và anchor tài nguyên từng ghế.
3. Sửa hit grouping/impact, hover và presentation state theo event.
4. Hoàn thiện Nguyệt Luân, Huyết Nguyệt, font/preview, owner identity và fallback art.
5. Bổ sung các animation còn instant, cân bằng duration/shake, rồi mới âm thanh và polish art.

