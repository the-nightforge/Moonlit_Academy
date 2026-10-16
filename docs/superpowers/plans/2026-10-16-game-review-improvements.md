# Game review improvements implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated tasks and an independent final review. Implement and verify the already-authorized scope without repeating approval requests.

**Goal:** Implement review priorities 1, 2, 3 and 5 as confirmed by the user.

**Architecture:** Extend existing pure rules, verified tickets and DOM/Phaser views. Keep each feature's state in its existing authority: combat state, run snapshot or server profile. Reuse artwork and native accessible controls.

**Tech stack:** TypeScript, Phaser, Fastify, Postgres, Vitest; existing asset pipeline and Python image encoding tools.

**Spec:** `docs/superpowers/specs/2026-10-16-game-review-improvements.md`.

## Constraints and review focus

- Work directly on main; preserve unrelated playtest/review files. Follow docs/ui-rules.md in every changed visual state.
- Never accept client-authored unlock pools, story victories or duplicate reward claims. Preserve profile revision checks and old-profile parsing.
- Replaying identical actions yields identical combat/run results; rotate bosses from dedicated boss encounters only.
- Empty reward pools, minimum decks, low health, owner restrictions and missing assets must provide a safe next action.
- Shutdown/retry, replaced scenes, keyboard focus and combat recovery must not leave invisible input blockers or orphan controls.
- Verify required assets before render; retain original image dimensions, full composition and source files.

## Task 1 — Correct combat semantics

Owner: core_rule_fixes. Files: rules effects/apply-action/turn/coop-turn/types, f11 hero data/schema, combat-review-regressions.test.ts.

- [x] Reproduce F03 opponent/duration, F11 own-card versus team-card counting and co-op fatigue failures.
- [x] Add distinct subsequentOwnAttackBonus and ownAttackCardsThisTurn; preserve existing combo passives and reset dead heroes' counters.
- [x] Verify previews do not consume state, multi-hit/bond/alternate-form behavior and fatigue deaths/seat continuation.
- [x] Run final focused tests after concurrent data validators settle; independent review.

## Task 2 — Asset entry and shared UI behavior

Owner: assets_ui_consistency. Files: asset manifest/pipeline/helpers and equipment WebP outputs; combat/home/arena/coop asset callers; image renderers, widgets, settings, hero detail/login and focused tests.

- [x] Reproduce asset selection and control defects; derive required assets from saved deck or actual public battle state.
- [x] Reencode equipment while retaining PNG sources and full dimensions; prefer optimized output in manifest.
- [x] Bound concurrent texture work, maintain progress/retry and cancel stale scene work; contain portrait rendering and fix shared controls.
- [x] Verify safe modal focus, native controls, persistent errors, asset failures/cancellation, and record measured byte changes. Automated checks pass; live browser verification remains unavailable (see implementation report).

## Task 3 — First session and story reuse

Owner: first_session_story_replay. Files: rules meta/onboarding/profile/story and optional Profile.firstLesson; server profile/story routes/tests; account/login/story/dialogue and new first-lesson UI/helpers/tests.

Interfaces: firstCardChoices(data, profile, deckId), claimFirstCard(data, profile, {deckId, cardId, replaceCardId}); POST /profile/first-card; Profile.firstLesson stores chosen/replaced card, deck and practice completion. Combat coach installs in createReady after the asset gate.

- [x] Reproduce unauthorized/repeated claim, missing eligibility, invalid owner/replacement and profile round-trip cases.
- [x] Grant one unlock credit and card plus one legal saved-deck replacement atomically after the first verified story win; select that deck for the next battle.
- [x] Add resumable choice and short gameplay guidance with native controls; registration starts the story flow.
- [x] Enable cleared-stage challenges and dialogue-only readers. Verify no replay rewards and no accidental fight after reading dialogue.
- [x] Verify revision conflict/claim idempotence, reload, dismissal/return and next-stage lesson completion.

## Task 4 — Run depth

Owner: run_depth. Files: run rules/map/types/config/encounters/schema, run policy, server run ticket/action schema, run view and tests.

Interfaces: RunSetup.availableCardIds snapshot, RunStatus/NodeType event, pendingEvent, event trade/rest actions and rest swapCard {cardId, replacementId}; runEventChoices supplies legal UI choices.

- [x] Reproduce post-victory healing disadvantage and missing boss/event/swap behavior.
- [x] Apply the revive recovery floor to survivors, choose seeded dedicated bosses, add three events and one-action same-owner rest swaps.
- [x] Snapshot only selected heroes' starter/unlocked cards; no permanent card grant or client-defined availability.
- [x] Verify diverse seeds/replay, invalid actions, empty pools, minimum decks, low health and complete client/server lifecycle.

## Task 5 — General co-op combinations and integration

Owner: root. Files: coop-combos.json, dedicated combo tests and version.ts. Add three generic combinations after existing ones: armor+healing grants team armor; attack+Vulnerable deals damage; card draw+moon shift grants team healing. Each is limited to once per combat and round, requires different seats and consumes both cards under existing rules.

- [x] Write failing real card-play/hint tests, including same-seat rejection, consumption, limits and roster breadth.
- [x] Add the validated data, full Vietnamese wording and engine fingerprint update.
- [x] Review all task diffs independently, fix material findings, run focused integration tests/typecheck/build. Commit task files only on main.

Verification and remaining observational limits: `docs/reviews/2026-10-16-game-review-improvements.md`.
