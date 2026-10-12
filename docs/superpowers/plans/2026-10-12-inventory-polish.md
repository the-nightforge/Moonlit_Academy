# Inventory polish implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Execute inline; one fresh whole-change review at the end.

**Goal:** Implement approved option A from the 50-part inventory review, keeping the collection grid and truthful upgrade decisions.
**Architecture:** Pure rules-backed insights feed ArmoryScene; local controls provide selected styles and semantic DOM equivalents. DeckBuilderScene consumes an optional armory return context. Existing APIs/rules/data/assets remain authoritative.
**Tech Stack:** TypeScript, Phaser 4, DOM, Vitest, Playwright.
**Spec:** `docs/inventory-ui/review-v2.md` (approved by the user's “Làm đi”).

## Global constraints
- Work only in the attached `codex/inventory-ui` worktree; retain it, no merge or push.
- Reuse all 41 equipment art files, contain complete art; no new raster assets needed.
- Keep 4×3 desktop grid, separate category state, upgrade one actual owned level at a time.
- Render every known condition of a passive or fall back to explicit original/history prose; never replace complete hooks with partial refinement prose.
- Focus, modals, resize, late mutations and deck copies must preserve established behavior.
- User requested execution directly after reviewing the concrete design; continue inline without a second approval flow.

## Review focus
- Future or complex hook/effect shapes must fall back, not omit mechanics.
- Hidden canvas hit targets and semantic DOM controls must not act through overlays or scroll clipping.
- Returning from deck builder must retain inventory state and leave saved deck untouched until Save.
- Very long text/name/currency and narrow viewports must leave price and action visible.
- Offline/pending/late replies must not show an actionable stale price or misleading empty filter.

## Task 1: Rules-backed display insights
Files: create `apps/client/src/ui/equipment-insights.ts`, `apps/client/test/equipment-insights.test.ts`; modify `equipment-presentation.ts` to avoid attributing an unassigned card to its signature hero.
Produces: `equipmentCounts`, `clearEquipmentFilters`, `equipmentChange`, `equipmentPassive`, `equipmentActionLabel`, `equipmentText`, `equipmentNavigation`.
- [x] Write tests for counts before ownership filter, sort-preserving reset, owned-level damage 7→9, replacing relic armor 3→4, current passive TL5, frequency/signature context, safe unknown fallback, status labels, keyboard row bounds.
- [x] Run focused test: expect missing exported implementation / FAIL.
- [x] Implement pure helpers using weaponAt/relicAt, numeric effect fields and explicit complete hook support.
- [x] Run focused tests + full client suite: expect PASS.
- [x] Commit helpers/tests.

## Task 2: Collection, detail and deck navigation polish
Files: modify `armory-scene.ts`, `deck-builder-scene.ts`; create local `equipment-controls.ts`; modify e2e `armory-ui.spec.ts`, create `armory-polish.spec.ts`.
Consumes: Task 1 helpers. Produces approved screen and optional `{back:'armory',equipment:{kind,id}}` deck-editor entry.
- [x] Add browser regressions for missing texture, owned-vs-preview action/price, filter counts/reset/offline, keyboard-semantic controls, source deck clone and return, viewport/full modal bounds.
- [x] Watch browser tests fail on the old scene.
- [x] Implement selected/disabled/focus distinction; portrait art/rarity/usage; compact toolbar; split effects/current passive/history; cumulative/replacing timeline; fixed delta-price-action footer, errors and state copy.
- [x] Reuse complete emblem assets; popup preview context without fictitious wearer; tap/keyboard/modal-close behavior; scroll/touch targets; responsive fit and semantic DOM equivalents.
- [x] Open actual deck slot and return to armory with its preserved category/query/selection. Keep unsaved-change guard and save flow.
- [x] Run focused browser regressions + prior armory/deck browser regressions; full client test/typecheck/build. Expected PASS; inspect production screenshots at desktop/narrow/short.
- [x] Dispatch one independent review, fix Important findings with a failing regression, run final checks and commit.

## Native execution notes
Skill shell scripts are Bash-specific. Use native PowerShell/Node for literal file edits and ledger entries; no new runtime dependencies. Plan is a checklist; tests and ledger hold observed evidence.
