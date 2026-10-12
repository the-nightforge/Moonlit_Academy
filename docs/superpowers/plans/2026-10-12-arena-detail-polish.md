# Arena detail polish implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this coupled Arena scene change. Steps use checkbox syntax for tracking.

**Goal:** Implement the approved 18-part Arena review, keeping the existing three-column layout and WebP art.

**Architecture:** Keep realtime ownership in ArenaScene. Update queue timer objects in place and mount the 90-second fallback separately. Add pure presentation helpers for hero information/history dates, and opt-in sizing for HomeControls so other scenes retain defaults.

**Tech Stack:** TypeScript, Phaser, Vitest, Playwright, existing WebP assets.

**Spec:** `docs/reviews/2026-10-12-arena-ui-detail-review.md`, approved by “Làm theo đề xuất đi”.

## Global constraints

- Work on the current branch as requested in the conversation; preserve unrelated changes. No commit/push requested.
- Keep the three panels and sharp hero art. Use existing WebP; no mandatory new asset or dedicated background.
- No changes to game rules, matchmaking, rewards, protocol or auth. All displayed data derives from existing data/API.
- Motion respects reduced motion. Main CTA 52 px / 16 px; readable secondary text 13–14 px; icon hit areas at least 44×44.
- Behavioral changes get a failing test before implementation. Reversible typography/layout use visual acceptance rather than tests mirroring coordinates.

## Review focus

- Queue status while a modal/tooltip is open must preserve objects and focus, including the 90-second boundary.
- Private input, pending actions and copy failures must preserve the code and show local feedback.
- Long hero/deck/equipment names and long validation messages must not overlap adjacent content.
- Equipment tooltips must use PvP refinement/resonance, not account PvE progression.
- Other scenes using HomeControls must retain their existing button dimensions and input behavior.

### Task 1: Queue continuity and safe footer (AR-10/12/17)

**Files:** `apps/client/src/scenes/arena-scene.ts`, `apps/client/e2e/arena-ui.spec.ts`.
**Interfaces:** ArenaScene retains existing stable `arena_*` action names except removed `arena_disconnect`. Queue updates preserve `arena_queue_timer` and modal/tooltip object identity; mount `arena_queue_practice` once at >=90 seconds.

- [x] Add browser regression: queue ticks 84→89→90→94 preserve timer, hero, modal, tooltip and focus; fallback appears once; back/cancel still send queue.leave.
- [x] Run regression against baseline; expect failure on preserved object identity.
- [x] Update timer and late-wait controls in place. Remove misleading immediate-disconnect button; retain Back.
- [x] Run regression and existing Arena UI browser checks.

### Task 2: Presentation helpers and readable lobby (AR-01–09)

**Files:** `arena-presentation.ts`, its existing unit test, `arena-scene.ts`, `home-controls.ts`, `widgets.ts`.
**Interfaces:** `arenaHeroLines(data: GameData, heroId: string): string[]`; `formatArenaDate(timestamp: number, now?: number): string`. Optional ButtonOptions height/fontSize/strong preserve existing defaults 40/14/false.

- [x] Add unit tests for hero upgrade descriptions/PvP HP without constellation bonuses; same-day/date/year and invalid timestamp formatting; watch them fail.
- [x] Implement pure helpers and run unit tests.
- [x] Implement fixed-order currency tooltips, connected/offline status, rank target/progress, honor cap, consistent Bộ bài copy, hero info controls, weapon/relic slots and summary chip. Keep art size/crop.
- [x] Make mode selected distinct from CTA; strong CTA 52 px / 16 px and pending copy; no duplicated label-only tooltips.
- [x] Typecheck and visually inspect long-name/full-equipment/empty/invalid cases.

### Task 3: Private room and modal details (AR-11/13–17)

**Files:** `arena-scene.ts`, `arena-input.ts`, `arena-ui.spec.ts`.
**Interfaces:** Same native field IDs and realtime messages. Selector six rows/page, stable deck IDs. History filter client-side on fetched entries, with explicit recent-history wording. Validation rows wrap with bounded row height and Edit action.

- [x] Add browser checks for full-equipment info, six-row deck pagination, history filter, validation-to-editor and local private-code error; watch new behavior assertions fail.
- [x] Implement portrait selector/check marker, compact icon pagination, loading placeholders/empty states, error details/retry, column-aligned own rank and differentiated top three.
- [x] Implement private labels/player slots/local copy feedback and input focus; no Ready/Start action.
- [x] Run new and existing Arena browser checks; inspect modal/full-name/error screenshots.

### Task 4: Motion, final verification and review (AR-18)

**Files:** `arena-scene.ts`, evidence in ignored `output/arena-detail-polish/`.
**Interfaces:** Normal motion queue pulse continuous; reduced-motion static; mode fade only changing body. Slot arrival flash never delays match.start.

- [x] Verify continuous queue tween with normal motion and static reduced motion; add a browser assertion if lifecycle coverage needs it.
- [x] Run client suite/typecheck/build plus affected Home/Arena browser checks. Run actual private/practice/queue routing as appropriate without masking full-motion combat limits.
- [x] Capture 1280×720, 1280×900, 1920×1080 and edge states; inspect screenshots and fix overlaps.
- [x] Request one independent review of the entire change; resolve important findings with regression checks.
- [x] Record results, limitations and all review items in the review document. Leave changes reviewable on current branch, no commit/push.


