# Implementation Plan: graveyard-ui

## Overview

Implementation language: TypeScript (strict), as used in the design. The plan builds in this order: foundations (tokens, fonts, types, test infrastructure), the pure Graveyard_Logic in `src/lib/graveyard/` with unit and property tests, the scan state layer, presentational components, page wiring, static conformance checks, and Playwright tests.

Rules that apply to every task:

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).
- Use design tokens only. No hex, rgb, hsl or named colors outside `src/app/globals.css`. Use only the spacing, radius, motion and font tokens from `design-system.md`.
- Use named exports. Default exports only for `page.tsx`, `layout.tsx` and `error.tsx`.
- Every new function in `src/lib/graveyard` gets Vitest unit tests next to it. Property tests use fast-check with at least 100 runs and the tag `Feature: graveyard-ui, Property N: <title>`.
- Pass `now` as an argument in tests. Never read the system clock in a test file.
- Client code never calls GitHub or an LLM provider. No token or secret reaches the client.

Assumptions to verify during implementation (do not skip):

- Framer Motion 14.x API names: `MotionConfig`, `LazyMotion`, `domAnimation`, `m`, `AnimatePresence`, `useReducedMotion`. Check them against the installed `framer-motion` package before using them.
- Module paths imported from the auth-ingestion and death-scoring specs: `@/lib/github/repo-health` (`RepoHealth`), `@/lib/scoring` (`scoreRepo`, `Tombstone`, `Status`, `TombstoneSchema`), `@/lib/scan/response` (`ScanSuccessSchema`, `SafeErrorSchema`), `@/lib/github/sort` (`compareCodePoint`), `readAuthEnv`, and the scaffold's Vitest and Playwright setup. If a path or export differs, adjust the imports in this spec's code only. Do not redefine the upstream types.

## Tasks

- [ ] 1. Foundations
  - [x] 1.1 Verify upstream imports and create shared types
    - Open the installed `framer-motion` package and the auth-ingestion and death-scoring modules. Confirm every name and path listed in the assumptions above. Record any difference as a short comment at the top of `src/lib/graveyard/types.ts`.
    - Create `src/lib/graveyard/types.ts` with `GraveEntry`, `LanguageFilter`, `Filters`, `SortOrder`, `ViewMode` and `NO_FILTERS`, importing `RepoHealth`, `Tombstone` and `Status` as types.
    - Run `npm run typecheck` to confirm the upstream imports resolve.
    - _Requirements: 1.1, 1.9_

  - [ ] 1.2 Add design tokens, fonts and the motion provider
    - Rewrite `src/app/globals.css` with the palette in `@theme static`, cleared default color, radius and spacing namespaces, spacing and motion variables on `:root`, `color-scheme: dark`, base body styles (16px, line height 1.5), the global `:focus-visible` rule (2px, offset 2px, `--color-focus`), and the `control` utility class (44px minimum size, `--color-text-muted` border).
    - Map `--font-display` and `--font-body` in `@theme inline` from `--font-cinzel` and `--font-inter`.
    - Update `src/app/layout.tsx`: load Cinzel and Inter with `next/font/google` (`display: "swap"`, serif and sans-serif fallbacks), set `<html lang="en">`, add metadata, and wrap children in `Providers`.
    - Create `src/components/providers.tsx` (`"use client"`, `MotionConfig reducedMotion="user"`).
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6, 15.8, 15.9, 15.10, 16.4, 17.5, 17.8, 18.3_

  - [ ] 1.3 Set up shared test infrastructure
    - Create `src/lib/graveyard/test-utils/arbitraries.ts` with `arbGraveEntry`, `arbUniqueEntries`, `arbFilters`, `arbAnyValue`, `arbIsoOrJunk` and `arbUrlLike`, reusing the death-scoring arbitraries where they exist and a fixed `now`.
    - Add two Vitest projects (`TZ=UTC` and `TZ=Pacific/Kiritimati`) to the Vitest config, so time zone checks run under both.
    - _Requirements: 19.8, 20.1, 20.13, 20.14_

