# Implementation Plan: Death Scoring

## Overview

Implement the deterministic scoring core in TypeScript: `src/lib/epitaphs.ts` first (no dependency on scoring), then `src/lib/scoring.ts` (constants, day math, score, status, cause, scene, `TombstoneSchema`, `scoreRepo`). Unit tests sit next to the code as `*.test.ts`. Property tests use fast-check and map one-to-one to Properties 1 to 19 in the design. Each property test is tagged `Feature: death-scoring, Property N: <title>` and runs at least 100 cases.

Rules that apply to every task: named exports only, no default exports; no I/O, clock reads, randomness or AI in `scoring.ts` and `epitaphs.ts`; `now` is always passed in; tests never read the system clock. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (this spec writes plain TypeScript modules, so it is unlikely to apply).

Scoring is status-first: `scoreRepo` computes the score, then the status with `statusFromScore`, then calls `selectCause(facts, status)`. `alive` can only give `still_active`, and every other status can only give a death cause, with `fading_health` as the last resort.

The design decision on Requirement 6.4 versus 8.2 is implemented as stated: for the `died_with_issues` cause, `scoreRepo` passes `{ requireFact: "issues" }` so only count-bearing templates are eligible, and the template is still chosen by `hash mod eligible.length`.

## Tasks

- [x] 1. Test tooling and epitaph module
  - [x] 1.1 Confirm test tooling and path alias
    - Check `package.json` for `vitest`, `fast-check` and `zod`. Install any that are missing as dev or runtime dependencies as appropriate
    - Ensure `npm run test` runs `vitest run`, and that Vitest resolves the `@/` alias to `src/` (add `vitest.config.ts` if absent)
    - Check whether `src/lib/github/repo-health.ts` exists (from the auth-ingestion spec). If it does not, create only the `RepoHealthSchema` and `RepoHealth` type exactly as the auth-ingestion design defines them, so `import type { RepoHealth }` resolves. Do not invent other fields
    - _Requirements: 1.7, 12.11_

  - [x] 1.2 Implement `src/lib/epitaphs.ts`
    - Export `CAUSE_CODES`, `CauseCode`, `EpitaphFacts`, `EpitaphTemplate`, and `EPITAPH_TEMPLATES` with the 22 templates from the design table (`CAUSE_CODES` has 7 codes, including `fading_health`)
    - Implement `fnv1a32` (offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul`, `>>> 0`), `normalizeName` (collapse whitespace, trim, empty becomes `"this repo"`), `eligibleTemplates` (drop templates that need an invalid fact; `days` may be null), `fillTemplate` (single-pass regex replace, clamp numbers to 999,999,999, `{days}` renders `"N days"`, `"1 day"` or `"a long time"`, truncate only the name by code point and end with `â€¦` so the result is 80 characters or fewer), and `generateEpitaph(cause, facts, options?)` with `options.requireFact: "issues"` filtering eligible templates when at least one remains
    - Select with `fnv1a32(facts.name) % eligible.length`, hashing the raw name
    - No imports from `scoring.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 6.4_

  - [ ]* 1.3 Write unit tests in `src/lib/epitaphs.test.ts`
    - `fnv1a32` known vectors (empty string gives `0x811c9dc5`, `"a"` gives `0xe40c292c`); selection index equals `hash % templates.length` when all facts are valid
    - Template table loop: at least 3 per each of the 7 causes and one with `needs: []` per cause; banned words (`you`, `your`, `yours`, `yourself`, `failed`, `failure`, `lazy`, `quit`, `loser`) absent as whole words; no hex, `rgb(`, `hsl(` or markup other than backticks; fixed text is 50 characters or fewer with `{days}` as 11 and numbers as 9 characters; revival wording from the allowed list is present
    - With a 100 character name every template yields 80 characters or fewer and ends the name with `â€¦`
    - Null days renders `"a long time"`; empty and whitespace names give `"this repo"`; invalid facts fall back to a template that does not need them; `requireFact: "issues"` returns a count-bearing template
    - _Requirements: 8.1 to 8.12, 9.1 to 9.8, 12.1, 12.9, 12.10_

  - [ ]* 1.4 Write property test for epitaph bounds in `src/lib/epitaphs.bounds.property.test.ts`
    - **Property 12: Epitaphs are bounded, single-line and clean**
    - **Validates: Requirements 8.6, 8.7, 8.8, 8.9, 9.7, 9.8, 13.10**

  - [ ]* 1.5 Write property test for epitaph determinism in `src/lib/epitaphs.determinism.property.test.ts`
    - **Property 13: Epitaph determinism**
    - **Validates: Requirements 8.3, 13.12**

  - [ ]* 1.6 Write property test for epitaph facts in `src/lib/epitaphs.facts.property.test.ts`
    - **Property 14: Epitaphs render the facts they use**
    - **Validates: Requirements 6.4, 8.4, 8.5, 9.6**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Scoring engine
  - [x] 3.1 Create `src/lib/scoring.ts` foundations
    - Export `SCORING_CONSTANTS`, `FOG_STEPS`, `STATUS_BANDS`, and the types `Status`, `Cause`, `Scene`, `Facts`
    - Implement and export `toCount`, `computeDaysInactive` (null for null, invalid `now`, non-ISO or unparseable strings; 0 for future dates; floor of whole days; cap 36,500), `effectiveDaysOf`, `inactivityPoints` (integer round-half-up formula), and `buildFacts` (the single place that sanitizes inputs; never reads `language`, `url` or `description`)
    - Use `import type { RepoHealth } from "@/lib/github/repo-health"` and import `CauseCode` from `@/lib/epitaphs`
    - _Requirements: 1.5, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.11, 3.12, 10.1, 10.3, 10.5, 10.6_

  - [x] 3.2 Add score, status, cause and scene functions to `src/lib/scoring.ts`
    - `computeScore` (five point sources, cap 100, archived floor 90), `statusFromScore` (first matching band in `STATUS_BANDS`; the status is computed before the cause), `fogForDays`, `computeScene` (fog, candle, cracks, vines; no `stars`)
    - `CAUSE_RULES`: exactly 7 ordered entries with the specified codes and labels, each with a `kind` field (`"death"` or `"living"`): six death rules in priority order (`archived`, `abandoned_failing_ci`, `died_with_issues`, `outdated_and_forgotten`, `quietly_retired`, `fading_health`), then the living rule `still_active`
    - `selectCause(facts, status)`: for `alive`, return `still_active`; for `dying`, `dead` and `ancient`, return the first matching death rule in the priority order above (`fading_health` always matches)
    - Read all thresholds from `SCORING_CONSTANTS`; no magic numbers
    - _Requirements: 3.2 to 3.10, 4.1 to 4.6, 5.1 to 5.5, 6.1 to 6.11, 7.1 to 7.12, 10.2, 10.4_

  - [x] 3.3 Add `TombstoneSchema` and `scoreRepo` to `src/lib/scoring.ts`
    - `TombstoneSchema` with `z.strictObject`, `NonBlank` refine, integer score 0 to 100, status enum, cause code enum, label and epitaph max 80, `daysInactive` int 0 to 36,500 nullable, scene with fog 0 to 1 and three booleans; export `Tombstone` as `z.infer`
    - `scoreRepo(repo, now)`: `buildFacts`, `computeScore`, `statusFromScore`, then `selectCause(facts, status)`, `computeScene`, and `generateEpitaph` with `{ requireFact: "issues" }` when the cause is `died_with_issues`. Build a new object, never mutate inputs, no `try/catch`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 5.1, 6.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 3.4 Create shared arbitraries in `src/lib/test-utils/scoring-arbitraries.ts`
    - `arbNow` (valid dates from integers, invalid date at low weight), `arbLastCommitAt` (ISO strings before and after `now`, null, empty, arbitrary strings), `arbRepoHealth` (schema-valid) and an "odd" variant with `NaN`, infinities, negatives and fractions
    - Weight generators so all four statuses and all seven causes are reached
    - Add independent reference helpers (floating-point `Math.round` score model and a plain if-chain cause model over status first, then death-rule priority) for Properties 3 and 8
    - _Requirements: 13.1, 13.5, 13.14_

  - [ ]* 3.5 Write unit tests in `src/lib/scoring.test.ts`
    - Use a fixed `now` such as `new Date("2025-01-01T00:00:00Z")`
    - `statusFromScore` boundaries 0, 24, 25, 59, 60, 89, 90, 100
    - `computeDaysInactive`: 86,399,999 ms and 86,400,000 ms, future date, null, empty string, `"March 3 2024"`, invalid `now`, a 200 year old date capped at 36,500
    - `inactivityPoints` at 0, 1, 182, 183, 365 and 1000 days against hand-calculated values
    - `CAUSE_RULES` has 7 entries in order with the specified labels and `kind` values; one repo per cause code (7 examples); one repo matching archived plus all other rules returns `archived`; one repo matching rules 2 to 5 returns `abandoned_failing_ci`
    - Contradiction examples: 29 days inactive, failing CI, outdated dependencies and no README gives score 28, `dying`, `fading_health`; 90 days inactive with 3 open issues (passing CI, no outdated dependencies, README present) gives score 23, `alive`, `still_active`
    - Fog at 29, 30, 119, 120, 299, 300 days; candle lit at 30 days, unlit at 31; future commit gives days 0, candle lit, fog 0
    - Odd inputs (no commits, `outdatedDeps` null, invalid date string, invalid `now`) assert the full Tombstone
    - `died_with_issues` epitaph contains the stale count and the label has no digits
    - `TombstoneSchema`: one valid example and one rejected example per rule with the expected issue path
    - _Requirements: 12.1 to 12.12_

  - [ ]* 3.6 Write property test for score and status ranges in `src/lib/scoring.range.property.test.ts`
    - **Property 1: Score and status are always in range**
    - **Validates: Requirements 1.5, 3.10, 10.7**

  - [ ]* 3.7 Write property test for determinism and immutability in `src/lib/scoring.determinism.property.test.ts`
    - **Property 2: Determinism and input immutability**
    - **Validates: Requirements 1.3, 1.4, 2.7, 6.2**

  - [ ]* 3.8 Write property test for the reference score model in `src/lib/scoring.model.property.test.ts`
    - **Property 3: Score equals the reference model**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.2, 5.5**

  - [ ]* 3.9 Write property test for inactivity monotonicity in `src/lib/scoring.inactivity.property.test.ts`
    - **Property 4: More inactivity never lowers the score**
    - **Validates: Requirements 13.3**

  - [ ]* 3.10 Write property test for negative-fact monotonicity in `src/lib/scoring.monotonic.property.test.ts`
    - **Property 5: Adding a negative fact never lowers the score**
    - **Validates: Requirements 13.7, 13.8**

  - [ ]* 3.11 Write property test for status bands in `src/lib/scoring.status.property.test.ts`
    - **Property 6: Status matches the score band**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 13.9**

  - [ ]* 3.12 Write property test for archived repos in `src/lib/scoring.archived.property.test.ts`
    - **Property 7: Archived repos are ancient**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 13.6**

  - [ ]* 3.13 Write property test for cause precedence in `src/lib/scoring.cause.property.test.ts`
    - **Property 8: Status first, then the first matching death rule wins**
    - **Validates: Requirements 6.1, 6.3, 6.6, 6.9, 6.10, 6.11, 13.5**

  - [ ]* 3.14 Write property test for scene values in `src/lib/scoring.scene.property.test.ts`
    - **Property 9: Scene values follow the facts**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12**

  - [ ]* 3.15 Write property test for days of inactivity in `src/lib/scoring.days.property.test.ts`
    - **Property 10: Days of inactivity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.1, 10.3, 10.6**

  - [ ]* 3.16 Write property test for ignored fields in `src/lib/scoring.ignored.property.test.ts`
    - **Property 11: Score ignores stars, language, URL and description**
    - **Validates: Requirements 3.12, 13.13**

  - [ ]* 3.17 Write property test for totality on odd data in `src/lib/scoring.total.property.test.ts`
    - **Property 15: Scoring is total on odd data**
    - **Validates: Requirements 3.11, 10.2, 10.4, 10.5, 10.7, 11.2, 13.11**

  - [ ]* 3.18 Write property test for JSON round trip in `src/lib/scoring.roundtrip.property.test.ts`
    - **Property 16: Tombstone JSON round trip**
    - **Validates: Requirements 11.8**

  - [ ]* 3.19 Write property test for schema rejection in `src/lib/scoring.schema.property.test.ts`
    - **Property 17: The schema rejects invalid Tombstones with a field path**
    - **Validates: Requirements 11.3, 11.4, 11.5, 11.6, 11.7**

  - [x] 3.20 Write property test for alive causes in `src/lib/scoring.alive-cause.property.test.ts`
    - **Property 18: Alive status never has a death cause**
    - **Validates: Requirements 6.7, 13.15**
    - Run at least 100 cases, tag `Feature: death-scoring, Property 18: Alive status never has a death cause`, and pass `now` as an argument to every call
    - Assert the generators reach `alive` and each of `dying`, `dead` and `ancient`

  - [x] 3.21 Write property test for non-alive causes in `src/lib/scoring.death-cause.property.test.ts`
    - **Property 19: Non-alive status never has still_active**
    - **Validates: Requirements 6.8, 13.16**
    - Run at least 100 cases, tag `Feature: death-scoring, Property 19: Non-alive status never has still_active`, and pass `now` as an argument to every call
    - Assert the generators reach `alive` and each of `dying`, `dead` and `ancient`

- [x] 4. Static checks
  - [x] 4.1 Add ESLint restrictions in `eslint.config.mjs`
    - For `src/lib/scoring.ts` and `src/lib/epitaphs.ts`: `no-restricted-imports` for `fs`, `http`, `https`, `octokit`, `@octokit/*` and LLM clients; `no-restricted-globals` for `fetch`; `no-restricted-properties` for `Math.random` and `Date.now`; `no-restricted-syntax` for `new Date()` with no arguments
    - Ban default exports under `src/lib`
    - Run `npm run lint` and `npm run typecheck` and fix any issues in the new code
    - _Requirements: 1.2, 1.6, 1.7, 1.8, 8.10_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but `tech.md` requires unit tests for every new function in `src/lib`, so skip them only knowingly
- Each task references requirements by their numbers in `requirements.md`
- Property tests are split into one file per property so they can run in parallel
- Tasks 3.20 and 3.21 are required (no `*`) because they guard the status and cause contradiction fix: `alive` must never carry a death cause, and a non-alive status must never carry `still_active`
- The `RepoHealth` type comes from the auth-ingestion spec. Task 1.1 only creates a minimal copy if that spec has not been implemented yet

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["3.3", "3.4"] },
    { "id": 7, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.17", "3.18", "3.19", "3.20", "3.21", "4.1"] },
    { "id": 8, "tasks": ["5"] }
  ]
}
```
