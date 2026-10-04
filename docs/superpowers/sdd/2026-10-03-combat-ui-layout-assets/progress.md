# Combat UI Layout & Assets — progress ledger

Plan: `docs/superpowers/plans/2026-10-03-combat-ui-layout-assets.md`
Branch: `feature/combat-ui-layout-assets` from `origin/main` `8ffe84a` (includes merged A1–A5 — prerequisite satisfied).
Baseline: client suite 129/129 green on base.

## Task list
- [x] U1 — Geometry chung, Moon HUD và panel Chọn Pha (`6791cac`)
- [x] U2 — Card readability, cost, ownership và targeting (`804c5e5`)
- [x] U3 — Unit HUD, status overflow và co-op groups (`c53f11d`)
- [x] U4 — Pile inspector và relic/augment HUD (`902df2d`)
- [~] U5 — Bổ sung art — BLOCKED, no image tool (`cc6d50e`, inventory pinned; 44 files remaining)
- [x] U6 — Browser nghiệm thu và tài liệu UI (`a89f298`)
- [x] Review — whole-branch fix pass (`138cc0d`)

## Constraints (from plan)
- 1280×720 EXPAND design; UI tiếng Việt; gameplay/replay unchanged.
- Compact body ≥11px, preview body 14px. No rewriting rules data to fit.
- PvP secrecy: no draw/hand/pending-choice identity of the opponent.
- Modal/tooltip clamp to visibleWorld; Esc + button close on every panel; input lock covers keyboard+pointer.
- No 68 card arts this round. U5 uses the imagegen skill when creating bitmaps; no imagegen during planning.
- Rules stays pure; cost query is arithmetic extraction of `getEffectiveCost`, no behavior change.

## Findings / rulings log

### U1 — done (commit pending)
- `combat-layout.ts`: `computeCombatLayout` produces `units`/`seats`/`hand`/`controls`/`moon`/`phaseSlots`/`phaseLabel`
  per the plan's pinned table (hero 136×196 @470/640/810 y424/200; co-op 100×148 @300/412/524 + 660/772/884;
  summons 80×108 @1000/1100; hand 130,556,1010,160; controls 1154,48,104,652). `handSlots` caps gap at 120.
- `combat-display.seatAnchors` now delegates to `seatAnchorsFor` — one table for renderer + animator.
- `moon-hud.ts`: `moonHudModel` (pure) + `renderMoonHud` — 8 schedule icons with per-phase tooltips,
  current-phase ring, blood badge beside the *effective* moon pos (art socket when present), decree label strip.
- `renderMoonChoice` rebuilt on `fitChoicePanel`: 360 wide, real `Text.height` measured before placing,
  masked wheel-scroll when content exceeds the region (clicks band-gated — Phaser masks clip pixels, not input).
- Mandatory choices can't be cancelled (rules): Esc / right-click / "Thu nhỏ" folds the panel to a reopen
  banner instead — satisfies "Esc + nút rõ" without inventing a cancel action.
- `renderPartnerHand`/`renderOpponentHand` moved to the seat `hand` anchors (790,532 compact 24px tiles /
  156,168 card-back markers) — they were still on the pre-layout top-left position.
- `COMBAT_LAYOUT` in theme trimmed to `midY` + `unitFlash` (animator-only constants no anchor expresses).
- `unitBounds` falls back to `layout.units` rects when no live view exists.
- Old pinned anchors in `combat-lifecycle.test.ts` updated to spec values (draw 54,424 / discard 54,504).
- Tests: `combat-layout.test.ts` (10), `moon-hud.test.ts` (2). Client suite 141/141 green, typecheck clean.
- Committed as `6791cac feat: unify combat layout and expose moon schedule`.
- Not committed: `.gitignore` (`.sdd-work`, pre-existing), `m06.jpg` (U5 scope), plan/review docs (untracked).

### U2 — done (commit pending)
- `queries.ts`: `getCardCostBreakdown` extracts `getEffectiveCost` arithmetic into
  `{base, effective, modifiers[], floor}`; `getEffectiveCost` delegates to `.effective` — replay unchanged.
  Modifiers signed (+cost / −discount); floor applied before discounts, so reason sum ≠ final when floored.
- `combat-card-view.ts`: `combatCardModel` (owners by seat, effective cost, Vietnamese `disabledReason` in
  priority dead→freeze→bloodMoon→power→noTarget→turn/done/choice/not-in-hand), `ellipsize`,
  `renderCombatCard` (110×160, 12 title / ≥11 body 4-line cap / 16 cost), `COMPACT_*`/`PREVIEW_BODY_FONT` consts.
