# Test Suite Cleanup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Review all repository tests, consolidate duplicated helpers, and organize historical phase suites by the behavior they exercise.

**Architecture:** Keep tests beside their existing package. Move reusable setup into existing test helpers and split mixed phase suites into focused feature suites; retain every scenario and assertion. Production source and public interfaces stay unchanged.

**Tech Stack:** TypeScript, Vitest, Playwright.

**Spec:** User request on 2026-10-09: audit all tests, optimize and consolidate functions, remove historical `phase...spec.ts` naming.

## Global Constraints

- Keep this work in the current checkout as requested in the ongoing session.
- No production behavior changes, new dependency versions, commits, or pushes; the client declares the Node types already pinned in the workspace.
- Do not remove coverage just to reduce test count.
- Functional moon-phase names remain valid; historical phase2/phase7a/phase7b prefixes do not.
- Distinguish card definition IDs, instance IDs, successful actions and intentionally rejected actions in helper interfaces.

## Review Focus

- Card helpers must preserve targets, players, result events and failure assertions.
- Shared test data must remain independently mutable per test.
- Realtime helpers must retain raw-message, auto-pong and disconnection controls.
- Canvas coordinates must retain centered EXPAND scaling at different viewport sizes.
- Test discovery must preserve all scenarios after files are regrouped.

### Task 1: Establish inventory and baseline

- [x] Inventory all tests and repeated functions across rules, data, server, client and E2E.
- [x] Run four Vitest suites and record expanded case counts and names.
- [x] Capture Playwright discovery before changes.

### Task 2: Consolidate rule helpers and regroup historical suites

**Files:** `packages/rules/test/helpers.ts`, `fixtures/index.ts`, historical `phase*.test.ts`, existing damage/status/keyword/blood-moon/hand/level-up suites, and focused hero/card/bot/guard/moon-choice/summon/charm/seal/revive suites.

**Interfaces:** Shared `playCardById`, `playCardInstance`, `playCardState`, `playTestCard`, `endTestTurn`, `heroByDefId`, and `takeCards` retain the original contracts.

- [x] Replace duplicated helper implementations with explicit shared imports.
- [x] Move each historical describe block to its feature suite, preserving cases and assertions.
- [x] Remove phase and wave labels from suite names and feature fixture names.
- [x] Run rules tests and typecheck; compare expanded cases against baseline.

### Task 3: Consolidate server and client test support and enforce test typechecking

**Files:** `apps/server/test/helpers.ts`, new `helpers/realtime.ts`, arena/coop/realtime/profile/run suites; `apps/client/test/helpers/async.ts` and two animation suites.

**Interfaces:** Shared `Ws`, `schedulerOf`, `hello`, `signedIn`, `flushMicrotasks` preserve existing setup and timing behavior.

- [x] Share websocket support with all existing optional controls intact.
- [x] Extract repeated sign-in and microtask helpers.
- [x] Extend client typechecking to source, unit tests and E2E; validate fixture action results through `requireSuccess` and repair incomplete event/mock fixtures.
- [x] Keep ordinary multiplayer playback settings when reusing online sign-in support.
- [x] Run server/client tests and typechecks; compare cases against baseline.

### Task 4: Consolidate E2E support and validate discovery

**Files:** `apps/client/e2e/helpers/combat.ts`, new `helpers/multiplayer.ts`, arena/coop/pvp/settlement suites; renamed `moon-choice.spec.ts` and `summon-revive.spec.ts`.

- [x] Share canvas coordinate, active-scene, account, API, deck and match-action helpers while preserving feature-specific setup.
- [x] Rename phase specs and historical review/redesign labels to feature names; reuse existing scene-text support.
- [x] Update active docs or scripts that invoke old names.
- [x] Finish Playwright runtime verification on the disposable pg-mem server; discovery matches all 89 cases. Results: 84 passed, 3 conditional skips, 2 failures retained and documented below.
- [x] Review diff for lost assertions, accidental production changes and leftover duplicate helpers.
- [x] Complete final verification: 1,071 unit/integration passes and 4 existing skips across package runs, all typechecks passed, independent review passed, diff clean. E2E is not fully green; both remaining failures are explicit findings.

## Runtime findings

- Replaced stale fixed coordinates for the Đấu Trường menu with its rendered caption. Shared lobby entry preserves reconnect checks.
- Measured full-art combat preload at ~16 seconds, exceeding the old 15-second scene deadline. Shared scene readiness now waits up to 90 seconds; behavior/layout assertions are unchanged.
- Four optional simulations keep their existing skip conditions.
- Run CPU-heavy rules verification separately from Chromium: concurrent execution produced two 5-second unit-test timeouts.
- Multiplayer actions now wait for server acknowledgement. PvP resolves its own pending choices before ending a turn; Co-op drains both playback queues between rounds and waits for a settled board before measuring VFX.
- Co-op uses visible Chiêm Bài options to find missing combo halves and reserves only one copy of each half. This improves the real-card strategy without bypassing server rules or weakening the combo assertion.
- The private PvP test allows 300 seconds for two clients and reload preloads; scene readiness still reports loader/loop diagnostics on failure.
- Final private Co-op failure: playback did not drain within 60 seconds even with turn-by-turn backpressure. Practice Co-op passed. Retain the failing test for further playback diagnosis.
- Final private PvP failure: reload did not reach deck-select within 90 seconds; the last diagnostic had no game handle. The pending-choice bug in the test driver was repaired, but reload startup remains unverified.
- E2E verification used serial batches; 28 early passes have terminal provenance, later batches have JSON reports. Detailed findings and commands are in `docs/testing.md`.
