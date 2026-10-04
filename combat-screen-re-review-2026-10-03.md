# Review lại màn hình chiến đấu sau ba plan — 03/10/2026

## Kết luận

**Chưa đạt gate hoàn thành cả ba plan.** Nhánh đã có phần lớn kiến trúc queue/recovery, presentation theo event và layout mới, nhưng còn **12 finding P2 và 5 finding P3**, U5 chưa hoàn thành và gate E2E offline còn đỏ. Các lỗi dưới đây có điều kiện tái hiện cụ thể; không suy luận rằng test xanh đồng nghĩa mọi tiêu chí đã đạt.

Review trên `feature/combat-ui-layout-assets`, HEAD `138cc0d` (`fix: close combat UI review gaps`), phạm vi `c733016..138cc0d`: 68 file, 9373 dòng thêm/1135 dòng xóa. Đối chiếu master plan và N1–N4, A1–A5, U1–U6. Review code toàn nhánh, chạy kiểm tra chính thức, probe bổ sung và thao tác trực tiếp trên trình duyệt offline.

Không sửa source game/server, test chính thức, branch hoặc commit. `.gitignore`, ảnh m06–m08 và tài liệu untracked của người dùng được giữ nguyên. Probe/log/ảnh review nằm trong `.sdd-work`; báo cáo này là artifact mới.

## Findings P2 — cần giải quyết trước khi đóng plan

### F01. Settlement của tài khoản cũ ghi đè hồ sơ tài khoản mới

- **Vị trí:** [account.ts:44](D:/Source/VongNguyet/apps/client/src/account.ts:44), [account.ts:93](D:/Source/VongNguyet/apps/client/src/account.ts:93), [match-registry.ts:84](D:/Source/VongNguyet/apps/client/src/net/match-registry.ts:84). Plan N4.
- **Tái hiện:** A nhận settlement và bắt đầu `GET /profile`; trước khi request trả về, logout A rồi login B. Registry dispose chỉ xóa map, không vô hiệu callback đang await. `resumeSession()` áp dụng reply A vào session toàn cục; sau đó notice của A cũng vào session B.
- **Bằng chứng:** probe dùng các hàm login/logout/registry thật và deferred fetch: B có 222 Nguyệt Ngọc, sau reply A còn 111, kèm `Trận trước: Thắng`.
- **Tác động:** hồ sơ, revision và thông báo trên UI thuộc sai tài khoản. Probe chứng minh client state bị ghi đè; không chứng minh server chuyển thưởng giữa tài khoản.
- **Đề xuất:** account generation/token được chụp khi request bắt đầu; kiểm tra trước `applyServerProfile` và trước notice. Logout/auth reset phải vô hiệu thế hệ cũ. Chỉ guard sau `await resumeSession()` là quá muộn.
- **Regression:** pending settlement A → logout → login B → trả profile A; profile/rev/notices B phải nguyên vẹn, kể cả nhánh request thất bại.

### F02. Reconnect không nhận snapshot/settlement của trận cũ đang chờ thưởng

- **Vị trí:** [hub.ts:254](D:/Source/VongNguyet/apps/server/src/realtime/hub.ts:254), đặc biệt `room.handleSync(seat)` tại dòng 260. Plan N4.
- **Tái hiện:** trận A kết thúc nhưng transaction thưởng còn chờ → vào trận B → mất socket/reconnect. Hello chỉ gắn socket mới vào B. Registry gửi `match.sync` cho A, nhưng handler sync dùng seat.socket cũ của A.
- **Bằng chứng:** probe pg-mem + Fastify WebSocket: sync A không có snapshot trả về; khi mở transaction gate, socket mới nhận 0 `match.end` của A.
- **Tác động:** thưởng có thể đã ghi đúng ở server, nhưng client mất kết quả/notice/refresh cho trận cũ; cơ chế retained settlement không đạt mục tiêu N4.
- **Đề xuất:** gắn connection hiện tại vào own seat của room được sync trước khi trả snapshot; giữ hành vi terminal attach không khởi động lại turn clock.
- **Regression:** retained A + live B → reconnect B → sync A đang pending → hoàn tất A; nhận snapshot và end A đúng một lần trên socket mới, không đổi B.

