# Combat Screen Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Màn chiến đấu hiển thị đúng state và đúng ghế, phục hồi được trận online, có animation dễ đọc và UI/art đầy đủ theo bản review 03/10/2026.

**Architecture:** Một playback coordinator điều phối snapshot/event theo thứ tự, với runtime hủy được khi rejoin/shutdown. Presentation state chỉ biểu diễn các thay đổi đã được event xác nhận; rules/server vẫn quyết định mọi hành động và kết quả. Tách thành ba plan có deliverable riêng, hoàn thành độ đúng trước rồi mới nâng chất lượng trình bày.

**Tech Stack:** TypeScript strict, Phaser 4, Vite, pnpm workspaces, Fastify/WebSocket, Vitest, Playwright; dùng dependency đang có.

**Spec:** `combat-screen-review-2026-10-03.md` tại gốc repo; `docs/01-combat-rules.md`, `docs/16-server-api.md`, `docs/17-phase5-6-spec.md`, `docs/18-phase7-spec.md`. UI mới dưới đây thay thế các chi tiết prototype cũ trong `docs/05-ui-combat-screen.md`, nhưng không thay luật.

## Global Constraints

- `packages/rules` là code thuần, không Phaser/DOM/mạng/file system/`Math.random()`/`Date.now()`; không đổi RNG, damage, targeting, điều kiện thắng/thua hoặc economy.
- Server là trọng tài hồ sơ; client chỉ gửi action, đọc event/state và hiển thị. Presentation state không được dùng làm đầu vào `applyAction`, `getValidTargets` hoặc API.
- Code/tên biến/comment tiếng Anh; chữ cho người chơi tiếng Việt theo `docs/04-glossary.md`.
- Không thêm thư viện. Không cài plugin/runtime mới. Không dùng database production hoặc ghi lại golden để che lỗi.
- Dùng đơn vị thiết kế 1280×720, giữ `EXPAND` và camera đã có; kiểm tra 1280×720, 1366×768, 1024×576, 1280×900.
- Giữ bí mật hand/draw/pending choice/RNG của đối thủ PvP. Chuỗi chiêu địch vẫn ẩn theo luật hiện hành.
- Không chạm thay đổi đang có của người dùng, đặc biệt `.gitignore`. Chỉ tạo worktree khi bắt đầu implementation theo skill, không tạo cho việc viết plan.
- Mỗi task có commit riêng sau check phù hợp. Không bắt chạy lại toàn bộ suite sau mỗi chỉnh màu; full suite chạy tại gate mỗi plan và gate cuối.
- Không coi số baseline là kết quả triển khai: lần review trước có 808 passed/3 skipped và typecheck xanh; lúc thực hiện phải chạy lại.
- Triển khai client/server protocol cùng một release. Không deploy trong phạm vi plan này.

## Review Focus

1. Push mới tới khi animation cũ chưa xong: render giữ thứ tự và không mở input sớm — N1.
2. Mất action hoặc kết thúc trận khi offline/reload: snapshot đồng bộ sequence và đưa được về kết quả/lobby — N2–N4.
3. Hai ghế dùng cùng Hero và duration PvP theo nửa vòng: UI dùng đúng chủ và số vòng — A1.
4. Multihit, reflect, death, revive hoặc summon trong cùng batch: thứ tự đọc được, HP/giáp không nhảy sai — A2–A4.
5. Hand đầy, mô tả dài, nhiều status, hai summon và cửa sổ cao/nhỏ: không che control hoặc bỏ mất thông tin — U1–U3/U6.

## Các plan và thứ tự

| Đợt | Plan | Task | Deliverable |
|---|---|---|---|
| 1 | [Mạng và phục hồi trận](D:/Source/VongNguyet/docs/superpowers/plans/2026-10-03-combat-network-stability.md) | N1–N4 | Queue/cancellation, action sequence recovery, terminal recovery và settlement độc lập scene |
| 2 | [Animation và VFX](D:/Source/VongNguyet/docs/superpowers/plans/2026-10-03-combat-animation-vfx.md) | A1–A5 | Số liệu đúng ghế, impact đúng nhịp, state hiển thị theo event, đủ nhịp lifecycle và settings |
| 3 | [UI, layout và tài nguyên](D:/Source/VongNguyet/docs/superpowers/plans/2026-10-03-combat-ui-layout-assets.md) | U1–U6 | Nguyệt Luân đầy đủ, hand dễ đọc, layout riêng co-op, pile/relic UI, art và nghiệm thu |

Thực hiện N1 → N2 → N3 → N4 → A1 → A2 → A3 → A4 → A5 → U1 → U2 → U3 → U4 → U5 → U6. Có thể phát hành fixes sau đợt 1/2; chưa tuyên bố hoàn thành toàn bộ đề xuất khi U5/U6 còn thiếu.

N1 cung cấp runtime/queue; A2/A3 dùng cùng runtime; U1–U4 dùng presentation binding từ A3. Không cho hai implementer sửa `combat-scene.ts` đồng thời. Có thể chuẩn bị art ở U5 độc lập, nhưng tích hợp/QA vẫn theo thứ tự.

## File structure tổng thể

