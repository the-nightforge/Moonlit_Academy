# Review priorities 1, 2, 3 and 5 — implementation

Implemented directly on main from dcfca8d, as authorized. Scope follows the user's explicit choice of the final priority table.

## Result

- Correct Hàn Kiếm's opposing targets and PvP duration, Vũ Điệp's own-card counting and preview behavior, and round-twenty co-op fatigue. Reset counters even while heroes are fallen.
- Encode 41 existing equipment images as WebP, retaining sources and original dimensions. Prefer optimized files deterministically. Total file bytes: 115,857,448 to 16,595,642 (85.7% reduction). This is an encoding-size comparison, not a measured network or frame-rate result. Per-image records are in equipment-optimization.json.
- Prepare selected deck equipment and actual public battle rosters rather than all equipment. Bound concurrent loading, report progress, retry failures and cancel stale work. Guard initial creation, repeated entry, replacement-match recovery and disconnected socket callbacks before drawing.
- Contain combat/deck/gacha images with fitted borders; add native keyboard controls to shared dialogs, settings and hero details. Keep actionable combat errors until dismissal or accepted action. Round and border affected controls.
- Lead registration into story; explain finite decks, moon and awakening contextually. After the first verified win, choose a free card and a legal same-owner replacement in a saved deck. Persist that choice, select the changed deck and recognize practice on a subsequent stage. Server validates eligibility, ownership and revisions; imports cannot forge the lesson claim.
- Apply atomic profile revision compare-and-swap so simultaneous requests cannot overwrite a newer profile. Serialize the pg-mem test adapter's snapshot transactions to preserve rollback isolation; a separate CAS-loss test exercises a writer losing after its read.
- Let survivors recover to the same minimum health floor as revived heroes after run victories. Rotate three seeded bosses; add three two-choice events with safe exits, plus one-action rest swaps from the selected heroes' snapshotted unlocked card pool. These swaps do not grant permanent ownership.
- Allow cleared story challenges without repeat first-clear rewards and separate dialogue reading from combat entry.
- Add three general co-op combinations with existing different-seat, consumption and usage-limit rules. Keep original combinations ahead in matching priority.
- Update the combat engine fingerprint for changed deterministic rules.

Existing arena matching and normal ranked fallback settlement remain outside this change. Concurrent balance edits to pvp-config.json and unrelated playtest/review files are excluded from this commit.

## Verification

- Rules: 14 selected files, 167 tests passed, covering combat regressions, heroes, statuses, leveling, PvP, co-op, run/map/depth, onboarding/profile/account and story.
- Client: all 57 unit-test files, 416 tests passed. After the final socket-cleanup change, its affected three lifecycle/error regressions passed again.
- Server: eight selected integration files, 46 tests passed; separate forced CAS-loss regression passed (47 total).
- Data: two files, 50 tests passed.
- Workspace typecheck passed after final changes.
- Production client build passed after final changes. Existing large-bundle warning remains (about 2.41 MB minified JavaScript / 632 KB gzip).
- Independent review found and verified fixes for three scene/asset lifecycle regressions and the remaining socket callback loading window. Final targeted review approved with no remaining Critical or Important findings.
- Git whitespace validation passed.

## Limits

The in-app browser timed out attaching to the local preview; its tab inventory remained empty. No live browser screenshots or viewport acceptance are claimed. DOM/geometry, keyboard and loader tests cover behavior but do not replace a human visual pass. No player balance study, long-run economy calibration, network benchmark or full simulation/golden sweep was performed.