### F03. Co-op thắng hiển thị THUA trong lúc chờ settlement

- **Vị trí:** [combat-scene.ts:2592](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2592). Plan N3.
- **Tái hiện:** terminal co-op có `status: won`, settlement pending, chưa có `match.end`. Co-op không điền winner seat như PvP. So sánh `state.winner === mySeat` cho false.
- **Bằng chứng:** gọi renderer thật với fixture co-op: text `THUA`, `Đang nhận kết quả thưởng…`, audio `defeat`. End đến sau sửa chữ nhưng terminal audio đã bị dedupe.
- **Đề xuất:** tính provisional outcome theo mode: co-op dùng terminal status, PvP dùng seat-relative winner; ưu tiên settlement outcome khi đã có. Xét riêng forfeiture khi dữ liệu cá nhân có sẵn.
- **Regression:** co-op won/lost ở cả hai ghế, pending/complete/failed; không phát nhạc thua trước rồi chuyển sang thắng.
- **Lưu ý lịch sử:** biểu thức winner fallback đã tồn tại trước phạm vi diff; đây là yêu cầu terminal recovery của plan vẫn chưa được khép lại, không gán là regression mới của commit cuối.

### F04. Âm rút bài làm mất âm thắng/thua và những lần rút sau

- **Vị trí:** [combat-audio.ts:37](D:/Source/VongNguyet/apps/client/src/ui/combat-audio.ts:37), [combat-audio.ts:103](D:/Source/VongNguyet/apps/client/src/ui/combat-audio.ts:103); callers ở [event-animator.ts:538](D:/Source/VongNguyet/apps/client/src/ui/event-animator.ts:538). Plan A5.
- `draw` vừa dùng cho rút/bỏ/tạo/tái chế bài, vừa nằm trong set terminal. Sau lần đầu nghe `draw`, `terminalPlayed` thành true suốt instance.
- **Bằng chứng:** AudioContext fake thực thi class thật, `draw → draw → victory` chỉ khởi động 1 oscillator.
- **Đề xuất:** tách cue rút bài khỏi cue hòa trận; chỉ dedupe terminal result. Bổ sung regression một trận có nhiều lần rút rồi kết thúc, bên cạnh test terminal lặp hiện có.

### F05. Gọi lại summon đã chết giữ hình ảnh chết và status cũ

- **Vị trí:** [combat-presentation.ts:135](D:/Source/VongNguyet/apps/client/src/ui/combat-presentation.ts:135). Plan A3/A4.
- Rules tái dùng public ID `summon:f09` khi gọi mới. Reducer coi mọi existing ID là thức tỉnh, kể cả existing đã chết: không reset alive/armor/status và giữ tỉ lệ HP.
- **Bằng chứng:** actual summon mới alive=true, HP12, status rỗng; presentation alive=false, HP1, vẫn Cường Hóa3. Bindings tiếp theo hiển thị summon ngã cho tới final commit.
- **Đề xuất:** chỉ áp dụng chuyển form cho summon sống; summon chết được thay bằng state mới từ def và owner của event.
- **Regression:** summon chết → gọi lại cùng ID → act/nhận damage trong cùng batch; mỗi beat phải có alive/HP/status đúng.

### F06. Boss nhảy lên pha cuối ngay tại event đổi pha đầu tiên

- **Vị trí:** [combat-presentation.ts:180](D:/Source/VongNguyet/apps/client/src/ui/combat-presentation.ts:180). Plan A3/A4.
- Một hit vượt nhiều ngưỡng sinh `bossPhaseChanged` 2,3,4. Reducer luôn copy `after.boss.phase` và countdown cuối batch thay vì pha của event hiện tại.
- **Bằng chứng:** event2 → presentation4/countdown2; event3 → presentation4/countdown2. Banner pha2 có thể đi với badge4/4 và countdown xuất hiện sớm.
- **Đề xuất:** cập nhật phase từ `event.phase`; chỉ đưa metadata countdown/revive vào thời điểm được phép hiển thị.
- **Regression:** hit vượt nhiều ngưỡng; xác nhận các phase trung gian và countdown, không chỉ snapshot cuối.

