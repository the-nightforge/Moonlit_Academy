# Inventory UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implement inline, then one fresh whole-branch reviewer.

**Goal:** Replace Armory's text list with the approved searchable equipment collection and fixed upgrade actions.
**Architecture:** Pure equipment presentation helpers resolve filters, upgrade availability and effective effects. Armory owns Phaser rendering, HTML filters, bounded scrolling and scene lifecycle; rules/account remain authoritative.
**Tech Stack:** TypeScript, Phaser 4, Vitest, Playwright; existing assets only.
**Spec:** docs/inventory-ui/proposal.md (user approved with “Làm đi”).

## Global Constraints
- 25 weapons / 16 relics, 12 items per page, preserve full art with contain.
- Upgrade maximum 5; preserve APIs, economy, per-deck equipment and navigation.
- No new capacity, copy inventory, global equip or gacha mechanics.
- Level preview never changes owned level or upgrade price.
- Implement all P0 and P1 items from the approved proposal using current repo patterns.

## Review Focus
- A response after shutdown/re-entry must not render into the new scene (Task 2 browser regression).
- Filtered-out selection remains explicitly labelled; zero results can reset (Task 2 browser regression).
- Scrolled interactive controls must not intercept header/footer (Task 2 long-text regression).
- Signature-only upgrades must not obscure normal-wearer passives (Task 1 effect test; review data text semantics).
- Modal filters/hotkeys and resize placement must remain usable (Task 2 overlay/resize browser checks).

### Task 1: Equipment presentation
**Files:** Create apps/client/src/ui/equipment-presentation.ts; test apps/client/test/equipment-presentation.test.ts.
**Interfaces:** consumes GameData/Profile/rules upgradeCost/weaponAt/relicAt; produces EquipmentFilters, equipmentLevel, equipmentUpgrade, filterEquipment, initialEquipmentId, equipmentEffects, equipmentDecks.
- [x] Write tests: Vietnamese search + combined rarity/ownership; affordable upgrade excludes max/unowned/offline; stable sort and input immutability; effective weapon at 3/5 and relic at 2; initial owned preference and real deck references.
- [x] Run `pnpm --filter client test -- equipment-presentation.test.ts --maxWorkers=1`; expect missing-module failure before implementation.
- [x] Implement helpers using rules resolvers. Passive prose retains base and labelled changes, rather than presenting partial refinement text as a complete passive.
- [x] Re-run targeted tests; expect all pass.
- [x] Commit helper and tests.

### Task 2: Production Armory scene
**Files:** Modify apps/client/src/scenes/armory-scene.ts; create apps/client/e2e/armory-ui.spec.ts; update docs/inventory-ui/proposal.md with implementation evidence.
**Interfaces:** consumes Task 1 helpers; retains upgrade endpoints and deck-builder session.editingDeck navigation.
- [x] Write browser tests for accent-insensitive empty/reset, per-category state, level preview vs cost, max/unowned/offline, server success/busy and late callback, clipped scrolling/overlay/keyboard/resize.
- [x] Run `pnpm --filter client exec playwright test e2e/armory-ui.spec.ts --workers=1`; expect failures for old UI.
- [x] Implement header/resources, counted category tabs, filters, grid, three detail tabs, fixed footer, real effective effects/deck references, pinned card/art overlays, keyboard and masked scroll. Guard late requests and clean HTML/listeners/masks on shutdown.
- [x] Run typecheck + client tests + focused browser tests; expect pass and inspect screenshots of both categories plus max/locked/overlay.
- [x] Run workspace unit suites with maxWorkers=1, typecheck and build; expect exit 0.
- [x] Commit scene/tests/docs, request whole-branch review and address consequential findings with regression checks.
- [x] Keep branch/worktree ready for review; no merge/push requested in this turn.

## Execution record
The user already approved implementation; proceed without another plan approval. Run native PowerShell equivalents for shell-only bookkeeping when needed. Fresh review at end, no per-task agents.

Execution notes: use `pnpm --filter client exec vitest run test/equipment-presentation.test.ts --maxWorkers=1` for focused helper tests; `test -- ...` forwarded a literal separator and ran the client suite, which still produced the expected missing-module RED. Whole-branch reviewer read committed + current working tree code so verification could continue without a premature completion commit. Reviewer P2 and additional WebGL visual regression fixed in one pass, each watched RED→GREEN. Remaining verification/commit is recorded in docs/inventory-ui/proposal.md.
