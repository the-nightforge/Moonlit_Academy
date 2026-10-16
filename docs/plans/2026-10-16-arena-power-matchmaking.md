# Arena power matchmaking

User requirements: use full owned hero and equipment progression in arena; find a human with comparable team strength; after sixty seconds start a bot with a random comparable-strength composition. A later instruction on **2026-10-16** supersedes the earlier same-day Honor-only fallback policy: fallback matches award normal ranked points, wins/losses/draws, placement progress and Honor. Players see an ordinary ranked opponent and are not told that the opponent is a bot. Names and statistics may overlay artwork.

## Implementation

1. Preserve actual constellation, refinement and resonance in arena loadouts and enable their combat bonuses. Keep trial heroes and free equipment at their base ranks. Introduce one deterministic, server-derived power estimate for validated selected teams; document its weights and limits. Generate bounded, seeded random bot compositions from the full roster and tune their legal progression to comparable strength.
2. Match humans primarily by relative team power (10% initially, widening 2 percentage points per ten seconds to 20%). Use rating as a tie breaker. Prioritize eligible humans before the sixty-second bot deadline. Prevent overlapping tick/cancellation/rejoin races. Persist fallback matches under an internal bot mode; settle normal Elo, ranked record, placement progress and capped Honor once. Generate an ordinary opponent alias and use the player's rating at queue join for the opponent rating; retain the alias in history and recovery.
3. Update arena waiting, help, history, combat and shop surfaces to present fallback matches as ordinary ranked matches. Show generic opponent search and elapsed time without a machine countdown, bot labels, separate history filter or promises that rank is unchanged. Preserve explicit practice and cooperative machine labels and rewards. Keep shared UI rules permitting overlays while retaining image aspect ratio, complete image display and bordered rounded controls.
4. Review integration, test loadouts/combat bonuses, valid matched bots, queue boundaries/races and settlement/recovery. Run targeted tests, typechecks and client build. Commit only task files on main; preserve unrelated untracked playtest files.

## Interface contracts

- `measurePvpPower(data, side: PvpSide): number` exported from rules.
- `botMatchedPvpSide(ctx, seed, targetSide: PvpSide): PvpSide` exported by server bot-player.
- Fallback match mode is stored internally as `ranked_bot`; public start, snapshots, welcome and history expose `ranked`; queue request remains `ranked`.
- Honor follows existing caps and early-forfeit policy; fallback games count as ranked placements and ranked wins/losses/draws and use normal Elo against the player's queue-join rating. The former `honorOnly` result option is removed.

The power score is a matchmaking heuristic, not a prediction of win probability. Its weights require future live-match calibration.
