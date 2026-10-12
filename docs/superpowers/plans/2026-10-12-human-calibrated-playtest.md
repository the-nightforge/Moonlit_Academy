# Human-Calibrated Playtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this coupled plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not execute until the user requests execution.

**Goal:** Cải thiện bot và hệ đo để hỗ trợ buff/nerf bằng kết quả có kiểm soát sai lệch, sai số và đối chiếu người thật.

**Architecture:** Simulator giữ state thật; policy chỉ nhận observation hợp lệ và các thế giới giả định không đọc state thật. Một portfolio theo kỹ năng/phong cách chạy trong runner deterministic; replay người thật hiệu chỉnh và xác nhận model trước khi báo cáo được gắn nhãn dùng cho đề xuất cân bằng.

**Tech Stack:** TypeScript, rules/data, Vitest, Node20+, Vite SSR bundling sẵn có, Postgres/pg-mem cho replay capture; JSON configs/JSONL records/Markdown reports. Không dependency AI hoặc thống kê mới.

**Spec:** `docs/superpowers/specs/2026-10-12-human-calibrated-playtest-design.md`.

## Global Constraints

- Người dùng chưa có replay/log người thật; thêm thu thập/pilot/calibration vào plan, không tự nhận bot giống người.
- Không đổi luật hoặc độ khó bot đấu tập đang chạy cho người dùng; không tự buff/nerf, phát hành hoặc sửa golden.
- Ba mức `novice/regular/advanced`, bốn style `aggressive/defensive/combo/tempo`; báo riêng từng profile trước khi aggregate.
- RNG engine/policy/belief/sampling độc lập; search theo số expansion, không cắt theo wall time; cùng version/input/seeds phải tái lập được.
- Screening128block; confirm2000block đã chốt trước trên seed mới; combat cap60round/4000action, run cap20000action; outcome truncated/error tách khỏi draw/loss.
- Rejection/error=0; truncated>0.5% chặn đề xuất. Delta≥3điểm, CI95% không qua0, half-width≤3điểm là ngưỡng đề xuất ban đầu, không phải mục tiêu50% cho mọi team.
- Pilot12tester/60player-trajectories; calibration floor30người/300trajectories/500decision mỗi mức mỗi mode; split50/50 theo người và nhóm đối thủ, tối thiểu5 người held-out/mức; dữ liệu thiếu thì `synthetic`.
- Held-out winrate MAE≤10điểm, upper95%≤15điểm; behavioral normalized MAE≤0.25, upper95%≤0.40; zero-variance scale floor1.
- Giữ các thay đổi UI hiện có. Không commit/push nếu chưa được người dùng yêu cầu. Record/report/model lớn vào output; test tên theo chức năng, không tạo `phase*.test.ts`.



## Review Focus

1. Hidden cards/ID/history/intent/RNG khác nhau: policy không đổi quyết định chỉ vì thông tin kín khác (Task1/4).
2. Death, summon, full hand, pending choice, zero resources: legal action enumeration không bỏ hành động hợp lệ hoặc trả endTurn bất hợp lệ (Task2/3).
3. Ghế đổi, cùng Hero ở hai phía, cap truncation, resume/workers: denominator và CI giữ đúng block, không double count (Task5/6).
4. Human-bot, disconnected/lost games, incompatible data versions và hai người cùng trận: capture/split/calibration không làm sạch thiên lệch hoặc lọt held-out (Task7/8).
5. Policy/pool/gear/version hoặc weights thay giữa baseline/candidate: report từ chối gộp/đề xuất, không diễn giải correlational card winrate thành nhân quả (Task6/9).



## File structure và contract chung

Giữ `src/bot.ts` là default heuristic sản phẩm. Các module mới trong `packages/rules/src/bot/`: `observation.ts` (redaction), `actions.ts` (legal enumeration), `policy.ts` + `features.ts` (scoring/profiles), `belief.ts` + `search.ts` (bounded search), `run-policy.ts` (map/reward/rest).

Infrastructure trong `packages/rules/test/playtest/`: `types.ts`, `manifest.ts`, `runner.ts`, `statistics.ts`, `report.ts`, `human.ts`, `calibration.ts`. CLI tại `scripts/playtest/`; configs tại `docs/playtest/`; capture/export tại `apps/server/src/playtest/`. Không kéo Node/DB/filesystem vào browser bundle rules.