### F07. Summon đồng đội co-op nằm trên hàng địch

- **Vị trí:** [combat-layout.ts:151](D:/Source/VongNguyet/apps/client/src/ui/combat-layout.ts:151). Plan U3.
- `baseY` chỉ phân biệt own seat/other seat, không phân biệt co-op/PvP. Bộ đếm slot theo seat cũng khiến summon đầu của hai ghế cùng x1000.
- **Bằng chứng:** co-op mỗi ghế một summon: own `(1000,410)`, partner `(1000,200)`; đổi viewer ghế1 đảo summon bị đẩy lên trên. Partner hero vẫn ở hàng ally.
- **Đề xuất:** co-op dành các slot own/partner riêng trên hàng ally; PvP giữ hostile band. Target/VFX phải dùng cùng geometry.
- **Regression:** sáu hero, hai summon, cả hai viewer seat; assert đúng ally band và slot cụ thể, không chỉ không giao boss.

### F08. Status summon che số giáp

- **Vị trí:** [combat-scene.ts:1620](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1620), armor tại [combat-scene.ts:1331](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1331). Plan U3.
- Công thức status chung không phù hợp card summon80×108. Armor center(-23,-5); status đầu(-22,7), status thứ ba(-22,-17), radius10. Chúng giao shield25.5×28.9 và được vẽ sau armor.
- **Tác động:** summon có armor kèm status mất khả năng đọc giáp hoặc status.
- **Đề xuất:** bố trí riêng các vùng armor/status/HP/name cho summon compact. Test geometry toàn bộ vùng HUD, rồi chụp summon có armor và ít nhất3 status.

### F09. Mô tả lá trên tay chồng lên tên chủ lá

- **Vị trí:** [combat-scene.ts:2255](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2255), owner strip dòng2284. Plan U2.
- Body bắt đầu y28, font11, cho phép4 dòng; owner strip ở y72. Khoảng cao thực tế không đủ để giữ cả4 dòng cùng strip. Các lá có mô tả dài như Đoạt Mệnh/Bạch Thảo Hương bị chữ chủ lá đè vào cuối mô tả ngay ở hand6.
- **Bằng chứng:** nhìn trực tiếp trên trình duyệt, ảnh [hand bị chồng chữ](D:/Source/VongNguyet/.sdd-work/review-card-body-overlap.png).
- **Đề xuất:** dành vùng cố định cho body và owner strip; đo chiều cao sau wrap, giữ font tối thiểu và ellipsis nằm trong vùng body. Kiểm tra ellipsis không gây wrap thêm dòng.
- **Regression:** card có4 dòng, mô tả dài, Song Hành hai chủ và hand10; kiểm tra bounds body/strip trong renderer thật ở1024×576 và1280×720.

### F10. Bấm số lượng chồng rút mở nhầm chồng bỏ

- **Vị trí:** [combat-scene.ts:2111](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2111), discard hit dòng2120. Plan U4.
- Draw hit90×130 phủ y359..489; discard hit90×100 phủ y454..554 và được thêm sau. Count draw tại y474 nằm trong phần giao nên discard ăn click.
- **Bằng chứng:** bấm số48 dưới chồng rút trên trình duyệt → inspector tiêu đề `Chồng bỏ`, count0. [Ảnh xác nhận](D:/Source/VongNguyet/.sdd-work/review-draw-count-opens-discard.png).
- **Đề xuất:** hit area bám đúng visual từng pile, không chồng count; hoặc phân vùng ưu tiên rõ ràng. E2E hiện chỉ bấm giữa draw pile nên bỏ sót.
- **Regression:** bấm icon, mép dưới và count draw; bấm discard; đều mở đúng model.

### F11. Preview bài đồng đội hiển thị cost gốc thay vì cost thực