| Tạo mới | Trách nhiệm |
|---|---|
| `apps/client/src/ui/combat-playback.ts` | Queue batch, epoch cancellation, lock/commit hooks |
| `apps/client/src/ui/animation-runtime.ts` | Tween/timer/temporary objects có ownership và abort |
| `apps/client/src/net/match-registry.ts` | Giữ match đang chờ settlement ngoài scene |
| `apps/client/src/ui/combat-display.ts` | Card/status/cost metadata cho renderer và animator |
| `apps/client/src/ui/combat-presentation.ts` | State hiển thị theo event; không thực thi rules |
| `apps/client/src/ui/combat-layout.ts` | Geometry/anchors thuần, dùng chung render/animation/test |
| `apps/client/src/ui/combat-settings.ts` | Speed, reduced motion, audio volume |
| `apps/client/src/ui/combat-audio.ts` | Cue âm thanh ngắn được tạo bằng Web Audio, không dependency mới |
| `apps/client/src/ui/moon-hud.ts` | Wheel 8 pha và blood badge |
| `apps/client/src/ui/combat-card-view.ts` | Card compact + preview và hover/cast ownership |
| `apps/client/src/ui/combat-inspector.ts` | Pile công khai, relic/augment details |
| `apps/client/test/helpers/combat-fixture.ts` | Fixture dùng actual rules/data, seed 42 |
| `apps/client/e2e/helpers/combat.ts` | Setup offline, design click, đọc scene và chụp ảnh |
| `apps/client/e2e/combat-visual.spec.ts` | Kiểm tra UI/animation và screenshot các viewport |
| `apps/client/public/assets/summons/` | Art Linh Thú |
| `docs/combat-visual-assets.md` | Inventory/provenance/QA tài nguyên |

Modify: `combat-scene.ts`, `event-animator.ts`, `vfx.ts`, `attack-style.ts`, `theme.ts`, `card-tooltip.ts`; client `net/{match,socket,protocol}.ts`, `session.ts`, arena/co-op lobby; server `realtime/{protocol,match-room,hub}.ts`; rules `index.ts` export query có sẵn và `queries.ts` tách cost breakdown thuần, giữ nguyên phép tính/cost/golden; docs UI/protocol/playtest. Không chia lại toàn bộ scene framework.

## Coverage map của bản review

| Đề xuất/lỗi | Task chịu trách nhiệm |
|---|---|
| Review lỗi 1/13: overlapping queue, rejoin, redraw phá playback | N1 |
| Lỗi 2: action sequence | N2 |
| Lỗi 3/4: terminal recovery, settlement sau chuyển scene | N3/N4 |
| Lỗi 5/6/7/8/9: owner, duration, tổng status, reveal, seat anchor | A1/A3 |
| Lỗi 10/11: multihit và impact | A2 |
| Lỗi 12: hover lá đang cast | A3/U2 |
| State HP/giáp/status theo event; summon anchor; death/revive/up | A3/A4 |
| Intro, draw/discard/recycle/armorRemoved, banner boss/combo | A4 |
| Duration budget, speed, shake, reduced motion, audio/settings | A5 |
| 8 pha/lệnh, blood phase/count, phase background | U1/A4 |
| Body font, full hand/mulligan, preview, cost/reason, owner/bond/weapon | U2 |
| HP/max HP, progress, status overflow, guard links, co-op groups/summon zones | U3 |
| Pile inspector, relic/augment bar/flash | U4 |
| Missing portrait/up/enemy/summon, fallback, background hierarchy | U3/U5 |
| Chọn Pha dài, targeting aim, error feedback, resize/viewport QA | U1/U2/U6 |

## Gate cuối và vận hành test

- [ ] Đọc spec + cả ba plan; không bỏ asset/audio thành “sẽ làm sau” khi báo hoàn thành toàn bộ.
- [ ] Trong workspace implementation: chạy targeted tests của task, rồi `pnpm test`, `pnpm typecheck`, `pnpm build` tại gate cuối.
- [ ] E2E offline: mở Vite `pnpm --filter client dev`; chạy `pnpm --filter client exec playwright test e2e/combat-visual.spec.ts e2e/moon-choice.spec.ts e2e/summon-revive.spec.ts`.
- [ ] E2E online: server test/dev dùng DB dev hoặc fixture pg-mem, API :8787 + Vite :5173; chạy `pnpm --filter client exec playwright test e2e/pvp.spec.ts e2e/coop.spec.ts e2e/arena.spec.ts`. Xác minh DB đích trước chạy; không dùng production.
- [ ] Nếu sandbox gặp EPERM của TEMP, đặt TEMP/TMP chỉ trong process sang thư mục scratch trong workspace; không đổi cấu hình máy.
- [ ] Lưu ảnh `test-results/combat-visual/<viewport>/<scenario>.png` và số đo timeline; review hình thật ngoài assertion.
- [ ] So sánh outcome/RNG/replay với baseline: mọi golden hiện hành giữ nguyên. Rules diff chỉ export query và tách cost breakdown không đổi behavior.
- [ ] Đánh dấu các checkbox đã làm, ghi commands/outcome/giới hạn chưa kiểm tra vào `docs/playtest-notes.md`.
- [ ] Review whole branch; sửa finding còn lại trước khi merge. Việc push/PR/deploy theo yêu cầu thực tế của người dùng, không tự mặc định trong plan.

## Self-review kế hoạch

Đã map 13 lỗi và toàn bộ các nhóm UI/VFX/art của bản review tới task cụ thể. Mọi interface liên plan được định nghĩa tại task cung cấp nó. Năm Review Focus có regression tại task sở hữu. Không thêm luật mới, không tái ghi golden, không có dependency mới; UI query dùng rules, presentation chỉ dùng event đã có.

Đây là tài liệu triển khai, chưa phải bằng chứng các lỗi đã được sửa. Art generation ở U5 là một deliverable thật với danh sách cụ thể, style/provenance và kiểm ảnh; các screenshot/layout được gate tại U6.