Các kiểu được định nghĩa ở Task1/3/5/7, sau đó import thay vì khai báo lại:

```ts
type BotMode = 'pve' | 'pvp' | 'coop';
type Skill = 'novice' | 'regular' | 'advanced';
type Style = 'aggressive' | 'defensive' | 'combo' | 'tempo';
type MatchOutcome = 'win' | 'loss' | 'draw' | 'truncated' | 'error';
type Evidence = 'synthetic' | 'tester-calibrated' | 'population-calibrated';
```



## Task 1 — P0: Khóa observation và thống nhất bot playtest

**Files:** Create `packages/rules/src/bot/observation.ts`, `packages/rules/test/bot-observation.test.ts`; modify `src/index.ts`, `test/playtest.test.ts`, `test/playtest-bot.ts`, `test/story-sim.ts`, `test/coop-sim.ts`, `test/pvp-sim.ts` (paths under packages/rules).

**Interfaces:** `BotObservation { mode: BotMode; seat: number; visibleState: CombatState; history: readonly CombatEvent[]; ownDeckCardIds: readonly string[] | null }`; `makeBotObservation(data: GameData, state: CombatState, seat: number, mode: BotMode, history: readonly CombatEvent[], ownDeckCardIds: readonly string[] | null): BotObservation`. Function returns detached, deeply frozen data; history input must contain only events already visible to seat. Define `BotMode` here. Existing `chooseCombatAction(data,state,seat)` signature remains unchanged.

- [x] Add `hidden_variant_has_same_observation_and_default_action`: mutate true deck order, RNG, opponent hand/choice, hidden `cards` mappings and unrevealed `plannedIntents`; assert equal observation and equal default action. Assert own hand/choice and publicly revealed intent still visible, original state not mutated, prior public card reveal remains usable.
- [x] Run `pnpm --filter rules exec vitest run test/bot-observation.test.ts --maxWorkers=1`; expect missing adapter/failing hidden-information equality, not unrelated setup error.
- [x] Audit client-visible PvE intents and existing `viewFor/coopViewFor`; implement adapter with allowlisted card instances/history. Remove local `combatAction` duplication from `playtest.test.ts`, use shared playtest wrapper. Feed sanitized `visibleState` to legacy heuristic in all sim wrappers; product bot call sites keep defaults.
- [x] Run new test plus `test/combat-bot.test.ts`, `test/moon-decrees.test.ts`, `test/pvp.test.ts`, `test/coop.test.ts`, `test/golden.test.ts`. Golden action replay must remain identical; do not set `GOLDEN_RECORD`.
- [x] Save small baseline v0 JSON manifest and report under output with source/data hash and profile `legacy`. Read-only source audit confirms no hidden-state route bypasses adapter in the sim paths.

**Deliverable:** All playtests have one honest baseline; archived legacy reports explicitly incompatible with the new observation/bot version.

## Task 2 — P0: Đầy đủ hành động hợp lệ

**Files:** Create `packages/rules/src/bot/actions.ts`, `packages/rules/test/bot-actions.test.ts`; use existing `queries.ts`, `choice.ts`, `apply-action.ts` without changing game rules.

**Interfaces:** `enumerateBotActions(data: GameData, obs: BotObservation): readonly Action[]`; `canonicalActionKey(action: Action): string`. Enumerate all legal root targets/choices, all mulligan subsets up to configured max (including none), chooseMoon0/1/2, discard, bloodPact and endTurn when legal. Do not produce forfeit/system actions. Canonicalize mulligan IDs without changing play order; stable lexical tie breaking. Inactive seat returns empty list.

- [x] Add tests `each_enumerated_action_applies_to_original_state`, `enumeration_ignores_hidden_variants`, `choosing_has_no_end_turn`, `mulligan_has_empty_and_all_valid_subsets`, `full_hand_dead_owner_taunt_and_fallen_targets`, `lunar_discard_and_blood_pact_limits`. Assert all targets from getValidTargets are represented, no duplicate keys, no system actions; cover both seats/coop partner.
- [x] Run new file; expect absent enumeration or specific missing-action assertion.
- [x] Implement eligibility from sanitized state/queries, with no inspection of authoritative engine state. Keep root instance IDs for returned actions; synthetic belief IDs will never be legal root outputs.
- [x] Run new tests + existing choice, summons, PvP/Coop and decree tests. Apply every action in generated fixture states to engine truth as the external assertion, not inside policy.

