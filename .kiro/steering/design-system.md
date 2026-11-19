# Repo Graveyard: Design System

The UI is a haunted graveyard. Every spooky element carries data (see Visual vocabulary). Nothing is decoration only.

## Hard rule: use tokens, never raw colors

Components must use the CSS variables below, through Tailwind theme mappings or `var(--...)`. Never hard-code hex, rgb or hsl values in components. New colors are added here first, as a variable.

## Palette

Define these in `src/app/globals.css` on `:root`. The app is dark only.

```css
:root {
  /* Surfaces */
  --color-bg: #0a0f1f;          /* near-black blue, page background */
  --color-surface: #121a31;     /* cards, panels */
  --color-surface-raised: #1b2542; /* tombstones, hovered surfaces */
  --color-border: #2c3860;

  /* Text */
  --color-text: #ebe6d6;        /* bone white */
  --color-text-muted: #a8adc0;

  /* Accent: eerie violet glow (the only accent) */
  --color-glow: #b79cff;
  --color-glow-soft: rgb(183 156 255 / 0.25); /* halos and shadows */

  /* Failing states: ember (the only warning color) */
  --color-ember: #ff7a45;
  --color-ember-soft: rgb(255 122 69 / 0.25);

  /* Focus */
  --color-focus: var(--color-glow);
}
```

Use violet for interactive and alive-related emphasis. Use ember only for failing or dying states (failing CI, errors, `dead` and `ancient` emphasis). Do not add other accent colors.

## Typography

Both fonts are free (Google Fonts, OFL). Load them with `next/font/google` and expose them as variables.

- Display (headings, tombstone names, epitaphs): **Cinzel**, serif fallback. Variable `--font-display`.
- Body (UI text, data, buttons): **Inter**, sans-serif fallback. Variable `--font-body`.

Rules:
- Use the display font for headings only, at 20px or larger. Never for long paragraphs or small data.
- Body text is at least 16px, with line height 1.5.
- Numbers and metrics use the body font.

## Spacing and radius

Spacing uses a 4px base scale: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`, `--space-16: 64px`. Do not use other spacing values.

Radius:
- `--radius-sm: 6px` for chips and inputs
- `--radius-md: 12px` for cards and buttons
- `--radius-lg: 20px` for panels
- `--radius-tomb: 40% 40% 6px 6px / 28% 28% 6px 6px` for tombstone tops (arched)
- `--radius-full: 9999px`

## Motion

Motion is slow, soft and ambient. It never blocks reading or interaction.

- Durations: `--motion-fast: 200ms` (hover, focus), `--motion-base: 400ms` (enter, exit), `--motion-slow: 1200ms` to `6000ms` (fog drift, candle flicker, loops).
- Easing: ease-in-out or ease-out. No bounce, no snap, no shake.
- No flashing. Nothing flickers faster than 3 times per second.
- Animate `opacity` and `transform` only, where possible.
- **Always honor `prefers-reduced-motion: reduce`.** When set, turn off loops (fog drift, flicker, floating), and replace transitions with instant changes or a simple fade of 150ms or less. State must still be readable with no motion.
- Framer Motion: use `useReducedMotion()` or `MotionConfig reducedMotion="user"` at the app root.

## Visual vocabulary

Each element maps to one data field. Keep the mapping stable so users can learn it.

| Element | Meaning | Rule |
|---|---|---|
| Fog thickness | Days of inactivity | More days gives denser fog over the tombstone, in 4 steps that match the status bands. |
| Flickering candle | Recent activity | A lit candle shows only when there was activity recently. No candle means no recent activity. |
| Cracks | Failing CI | Cracks on the stone appear only when CI is failing. More failing checks gives more cracks, up to a cap. |
| Vines | Outdated dependencies | More outdated dependencies gives more vines. No outdated dependencies gives none. |
| Stone size | Stars | More stars gives a bigger stone, within a min and max size so every tombstone stays readable and tappable. |

Rules:
- Exact thresholds come from the scoring rules, not from the UI.
- Every visual element must also be available as text (see Accessibility). For example, the tombstone shows or announces "Inactive 412 days, CI failing, 3 outdated dependencies, 120 stars".
- Do not add visual elements that map to no data.

## Epitaph voice

An epitaph is one short line, under 80 characters, based on real facts about the repo. Dark humor, kind to the user, never insulting. Joke about the repo's fate, never about the person. Say paused, not failed.

Examples:
1. "Here lies todo-app. Last words: `// TODO: finish this`."
2. "It compiled once. We will always remember that."
3. "Taken by a breaking change in a dependency. 3 stars, all deeply loved."
4. "Sleeping since March 2023. Not gone, only waiting for a free weekend."
5. "Its tests are red, but its ideas are still alive."

## Accessibility

- **Contrast:** WCAG AA at minimum. Body text 4.5:1 or better, large text and UI components 3:1 or better. Check any new token pair before use. Do not put muted text on glow or ember backgrounds.
- **Keyboard:** Every interactive element is reachable and usable with the keyboard, in a logical tab order. Tombstones are focusable controls, not click-only divs. Show a visible focus ring with `--color-focus` (at least 2px, with offset).
- **Status never by color alone:** Always pair color with a text label and an icon or shape. Every status (`alive`, `dying`, `dead`, `ancient`) has a text label, and the visual vocabulary elements above have text equivalents.
- **Screen readers:** Give each tombstone an accessible name with the repo name, status and cause of death. Decorative layers (fog, particles) use `aria-hidden`.
- **Touch targets:** At least 44 by 44 px.
- **Mobile-first:** Write styles for small screens first and add `sm:`, `md:` and `lg:` upwards. The graveyard scene must work at 360px wide with no horizontal scroll. Provide a plain list view as an equivalent to the scene.
- **Zoom:** Layouts work at 200% zoom and with text-only enlargement.
