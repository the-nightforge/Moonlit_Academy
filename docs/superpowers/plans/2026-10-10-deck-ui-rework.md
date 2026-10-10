# Deck selection and editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox syntax.

**Goal:** Implement the approved P0/P1 deck modal and copy/edit redesign.

**Architecture:** Keep existing Phaser scenes and rules/API contracts. Share pure deck statistics/search helpers; modal and editor render independently. Confirm selection explicitly and preserve invalid draft saving.

**Tech Stack:** TypeScript, Phaser, Vitest, Playwright.

**Spec:** `docs/reviews/2026-10-10-deck-ui-review.md`.

## Global Constraints

- Existing checkout/current branch; preserve preexisting Home layout edits. No commit/push requested.
- P0 and P1 only; no favorites, undo, Hero replacement, or backend rule changes.
- 1280×720 design coordinates, verify 1280×900 and 1920×1080.
- Deck slots include weapons; battle copies and weighted Nguyệt Lực curve include weapon copies; relics do not occupy slots.
- Names trimmed 1–24 characters. Invalid drafts remain saveable; pending/offline/name-invalid saves disabled.
- Existing asset fallbacks, auth/scene generation guards, dirty exit, reduced motion preserved.

## Review Focus

- Preview another deck then cancel must preserve active selection.
- Draft save while editing active deck must not change selected ID or leave editor.
- Async asset/save completion after scene shutdown must not change replacement scene.
- Search/filter results and long text must fit with 30 decks, locked cards, empty results.
- Two-mode validation must allow PvP-valid deck confirmation.

### Task 1: Shared presentation statistics and search

**Files:** Create `apps/client/src/ui/deck-presentation.ts`; test `apps/client/test/deck-presentation.test.ts`.

**Interfaces:** `summarizeDeck(data: GameData, deck: SavedDeck, options?: { profile?: Pick<Profile, "weapons">; mode?: "pvp" }): { slots: number; copies: number; averageCost: number; curve: number[]; heroCounts: Record<string,number> }`; curve has nine copy-weighted bins, last includes cost ≥8. `matchesDeckText(query: string, ...values: string[]): boolean` accent-insensitive Vietnamese search.

- [x] Write tests for weapon slots/copies/cost, high costs, relic exclusion, accents, no input mutation.
- [x] Run `pnpm --filter client exec vitest run test/deck-presentation.test.ts` and observe missing-helper failure.
- [x] Implement helpers and run same command, expect PASS.

### Task 2: Modal list and preview

**Files:** Modify `apps/client/src/scenes/deck-select-scene.ts`; create behavioral tests `apps/client/e2e/deck.spec.ts`; update relevant Home/E2E consumers.

**Interfaces:** Consume Task 1 exports. Preserve `openDeckEditor`, profile mutations, virtual starters, `overlayScroll`/`overlayScroller` lifecycle.

- [x] Add failing preview/cancel/confirm and preview-copy tests; run before implementation.
- [x] Implement 1080×624 rounded modal, six portrait rows, independent preview, search, close, mode validation, gear/stat preview.
- [x] Keep Deck mới separate; edit/copy based on preview; delete via ⋯ and named confirmation.
- [x] Implement guarded lazy art, keyboard focus, reduced motion, scrolling and cleanup.
- [x] Run modal behavioral tests and typecheck; expect PASS.

### Task 3: Editor and equipment picker

**Files:** Modify `apps/client/src/scenes/deck-builder-scene.ts`; optional focused `apps/client/src/ui/deck-builder-*.ts` helpers; test `apps/client/e2e/deck.spec.ts`.

**Interfaces:** Consume Task 1 exports; use existing card/equipment art loaders. Keep `PUT /profile/decks`, returned deckId, auth/scene generation guard.

- [x] Write failing invalid-draft save/stay/selection and valid-copy save/busy tests; observe failure.
- [x] Implement three ~296px Hero columns plus280px sidebar, scrolling art rows, locked info, fixed-copy explanation, search/cost/unlocked/in-deck filters.
- [x] Implement editable name, draft/dirty indicators, ordinary/PvP validation preview; slots/copies, weighted curve, clickable errors, art weapon/relic slots.
- [x] Implement art tile gear picker with equipped state and contained preview; safe hover/focus/tap card info.
- [x] Save valid deck via Lưu và dùng; invalid via Lưu bản nháp staying in editor, preserve active selection, block double submission, keep edits on failure/offline.
- [x] Verify dirty exit, empty search, max-name clipping, art failures and all three viewports.
- [x] Run client unit suite, typecheck, build, Home/deck smoke E2E; expect PASS. Record screenshots under `output/deck-ui-rework`.
- [x] Independent code review; fix important issues and rerun affected checks. Record verification in this plan.

## Execution notes

User approved implementation with “Làm đi”; proceed without a second approval. Independent scene work can run concurrently under dispatching-parallel-agents, with root owning shared helpers and acceptance tests. Preserve changes without committing.

## Verification ledger

- RED → GREEN: preview/cancel/confirm, invalid draft save/stay, busy submission, Vietnamese filters, profile/refinement statistics, native input shortcuts, pinned preview, visible-only art loading, scroll ownership.
- Independent review completed; fixed cumulative weapon refinement text, profile/PvP statistics, pinned preview lifetime and lazy loading of visible assets.
- Client unit suite: 32 files / 277 tests passed. Typecheck and production build passed after review fixes.
- Home/deck acceptance: 55/55 passed (17.5 minutes, one browser worker). Final chart spacing refinement: all three viewport tests passed again (53 seconds); final typecheck and build passed.

- Final screenshots: `output/deck-ui-rework/previews/modal-1280x720.png`, `editor-1280x720.png`, `gear-picker.png`. Visually checked portraits, row text, sidebar chart caption/count spacing and contained equipment art.
- Preserved preexisting Home layout. Temporary local test servers stopped and generated server files removed; test output stays under ignored `output/deck-ui-rework`.