**Deliverable:** Search and noise can choose legal endTurn/targets instead of being biased by an incomplete action set.

## Task 3 — P1: Portfolio heuristic và quyết định Run

**Files:** Create `src/bot/policy.ts`, `features.ts`, `run-policy.ts`, `test/bot-policy.test.ts`, `test/run-policy.test.ts` under packages/rules; modify `test/playtest-bot.ts`. Create `docs/playtest/profiles.v1.json`.

**Interfaces:** Define `Skill`, `Style`; `BotProfile { id: string; version: string; skill: Skill; style: Style; mistakeRate: number; temperature: number; weights: Record<string,number>; search: { maxExpansions:number; depth:number; beamWidth:number; samples:number } }`; `BotContext { policySeed:number; beliefSeed:number }`; `BotDecision { action:Action; reason:string; expansions:number; actionScores: readonly { key:string; score:number }[] }`; `scoreBotAction(data:GameData, obs:BotObservation, action:Action, profile:BotProfile):number`; `chooseBotAction(data:GameData, obs:BotObservation, profile:BotProfile, context:BotContext):BotDecision | null` (initially heuristic); `chooseRunAction(data:GameData, run:RunState, profile:BotProfile, context:BotContext):RunAction`. Run wrapper sanitizes combat observation; non-combat policy reads only current map/reward/deck/HP knowledge.

- [x] Add situation tests: cheap lethal beats expensive overkill; prevent own lethal beats draw; heal avoids full-HP target; guard avoids source; combo ordering beats cost ordering; hold/shift can justify endTurn; different style changes an ambiguous action while keeping legality; same seeded noise repeats; mistake policy never selects invalid action.
- [x] Add Run tests: useful augment beats first option; remove dead/synergy-breaking card according to deck value rather than cheapest automatically; low HP prioritizes reachable rest; no peek at unrevealed future node rewards. Verify no test pins universal style superiority.
- [x] Run new files and observe intended red assertions.
- [x] Implement scored feature vectors from the spec, including opportunity cost/reserve/hand-cap and hero level-up. No hidden oracle and no unconditional cost ranking. Create12profiles with zero initial mistakeRate/temperature and pinned initial budgets from spec; weights documented as hypothesis. Keep candidate score breakdown so failures can be explained.
- [x] Run new/existing bot suites; benchmark a small fixed portfolio matrix, record card usage/round/mana differences rather than “strongest profile = human”. Existing production `pvpBot/coopBot` remain default heuristic; only test runner opts into portfolio.

**Deliverable:** Multiple understandable policies and Run behavior without automatic change to player-facing bots.

## Task 4 — P1: Search giới hạn trên thông tin người chơi biết

**Files:** Create `src/bot/belief.ts`, `search.ts`, `test/bot-search.test.ts`; modify `policy.ts` (under packages/rules).

**Interfaces:** `sampleBeliefStates(data:GameData, obs:BotObservation, profile:BotProfile, seed:number):readonly CombatState[]`; `searchBotAction(data:GameData, obs:BotObservation, profile:BotProfile, context:BotContext):BotDecision | null`. Uses Task2 actions and Task3 feature evaluation; chooseBotAction dispatches to search for budget>0 and legal heuristic otherwise.

- [x] Add `hidden_order_rng_and_enemy_deck_do_not_change_decision`, `two_cheap_cards_find_lethal`, `draw_choice_branch_keeps_root_ids`, `end_turn_reserve_beats_wasted_card`, `same_seed_and_budget_replay`, `total_expansions_never_exceed_budget`, `belief_never_mutates_real_state`. Sampled worlds satisfy zone/card-count/status invariants; swapping data only in inaccessible true opponent cards cannot change samples.
- [x] Run new tests; expect missing search/belief or the targeted heuristic limitation, not timeout.
- [x] Build independent synthetic hidden zones from own known deck/public reveal history; opponent prior from permitted archetypes, never true submitted opponent deck unless public by game rules. PvE intent samples only legal unrevealed possibilities. Every search node carries a fresh seat observation before selecting its next action.
- [x] Implement deterministic beam search over actions/choices; aggregate scores across belief samples. Budget512/depth3/beam6/samples8 regular,2048/depth6/beam12/samples16 advanced, total expansions per decision. Evaluate terminal outcomes first; cut at budget/horizon and fall back to best legal root action. Keep unresolved effects uncertain; no future revealed draw granted for free.
- [x] Run suite and benchmark expansions, action quality and p50/p95 latency on recorded hardware. Stop/flag synthetic state errors, never silently use real state to make search work. If search cannot complete within budget, legal heuristic fallback and its frequency are recorded.