- **Vị trí:** [combat-scene.ts:1912](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1912). Plan U2.
- Tile partner dùng `getEffectiveCost(..., partner.index)`, nhưng tooltip không nhận presentation context. Khi có giảm giá, tile và preview mâu thuẫn, không có reason breakdown.
- **Đề xuất:** tạo card model theo partner seat và truyền effectiveCost/costReasons giống hand của mình.
- **Regression:** co-op partner có modifier khác viewer; tile và preview khớp cost/query authoritative ở cả hai seat.

### F12. Gate E2E offline của master plan còn thất bại

- **Vị trí:** [phase7a.spec.ts:155](D:/Source/VongNguyet/apps/client/e2e/phase7a.spec.ts:155), [phase7b.spec.ts:295](D:/Source/VongNguyet/apps/client/e2e/phase7b.spec.ts:295). Plan U6/gate cuối.
- Chạy đúng ba file gate offline: **13 pass, 2 fail**, exit1. Chạy riêng phase7a tiếp tục fail cùng vị trí.
- **phase7a:** gửi mulligan ngay khi status đọc là mulligan, chưa chờ intro drain. Dispatch trả false khi inputLocked; test chờ playerTurn và timeout trước bước force level-up/Chọn Pha. Helper mới đã có chờ idle ở cùng bước, test cũ chưa theo.
- **phase7b:** summon đã render và target list có ID; test bấm `(956,400)` từ layout cũ. Card mới center `(1000,410)`, rộng80, nên x956 nằm ngoài hit area. Timeout ở assertion cardPlayed target summon; chưa tới hồi sinh.
- **Đề xuất:** đồng bộ setup với lifecycle mới, lấy tọa độ từ anchor/bounds thật thay tọa độ cũ. Sau đó chạy tới lựa chọn pha và hồi sinh thực tế.
- Hai timeout này **không phải bằng chứng Chọn Pha hoặc hồi sinh bị lỗi gameplay**; chúng chứng minh gate nghiệm thu chưa chạy tới hành vi cần kiểm tra.

## Findings P3 — hiển thị và nghiệm thu còn thiếu

### F13. Lá đã chọn mất độ nâng khi pointer rời lá

[combat-scene.ts:2358](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2358), U2. Render ban đầu giữ lift cho selected, nhưng pointerout reset scale/y/depth vô điều kiện trừ casting. Tái hiện trên browser: chọn Âm Tiễn → pointer đi qua lá rồi ra vùng trống; target hint và enemy frames vẫn active nhưng lá trở về hàng. Guard selected ID cho tới cancel/commit. [Trước](D:/Source/VongNguyet/.sdd-work/review-selected-card-before.png), [sau](D:/Source/VongNguyet/.sdd-work/review-selected-card-after.png). E2E cần pointerover/out sau khi select, không chỉ ảnh render đầu.

### F14. Terminal push thường chưa chuyển settlement sang pending

[match.ts:120](D:/Source/VongNguyet/apps/client/src/net/match.ts:120), N3. `match.events` cập nhật terminal view nhưng settlement vẫn `playing`; pending chỉ có khi snapshot phục hồi. Probe thực thi NetMatch xác nhận playing thay vì pending. Khi end đến chậm, flow thường không hiện lời chờ thưởng đã hứa. Chuyển playing→pending khi view terminal, giữ nguyên complete/failed; regression terminal events trước end và snapshot.

### F15. Reduced motion vẫn lunge hero cận chiến

[vfx.ts:422](D:/Source/VongNguyet/apps/client/src/ui/vfx.ts:422), A5. Enemy intent lunge đã guard, nhưng helper lunge cho slash/spear chỉ kiểm tra có view. Runtime scale duration/shake/particles không tự chặn x/y tween. Reduced motion vẫn dịch chuyển card. Guard và dùng tint/short fade theo plan; regression slash/spear với attackerView, reducedMotion=true, vẫn gọi impact đúng một lần.

### F16. Timing test chưa đo đủ vòng thật cùng cleanup

