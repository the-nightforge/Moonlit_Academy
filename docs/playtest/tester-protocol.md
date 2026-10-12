# Tester Protocol — Human Replay Collection (`20` §7)

How the pilot playtest cohort is recruited, instrumented and labelled. This
document describes the *process only* — it never contacts testers, sends
invites, or automates recruitment. Coordinators run it manually.

## Cohort

- **Size:** 12 testers (one pilot group, `groupId` e.g. `pilot-2026-10`).
- **Trajectories:** at least **60 completed replays** across the cohort
  (≈5 per tester). Both wins **and losses** are required — a corpus of only
  successful runs cannot calibrate a skill gradient.
- **Skill labels:** collected **before any game is played** via a short
  self-assessment (deck-builder experience, this game's systems). Each tester
  is labelled `novice` / `regular` / `advanced` up front; labels go into the
  cohort config used by `exportTesterReplays` (`skillLabels`). Labels are
  never inferred from results — that would leak outcome into the feature.

## Session design

- **Counterbalanced decks:** testers rotate through the fixed deck pool so
  each deck sees a mix of skill labels and seat positions; no tester plays
  the same deck twice in a row.
- **First-seat / order balancing:** in human–human matches, pairings are
  arranged so each tester sits first and second an equal number of times
  across the session. The export's first-player-advantage metric is only
  meaningful under this balance.
- **Mode mix:** PvP (human–human), bot practice (human–bot), run, and story
  sessions. `actionSources`/`humanSeats` keep human–bot trajectories
  separable from human–human ones — never pool them for action-fit.
- **Dropout policy:** disconnects, timeouts and resignations are valid
  trajectories. They are exported with `termination` ∈
  {disconnect, timeout, resign} and `system`-marked actions, retained for
  outcome strata but excluded from action-fit analysis.

## Data handling

- Capture is **opt-in** (`PLAYTEST_REPLAY_CAPTURE=1`); the flag is off by
  default and capture failure can never block settlement.
- Stored replays (`playtest_replays`) are **offline-only**: full setups and
  seeds, never in API responses.
- Exports carry salted `pt_*` pseudonyms only — no usernames, tokens,
  passwords or raw account ids. Salt rotation breaks cross-export joins.
- Old logs carry **no decision timestamps**; none are invented at export.
- Replays pinned to a different `data_version`/`engineHash` are counted in
  `versionRejected`, never silently included or deleted.

## Acceptance

- ≥60 trajectories, every tester ≥3, both outcomes represented, both seats
  balanced per pairing, and `quality.exported / (exported + versionRejected +
  incomplete)` ≥ 0.9 before calibration may consume the corpus.