**Deliverable:** Tactical improvement with reproducibility and explicit partial-information limits.

## Task 5 — P1: Runner và pool đo không thiên lệch ghế/đội

**Files:** Create `packages/rules/test/playtest/types.ts`, `manifest.ts`, `runner.ts`, `packages/rules/test/playtest-runner.test.ts`, `scripts/playtest/main.ts`, `scripts/playtest/vite.config.ts`, `docs/playtest/scenarios.v1.json`; modify root `package.json` and existing PvP/Coop/Story/Run sim wrappers.

**Interfaces:** Define `MatchOutcome`; `Scenario { id:string; mode:BotMode | 'run' | 'story'; setup:CombatStart | RunSetup | StorySetup | PvpSetup | CoopSetup; profiles:readonly BotProfile[]; policySeeds:readonly number[]; beliefSeeds:readonly number[]; blockId:string; leg:'AB'|'BA'|'single' }` (use actual exported setup types, no duplicate engine types); `ExperimentManifest { schemaVersion:1; id:string; sourceRevision:string; engineHash:string; dataHash:string; policyHash:string; poolHash:string; stage:'screen'|'confirm'; evidence:Evidence; scenarios:readonly Scenario[] }`; `MatchRecord { experimentId:string; scenarioId:string; blockId:string; leg:Scenario['leg']; outcome:MatchOutcome; winnerSeat:number | null; rounds:number; actions:number; counters:Record<string,number>; traceHash:string; error:string | null }`.

`buildManifest(data:GameData, config:ExperimentConfig):ExperimentManifest`; define `ExperimentConfig` here as schemaVersion1/id/stage/seedStart/blockCount/mode/poolPath/profilePath, JSON parse rejects unknown/invalid budgets. `runScenario(data:GameData, scenario:Scenario):MatchRecord`. Run record holds full action trace as a sidecar JSONL for replay; seed/config manifest is immutable.

- [x] Add tests: same seed trace equality; one vs two worker equality; mirrored leg swaps teams/profiles without losing first-player metadata; cap→truncated, invalid action→error; resume restores blocks exactly once; legal gear/ownership by mode; both-side Hero counts use appearances rather than match count; symmetric scenarios have symmetric aggregation.
- [x] Run new test, observe expected red.
- [x] Create starter/archetype/tester deck pool with mode-legal gear and labels. Generate coverage-aware matchups and AB/BA blocks, skill/style pairs, strength tiers and encounter IDs; count roster dynamically, remove stale14-Hero comment. Preserve legacy exported runner signatures via thin adapters where needed.
- [x] Implement JSONL runner/checkpoint identity on experiment+block+leg, final deterministic ordering and hashes; no silent skip on errors. Caps from spec apply uniformly across wrappers. Use existing Vite SSR with rules/data bundled into `output/playtest-tool/main.mjs` so Node20 does not import uncompiled TS.
- [x] Add root commands `playtest:build` = `pnpm --filter server exec vite build --config ../../scripts/playtest/vite.config.ts`, `playtest` = `node output/playtest-tool/main.mjs`. CLI flags `--command simulate --config <json> --output <directory> --workers <n> --resume`; parse strict with Node util.parseArgs. No default long sweep in pnpm test.
- [x] Run `pnpm playtest:build`; then a smoke JSON config with4blocks. Confirm8PvPlegs, same hashes after resume and worker count change. Large screen/confirm runs are explicit, not regular Vitest setup.

**Deliverable:** Repeatable raw experiment records with coverage and bounded runtime.

## Task 6 — P1: Report, CI và so baseline/candidate

