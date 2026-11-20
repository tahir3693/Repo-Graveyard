# Tombstone component: iteration log

Vibe-coded with no spec. One row per round of feedback, so we can see how many iterations it took to be happy.

| # | Date | What was built or changed | Result |
|---|---|---|---|
| 1 | 2026-11-20 | First version. `src/components/Tombstone.tsx` and `Tombstone.css`. Rises in on entering the viewport (400ms, ease-out, once). Hover lift of 4px (200ms) with a glow ring. Candle glow flickers on a 2.4s loop. Reduced motion: no lift, no loop, fade only. | Waiting for your feedback |

## Iteration count

**1 so far.** Tell me what to change and I will add a row.

## Notes

- Props: `name`, `epitaph`, `status`, `candle`, optional `onSelect`.
- The stone is a real `button`. Its accessible name is "{name}, {Status}".
- Status uses a text label plus a distinct icon shape, never color alone.
- Styles are plain CSS with a `tombstone-` prefix. `next.config.ts` sends every `*.css` file, including `.module.css`, through the Tailwind loader, which breaks CSS Modules scoping.