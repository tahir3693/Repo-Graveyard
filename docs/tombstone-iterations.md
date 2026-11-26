# Tombstone component: iteration log

Vibe-coded with no spec. One row per round of changes, so we can see how many iterations it took to be happy.

Rounds are read from `git log` for `src/components/Tombstone.tsx` and `Tombstone.css` (4 commits touched them) and from the session that added the stone vocabulary. Git messages are vague ("More updates"), so each row says what the diff shows. I do not know which feedback triggered each round. Those cells are **TODO (you)**.

| # | Date | Source | What was built or changed | Your feedback |
|---|---|---|---|---|
| 1 | 2026-11-20 | commit `6f00547` | First version: `Tombstone.tsx` and `Tombstone.css`. Rises in on entering the viewport (400 ms, ease-out, once). Hover lift of 4 px (200 ms) with a glow ring. Candle glow flickers on a 2.4 s loop. Reduced motion: no lift, no loop, fade only. | **TODO (you)** |
| 2 | 2026-11-21 | commit `40fe0aa` | `STATUS_LABEL` and `StatusIcon` exported so the detail drawer reuses them. No visual change. | **TODO (you)** |
| 3 | 2026-11-22 | commit `dfbc247` | CSS polish. Epitaph text from `--color-text-muted` to `--color-text` (a CSS comment says about 11:1 on the raised stone). Candle glow from 96 px to 112 px, now two radial gradients, and a drop shadow on the flame. | **TODO (you)** |
| 4 | 2026-11-23 | commit `e8a0d2b` | Visual vocabulary from `design-system.md`: stone size from stars, fog, cracks and vines, with each trait also written in the accessible name. Details below. | **TODO (you)** |

## Iteration count

**4 rounds in git history**, and inside round 4 two correction passes after looking at measurements and screenshots (below). I can't see any round that was never committed.

> **TODO (you):** say whether the count matches your memory, including rounds that were thrown away before a commit.

## Round 4 in detail

All the rules are pure functions in `src/lib/graveyard/stone-vocab.ts`, computed from the scored data. The component only draws the result.

- **Stone size from stars, 4 steps.** Small is under 10 stars, medium 10 to 99, large 100 to 999, grand 1,000 or more. More stars never gives a smaller stone (a fast-check property). Max widths are 192, 224, 240 and 256 px, so every stone is far above the 44 px touch minimum.
- **Fog from days of silence, 3 steps.** Light, medium and dense follow the scoring's fog levels (0.33, 0.66 and 1). Alive repos get none. Denser scored fog never gives thinner fog (a property test through the real scoring). Under reduced motion the fog stops drifting and stays at its density.
- **Cracks when CI is failing.** An ember SVG line in the right gutter.
- **Vines when dependencies are outdated.** Two SVG vines growing up the side gutters.
- **Candle.** Unchanged: only for recent activity.
- **Text equivalents.** The accessible name now lists every trait, for example "todo-app, Dead, quietly retired, large stone, failing CI, outdated dependencies, dense fog" (a unit test pins this string). The drawings are `aria-hidden`.
- **Legend.** A short collapsible key above the controls: "Stone size: stars. Fog: silence. Cracks: failing CI. Vines: old dependencies. Candle: recent activity."

The two correction passes:

1. **Measured at 360, 768 and 1280 px, first run.** I measured the 9 repos the app showed that run (real demo-account data, not the sample repos). There was no overlap between stones and no horizontal scroll, and the lowest text contrast was 5.84:1. One crack strip overlapped an epitaph (the repo `Agent-Purse`, at all three widths). I narrowed the crack and vine strips from 16 px to 12 px. The second run used the 8 sample repos, and `Agent-Purse` was not among them, so that exact case was not re-measured.
2. **Second run on the 8 sample repos (all four statuses, four stone sizes).** No overlaps, no drawing over text, no horizontal scroll, stones 192 to 256 px wide, lowest text contrast 5.84:1. Reading the 1280 px screenshot showed the legend stretched edge to edge, so I centered it and capped it at 56 rem.

Screenshots: `docs/screenshots/vocab-graveyard-360.png`, `vocab-graveyard-768.png` and `vocab-graveyard-1280.png`.

The live site (checked after the push) showed fog, cracks and candle in the stones' accessible names. No stone had vines and all were small, because none of the 9 demo repos is flagged as having outdated dependencies or has 10 stars.

## Notes

- Props: `name`, `cause`, `epitaph`, `status`, `candle`, optional `vocab` and optional `onSelect`.
- The stone is a real `button`. Its accessible name is "{name}, {Status}, {cause}" and, when `vocab` is given, it continues with the traits. The three example stones on the landing page pass no `vocab`, so they keep the short name.
- Status uses a text label plus a distinct icon shape (circle alive, triangle dying, square dead, diamond ancient), never color alone.
- Styles are plain CSS with a `tombstone-` prefix. `next.config.ts` sends every `*.css` file, including `.module.css`, through the Tailwind loader, which breaks CSS Modules scoping.
- Tests: `Tombstone.test.tsx` (accessible name, decorations hidden, one focusable button), `stone-vocab.test.ts` (thresholds and the properties above) and `GraveyardLegend.test.tsx`.

## TODO (you) in this file

1. Your feedback for each of the 4 rounds.
2. Whether the round count matches your memory, including discarded rounds.
