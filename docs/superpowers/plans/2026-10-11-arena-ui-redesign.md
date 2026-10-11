# Arena UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the approved arena review using existing raster art and three new transparent WebP icons.

**Architecture:** Preserve ArenaScene as the owner of API/realtime state. Use focused arena presentation/view modules for the three-column lobby and scrollable modal content; reuse HomeControls, roundedPanel, raster action icons, existing equipment art and PvP deck summaries. Root handles image generation and end-to-end verification; one implementer owns product code, followed by an independent review.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, Playwright, built-in imagegen, Sharp for final WebP conversion.

**Spec:** `docs/reviews/2026-10-11-arena-ui-review.md`, approved by the user with WebP replacing PNG for new assets.

## Global Constraints

- Final new assets are transparent 512×512 WebP: `mode_practice.webp`, `mode_private.webp`, `nav_leaderboard.webp`, in `apps/client/public/assets/ui/`.
- Reuse existing home background, heroes, equipment, rank and currency art; no SVG/emoji icon fallback.
- Three panels: left x40/w264, center x328/w528, right x880/w360, y100/h500; footer y624–696, design 1280×720. Readability may justify small internal spacing adjustments.
- Keep current API/protocol and saved-deck-only PvP rules. No season rewards, fake ETA, ready/start protocol additions or server pagination invented.
- Queue locks deck edits/selection. Changing modes leaves queue explicitly; practice is not simultaneous with ranked matchmaking.
- Preserve current checkout and existing unrelated user edits; no commits, pushes, branch switches or new dependencies for this task.
- Modal controls use real hit areas and keyboard focus; input fields clean up on close/shutdown; async callbacks check generation and request identity.
- Reduced motion uses static states; normal motion uses short fades and subtle queue pulse with proper cleanup.

## Review Focus

- 0, 1, 8 and many saved decks, long names, invalid PvP decks and missing art remain readable without overlaps.
- Delayed/out-of-order API callbacks cannot change a later scene run, later modal or hide a more recent error.
- Queue/room switching, lost connections and repeated clicks do not send contradictory or stale actions.
- Wide/tall viewports and repeated scene/modal entry keep background coverage and listener/input lifetimes correct.
- Loading/error/empty history and leaderboard remain operable with keyboard and reduced motion.

### Task 1: Arena UI and behavior

**Files:**
- Modify `apps/client/src/scenes/arena-scene.ts` (state orchestration and callbacks).
- Create focused modules under `apps/client/src/ui/arena-*` for view/presentation as needed; keep modules purposeful and interfaces typed.
- Test `apps/client/test/arena-presentation.test.ts` and `apps/client/e2e/arena-ui.spec.ts`.
- Modify existing arena paths in `apps/client/e2e/arena.spec.ts`, `pvp.spec.ts`, and `home.spec.ts` only where changed captions/hit coordinates require migration; do not modify unrelated multiplayer helper or login changes.

**Interfaces:**
- Consume `HomeControls`, `roundedPanel`, `preloadActionIcons`, `roundedArtTexture`, `summarizeDeck`, `showTextTooltip`, existing widgets and equipment-art helpers.
- Consume manifest keys `ui:mode_practice`, `ui:mode_private`, `ui:nav_leaderboard` supplied by Task 2. Preload own lobby art independently of combat preload.
- Preserve current Scene key, incoming realtime handling and API reply contracts. View callbacks invoke existing queue/room/practice operations.
- Name actionable hit objects with stable `arena_*` names (back, deck_change, deck_edit, mode_ranked, mode_practice, mode_private, ranked_start, queue_cancel, practice_start, room_create, room_join, room_copy, room_leave, history, leaderboard, honor_shop, modal_close). Expose actionLabel metadata for semantic tests/tooltips.

- [x] Write meaningful failing tests for rank progress (1000→next1100, max tier), server timer formatting, and any extracted action gating. Add browser coverage for deck selector overflow/selection, queue controls and persistent errors, modal scrolling, room code input and cleanup.
- [x] Run focused tests and confirm the expected failures.
- [x] Implement all P0/P1/P2 scope from the approved review: responsive background, header currencies, rank/progress/honor, three hero deck preview and validation, saved-deck selector with native search and paging/scroll, edit navigation, three modes and CTA, real room code input, room players/copy/leave, persistent errors/loading/retry and queue state.
- [x] Implement scrollable history/leaderboard with columns, sticky own row, independent loading/empty/error/retry, viewport-wide dimmer and raster close; short fade/hover/queue pulse and reduced motion.
- [x] Migrate existing E2E interactions away from old hardcoded arena coordinates and obsolete captions using stable hit names or semantic controls; preserve actual queue/practice/private behavior assertions.
- [x] Run focused unit tests, client typecheck, self-review; write report with files, tests/outputs and limitations to `output/arena-ui-redesign/task-1-report.md`. Do not commit.

### Task 2: Generated WebP assets, integration and acceptance

**Files:**
- Create the three WebP files named in Global Constraints.
- Save full image prompts, generation source paths, asset measurements and screenshots under `output/arena-ui-redesign/`.
- Update review asset names from PNG to WebP and task progress in this plan.

**Interfaces:**
- Provide exact manifest stems consumed by Task 1; image source outputs may be PNG, final repository assets must be WebP with alpha.
- Use existing mode_arena and rank_dong_sinh as style references, one built-in imagegen call per requested icon.

- [x] Generate practice wooden training dummy/weapon, private moon gate/two invitation talismans, leaderboard moon trophy/three steps. Match gold/ivory/navy/cel-shaded anime silhouette; no text/watermark, transparent background.
- [x] Inspect art, convert to transparent 512×512 WebP with safe padding and validate alpha/dimensions/size. Save full prompts/source ledger.
- [x] Run independent code/spec review on scoped changes; resolve actionable findings through the original implementer and re-review.
- [x] Run client unit suite once (maxWorkers2), typecheck and build. Run targeted browser acceptance against an owned disposable backend, covering ranked/private/practice routes and UI states at 1280×720, 1280×900, 1920×1080. Do not rerun broad suites without a new failure/change.
- [x] Inspect final screenshots for clipping, contrast, button geometry, hero clarity and WebP icon rendering; resolve problems.
- [x] Stop owned test servers, remove only checked temporary bundle paths, save verification ledger and final paths/screenshots. Leave all changes reviewable on the user's checkout.

## Kết quả triển khai — 2026-10-12

Đã triển khai toàn bộ phạm vi UI và ba asset WebP trên nhánh hiện tại. 281 unit test, 3 kiểm thử UI, typecheck và build đạt; các vòng review source cuối không còn finding. Luồng mạng xếp hạng/điểm/Vinh Dự, tạo/vào phòng và khôi phục trận, máy tự đánh được xác nhận bằng asset và backend thật với chế độ giảm chuyển động/tốc độ2 có sẵn.

Giới hạn được giữ rõ: hai kiểm thử PvP với đầy đủ animation còn timeout chờ playback, log ghi nhận2–4 FPS; có cảnh báo texture trùng trong lần khôi phục. Chưa xác định nguyên nhân và không tuyên bố các vấn đề này đã được sửa. Chi tiết ở `output/arena-ui-redesign/verification.md`. Máy chủ thử nghiệm đã dừng; giữ ảnh kiểm tra và provenance, không commit/push hay đổi nhánh.

