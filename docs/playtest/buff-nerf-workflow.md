# Buff/Nerf Workflow — Controlled Decision Packets

How a suspected balance problem becomes an accepted (or rejected) data change.
The pipeline is deliberately conservative: every step either produces
*bounded, labelled evidence* or stops with an explicit reason. The simulator
never "approves" a patch — it produces a decision packet that a human
reviewer accepts or rejects.

**Core rule: the pipeline never patches `packages/data`.** A candidate is a
descriptor (`experiments/example-candidate.json`) that declares the *one*
changed parameter; tooling materializes a copy, applies the declared patch,
re-validates through `parseGameData`, and simulates. Shipped bytes are
verified identical before and after every run.

## 0. Classify the issue first

Before touching data, decide which of four problems you actually have —
each has a different fix, and confusing them produces "balance" patches
that mask real bugs:

| Issue | Signature | Fix location |
|---|---|---|
| **Bot blindness** | Humans exploit a line all bot profiles ignore; delta vanishes under stronger search budget | `bot/policy.ts`, `bot/search.ts`, belief sampler |
| **Coverage gap** | The suspect card/deck barely appears in the pool or scenario mix | `scenarios.v*.json` pool, `generateScenarios` rotation |
| **Rule bug** | Observed result contradicts `docs/01-combat-rules.md`; golden replay diverges from spec reading | `packages/rules` + regression test |
| **Card strength** | Survives all of the above: consistent delta across profiles, seeds, matchups | *Then* a data candidate |

Only "card strength" proceeds to a buff/nerf experiment. The others are
fixed at the source, with tests, before any balance claim is trusted.

## 1. Screen (synthetic, cheap)

- Run the portfolio (`profiles.v1.json` — 12 skill/style mixes) against a
  `screen`-stage manifest. The suspect change is compared as base-vs-candidate
  over identical scenario seeds (paired AB/BA blocks).
- Read the `BalanceReport`: coverage, error/truncation quality, per-mode and
  per-profile score, first-player advantage.
- `reviewCandidate(report, declaredComparisons)` maps it to a decision:
  - `inconclusive` — quality/coverage gates failed or delta rejected;
  - `policy-sensitive` — the delta's sign flips across bot profiles, i.e.
    the answer depends on who plays, not on the card;
  - `human-check-required` — promotable on bots but evidence is synthetic
    or the calibration artifact is missing/stale/off-scope;
  - `review-candidate` — every gate passed *and* a passed human-calibrated
    artifact covers the mode.
- If no real human corpus exists yet, evidence stays `synthetic` and the
  recommendation is always `human-check-required`. That is the expected
  state until the pilot cohort delivers replays — it is a dependency,
  not a failure.

## 2. Preregister

Before the confirmation run, freeze the question:

- **Target metric:** one declared effect (e.g. "seat-1-team winrate delta ≥
  +5pp in PvP"), plus the metric *family* (`declaredComparisons`) so Holm
  correction bounds the whole family — no silent metric shopping.
- **N:** block count at `confirm` stage. Target ≈ **2000 fresh blocks**
  (fresh seeds, never re-screened ones) for a ±1.5pp CI; halve only if the
  precision gate still holds.
- **Hypothesis + patch:** written into the experiment descriptor
  (`declaredHypothesis`, `patch`) *before* running. `applyDeclaredPatch`
  verifies `patch.from` — a stale copy fails loudly instead of silently
  running a different experiment.
- **Freeze the model:** engine, policy set and pool are pinned by manifest
  hashes (`engineHash`/`policyHash`/`poolHash`). Any mid-run change makes
  manifests incomparable — `buildBalanceReport` throws, by design.

## 3. Confirm (frozen, paired)

- Run base and candidate over the *same* scenario list; records pair by
  `blockId` so AB/BA legs cancel first-player advantage inside each block.
- Gates (`balance-gates.v1.json`): coverage floor, error rate 0, truncation
  <0.5%, paired-block count, effect size, CI width, Holm-adjusted p, family
  CI excluding 0.
- Spillovers, not just the target: compare **weak vs strong hero decks,
  deck archetypes, gear/loadout strata** in `perProfileDelta` and
  `cardCorrelations`. A buff that only moves its own card is different from
  one that shifts the whole seat economy — both appear here.
- `cardCorrelations` are labelled *correlation, not causation* — a card
  appearing more in wins may be a symptom of who's winning.

## 4. Inspect representative traces

Numbers alone can't distinguish "strong card" from "degenerate line".
Pull representative decision traces from paired records (same `traceHash`
family, divergent outcome):

- Did the candidate card actually get played, and did the *line* change
  (earlier play, different target, held for lethal)?
- Do winning traces show a repeated dominant sequence a human would find
  degenerate? That's a design problem even at fair winrates.
- Traces are evidence for the packet, not proof — sample several blocks,
  not just the most extreme.

## 5. Human validation

Required before any `review-candidate` becomes a real change:

- **Calibration gate** (`validate-human`): profiles tuned on the train
  split must match held-out human decisions per `mode:skill` scope. The
  artifact's `scope` must cover the experiment's mode — a `run`-calibrated
  artifact cannot promote a PvP patch.
- **Human A/B:** testers play the candidate under the tester protocol —
  fresh sessions, order/deck counterbalanced, both wins and losses kept.
  Human A/B uses **fresh observations only**; historical replays are never
  rewritten to a different patch — old replays were generated under the
  old rule and are evidence about it, not about the candidate.
- Floors: pilot 12 testers / 60 trajectories; spec floor 30 people /
  300 trajectories / 500 decisions per skill label. Missing participants
  is an external dependency — synthetic matches are never substituted.

## 6. Decision packet & manual review

The packet handed to the human reviewer contains:

1. **Hypothesis** — declared up front, one parameter.
2. **Delta + uncertainty** — paired-block estimate, 95% CI, sign-flip and
   Holm-adjusted p, family CI.
3. **Sensitivity** — per-profile deltas (policy mix), per-mode breakdown,
   matchup/spillover strata, first-player advantage.
4. **Human validation scope** — which `mode:skill` scopes the calibration
   artifact covers and whether they include this experiment's modes.
5. **Representative replays/traces** — a handful of paired blocks showing
   the mechanism, not just the mean.
6. **Accept/reject reasons** — every gate outcome and the reviewer's call.

Manual review is a real gate, not a rubber stamp: the reviewer checks that
the cohort was relevant, the hypothesis was preregistered, and the trace
evidence matches the mechanism claimed.

## What this does *not* promise

- A passed pipeline does **not** guarantee live balance. Simulator deltas
  are evidence about *bot* behaviour under a frozen pool; humans may find
  lines bots miss (hence bot-blindness triage at step 0).
- `tester-calibrated` is required before promotion claims; a
  `population-calibrated` claim additionally needs a representative real
  population cohort — the pilot group is never silently generalized.
- Stale artifacts (hash mismatch vs current data/policy/pool) **downgrade**
  evidence to `human-check-required`; they never carry a promotion across
  a data change they were not measured against.