**Files:** Create `packages/rules/test/playtest/statistics.ts`, `report.ts`, `packages/rules/test/balance-report.test.ts`; extend CLI; modify `test/economy-sim.ts`, `test/economy-sim.test.ts`. Create `docs/playtest/balance-gates.v1.json`.

**Interfaces:** `Interval { estimate:number; lower:number; upper:number; n:number }`; `wilson95(wins:number,n:number):Interval | null`; `pairedBlockDelta95(base:readonly MatchRecord[], candidate:readonly MatchRecord[], seed:number,resamples:number):Interval | null`; `buildBalanceReport(base:ExperimentManifest, baseline:readonly MatchRecord[], candidate:ExperimentManifest | null, candidateRecords:readonly MatchRecord[] | null, calibration:CalibrationArtifact | null):BalanceReport` (Task8 defines artifact, temporarily only null allowed). `BalanceReport` contains versions/evidence/coverage/quality/status, per-mode/profile/archetype metrics, matchup estimates, delta intervals and artifact paths. Use config gates copied from spec, bootstrap10000resamples with dedicated seed.

- [x] Add numerical tests: Wilson0/0→null,0/100 and100/100 within[0,1],50/100≈[0.40383,0.59617]; paired identical outcomes→delta0/CI[0,0]; constant block improvement→zero-width delta; AB/BA correlated legs kept together; draw half-score uses bootstrap rather than binary Wilson; error/truncated rates remain visible. Holm fixture rawp[0.01,0.03,0.20]→adjusted[0.03,0.06,0.20].
- [x] Add gate tests: low coverage→insufficient-data; mixed data/policy/pool hash rejects comparison (data hash may differ only for declared baseline/candidate); ≥0.5% truncate boundary uses spec **>**0.5%; policy sign reversal→policy-sensitive; no calibration→human-check-required; card played-win correlation never labelled causal.
- [x] Run new test and targeted economy tests, verify red.
- [x] Implement Wilson and paired cluster bootstrap; report blocks/appearances/independent unit counts. Keep wins/losses/draws separately from mean score. Baseline/candidate manifest must share policies/pool/engine/scenarios except declared data intervention. Candidate parsed with `parseGameData`; freeze policies and re-simulate actions, not replay old human actions under changed costs.
- [x] Add confirm family/adjustment with Holm over predeclared comparisons; paired p-value via block sign-flip test (10000seeded permutations, one swap per complete block), raw95% CI plus conservative family CI using alpha0.05/familySize. Promotion requires corrected test pass and family CI exclude0, alongside effect/precision gates; clarify no repeated significance peeking.
- [x] Change economic reporting to distinguish scenario fixed win assumptions from input measured outcomes. Existing `simulatePvp/Coop` fixed schedules remain labelled `scenario-assumption`; new optional outcome input is a versioned record series. Do not claim changed combat skill improves PvP/Coop income from the fixed schedule.
- [x] Build/read smoke report: JSON+Markdown+CSV, units show percentage points, profile sensitivity and low coverage prominent. Reference NIST/SciPy in docs, no runtime Python dependency.

**Deliverable:** A report that can say “chưa đủ dữ liệu” and estimates intervention effects without pretending to prove real-world causality.

## Task 7 — P2: Thu thập replay từ tester

**Files:** Create `apps/server/src/playtest/replay-capture.ts`, `export.ts`, `apps/server/test/playtest-replay.test.ts`, `docs/playtest/tester-protocol.md`; modify `apps/server/src/config.ts`, `db.ts`, `routes/runs.ts`, `routes/story.ts`; extend CLI with an offline exporter entry built separately using server's existing Vite runtime.

**Interfaces:** `HumanReplay { schemaVersion:1; id:string; groupId:string; participantIds:readonly string[]; humanSeats:readonly number[]; skillLabels:readonly Skill[]; mode:Scenario['mode']; dataHash:string; engineHash:string; setup:Scenario['setup']; actions:readonly (Action | RunAction)[]; actionSources:readonly ('human'|'bot'|'system')[]; result:string; termination:'combat'|'resign'|'timeout'|'disconnect'|'incomplete' }`; `exportTesterReplays(db:Db, cohort:CohortConfig, dataHash:string):Promise<readonly HumanReplay[]>`. CohortConfig pins pseudonymous identity mapping, pre-match skill labels, mode and time range; DB export joins stored seat/account info but output never includes real account identifiers. `captureValidatedReplay(...)` accepts a typed HumanReplay only after server validation, writes to new opt-in table with unique replay ID and version hashes.