- `theme.ts`: `OWNER_COLORS` now covers all 20 hero ids (test pins key equality with `data.heroes`).
- `card-tooltip.ts`: 320-wide preview, 14px body, header shows `eff (base)` cost + signed reason rows +
  `⚠` disabled line; tall content wheel-scrolls under a mask; both tooltips clamp to `visibleWorld`.
- Scene: `renderCard` consumes the model — effective cost (base struck through), 12px title, 11px
  4-line-ellipsized body (was shrink-to-6.5px), owner/colored strip (replaces the single-color jewel),
  tooltip carries cost presentation; `onCardClicked` shows the model's reason (no English rule strings —
  `getPlayCardError` fallback removed); partner tiles use `getEffectiveCost(…, partner.index)`; selected
  card keeps its lift; gold aim line to hovered valid target; `castingIds` gate added to the click path.
- Layout collisions resolved: "⚡ Hợp Kích" moved to the top edge; strip sits at y=72 (below the 4-line body).
- Tests: `cost-breakdown.test.ts` (10), `combat-card-view.test.ts` (11). Client suite 152/152 green.
- Committed as `804c5e5 feat: improve combat card readability and targeting feedback`.

### U3 — done
- `combat-display.ts`: `statusBadgeModels` — width-derived badges/row, max 2 rows, state order preserved,
  seal last, one slot reserved for the `+N` overflow badge; full statuses stay in the tooltip with source
  ids and real durations. `heroProgressLabel` mirrors `levelup.ts` exactly (Tinh Hồn-2 threshold only
  outside PvP — fixes a real display bug where the scene dropped `!hero.pvp`). `statusLooks` emitter cap:
  max 3 ambient emitters per unit, priority freeze → burn → guard → remaining order.
- Scene: guard tethers are hover/status-triggered now (not permanent), keyed by `guard.sourceId`; co-op
  group titles ("Đội của bạn"/"Đồng đội · Đã Xong"); partner summons use shared-layout top-right slots
  (enemy band never passes x≈682 in co-op — single boss); missing art falls back to a silhouette + name
  strip; HP bar shows compact `hp/max` at 10px when the card is ≥100 wide; unit flash bounds follow
  `layout.units` via `unitBounds`.
- Tests: `combat-unit-view.test.ts` (9). Client suite 161/161 green, typecheck clean.
- Committed as `c53f11d feat: clarify combat unit status and coop layout`.

### U4 — done
- `combat-inspector.ts` (new): `pileModel` (draw hidden everywhere — count only, never order; discard
  resolves `cardDefOf`, redacted `hidden_*` sentinels never fabricate entries), `drawComposition`
  (own-seat bag-of-names only), `relicHudEntries` (moon relics w/ resonance + runRelics + augments,
  unknown ids fall back to the id string), `triggerAnchorKey` = `${player}:${kind}:${id}`,
  `InspectorView` — scene-owned modal (depth 1600 dim), Esc/right-click/✕ close, wheel-scrolled body
  under a mask, registers via `registerModal` so E/cast hotkeys and board input yield; `openRelics` for
  strip overflow; `weapon` joined `RelicHudEntry.kind` ("Trang Bị").
- `widgets.ts`: `registerModal(cancel)` — a non-`showModal` overlay takes modal state; opening cancels
  the previous one.
- Scene: relic strip under the encounter plate (x16..208, 6/row ×2 rows, ≤10 icons then `+N` overflow),
  each icon a tooltip + click→`openRelic` + trigger anchor; hero `UnitCardSpec.weapon` renders a ⚔ badge
  bottom-left (lives inside the unit card so `refreshUnit` rebuilds it — anchor key carries the seat);
  both piles get click zones → `openPile` (draw shows count + own composition, never order).
- `event-animator.ts`: `AnimContext.triggerAnchors`; `runRelicTriggered`/`relicTriggered`/
  `weaponTriggered` flash the icon + short label at the anchor (weapon resolves its wearer's seat via
  `event.player ?? hero.player`); unregistered ids fall back to the center float — never throw.
- Tests: `combat-inspector.test.ts` (8). Client suite 169/169 green, typecheck clean.
- Committed as `902df2d feat: expose public combat piles and relic feedback`.