- [ ] 2. Pure Graveyard_Logic
  - [ ] 2.1 Implement entries and status helpers
    - Create `src/lib/graveyard/entries.ts` (`buildGraveEntries`) and `src/lib/graveyard/status.ts` (`STATUSES`, `statusLabel`, `countByStatus`, `formatSummary`).
    - Write unit tests: empty input, order preserved, `scoreRepo` result equality with a fixed `now`, zero counts, summary string format.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3_

  - [ ] 2.2 Write property tests for entries and counts
    - **Property 1: Building entries preserves the repos and applies the scoring function**
    - **Property 2: Status counts are exact**
    - **Validates: Requirements 1.2, 1.3, 1.4, 8.1, 8.2, 20.2, 20.11**

  - [ ] 2.3 Implement filtering and language listing
    - Create `src/lib/graveyard/filter.ts` (`filterEntries`, `listLanguages`, `reconcileFilters`) using `compareCodePoint`.
    - Write unit tests: empty statuses, one status, several statuses, a named language, unknown language, no match, `reconcileFilters` after a vanished language, no input mutation.
    - _Requirements: 9.2, 9.3, 9.5, 9.6, 9.7, 19.7_

  - [ ] 2.4 Write property tests for filtering
    - **Property 3: Filtering selects exactly the matching entries**
    - **Property 4: The language list is distinct, sorted and complete**
    - **Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7, 20.3**

  - [ ] 2.5 Implement sorting
    - Create `src/lib/graveyard/sort.ts` (`SORT_OPTIONS`, `sortEntries`) with the tie-break by name, then URL, and `null` `daysInactive` treated as largest.
    - Write unit tests for each of the five orders, including a name tie, a URL tie and a `null` `daysInactive`, with exact expected order. Test that `SORT_OPTIONS` has five entries with the exact labels.
    - _Requirements: 9.8, 9.9, 9.10, 19.6_

  - [ ] 2.6 Write property tests for sorting
    - **Property 5: Sorting orders, preserves and does not mutate**
    - **Property 6: Sorting does not depend on the input order**
    - **Property 7: Filtering and sorting commute**
    - **Validates: Requirements 9.9, 9.10, 9.11, 20.4, 20.5, 20.6**

  - [ ] 2.7 Implement stone size and fog count
    - Create `src/lib/graveyard/stone.ts` (`stoneSize`, `fogLayerCount`, `MAX_ANIMATED_STONES`).
    - Write unit tests: `stoneSize` at 0, 1, 10, 100, 1000 and 1,000,000 stars (96x120, 102x128, 118x148, 139x174, 160x200, 160x200) and for `NaN`, -1, 1.5; `fogLayerCount` at 0, 0.33, 0.66, 1 and for `NaN`, -0.1, 1.1.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 19.2, 19.3_

  - [ ] 2.8 Write property tests for stone size and fog
    - **Property 8: Stone size is total, bounded and matches the formula**
    - **Property 9: A bigger star count never gives a smaller stone**
    - **Property 10: Fog layers follow the fog value**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 6.1, 20.7, 20.12**

  - [ ] 2.9 Implement date helpers and lifespan text
    - Create `src/lib/graveyard/dates.ts` (`parseIsoDate`, `formatLifespan`, `formatUtcDate`, `formatUtcTime`, `formatUtcDateTime`). Use `getUTC*` getters only, never `toLocale*`.
    - Write unit tests: valid last commit, `createdAt` with a different year, same year, null and invalid `lastCommitAt`, and `2023-12-31T23:59:59Z` giving 2023. Run under both Vitest time zone projects.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 13.9, 14.4, 19.4_

  - [ ] 2.10 Write property tests for dates
    - **Property 13: Lifespan text follows the date rules and ignores the time zone**
    - **Property 14: UTC date and time formatting**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 13.9, 14.4, 20.10**

  - [ ] 2.11 Implement accessible text
    - Create `src/lib/graveyard/text.ts` (`plural`, `buildAccessibleName`, `describeFacts`).
    - Write unit tests for counts of 0, 1 and 2, a null `daysInactive`, an empty name, a whitespace name, a missing cause label (no trailing comma), and the cracks and vines combinations, with exact strings.
    - _Requirements: 5.9, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9, 7.10, 19.5_

  - [ ] 2.12 Write property tests for accessible text
    - **Property 11: Accessible names are complete and safe**
    - **Property 12: Fact descriptions match the scene and the counts**
    - **Validates: Requirements 5.9, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9, 7.10, 20.8, 20.9**

  - [ ] 2.13 Implement detail rows and the safe repo link
    - Create `src/lib/graveyard/detail.ts` (`ciLabel`, `depsLabel`, `buildDetailRows`, `safeRepoLink`, `DetailRow`).
    - Write unit tests: each CI and dependency label, null language and description fallbacks, `YYYY-MM-DD` last commit, link accepted for `https://github.com/...`, rejected for `http`, `javascript:`, `github.com.evil.example`, credentials and garbage.
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ] 2.14 Write property tests for detail rows and links
    - **Property 15: Only github.com links over https are produced**
    - **Property 16: Detail rows carry every field as plain text**
    - **Validates: Requirements 11.2, 11.3, 11.4**

  - [ ] 2.15 Implement copy, sign-in error and session helpers
    - Create `src/lib/graveyard/copy.ts` (`COPY` with every user-facing sentence from Requirements 2, 13 and 14), `src/lib/graveyard/sign-in-error.ts` (`classifySignInError`, `parseDemoFlag`) and `src/lib/graveyard/session.ts` (`SessionResponseSchema`, `readSession`, validated with Zod, failure means signed out).
    - Write unit tests: no message contains the whole words failed, failure, lazy, quit or loser (case-insensitive); landing messages are at most 140 characters; `parseDemoFlag` is true only for `"1"`; `classifySignInError` examples; `readSession` with a valid body, `{}` and junk.
    - _Requirements: 2.8, 3.1, 3.2, 13.1, 13.4, 14.1, 14.3, 14.6, 14.7, 14.8, 14.14_

  - [ ] 2.16 Write property test for sign-in error classification
    - **Property 18: Sign-in error values map to fixed categories**
    - **Validates: Requirements 2.8**

  - [ ] 2.17 Implement scan error classification
    - Create `src/lib/graveyard/scan-errors.ts` (`ScanErrorView`, `classifyScanError`) using `SafeErrorSchema`. Return only `kind` and a validated `resetAt`.
    - Write unit tests: one example per row of the design table, 429 with a missing and with an invalid `resetAt`, an unlisted status and code pair, a body that fails the schema, a `null` status.
    - _Requirements: 1.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.10, 14.13_

  - [ ] 2.18 Write property test for scan error classification
    - **Property 17: Scan errors classify safely**
    - **Validates: Requirements 1.7, 14.1, 14.2, 14.3, 14.5, 14.6, 14.7, 14.8, 14.10, 14.13**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint` and `npm run test`. Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Scan client and state
  - [ ] 4.1 Implement the scan reducer
    - Create `src/lib/graveyard/scan-state.ts` (`ScanState`, `ScanAction`, `ScanOrigin`, `ScanMeta`, `scanReducer`, `settleSuccess`).
    - `settleSuccess` returns `empty` for zero repos or code `empty_account` without calling `buildGraveEntries`, and `ready` otherwise.
    - Write unit tests: ready, empty from `repos: []`, empty from `empty_account` (spy on `scoreRepo` to confirm it is not called), error, a toggle during loading carries `previous`, a failed `empty-action` returns the Empty_State with `retryFailed`.
    - _Requirements: 1.2, 3.4, 3.5, 3.6, 3.7, 13.7_

  - [ ] 4.2 Implement the scan client
    - Create `src/lib/graveyard/scan-client.ts` (`ScanSuccess`, `ScanResult`, `SCAN_TIMEOUT_MS`, `requestScan`) with an injectable `fetchImpl`. Send only `POST /api/scan` with `{ demo: true, includeForks }` or `{ includeForks }`, validate with `ScanSuccessSchema`, combine the caller signal with `AbortSignal.timeout(30_000)`, never log, never rethrow.
    - Write unit tests with a fake fetch: relative URL, exact body in both modes, no username, valid body gives `ok`, invalid body gives `generic`, rejecting fetch gives `generic`, aborted signal gives `aborted`, timeout (fake timers) gives `generic`, error statuses go through `classifyScanError`.
    - _Requirements: 1.5, 1.6, 1.7, 3.1, 3.2, 3.3, 14.9, 14.10_

  - [ ] 4.3 Implement the `useScan` hook
    - Create `src/lib/graveyard/use-scan.ts` (`"use client"`) with `state`, `setIncludeForks`, `includeForksFromEmpty` and `retry`. Own one `AbortController` in a ref, abort the previous request on each new one, ignore `aborted`, read the clock once (`new Date()`) and pass it to the reducer, abort in effect cleanup.
    - _Requirements: 1.4, 3.1, 3.2, 3.13, 3.14, 14.11_

- [ ] 5. Presentational components
  - [ ] 5.1 Build status icons, shared SVG definitions and stone decoration
    - Create `status-icon.tsx` (four distinct shapes: circle, down triangle, square, diamond), `status-badge.tsx`, `scene-defs.tsx` (one hidden SVG with `<symbol>` for cracks, vines and candle) and `stone-decor.tsx` (`FogLayers`, `Candle`, `Cracks`, `Vines`) under `src/components/graveyard/`.
    - Add the stone, halo, fog, candle and ground styles and the `fog-drift` and `candle-flicker` keyframes to `src/app/globals.css`: 6000ms fog loop, 2400ms candle loop, `opacity` and `transform` only, `ease-in-out`, `data-animate="false"` and `prefers-reduced-motion: reduce` both set `animation: none` while keeping the elements. Use the 200ms halo transition for hover and focus with no change to the hit area.
    - All decoration is `aria-hidden="true"`, uses tokens only, and fog layers have `pointer-events: none`.
    - _Requirements: 4.2, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 16.1, 16.2, 16.3, 16.7, 16.9, 16.10, 17.7, 17.12, 18.6_

  - [ ] 5.2 Build the tombstone stone and the scene
    - Create `tombstone-stone.tsx` (`React.memo`, native `button`, `aria-label` from `buildAccessibleName`, `aria-describedby` to a visually hidden `describeFacts` span, size from `stoneSize`, name clamped to 2 lines in the display font at `text-xl`, epitaph as plain text, `--radius-tomb` top) and `graveyard-scene.tsx` (`<ul aria-label="Graveyard">`, `data-animate` from `MAX_ANIMATED_STONES`, wrapping flow with `gap-6 md:gap-8`, DOM order equals sort order).
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 4.10, 5.8, 5.9, 6.2, 6.4, 6.7, 6.9, 7.5, 7.11, 10.6, 10.9, 10.10, 15.7, 16.10, 17.6_

  - [ ] 5.3 Build the list view
    - Create `list-view.tsx`: `<ul aria-label="Graveyard list">`, one row per entry from the same `visible` array, each with a native `button` named by `buildAccessibleName` and text for name, status badge, score as an integer, cause, epitaph, lifespan and stars.
    - _Requirements: 10.3, 10.4, 10.5, 10.10, 10.11_

  - [ ] 5.4 Build the summary, filter, sort and view controls
    - Create `summary-header.tsx` (four counts from `formatSummary`, icons with `aria-hidden`, "Showing {k} of {n}" while filters are active, hidden separators for screen readers, "Counts are unavailable right now." variant), `filter-bar.tsx` (four `aria-pressed` toggles, language select with `all`, `unknown` and `lang:` option values), `sort-control.tsx`, `view-toggle.tsx` and `include-forks-switch.tsx`. Every control is at least 44px high with a visible text label.
    - _Requirements: 3.12, 8.3, 8.5, 8.7, 8.8, 9.1, 9.3, 9.4, 9.8, 9.14, 10.1, 10.2, 17.6_

  - [ ] 5.5 Build the detail drawer and the Resurrect area
    - Create `detail-drawer.tsx` (`role="dialog"`, `aria-modal="true"`, named by the heading, focus moves to the heading on open, Tab and Shift+Tab trap, Escape, backdrop and "Close" button close, body scroll lock restored on close, bottom sheet below `md` at most 85% of the viewport height, 420px right panel from `md`, `LazyMotion` with `domAnimation`, `AnimatePresence`, `useReducedMotion` with a 150ms fade) and `resurrect-area.tsx` (one `GraveEntry` prop, `aria-disabled="true"`, no `disabled`, `aria-describedby`, `onClick` only prevents default).
    - Show the repo link only when `safeRepoLink` is not `null`, with `target="_blank"` and `rel="noopener noreferrer"`. Render every field as plain text. Add the "Outdated means package.json has not changed for over a year" note.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.16, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 5.6 Build the loading, empty, error and stale states
    - Create `loading-state.tsx` (`role="status"`, 1 to 3 `aria-hidden` fog layers, static under reduced motion), `empty-state.tsx` (heading, body, static scene, link home, "{n} forks were left out" with an "Include forks" button, `retryFailed` line with "Try again"), `error-state.tsx` (`role="alert"`, ember icon, `h2` focused on mount, text and actions from `COPY` per `ScanErrorView`, reset time as `HH:mm UTC` only when valid) and `stale-notice.tsx` (`role="status"`, icon and text in ember, cached time and optional reset time).
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.12, 14.13, 14.15_

  - [ ] 5.7 Build the landing components
    - Create `src/components/landing/landing-hero.tsx` (one `h1`, one sentence of at most 140 characters, inline SVG hill and moon, at most 3 `aria-hidden` fog layers, no raster image) and `landing-actions.tsx` (`"use client"`, session fetch validated with `readSession`, signed-out and signed-in layouts, `signIn` and `signOut` from `next-auth/react`, disabled sign-in with a text when not configured, sign-in error alert with "Try again", 44px targets).
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 18.1_

- [ ] 6. Page wiring
  - [ ] 6.1 Build the graveyard container
    - Create `graveyard-app.tsx` (`"use client"`): `useScan(demo)`, view state (`filters`, `sortOrder`, `view`, `selectedUrl`), `useMemo` for `countByStatus`, `listLanguages` and `sortEntries(filterEntries(...))`, the same `visible` array for scene and list, render by phase (loading, ready, empty, error), demo badge, truncated, forks-skipped and invalid-skipped notes, stale notice above the summary, persistent `role="status" aria-live="polite"` region, "No graves match these filters" with "Clear filters", `reconcileFilters` effect, `inert` on the page behind the drawer, focus return to the opener on close, and closing the drawer with focus on `#page-heading` when the open entry disappears.
    - _Requirements: 1.4, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.13, 8.4, 8.6, 9.2, 9.11, 9.12, 9.13, 9.15, 10.2, 10.4, 11.9, 11.10, 11.15_

  - [ ] 6.2 Build the graveyard route
    - Create `src/app/graveyard/page.tsx` (default export, server): "Skip to graveyard" link as the first focusable element, home link, `main#graveyard-main` with `tabIndex={-1}`, one `h1#page-heading` with `tabIndex={-1}`, and `GraveyardRoute` inside `<Suspense fallback={<LoadingState />}>` that awaits `searchParams` and uses `parseDemoFlag`. Create `src/app/graveyard/error.tsx` with the generic paused message and a reset button.
    - _Requirements: 3.1, 3.2, 17.8, 17.9, 17.10_

  - [ ] 6.3 Build the landing route
    - Replace `src/app/page.tsx` (default export) with `LandingHero` and, inside `<Suspense>`, `LandingActionsRoute` that awaits `searchParams`, calls `classifySignInError` and `readAuthEnv(process.env)` per request, and renders `LandingActions`.
    - _Requirements: 2.1, 2.2, 2.3, 2.8, 2.9_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`. Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Static conformance checks and e2e setup
  - [ ] 8.1 Add static conformance, contrast and size checks
    - Create `src/components/style-rules.test.ts`: fail on raw colors, off-scale spacing or arbitrary spacing classes, `text-xs` or `text-sm`, `font-display` without `text-xl` or larger, `max-width` queries or `max-*:` variants, `prefers-color-scheme`, `dangerouslySetInnerHTML`, `innerHTML`, imports of `octokit` or an LLM client, default exports under `src/lib/graveyard`, and non-token accent colors, off-list easing, off-range loop durations or non-`opacity`/`transform` keyframes in `globals.css`.
    - Create `src/app/contrast.test.ts`: parse tokens from `globals.css`, compute WCAG contrast for each pair in the design (4.5:1 text, 3:1 borders, worst-case fog blend), and assert `--color-text-muted` is never used on glow or ember.
    - Add an ESLint rule (`no-restricted-imports`, `react/no-danger`) for `src/components` and `src/lib/graveyard`.
    - Create `scripts/check-landing-size.mjs` (gzip JS, CSS and HTML of the landing route, fonts excluded, fail above 200 kB, and grep client assets for secret variable names and `octokit`).
    - _Requirements: 1.8, 1.9, 4.9, 6.13, 15.1, 15.4, 15.5, 15.6, 15.8, 15.9, 15.10, 16.1, 16.2, 16.3, 16.9, 17.1, 17.2, 17.3, 18.2_

  - [ ] 8.2 Set up Playwright configuration and fixtures
    - Configure `playwright.config.ts` to run `npm run build && npm run start` with dummy `GITHUB_ID`, `GITHUB_SECRET` and `AUTH_SECRET` and no LLM or demo credentials, plus a second project on another port with those variables unset.
    - Create `e2e/fixtures/scan-fixtures.ts` (responses built to pass `ScanSuccessSchema` and `SafeErrorSchema`, imported from the app; at least 6 repos covering all four statuses, candle, cracks and vines, stars 0 and 1000, null languages, and an epitaph and description containing `<b>x</b>`; a 61-repo and a 300-repo set) and a shared helper that mocks `/api/scan` and `/api/auth/*`, records all requests, fails on any host other than the app origin and the fonts host, and asserts zero requests to `api.github.com`, `github.com` and LLM hosts.
    - _Requirements: 21.1, 21.2, 21.3, 21.25_

- [ ] 9. End-to-end tests
  - [ ] 9.1 Write landing page e2e tests
    - Create `e2e/landing.spec.ts`: one `h1` and two buttons; demo navigation to `/graveyard?demo=1` with exactly one scan request and `demo: true`; sign-in intercepted without reaching `github.com`; signed-in layout and sign-out; `?error=AccessDenied` and another error value show the right message and "Try again"; unconfigured sign-in disables the button; 44px targets and no horizontal scroll at 360px.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9, 2.10, 21.4, 21.5, 21.6, 21.22, 21.23_

  - [ ] 9.2 Write graveyard scene, filter, sort and list e2e tests
    - Create `e2e/graveyard-ui.spec.ts`: Summary counts per status, stone names as `{name}, {status}, {cause}`, decorations present if and only if their flag is true, stone widths 96 and 160, `<b>x</b>` shown literally, status toggle, language and sort changes with unchanged summary counts and focus kept on the control, "Clear filters", list view order equals scene order, Tab order (skip link, filters, sort, view toggle, stones).
    - _Requirements: 3.12, 4.9, 5.8, 6.4, 6.7, 6.9, 8.3, 9.1, 9.8, 9.12, 9.13, 9.15, 10.4, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.24_

  - [ ] 9.3 Write detail drawer e2e tests
    - Create `e2e/detail-drawer.spec.ts`: Enter opens the dialog and focus moves inside, 20 Tab and 20 Shift+Tab stay inside, Escape and backdrop close and return focus to the stone, the Resurrect button is focusable with `aria-disabled="true"` and sends zero requests, the link appears only for a `github.com` URL, bottom sheet anchored and full width at 360x640, right panel of 420px at 1280px, body scroll locked while open.
    - _Requirements: 11.1, 11.3, 11.4, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.14, 12.2, 12.4, 21.13, 21.14, 21.15, 21.16, 21.22_

  - [ ] 9.4 Write loading, empty, error and stale e2e tests
    - Create `e2e/graveyard-states.spec.ts`: Loading_State visible during a response delayed by at least 1000 ms and gone after; `empty_account` Empty_State; the Include forks hint and a failed Include forks request from the Empty_State; one test each for 401 `token_revoked`, 429 `rate_limited`, 404 `account_not_found`, 502 `github_unavailable` and a body that fails the schema, each checking the text and that no raw body or token is visible; stale notice with cached stones; a toggle during a pending request ignores the older response; demo badge, truncated and skipped-count notes.
    - _Requirements: 3.8, 3.9, 3.10, 3.11, 3.13, 3.14, 13.1, 13.4, 13.5, 13.7, 13.9, 14.1, 14.3, 14.6, 14.8, 14.10, 14.12, 14.13, 21.17, 21.18, 21.19, 21.20_

  - [ ] 9.5 Write motion, layout and performance e2e tests
    - Create `e2e/graveyard-quality.spec.ts`: with `reducedMotion: "reduce"` no infinite animation on the landing and graveyard pages; with 61 stones no infinite animation but the same number of fog and candle elements as the motion-enabled case; at 360x640 `scrollWidth` is at most 360 for landing, scene, list and drawer, and every visible interactive element is at least 44x44; one `h1` and a non-empty `lang`; zero raster image requests; with 300 stones render time under a 4x CPU throttle through CDP and layout shift sum of at most 0.01 for 5 seconds.
    - _Requirements: 6.11, 6.12, 10.7, 16.5, 16.7, 17.6, 17.8, 18.1, 18.4, 18.5, 21.21, 21.22, 21.23_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, the size check script and `npm run e2e`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Unit tests are part of each implementation task, because `tech.md` requires tests for every new function in `src/lib`. Property test sub-tasks are not marked optional for the same reason, since the steering asks for fast-check properties on the design's correctness properties.
- Component behavior is covered by Playwright and static checks only. No jsdom or Testing Library is added.
- All scan field names come from `ScanSuccessSchema` and `SafeErrorSchema`. If an upstream name differs from the design, fix it in this spec's code only.
- Run the "exactly one request" e2e tests against `next build` and `next start`, not `next dev`, because Strict Mode runs effects twice in dev.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.5", "2.7", "2.9", "2.11", "2.15", "2.17"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6", "2.8", "2.10", "2.12", "2.13", "2.16", "2.18", "4.2"] },
    { "id": 4, "tasks": ["2.14", "4.1", "5.1", "5.4", "5.6", "5.7"] },
    { "id": 5, "tasks": ["4.3", "5.2", "5.3", "5.5"] },
    { "id": 6, "tasks": ["6.1", "6.3"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["8.1", "8.2"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] }
  ]
}
```
