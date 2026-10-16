# Arena power matchmaking

User requirements: use full owned hero and equipment progression in arena; find a human with comparable team strength; after sixty seconds start a bot with a random comparable-strength composition. Bot matches award Honor without changing rank. Names and statistics may overlay artwork.

## Implementation

1. Preserve actual constellation, refinement and resonance in arena loadouts and enable their combat bonuses. Keep trial heroes and free equipment at their base ranks. Introduce one deterministic, server-derived power estimate for validated selected teams; document its weights and limits. Generate bounded, seeded random bot compositions from the full roster and tune their legal progression to comparable strength.
2. Match humans primarily by relative team power (10% initially, widening 2 percentage points per ten seconds to 20%). Use rating as a tie breaker. Prioritize eligible humans before the sixty-second bot deadline. Prevent overlapping tick/cancellation/rejoin races. Persist fallback matches under an explicit bot mode; award capped Honor once and leave rating and ranked record unchanged.
3. Update arena waiting, help, history and combat labels to describe actual strength and the Honor-only bot fallback. Update shared UI rules to permit overlays while retaining image aspect ratio, complete image display and bordered rounded controls.
4. Review integration, test loadouts/combat bonuses, valid matched bots, queue boundaries/races and settlement/recovery. Run targeted tests, typechecks and client build. Commit only task files on main; preserve unrelated untracked playtest files.

## Interface contracts

- `measurePvpPower(data, side: PvpSide): number` exported from rules.
- `botMatchedPvpSide(ctx, seed, targetSide: PvpSide): PvpSide` exported by server bot-player.
- Fallback match mode: `ranked_bot`; queue request remains `ranked`.
- Honor follows existing caps and early-forfeit policy; bot games do not count as ranked placements or ranked wins/losses.

The power score is a matchmaking heuristic, not a prediction of win probability. Its weights require future live-match calibration.
