# Implementation Plan: auth-ingestion

## Overview

Implementation is in TypeScript, as in the design. Work starts with test infrastructure and the pure core (schemas, derivations, filters, mapping), then adds failure classification, pagination and concurrency, then the GitHub I/O layer, the scan API contract, Auth.js, the handler and routes, and finally lint rules and the end-to-end test. Each task builds on earlier ones and ends wired into the scan route, so no code is left orphaned.

Conventions for every task (from `.kiro/steering/`):
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- Named exports only, except `route.ts` method exports.
- No `as` casts or non-null assertions on external data.
- Each new function in `src/lib` gets a Vitest unit test next to it (`*.test.ts`) with one success case and one failure or boundary case.
- Property tests use fast-check with `numRuns` of at least 100. Each property test file defines its own arbitraries, built on the shared basics from task 1.1, so parallel tasks do not edit the same file.
- No secrets in logs, responses or `.env.example` values.

## Tasks

- [x] 1. Set up test infrastructure and environment configuration
  - [x] 1.1 Configure Vitest, network blocking and shared arbitraries
    - Create or update `vitest.config.ts` with a `setupFiles` entry and a `@/` path alias matching `tsconfig.json`
    - Create `src/test/setup.ts` that replaces `globalThis.fetch` and Node HTTP/HTTPS request functions so any real request throws an error naming the blocked URL
    - Create `src/lib/github/test-utils/arbitraries.ts` with basic arbitraries: valid `RepoHealth`-shaped values, valid and invalid GitHub repo payloads
    - Add `test`, `typecheck` scripts to `package.json` if missing (`vitest run`, `tsc --noEmit`)
    - Add `GITHUB_DEMO_USERNAME` and `NEXTAUTH_URL` (names only, no values) to `.env.example`
    - Add a unit test for the setup file proving a real `fetch` call is rejected with an error identifying the URL
    - _Requirements: 11.4, 11.8_

  - [x] 1.2 Implement environment readers
    - Create `src/lib/env.ts` with `readAuthEnv` and `readDemoConfig` taking an env record
    - `readAuthEnv` returns `null` if `GITHUB_ID`, `GITHUB_SECRET` or `AUTH_SECRET` is missing or empty after trim
    - `readDemoConfig` returns `null` if `GITHUB_DEMO_USERNAME` is missing, empty or fails `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`; `token` is `null` when `GITHUB_DEMO_TOKEN` is missing or empty
    - Write `env.test.ts` covering missing, empty, whitespace and invalid-username cases
    - _Requirements: 1.4, 1.8, 9.2, 9.3, 9.5, 9.6_

