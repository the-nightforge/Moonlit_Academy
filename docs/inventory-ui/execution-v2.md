# SDD ledger — plan: docs/superpowers/plans/2026-10-12-inventory-polish.md
Spec: docs/inventory-ui/review-v2.md, user-approved option A; base 08c9dac.
Pre-flight: Task 1 pure insights consumed by Task 2 scene; no conflicting names/types. Shared current rules, no API schema changes.
Ruling: Execute native inline after direct user authorization — implementation plan operationalizes reviewed design — cost if wrong: local reversible UI changes only.
Ruling: Option A retains 4×3; option B/C are conditional alternatives, not simultaneous features — validate small views before choosing responsive fit — cost if wrong: smaller art at narrow view.
Task 1: in progress.
Task 1: complete — missing module RED → 13 focused GREEN; full client suite 302 passed; typecheck passed. Task 2: in progress.
Task 2: current passive safety regressions RED (compound condition and new effect omitted), fixed all-or-nothing summaries, GREEN 10/10 focused; full client 304/304 and workspace typecheck pass. Browser suite in progress. Final independent read-only review dispatched while browser verification runs; code review will be graded after verification.
Final review: four Important; all reproduced RED in review-unit-red.log/review-browser-red.log. One fix pass: pendingUpgrade account record/finally across scene generation, preview ownership reconciliation only, bounded header/balance text, each/global hook fallback. Focused unit 11/11 GREEN and client typecheck PASS; browser full final running.
Final: minor (deferred): truncated heading/delta full text requires hover; touch expansion remains future polish.
Final: Ruling: test typo is a verification defect — correct the accidentally transformed balance assertion and sorted keyboard fixture — cost if wrong: missed browser regression; final suite must prove corrected expectations.
Final: Ruling: narrow readability judged from actual desktop/900x650 images and bounds — no claim for phone usability — cost if wrong: layout A targets may be too small on narrower devices.
Final: Ruling: transport-loss monitoring stays outside UI scope — keep existing session.online eligibility — cost if wrong: physical connection loss may not update mode promptly.
Final: Ruling: final browser success must be established by a completed test run — source review is not evidence — cost if wrong: unverified interaction regression.

Final: fixed pending re-entry — pending upgrade remains blocked across scene reentry and clears after a late failure RED→GREEN.
Final: fixed preview return — deck equipment deep link returns without changing saved deck or collection state RED→GREEN.
Final: fixed large values — large balances leave header materials and fixed upgrade price in separate regions RED→GREEN.
Final: fixed compound actor effects — falls back for per-hero global effects rather than dropping repeated execution RED→GREEN.
Task 2: complete — full client 305/305, browser inventory19/19 + deck4/4, workspace typecheck/build PASS. Independent reviewer checked 08c9dac through worktree changes; four Important fixed, remaining touch minor recorded. Screenshots desktop/relic/card/art/narrow inspected and saved.
Finishing: retain codex/inventory-ui worktree as requested. No push or merge.