[combat-timing.test.ts:166](D:/Source/VongNguyet/apps/client/test/combat-timing.test.ts:166), [combat-scene.ts:574](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:574), A5. Test routine budget dùng chuỗi intent tổng hợp và đo trước `runtime.drain`, trong khi scene drain trước commit/unlock. Probe seed42/enc_01, không chơi bài, vòng6 không có death/up/combo: **3348ms ở speed1**, gồm cleanup, vượt3000ms của plan. Đây là timeline scheduler mô phỏng; không quy số này thành hiệu năng FPS hay thời gian treo trên máy thật. Thêm fixture rules thật đủ các style/status và đo tới drain/commit, rồi điều chỉnh hold/overlap để đạt budget, không bỏ event.

### F17. Nút Kết thúc/Xong lượt không báo đang xử lý

[combat-scene.ts:2940](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2940), [combat-scene.ts:729](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:729), N1/U2. Input lock chặn dispatch đúng, nhưng trạng thái visual nút chỉ phụ thuộc turn/done; không đổi caption/busy styling khi playback hoặc action pending. Người chơi thấy nút còn active nhưng bấm không phản hồi. Cập nhật visual qua lifecycle lock mà không phá batch; nghiệm thu nhãn xử lý, pending network, disconnect và unlock.

## Đối chiếu deliverable của ba plan

| Task | Kết quả review | Phần cần khép lại |
|---|---|---|
| N1 queue/cancel | Đã có coordinator/runtime và regression | Busy feedback F17; bổ sung browser lifecycle/resize lúc cast |
| N2 sequence/ack | Không thấy blocker mới trong phần đã kiểm | Browser online end-to-end chưa chạy trong review này |
| N3 terminal recovery | Chưa đạt đầy đủ | F03, F14 |
| N4 settlement ngoài scene | Chưa đạt đầy đủ | F01, F02; account/reconnect lifecycle |
| A1 metadata/seat/duration | Không thấy blocker mới trong phần đã kiểm | Nghiệm thu browser online hai ghế chưa đủ |
| A2 impact/multihit | Có callback/serialization và test | Timing F16; adjacency-based steal inference còn lệch cách tiếp cận plan, chưa có chuỗi rules thật chứng minh mispair nên không tính finding |
| A3 presentation/cast | Chưa đạt đầy đủ | F05, F06 |
| A4 lifecycle | Có intro/death/revive/phase beats | F05, F06 và visual coverage thực tế |
| A5 settings/audio/budget | Chưa đạt đầy đủ | F04, F15, F16 |
| U1 moon/choice | Có8 pha và panel có mask/scroll | E2E lựa chọn thật F12; icon moon chính vẫn đổi sang blood thay actual phase + badge như plan, dù vòng nhỏ vẫn cho biết pha |
| U2 card/preview/targeting | Chưa đạt đầy đủ | F09, F11, F13, F17 |
| U3 unit/co-op | Chưa đạt đầy đủ | F07, F08 |
| U4 pile/relic | Chưa đạt đầy đủ | F10 |
| U5 art | **Chưa hoàn thành** | 44 file thiếu trong workspace;47 trong checkout chỉ từ commit |
| U6 browser/docs | **Chưa đạt gate** | F12, coverage còn thiếu bên dưới |

### U5: blocker được ghi đúng nhưng deliverable vẫn chưa có

[Inventory](D:/Source/VongNguyet/docs/combat-visual-assets.md) ghi thiếu7 normal +20 awakened +15 enemy +2 summon =44. Ba normal m06/m07/m08 hiện ở workspace nhưng untracked; commit HEAD chỉ có10 portrait hero normal, nên checkout từ nhánh thiếu47/57 tài nguyên bắt buộc. Inventory hiện gọi ba ảnh này là existing/done nhưng chưa bảo đảm chúng đi cùng nhánh.

[combat-assets.test.ts:59](D:/Source/VongNguyet/apps/client/test/combat-assets.test.ts:59) dùng4 `it.fails` cho bốn nhóm art thiếu. Chúng giúp giữ blocker hiện rõ, nhưng không thể dùng số test xanh để tuyên bố U5 đạt. Khi asset có đủ cần bỏ expected-fail, kiểm crop/contact sheet và provenance theo plan. Không tạo thêm art trong phạm vi review.

### U6: matrix xanh chưa bao phủ toàn bộ nghiệm thu