- [x] 2. Implement the pure core
  - [x] 2.1 Create RepoHealth and GitHub payload schemas
    - Create `src/lib/github/repo-health.ts` with `RepoHealthSchema` (`z.strictObject`) and `RepoHealth` type
    - Create `src/lib/github/schemas.ts` with `GitHubRepoSchema`, `CommitListSchema`, `CheckRunsSchema` and the README object schema
    - Write unit tests for valid objects and for rejection of bad `ciStatus`, negative or non-integer counts, missing fields and `null` without throwing
    - _Requirements: 2.2, 10.1, 10.6, 10.7, 10.8, 10.10_

  - [ ]* 2.2 Write property test for RepoHealth JSON round trip
    - Create `src/lib/github/repo-health.roundtrip.property.test.ts`
    - **Property 3: RepoHealth JSON round trip**
    - **Validates: Requirements 10.9**

  - [ ]* 2.3 Write property test for RepoHealth schema rejection
    - Create `src/lib/github/repo-health.reject.property.test.ts`
    - **Property 4: RepoHealth schema rejects invalid values**
    - **Validates: Requirements 10.7, 10.8, 10.10**

  - [x] 2.4 Implement derivations, fork filter and sorting
    - Create `derive.ts` with `deriveCiStatus` and `deriveOutdatedDeps(manifestCommittedAt, now)` (365 day threshold, `null` for missing or unparseable date)
    - Create `forks.ts` with `filterForks(repos, includeForks)` returning `{ kept, skippedForks }`
    - Create `sort.ts` with `compareCodePoint` and `sortByName` (code point order, returns a new array)
    - Write unit tests next to each file, including the exactly-365-days boundary, a future date, an archived fork counted once, and astral characters in sorting
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.15, 3.1, 3.2, 3.3, 3.4, 3.6, 11.1, 11.2_

  - [ ]* 2.5 Write property test for the fork filter
    - Create `src/lib/github/forks.property.test.ts`
    - **Property 2: Fork filter and skipped count**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**

  - [ ]* 2.6 Write property test for CI status derivation
    - Create `src/lib/github/derive-ci.property.test.ts`
    - **Property 6: CI status derivation**
    - **Validates: Requirements 2.4, 2.5, 2.6**

  - [ ]* 2.7 Write property test for outdated dependency derivation
    - Create `src/lib/github/derive-outdated.property.test.ts`
    - **Property 7: Outdated dependency derivation**
    - **Validates: Requirements 2.7, 11.2**

  - [ ]* 2.8 Write property test for output ordering
    - Create `src/lib/github/sort.property.test.ts`
    - **Property 8: Output ordering**
    - **Validates: Requirements 2.15**

  - [x] 2.9 Implement mapping and entry validation
    - Create `map.ts` with `RepoDetails` and `toRepoHealth(repo, details)` as a pure field mapping
    - Create `validate-list.ts` with `splitValidEntries(items)` returning `{ ok: true, repos, skippedInvalid }` or `{ ok: false }` (non-array input, or non-empty list where every entry is invalid)
    - Write unit tests: mapping of every field, `lastCommitAt: null`, a list with one invalid entry, an all-invalid list, an empty array, `null` input
    - _Requirements: 2.1, 2.2, 2.3, 10.3, 10.4, 10.5, 10.6, 11.1, 11.3_

  - [ ]* 2.10 Write property test for mapping
    - Create `src/lib/github/map.property.test.ts`
    - **Property 5: Mapping is schema-valid and deterministic**
    - **Validates: Requirements 2.1, 2.2, 2.3, 11.1, 11.3**

  - [ ]* 2.11 Write property test for valid and invalid entry split
    - Create `src/lib/github/validate-list.property.test.ts`
    - **Property 10: Valid and invalid entry split**
    - **Validates: Requirements 10.3, 10.4, 10.5**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement failure classification, pagination and concurrency
  - [x] 4.1 Implement GitHub failure classification
    - Create `src/lib/github/errors.ts` with `ScanFailure`, `ScanFailureError` and `classifyGitHubFailure(error: unknown, now: Date)`
    - Read `status`, response headers and message from the unknown error through a Zod schema, with no type assertions
    - Apply the rules: 429 is rate limited; 403 is rate limited with `x-ratelimit-remaining: "0"`, `retry-after` or a rate-limit message, otherwise forbidden; 401 is token revoked; 404 is not found; 5xx, aborts and status-less errors are unavailable
    - Derive `resetAt` as ISO 8601 UTC from `x-ratelimit-reset` (epoch seconds) or `now` plus `retry-after`; omit it when neither is a valid number
    - Write `errors.test.ts` for each rule and for malformed header values
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.3, 7.4, 8.3_

  - [ ]* 4.2 Write property test for failure classification
    - Create `src/lib/github/errors.property.test.ts`
    - **Property 11: GitHub failure classification**
    - **Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.3, 7.4**

  - [x] 4.3 Implement pagination
    - Create `src/lib/github/pagination.ts` with `PAGE_SIZE` (100), `REPO_LIMIT` (300), `parseHasNextPage(linkHeader)` and `collectPages(fetchPage, limit)`
    - `collectPages` stops at no next page or at the limit, slices to the first `limit` items, sets `truncated` correctly (exactly 300 with no next page is `false`), and rejects without partial items if any page rejects
    - Write `pagination.test.ts`: Link headers with and without `rel="next"`, a malformed header, 300 exactly, 301 items, a failure on page 2
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

  - [ ]* 4.4 Write property test for the pagination invariant
    - Create `src/lib/github/pagination.property.test.ts`
    - **Property 1: Pagination invariant**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.6, 4.7**

  - [x] 4.5 Implement bounded concurrency
    - Create `src/lib/github/concurrency.ts` with `DETAIL_CONCURRENCY` (5) and `mapWithConcurrency(items, limit, fn)` as a worker pool that keeps input order and stops starting work after the first rejection
    - Write `concurrency.test.ts`: order preserved, limit never exceeded, rejection propagates and stops new work, empty input
    - _Requirements: 4.5_

  - [ ]* 4.6 Write property test for concurrency limit and order
    - Create `src/lib/github/concurrency.property.test.ts`
    - **Property 9: Concurrency limit and order**
    - **Validates: Requirements 4.5**