### U5 — BLOCKED (no image tool in environment)
- Verified lookups already satisfy the plan: `coverImage` cache key is `${key}@${w}x${h}` (source+size
  distinct; `_up` is a distinct source key), `summons:`/`enemies:`/`heroes:{id}_up` keys all wired,
  `assetsManifest()` scans every `public/assets/*` subdir — no code change needed for preload.
- `test/combat-assets.test.ts`: inventory asserts all 20 hero normals + 20 `_up` + 15 enemies + 2 summons
  + no cross-extension stem collisions. Missing lists verified exactly: m09,m10,f05,f06,f07,f08,f09;
  all 20 ups; all 15 enemies; both summons. The four missing-asset tests are `it.fails` — they flip to
  XPASS when files land; remove `.fails` then. Suite: 2 pass + 4 expected-fail.
- `docs/combat-visual-assets.md` created — full ID/path/status table + technical frame + QA checklist.
- **Blocker:** plan Step 3 needs an image-generation tool; none exists in this environment (prompts doc
  targets Leonardo.AI). Per the plan, U5 stays open — silhouettes do not count as done.
  Remaining: 7 normals + 20 ups + 15 enemies + 2 summons = 44 files.

### U6 — done (online paths probed, DB-verified locally only for offline)
- `e2e/helpers/combat.ts`: `clickDesign`/`waitIdle`/`setupOfflineCombat`/`probeCombat`/`captureCombat`/
  `sceneTexts` — all reads inside `page.evaluate` (the `__vn` handle doesn't serialize); probes walk
  `scene.children` so inspector/FX/tooltip texts are visible, not just `root`.
- `e2e/combat-visual.spec.ts`: 13 tests — 4 viewports × (board invariants + hand0/1/8/10) +
  denseStatus(+N overflow)/longChoice(fold+reopen)/summonRevive/playback-lock/pile-privacy. All green;
  one boot-timing flake at 1280x900 passed on re-run. Screenshots → `test-results/combat-visual/`.
- `pvp.spec.ts`/`coop.spec.ts`: `probeCombat` layout assertions added at the post-mulligan settle —
  require the dev DB (server on :8787 unavailable here) so they are written but not locally run.
- Learned fixtures: handSize=6/handLimit=8 (hand10 pushes past the cap by direct mutation — layout
  stress only); intro batch still runs while status reads "mulligan" — waitIdle must precede dispatch;
  inspector body is one \n-joined Text node — match with `includes`.
- docs/05 updated: EXPAND/visibleWorld, combat-layout.ts geometry, card cost/owner/11px bodies,
  status rows+overflow+emitter cap, weapon badge, pile/relic inspector, Esc priority.
- docs/playtest-notes.md appended with environment, commands, screenshot paths, and limits.

### Whole-branch review — fix pass (`138cc0d`)
- Reviewer found 1 HIGH + 5 lows; all verified against source and fixed:
  - HIGH: `heroSpecOf` matched `CombatWeapon.heroId` (a hero DEF id) against `hero.id` (unit id)
    → the Trang Bị badge, tooltip and weapon-trigger anchor could never render. New pure
    `combat-display.weaponForHero` does the defId+seat lookup; 3 tests (wearer, none, seat leak).
  - `refreshUnit`'s ring threshold dropped `!hero.pvp` vs renderHeroCard/heroProgressLabel — PvP
    mid-batch over-fill, transient. Now identical to `levelup.ts`.
  - Draw showed THUA until `match.end` arrived — `draw` also counts `state.winner === "draw"`.
  - 3rd+ own summon wrapped a full row into the hand band — extras now fan in 28px steps; test
    pins `y+h ≤ hand.y` and `x+w ≤ controls.x` for a 4-summon seat.
  - `fitChoicePanel` had no width clamp — `min(360, visible.w-32)` for narrow windows.
  - Chiêm Bài options reported "Chưa tới lượt" — `combatCardModel` skips turn/power/target gates
    for `pendingChoice.options` entries; dead/frozen-owner warnings still show (2 new tests).
  - `weaponTriggered`'s hero fallback matched a defId against unit ids — accepts either shape.
- Ambiguous left as-is: co-op partner summon on the foe row is the deliberate non-overlap
  compromise (test-pinned); opponent relic triggers fall back to center float by design.
- Gates after fix pass: client 177 + 4 expected-fail (U5), typecheck clean, build green.
- Branch `feature/combat-ui-layout-assets` at `138cc0d` — U1–U4+U6 complete, U5 art blocker open.
  Not pushed; no PR inferred.