- Default board và hand0/1/8/10 chạy cả4 viewport; dense status, longChoice, summon/fallen chỉ1280×720.
- `multiHit` helper chưa thực thi một chuỗi multihit thật; summonRevive chỉ dựng summon cạnh hero ngã, không chơi hồi sinh; longChoice là Chọn Pha3 option, chưa kiểm menu dài thật cần scroll.
- Chưa có browser case6 hero +2 summon cả hai ghế; partner cost tooltip; selected pointerout/aim; status/armor compact; resize giữa cast; modal chặn phím E; action-send-count khi busy; terminal pending ngoài scene và đổi account.
- Screenshot lưu được và geometry assertion xanh không chứng minh text không chồng: F09 nhìn thấy ngay trên hand thường.
- Chưa đủ bằng chứng visual14 attack style/spell ở1×/2× và reduced motion như nghiệm thu A5. Không suy rộng từ test helper sang toàn bộ hiệu ứng thật.

## Kiểm chứng đã thực hiện trong lần review này

| Kiểm tra | Kết quả mới chạy |
|---|---|
| `pnpm test` | Exit0: data49 + rules712 + client177 + server58 = **996 pass**, **3 skip**, **4 expected-fail** art |
| `pnpm typecheck` | Exit0, cả4 workspace |
| `pnpm build` | Exit0 client/server; còn cảnh báo chunk client lớn |
| Offline E2E: combat-visual + phase7a + phase7b | Exit1: **13 pass,2 fail**,11 phút;13 visual case xanh |
| Phase7a isolated | Exit1, cùng timeout trước bước level-up; không phải nhiễu từ ca test khác |
| Probe review account/network/terminal | **4 assertion fail** có chủ đích assert hành vi mong muốn; tái hiện F01/F02/F03/F14, tách khỏi suite chính thức |
| Probe animation |5 case đo/ghi nhận đã chạy, xác nhận F04/F05/F06/F16; không gọi chúng là test sửa lỗi đã xanh |
| Browser thủ công | Xác nhận F09/F10/F13, lưu ảnh |

Logs: [suite](D:/Source/VongNguyet/.sdd-work/review-current-tests.log), [typecheck](D:/Source/VongNguyet/.sdd-work/review-current-typecheck.log), [build](D:/Source/VongNguyet/.sdd-work/review-current-build.log), [E2E](D:/Source/VongNguyet/.sdd-work/review-current-e2e.log), [isolated phase7a](D:/Source/VongNguyet/.sdd-work/review-phase7a-isolated.log), [probe regressions](D:/Source/VongNguyet/.sdd-work/review-reproduction-probes.log), [probe animation](D:/Source/VongNguyet/.sdd-work/review-animation-probes.log).

E2E online PvP/co-op/arena/settlement đầy đủ chưa chạy vì phiên review không có API/DB dev đã xác minh. Các probe server sử dụng pg-mem/Fastify fixture, không truy cập DB production. Suite rules/golden hiện hành pass; không dùng điều đó để bảo đảm mọi chuỗi gameplay chưa có test.

## Thứ tự khép lại đề xuất

1. F01/F02/F03: vòng đời tài khoản, retained settlement và provisional outcome; thêm regression thật trước khi sửa.
2. F04/F05/F06: tách audio cue, summon replacement, boss phase theo event.
3. F07–F11: layout co-op, compact HUD/body, hit areas và partner preview; nghiệm thu bằng ảnh/browser.
4. F12–F17: khép gate E2E, selected/busy/reduced motion/pending và timing tới cleanup; mở rộng matrix thiếu.
5. Hoàn tất và đưa U5 asset vào nhánh, kiểm crop/provenance, bỏ expected-fail; chạy gate cuối và browser online trên DB dev đã xác minh.

## Bằng chứng trực quan

Bấm count48 của chồng rút mở inspector `Chồng bỏ`0:

![Bấm count chồng rút mở nhầm chồng bỏ](D:/Source/VongNguyet/.sdd-work/review-draw-count-opens-discard.png)

Mô tả các lá dài chồng với tên chủ lá ở đáy hand:

![Mô tả bài chồng tên chủ lá](D:/Source/VongNguyet/.sdd-work/review-card-body-overlap.png)
