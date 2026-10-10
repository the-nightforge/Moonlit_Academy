# Home UI hierarchy implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. The user approved implementation of the four priority changes after the UI comparison.

**Goal:** Make Home routes recognizable and group mode, rank and selected-deck information.
**Architecture:** Keep the existing Phaser scene/session/request guards and overlay. Replace Home presentation only, using existing raster assets and scene text labels for routing checks.
**Tech Stack:** TypeScript, Phaser, Playwright, Vite.
**Spec:** Approved in-chat proposal on 2026-10-10: labeled bottom navigation; rank inside Arena tile; selected-deck name and explicit edit action; two large mode tiles above two compact tiles.

## Constraints

- Work in the current checkout; preserve existing P0/P1 changes. No commit/push.
- Keep direct mode routes and existing offline/busy/invalid-deck/starter behavior.
- Design 1280×720; verify 1280×720, 1280×900, 1920×1080.
- Retain art fallbacks, rank retry and stale-request protections.
- No new progression backend, art generation or ambient VFX in this iteration.

## Task 1 — Home hierarchy and acceptance

**Files:** `apps/client/src/scenes/deck-select-scene.ts`; `apps/client/e2e/home.spec.ts`.
**Interfaces:** Scene key `deck-select`, session selected deck ID, existing deck overlay, rank API and five footer scene routes remain unchanged. Footer labels become public visible navigation affordances.

- [x] Add failing acceptance: visible footer labels route by click; selected saved deck name and explicit edit action open correct draft; rank emblem contained inside Arena tile; primary tiles larger than secondary, secondary tiles share a row; all main UI remains above footer at three viewports.
- [x] Run new acceptance before implementation; expect failure for missing labels/explicit edit.
- [x] Implement header account/resources, labeled footer, Arena rank panel and retry, selected-deck heading/actions, mode hierarchy. Keep hero portraits and existing deck management semantics.
- [x] Update old coordinate-only Home navigation/hover assertions to follow visible labels/new geometry. Keep all prior assertions.
- [x] Run Home acceptance/layout/art, then full Home+online smoke; typecheck and build. Inspect screenshots before completion.

## Review focus

- Starter editing must create a copy; saved editing must keep the selected ID.
- Rank failure retry must not trigger the parent Arena route.
- Busy/offline controls must not remain clickable after moving them.
- Long deck names and error messages must not overlap actions or footer.
- Story override and team-picker screens must keep their existing flows.

## Verification

- RED confirmed before implementation: the new 1280×720 acceptance failed on missing footer labels and explicit edit UI.
- `pnpm --filter client typecheck`: PASS (including E2E).
- `pnpm --filter client build`: PASS; existing large-bundle warning remains.
- `pnpm --filter client test --maxWorkers=2`: 256/256 PASS across 27 files. Local scratch TEMP/TMP avoids sandbox temp-rename restrictions.
- `pnpm exec playwright test e2e/home.spec.ts e2e/online-smoke.spec.ts --workers=1`: 34/34 PASS, zero skips, 10.4 minutes. Test backend pg-mem; local API proxy override. Includes actual tile bounds, long deck name/error clearance, disabled footer/edit while busy, rank retry staying on Home, direct routes, saved/starter edit, previous request/overlay/asset gates and online practice combat.
- Inspected screenshots at 1280×720, 1280×900 and 1920×1080. Preview copies: `output/home-ui-hierarchy/previews/home-hierarchy-<width>x<height>.png`.
- Independent read-only review: no actionable P0–P2 findings. Strengthened two assertions identified by review: actual tile bounds rather than child-inclusive container bounds; long selected name/error clearance.
- Targeted first run: 13/14 PASS; final case received HTTP 502 at registration while the test backend restarted. The stable full run above passed that case and all others.
- `git diff --check`: PASS. No commit/push performed.

Ignored local evidence: `output/home-ui-hierarchy/full-home-smoke.log`, `targeted-e2e.log`, `client-unit.log`, `typecheck.log`, `review.md` and `previews/`.