- [x] 5. Implement the GitHub I/O layer
  - [x] 5.1 Implement the requester
    - Create `src/lib/github/requester.ts` with `GitHubResponse`, `GitHubRequester` (`data: unknown`) and `createOctokitRequester(token)`
    - Configure Octokit with throttle and retry disabled, a silent logger, and a 10 second `AbortSignal.timeout` per request through `octokit.hook.wrap`
    - This is the only file that imports `octokit`
    - Write `requester.test.ts` with a mocked Octokit module: the timeout signal is attached, no auth is set when the token is `null`, and a non-2xx error rejects
    - _Requirements: 2.13, 5.1, 7.4, 9.4, 9.6_

  - [x] 5.2 Implement per-repository detail lookups
    - Create `src/lib/github/details.ts` with the four lookups (latest commit, check runs, README, `package.json` commit), defined as `GET` route constants, each validating its response with Zod before reading it
    - Handle 409 or empty commit list as `lastCommitAt: null` and skip the other lookups with defaults; 404 check runs is `none`; README 200 is `true` and 404 is `false`
    - Rethrow 401 and rate limits as `ScanFailureError`; fall back to defaults (`lastCommitAt` from `pushed_at`, `ciStatus: none`, `hasReadme: false`, `outdatedDeps: null`) on other HTTP or network failures; raise `invalid_response` on Zod failure
    - Write `details.test.ts` with a mocked requester: each lookup, each fallback, 401 abort, Zod failure, and an assertion that every route string starts with `GET `
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.13, 7.5, 7.6, 9.4, 10.1, 10.2, 11.4_

  - [x] 5.3 Implement the scan orchestrator
    - Create `src/lib/github/scan.ts` with `ScanAccount`, `ScanData` and `scanAccount({ request, now }, account, includeForks)`
    - List repositories via `GET /user/repos` (`affiliation: owner`) or `GET /users/{username}/repos` (`type: owner`), `per_page: 100`, sorted by `full_name` ascending, through `collectPages`
    - Then `splitValidEntries`, `filterForks`, `mapWithConcurrency` (limit 5) over detail lookups, `toRepoHealth`, a `RepoHealthSchema.parse` check on every output, and `sortByName`
    - Propagate `ScanFailureError`; classify raw list-request errors with `classifyGitHubFailure`
    - Write `scan.test.ts` with a mocked requester: multi-page listing, truncation at 300, fork exclusion, an invalid entry counted, sorted output, a failing page 2 gives no partial result, a 401 mid-scan discards results
    - _Requirements: 2.1, 2.2, 2.13, 2.15, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.5, 4.6, 7.6, 10.4, 10.6, 11.1, 11.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the scan API contract and cache
  - [x] 7.1 Create request and response schemas
    - Create `src/lib/scan/request.ts` with `ScanRequestSchema` and `parseScanRequest(raw)` returning `{ demo, includeForks }` (defaults `false`) or `null`; unknown keys such as `username` are stripped
    - Create `src/lib/scan/response.ts` with `ErrorCodeSchema`, the fixed error table (code, HTTP status, constant message), `SafeErrorSchema`, `ScanSuccessSchema`, and a helper that builds a Safe_Error response from a code
    - Write unit tests: non-boolean fields rejected, empty object accepted, extra keys stripped, each error code maps to its fixed status and message
    - _Requirements: 2.10, 2.11, 2.14, 3.5, 5.2, 6.1, 8.1, 9.11, 9.12_

  - [ ]* 7.2 Write property test for request body validation
    - Create `src/lib/scan/request.property.test.ts`
    - **Property 13: Request body validation**
    - **Validates: Requirements 2.10, 2.11, 2.14, 3.5**

  - [x] 7.3 Implement the scan cache
    - Create `src/lib/scan/cache.ts` with `createScanCache()` (`get(key, nowMs, ttlMs, includeForks)`, `set(key, data, includeForks, nowMs)`), `USER_CACHE_TTL_MS` (3,600,000) and `DEMO_CACHE_TTL_MS` (300,000)
    - Entries expire at `ttl` after storage, expired entries are deleted on read, a mismatched `includeForks` is a miss, `set` replaces the existing entry, and entries hold `ScanData` only
    - Expose a `globalThis`-backed singleton accessor so dev hot reload keeps the cache
    - Write `cache.test.ts`: hit before TTL, miss at TTL, replacement, fork-setting mismatch, no token field in a stored entry
    - _Requirements: 6.4, 6.6, 6.7, 6.8, 9.8, 9.10_

  - [ ]* 7.4 Write property test for cache TTL and replacement
    - Create `src/lib/scan/cache.property.test.ts`
    - **Property 12: Cache time-to-live and replacement**
    - **Validates: Requirements 6.6, 6.7, 9.8, 9.10**