- [x] Test completed PvP match reconstructs accepted action order and participant/seat labels from matches/match_players; bad-version/incomplete replay rejected for action evaluation but counted in collection-quality totals. Seed/full setup are offline-only, not placed in public API responses.
- [x] Test PvE/Story win **and loss** finish capture; flag off→no write; duplicate finish→one row; stored replay not altered by later upgrades; failed replay validation→no accepted human record; storage/export failure cannot change rewards/settlement. Use pg-mem and synthetic participants.
- [x] Run new server tests, observe missing exporter/capture failure.
- [x] Reuse existing matches/actions persistence for multiplayer, without protocol changes. Add PvE/Story capture after authoritative replay validation behind `PLAYTEST_REPLAY_CAPTURE` defaultfalse and tester cohort inclusion; do not sync-throw into finish if capture fails. Store full replay in restricted offline source; export salted stable pseudonyms so group split works, never tokens/password/username.
- [x] Export incomplete tickets/dropout counts and system/bot seats; clarify timestamp/decision time absent in old logs, do not invent them. Capture disconnect/surrender as termination labels, exclude system substitutions from human action-fit but retain outcome strata.
- [x] Write protocol: pilot12testers, ≥60trajectories, level labels before games, counterbalanced decks/first-seat/order, both successful and failed runs, human-human vs human-bot separated. Invite/collect only after execution approval; this task does not message testers automatically.
- [x] Validate exported JSON schema and replay equality against pinned source data. Raw data/output files ignored by Git, fixture samples small/synthetic.

**Deliverable:** Real gameplay evidence with explicit cohort/coverage limits and no effect on match execution.

## Task 8 — P2: Hiệu chỉnh và nghiệm thu held-out

**Files:** Create `packages/rules/test/playtest/human.ts`, `calibration.ts`, `packages/rules/test/bot-calibration.test.ts`, `docs/playtest/calibration.v1.json`; extend CLI commands `prepare-human`, `calibrate`, `validate-human`.

**Interfaces:** `splitHumanCorpus(replays:readonly HumanReplay[], salt:string):{train:readonly HumanReplay[];test:readonly HumanReplay[]}`; `CalibrationArtifact { schemaVersion:1; evidence:Evidence; dataHash:string; engineHash:string; policyHash:string; poolHash:string; cohortHash:string; splitHash:string; weights:Record<string,number>; metrics:Record<string,Interval>; scope:readonly string[]; passed:boolean }`; `calibrateProfiles(data:GameData,train:readonly HumanReplay[],profiles:readonly BotProfile[],config:CalibrationConfig):readonly BotProfile[]`; `validateCalibration(data:GameData,test:readonly HumanReplay[],profiles:readonly BotProfile[],config:CalibrationConfig):CalibrationArtifact`. Config pins seed/search range/metric scales/gates; no tuning callback sees test data.

- [x] Add tests: same participant or opponent-connected component never crosses partition; future events not included in decision observation; human-bot/system decisions excluded from human action-fit; versions mixed reject; loss/disconnect samples not silently dropped; no corpus→synthetic/passedfalse; low distinct-player count/CI precision fails; calibration artifact hash mismatch invalidates eligibility.
- [x] Add numerical held-out fixtures at gate boundaries: MAE10pp accepted only when upper95%≤15pp; behavioral0.25 accepted only when upper≤0.40; zero-variance scale floor1. Test action alternatives with same public benefit count as equivalent and raw exact agreement remains separate. For multiple human seats keep shared match outcomes grouped in resampling; implement participant/opponent components as resampling clusters, report loss of precision if few clusters.
- [x] Run tests and verify red.
- [x] Replay human decision points with exact **historical** data version; reconstruct observation/history before each action. Fit profile weights/noise/budget on train with seeded bounded grid search and loss over observed behavior/skill/matchups; do not tune to target Hero winrate50%. Save every candidate config/hash and training score.
- [x] Freeze profiles; simulate the held-out setup distribution with representative opponent/profile mix and recorded deck/gear strata, no true hidden-hand input. Estimate winrate and behavioral discrepancy with human cluster CI. Produce pass/fail **per mode/skill/deck scope**, not a global badge from one PvP cohort.
- [x] Pilot first, then expand to spec floor30people/300trajectories/500decisions per skill; ask for more independent tester cohorts if split graph/precision gates fail. Missing real participants is an explicit external dependency, not replaceable with synthetic matches.
- [x] Set `tester-calibrated` only after floor+quality+held-out gates pass; `population-calibrated` requires an additional representative real population cohort and observed profile/deck weights. Manual reviewer verifies cohort relevance. Integrate valid artifact into Task6; stale artifact downgrades evidence.

