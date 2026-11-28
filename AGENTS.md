# Emberfall: notes for coding agents

## Music (Toneweft)

Music comes from `music/*.song` via the Toneweft engine behind `USE_TONEWEFT` (`?toneweft` or
`VITE_TONEWEFT=1`); with the flag off the old sequencer is untouched. Check new songs with
`npx toneweft check music` and `npx toneweft balance music/<file>`, and run
`npm run check:music` after audio changes. Do not edit `node_modules/toneweft`; upgrade by
changing the pinned commit in `package.json`.

The `toneweft` skill in `.claude/skills/toneweft/` is copied from `node_modules/toneweft/skills/`;
re-copy it after changing the pinned commit. Composing plan: `music/CUES.md`.

## Balance tuning handoffs (dsh)

Automated tuning passes on this repo have repeatedly met the balance targets by bending the game:
- normal waves out-hit their bosses;
- a 60× ATK guard burn;
- elite heavies at 11× ATK;
- elites offered 4% of the time, so the elite target passed on "too few" fights.

Any spec that asks dsh (or any agent) to tune numbers here must:

- list the exact knobs it may change, **each with an allowed range** inside `tools/balance/rails.ts`, and freeze every other number;
- pin the designed values of the feature being tuned (how often it appears, how strong it is) as non-tunable;
- put `npm test` in Acceptance. It includes the **design-rails** and **features-present** targets, so a bent game fails by name;
- say in Constraints: "Never meet a target by removing, hiding, shrinking or making rare the feature it measures. If a target can't be met inside the allowed ranges, stop tuning and report the closest result; a failing target is an acceptable outcome, a bent game is not."

When reviewing the result, diff every tuned number against the spec before trusting the report. Widening a rail is the owner's decision; record it in `docs/balance.md` under *Design rails*.