- [x] 8. Implement Auth.js sign-in
  - [x] 8.1 Implement session callbacks and type augmentation
    - Create `src/lib/auth/callbacks.ts` with pure `jwt` and `session` callback logic (the token and login copied into the JWT on first sign-in; the session returns login, avatar and expiry only)
    - Create `src/types/next-auth.d.ts` augmenting `Session` and `JWT`
    - Write `callbacks.test.ts`: first sign-in stores the token, later calls keep it, the session output contains no token
    - _Requirements: 1.2, 1.3, 1.5_

  - [ ]* 8.2 Write property test for session callbacks
    - Create `src/lib/auth/callbacks.property.test.ts`
    - **Property 15: Session callbacks never expose the access token**
    - **Validates: Requirements 1.2, 1.3, 1.5**

  - [x] 8.3 Implement session cookie clearing and auth error messages
    - Create `src/lib/auth/session-cookies.ts` with `sessionCookieNames(names)` (including chunked `.N` cookies) and `appendClearCookies(headers, names)` (`Max-Age=0`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure` for `__Secure-` names)
    - Create `src/lib/auth/error-messages.ts` mapping `AccessDenied` to the cancelled message and every other value to the failed-retry message
    - Write unit tests for both files, including unrelated cookie names and arbitrary error values
    - _Requirements: 1.6, 1.7, 1.9, 7.2_

  - [ ]* 8.4 Write property test for session cookie clearing
    - Create `src/lib/auth/session-cookies.property.test.ts`
    - **Property 16: Session cookie clearing**
    - **Validates: Requirements 7.2, 1.9**

  - [x] 8.5 Implement Auth.js options and token reader
    - Create `src/lib/auth/options.ts` with a factory building `NextAuthOptions` (GitHub provider, `authorization.params.scope` of `public_repo`, JWT session strategy, `pages` signIn and error set to `/`, callbacks from 8.1)
    - Create `src/lib/auth/token.ts` with `readUserToken(req)` using `getToken`, validating `login` and `accessToken` with Zod, returning `null` if invalid
    - Write unit tests: scope is exactly `public_repo`, error page is `/`, invalid decoded token returns `null`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 8.6 Add the Auth.js route handler
    - Create `src/app/api/auth/[...nextauth]/route.ts` exporting `GET` and `POST`
    - When `readAuthEnv(process.env)` is `null`, return the `auth_not_configured` Safe_Error (503) without naming any variable; otherwise delegate to NextAuth with the options from 8.5
    - Read the installed Next.js route handler docs first (async `params`)
    - Write a unit test for the unconfigured branch
    - _Requirements: 1.8, 1.9_

- [x] 9. Implement the scan handler and route
  - [x] 9.1 Implement `handleScan`
    - Create `src/lib/scan/handler.ts` with `ScanDeps` (`now`, `env`, `cache`, `makeRequester`, `readUserToken`, `log`) and `handleScan(deps, req)`
    - Order: request id, body validation (400), demo branch (never reads the session or user cache; `demo_unavailable` without calling GitHub when unconfigured; fresh demo cache hit without calling GitHub; cache stored only on success), signed-in branch (`auth_not_configured`, `unauthorized`, scan, store under `user:<login>`)
    - Shape results: `mode` of `demo` or `user`, `empty_account` code for zero repos with no invalid entries
    - Map failures to the fixed codes: stale cached result with `stale`, `cachedAt`, `rate_limited` and `resetAt` on a user-mode rate limit; 429 otherwise; `token_revoked` clears session cookies; `forbidden` keeps the session; `not_found` becomes `account_not_found`; `unavailable` becomes `github_unavailable`; `invalid_response` becomes `invalid_github_response`; anything else becomes `internal_error`
    - Log only `{ code, requestId }`; validate the success body with `ScanSuccessSchema` before returning
    - Write `handler.test.ts` with injected deps and a mocked requester covering every status path and branch listed in the design's testing strategy, including demo with a session not calling `readUserToken`, a failed demo scan leaving the cache untouched, upstream failure never giving `empty_account`, and cached entries containing no token
    - _Requirements: 1.8, 2.1, 2.10, 2.11, 2.12, 2.13, 2.14, 3.4, 3.5, 4.4, 4.6, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 10.3, 10.4, 10.5, 10.6, 11.9_

  - [ ]* 9.2 Write property test that Safe_Errors never leak secrets
    - Create `src/lib/scan/handler.leak.property.test.ts`
    - **Property 14: Safe errors never leak secrets**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 7.1, 11.9**

  - [x] 9.3 Add the scan route
    - Create `src/app/api/scan/route.ts` exporting `POST` that builds `ScanDeps` from `process.env`, `createOctokitRequester`, `readUserToken` and the cache singleton, then calls `handleScan`
    - Read the installed Next.js route handler docs first
    - Write a small unit test confirming the route module exports `POST` and no other method
    - _Requirements: 2.1, 5.1, 5.6, 9.1_

- [x] 10. Harden and verify end to end
  - [x] 10.1 Add static and build checks
    - Update `eslint.config.mjs` with `no-restricted-imports` for `octokit` outside `src/lib/github/`, and a ban on `as` assertions and non-null assertions under `src/lib/github/`
    - Add a script `scripts/check-client-bundle.mjs` that greps `.next/static` for `octokit` and exits non-zero on any hit, plus an npm script to run it after `npm run build`
    - Fix any lint or type errors in the new code
    - _Requirements: 5.1, 10.2_

  - [x] 10.2 Write the Playwright end-to-end test
    - Create `e2e/scan-demo.spec.ts` and a `playwright.config.ts` if missing, starting the app with `GITHUB_DEMO_USERNAME` set to a fixture name and GitHub mocked at the network layer
    - Assert `POST /api/scan` with `{ "demo": true }` returns a body that parses with `ScanSuccessSchema`, `mode` is `demo`, and no request reached the real GitHub API
    - Add a case posting `{ "includeForks": "yes" }` that expects HTTP 400 with a Safe_Error
    - _Requirements: 3.5, 9.11, 11.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. All property tests are optional; unit tests are not, because `tech.md` requires tests for every new function in `src/lib`.
- Each property test is a single fast-check test with at least 100 runs and a `Feature: auth-ingestion, Property N: <title>` comment.
- The OAuth redirect scope (requirement 1.1) and sign-out timing (requirement 1.9) are covered by the unit tests in 8.5 and 8.6. Real browser OAuth is not automated.
- Requirement 5.1 is enforced by the ESLint rule and the bundle check in 10.1.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.4", "4.1", "4.3", "4.5", "8.1", "8.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "2.6", "2.7", "2.8", "2.9", "4.2", "4.4", "4.6", "5.1", "7.1", "8.2", "8.4", "8.5"] },
    { "id": 3, "tasks": ["2.10", "2.11", "5.2", "7.2", "8.6"] },
    { "id": 4, "tasks": ["5.3"] },
    { "id": 5, "tasks": ["7.3"] },
    { "id": 6, "tasks": ["7.4", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["10.1", "10.2"] }
  ]
}
```