**Deliverable:** Measured similarity to observed humans, with transparent unsupported modes and cohorts.

## Task 9 — P3: Quy trình buff/nerf có đối chứng và bàn giao

**Files:** Create `docs/playtest/buff-nerf-workflow.md`, `docs/playtest/experiments/example-candidate.json`, `packages/rules/test/balance-workflow.test.ts`; extend CLI/report only as needed. Never modify shipped data as part of the example.

**Interfaces:** `CandidateExperiment { id:string; baselineDataPath:string; candidateDataPath:string; manifestPath:string; calibrationPath:string | null; declaredComparisons:readonly string[]; declaredHypothesis:string }`; `reviewCandidate(report:BalanceReport):{status:'inconclusive'|'policy-sensitive'|'human-check-required'|'review-candidate';reasons:readonly string[]}`. Null calibration allowed for preliminary screening only.

- [x] Add end-to-end small synthetic runner/report test: known effect compares frozen setup/policies, hash mismatch prevents promotion, insufficient/contradictory profiles block recommendation; production data files byte-identical after run. Artifact can promote only declared calibrated scope with correction/precision/coverage/truncation gates passed.
- [x] Run expected red, implement integration, run green. Example uses copied data input parsed through parseGameData and changes one declared parameter; no automatic patch of packages/data.
- [x] Document sequence: identify whether issue is bot blindness/coverage/rule bug or card strength; screen with portfolio; preregister target+N+metric family; freeze model; confirm2000newblocks; compare direct target and spillovers in weak/strong/deck/gear strata; inspect representative decision traces; A/B tester play with order/deck counterbalance; review patch manually. Human A/B uses fresh observations, not rewritten historical replay outcomes.
- [x] Run fast new bot/runner/report/calibration tests; then `pnpm --filter rules test --maxWorkers=2`, rules/server typechecks and targeted capture tests. Known server PvE gear T205 fails in current baseline (400vs201); triage separately, do not count it as green or rewrite it to hide it. No long golden/sim sweep repeats unless affected behavior or failures justify.
- [x] Run opt-in portfolio screen; if no real corpus yet, output must say `synthetic`, recommendations `human-check-required`. Human collection/confirmation runs are scheduled only when data is available and independently versioned.
- [x] One independent final review of observation boundary, hidden-information invariance, block/participant grouping, data validity and calibration gates. Fix important findings with targeted regressions. Persist commands/counts/hardware/hash/limits in `output/playtest/<experiment>/verification.md`.

**Deliverable:** A repeatable buff/nerf decision packet: hypothesis, baseline/candidate delta+uncertainty, cross-policy/matchup sensitivity, human validation scope, representative replays and reasons to accept/reject. No promise that simulator alone guarantees live balance.

## Execution order và điểm dừng

1. P0 Task1–2: loại lỗi thông tin và hành động trước khi cải thiện độ mạnh.
2. P1 Task3–6: portfolio/search/runner/statistics; có thể dùng ngay cho screening, nhãn synthetic.
3. P2 Task7–8: collect pilot, thêm dữ liệu, hiệu chỉnh/held-out; chưa có người thật thì dừng nhãn ở synthetic và tiếp tục công việc offline độc lập.
4. P3 Task9: confirm candidate và A/B tester; buff/nerf là quyết định riêng sau khi xem packet.

Khuyến nghị thực hiện trực tiếp theo từng task vì observation/policy/runner/calibration dùng chung contract; một reviewer độc lập cuối đợt, không tạo nhiều agent cho các module đang thay interface. Plan này mới được viết, chưa thực hiện các task.