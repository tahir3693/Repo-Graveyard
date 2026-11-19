# Implementation Plan: Resurrection

## Overview

Build the Resurrect flow in TypeScript, from the pure core outward: text helpers and plan parsing, context capping and gathering, prompt and LLM adapter, fallback and retry, rate limiting and validation, issue creation, then the two route handlers, the client logic, the UI, build guards and Playwright tests. Paths follow the design's module layout (`src/lib/resurrection/`, `src/lib/llm.ts`, `src/lib/llm-gemini.ts`, `src/lib/graveyard/`, `src/lib/e2e/`, `src/components/graveyard/`, `e2e/`).

Rules for every task:

- Named exports only. Default exports only where Next.js requires them (`route.ts` exports `POST` and `maxDuration`).
- Before writing any Next.js code (route handlers, `next.config.ts`, client components), read the relevant guide in `node_modules/next/dist/docs/`, as `AGENTS.md` requires.
- Scoring stays untouched. AI is never used for scoring. Secrets never reach the client, logs or responses.
- Every function added in `src/lib` gets Vitest unit tests next to it. Each design property is one fast-check test (at least 100 runs), in its own `*.property.test.ts` file, tagged `Feature: resurrection, Property N: <title>`. Tests pass a fixed `now`/`nowMs` and never read the clock or the network.
- UI code follows `.kiro/steering/design-system.md` strictly: tokens only (no hex, rgb or hsl), 44 px targets, 2 px `--color-focus` ring, motion limited to `opacity` and `transform`, `prefers-reduced-motion` honored, status never by color alone, mobile first.
- Test sub-tasks are not marked optional here because `tech.md` requires unit tests for every `src/lib` function and the user asked for property tests for every design property.
- If a module from auth-ingestion, death-scoring or graveyard-ui that this spec imports does not exist yet, stop and report it instead of inventing its types.

The four assumptions flagged in the design are verified in tasks 1.2, 1.3, 1.4 and 13.2.

## Tasks

- [ ] 1. Foundation and flagged-assumption checks
  - [ ] 1.1 Verify tooling, prerequisites and add the network blocker
    - Check `package.json` for `vitest`, `fast-check`, `zod`, `@google/genai`, `next-auth`, `@playwright/test` and a React test library. Install any that are missing
    - Ensure Vitest resolves the `@/` alias and `npm run test` runs `vitest run`
    - Confirm these imports exist: `RepoHealth`, `GitHubRequester`, `readUserToken`, `classifyGitHubFailure`, `ScanFailureError`, `mapWithConcurrency`, `toRepoHealth`, `deriveCiStatus`, `deriveOutdatedDeps`, `readDemoConfig`, `sessionCookieNames`, `appendClearCookies`, `createOctokitRequester`, `compareCodePoint`, `scoreRepo`, `Tombstone`, `GraveEntry`, `DetailDrawer`, `formatUtcTime`. Report any that are missing
    - Create `src/test/block-network.ts` that replaces `globalThis.fetch` with a function throwing `Blocked network request to <host>`, and register it in Vitest `setupFiles`
    - Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and the `maxDuration` guide before any route work
    - Add `src/test/block-network.test.ts` showing a `fetch("https://api.github.com/x")` call rejects with the host in the message
    - _Requirements: 16.2, 16.11_

  - [ ] 1.2 Verify the `BANNED_WORDS` export from `@/lib/epitaphs`
    - Check that `src/lib/epitaphs.ts` exports `BANNED_WORDS` (`you`, `your`, `yours`, `yourself`, `failed`, `failure`, `lazy`, `quit`, `loser`) and a whole-word, case-insensitive `containsBannedWord`
    - If the list lives only in a test file, move it into `src/lib/epitaphs.ts` as a named export with no behavior change, and update the existing test to import it
    - Add or extend `src/lib/epitaphs.test.ts` with a case that `containsBannedWord("Quit now")` is true and `containsBannedWord("quitting")` is false
    - _Requirements: 7.8, 15.1_

  - [ ] 1.3 Verify the manifest-date function export in `src/lib/github/details.ts`
    - Check that the function that returns the committer date of the latest commit touching root `package.json` (auth-ingestion's manifest lookup) is exported by name from `src/lib/github/details.ts`
    - If it is private, export it with no behavior change. Record its exact name and signature in a code comment above its use in `gather.ts` later
    - Add or extend `src/lib/github/details.test.ts` with a case that calls the exported function with a fake requester (date returned, empty list returns `null`)
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ] 1.4 Add `LLM_MODEL` to `.env.example` (names only)
    - Append `LLM_MODEL=` with no value. Confirm `LLM_API_KEY=` is already listed. Do not add any `E2E_*` name or any value
    - Run `Select-String` on `.env.example` to confirm no line has a value after `=` for secret names
    - _Requirements: 5.6, 15.6_

  - [ ] 1.5 Create `src/lib/resurrection/limits.ts`
    - Export `RESURRECTION_LIMITS` with every constant from the requirements Constants table under the same names, plus `RESURRECT_LIMIT`, `DEMO_RESURRECT_LIMIT`, `ISSUE_LIMIT` (`WindowConfig`), `DEFAULT_LLM_MODEL = "gemini-2.5-flash-lite"` and `FALLBACK_NAME_MAX = 60`
    - No imports, so client code may use it
    - Add `limits.test.ts` asserting each value and that `CONTEXT_DEADLINE_MS + LLM_MAX_ATTEMPTS * LLM_TIMEOUT_MS` is 60,000
    - _Requirements: 3.6, 5.2, 7.10, 8.6, 8.7, 8.8_

- [ ] 2. Text helpers and revival plan parsing
  - [ ] 2.1 Implement `src/lib/resurrection/text.ts`
    - Export `sanitizeText`, `capText`, `codePointLength`, `firstLine`
    - `sanitizeText` order: normalize `\r\n` and `\r` to `\n`, replace lone surrogates with U+FFFD (string loop, not a regex flag), remove `\p{Cc}` except `\n` and `\t`, remove U+202A to U+202E and U+2066 to U+2069
    - `capText` returns `""` for non-strings, cuts by code points with the string iterator, treats invalid `maxChars` as 0, never throws
    - Write `text.test.ts`: 6,000 and 6,001 code point boundary, a cut between two surrogates, lone surrogate, bidi removal, `null`/number/object input, `firstLine`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 2.2 Write property test for `capText`
    - File `text.property.test.ts`
    - **Property 1: capText bounds, cleanliness and idempotence**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ] 2.3 Implement `src/lib/resurrection/plan.ts` (client-safe)
    - Export `EFFORTS`, `EFFORT_LABELS`, `boundedText(min, max)` (code point count, rejects whitespace-only), `RevivalPlanSchema`, `RevivalPlan`, `Effort`, `sanitizePlanText`, `parsePlan`
    - `sanitizePlanText` steps in order: lone surrogates, control characters except `\n`, bidi overrides; HTML tag removal with `/<[^>]*>/g`; image replacement then `/!+\[/g` to `[`; `@login` wrapping outside backtick spans (split on backtick, odd count means the last part is outside)
    - `parsePlan` steps: non-string or over `LLM_RAW_MAX_CHARS` fails, trim, strip exactly one wrapping fence, `JSON.parse` of the whole text, require a plain object, sanitize the four text fields, `safeParse`. No brace search. Never throws
    - Import only `limits.ts` and `text.ts`. No server imports
    - Write `plan.test.ts` for each case in Requirement 16.3 plus `sanitizePlanText` examples (HTML, image, `@user`, `@user` inside backticks, unclosed backtick)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.13, 16.3_

  - [ ] 2.4 Write property test for `parsePlan` safety
    - File `plan.parse.property.test.ts`
    - **Property 5: parsePlan never throws and accepts only valid plans**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.13**

  - [ ] 2.5 Write property test for plan round trip
    - File `plan.roundtrip.property.test.ts`. Generate valid plans that the sanitizer leaves unchanged, and wrap in a fence with a language word, without one, and with surrounding whitespace
    - **Property 6: Plan round trip, with and without a code fence**
    - **Validates: Requirements 6.6, 6.8, 6.12**

  - [ ] 2.6 Write property test for extra fields
    - File `plan.extra-fields.property.test.ts`
    - **Property 7: Extra fields are discarded**
    - **Validates: Requirements 6.3**

  - [ ] 2.7 Write property test for `sanitizePlanText`
    - File `plan.sanitize.property.test.ts`
    - **Property 8: sanitizePlanText is total, idempotent and removes risky markup**
    - **Validates: Requirements 6.9, 6.10**

- [ ] 3. Context gathering and capping
  - [ ] 3.1 Implement `read-only.ts` and `github-schemas.ts`
    - `read-only.ts`: export `ReadRoute`, `ReadRequester`, `isReadRoute(route)` (true only when the string starts with `"GET "`) and `readOnly(requester)` that throws `read-only requester` before calling the inner requester for any other route
    - `github-schemas.ts`: Zod schemas for README (raw text, max 2,000,000 chars), tree (`path`, `type`), commits (`commit.message`, `commit.committer.date` nullable), check runs, open issues (with optional `pull_request`), issue creation (`number`, `html_url`), and `RepoWithIssuesSchema = GitHubRepoSchema.extend({ has_issues: z.boolean() })`
    - Write `read-only.test.ts` (GET passes, POST/PATCH/DELETE throw, inner not called) and `github-schemas.test.ts` (valid and invalid payload per schema)
    - _Requirements: 1.8, 1.9, 2.4, 10.7_

  - [ ] 3.2 Write property test for the read-only guard
    - File `read-only.property.test.ts`
    - **Property 17: Read-only guard**
    - **Validates: Requirements 1.8, 1.9**

  - [ ] 3.3 Implement `src/lib/resurrection/context.ts`
    - Export `CONTEXT_FIELDS`, `ContextBundleSchema` (strict), `ContextBundle`, `RawContext`, `buildFileTree`, `buildCommitMessages`, `buildIssueTitles`, `deriveRepoHealth`, `capBundle`
    - Follow the design: top-level entries only with `/` suffix for directories and `compareCodePoint` sort, first line of commits, failing checks are `failure`, `timed_out`, `startup_failure`, each `null` raw field adds its bundle field to `unavailable`, `deriveRepoHealth` uses `toRepoHealth`, `deriveCiStatus`, `deriveOutdatedDeps`
    - End `capBundle` with the bounded loop that halves `readme` until `JSON.stringify(bundle).length <= CAP_SERIALIZED` and sets `readmeTruncated`
    - Bundle must contain no token, key, cookie or URL query string
    - Write `context.test.ts`: README at 6,000 and 6,001 code points, every cap at and one above, unavailable mapping, empty repo, a bundle with `ci.state: "none"`, `description: null`
    - _Requirements: 2.3, 2.6, 2.11, 2.12, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 16.4_

  - [ ] 3.4 Write property test for bundle caps
    - File `context.caps.property.test.ts`. Use a raw-context generator with arrays up to 200 and text biased toward quotes, backslashes and newlines
    - **Property 2: Capped bundle respects every cap**
    - **Validates: Requirements 2.11, 2.12, 3.6, 3.9, 3.11**

  - [ ] 3.5 Write property test for list builders
    - File `context.lists.property.test.ts`
    - **Property 3: List builders keep order, shape and top level only**
    - **Validates: Requirements 3.7, 3.8, 3.10**

  - [ ] 3.6 Implement `src/lib/resurrection/gather.ts`
    - Export `gatherContext(deps: { request: ReadRequester; now: Date }, owner, repo)`
    - Read metadata first and map failures with the `ScanFailureError` kinds (fatal). Then run six GET reads (README raw, tree, 10 commits, check runs, open issues, manifest date using the function verified in task 1.3) through `mapWithConcurrency(tasks, 5, run)`
    - Each task catches non-fatal failures (including Zod failures) and returns `null`; `rate_limited` and `token_revoked` rethrow. 404 README gives `""`; 404/409 tree gives `[]`; 409 commits gives `[]`; 404 checks gives `[]`; drop issues with `pull_request`
    - One `CONTEXT_DEADLINE_MS` timer raced against each task, cleared in `finally`. Octokit is injected, never imported here
    - Write `gather.test.ts` with a fake requester: all six reads succeed, one read fails validation, one read times out (fake timers), 401 fatal, rate limit fatal, never more than 5 in flight, every route starts with `GET `, zero real network
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.13_

- [ ] 4. Prompt builder and LLM adapter
  - [ ] 4.1 Implement `src/lib/resurrection/prompt.ts`
    - Export `SYSTEM_PROMPT` (constant, no interpolation, covers every item of Requirement 4.3 and the length guidance from the design), `USER_PREFIX`, `buildPrompt`, `extractDataBlock`
    - `buildPrompt` returns `{ system: SYSTEM_PROMPT, user: USER_PREFIX + JSON.stringify(bundle) }` and nothing else builds strings
    - Write `prompt.test.ts`: system text contains each required statement, the system string is identical for two bundles, a README with `"` `\` newlines and "ignore previous instructions" stays inside the parsed block, `extractDataBlock` round trip example
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 4.2 Write property test for prompt separation
    - File `prompt.property.test.ts`. Generate bundles with instruction-like phrases, quotes, backticks, braces, XML-like tags and delimiter imitations
    - **Property 4: Prompt separates instructions from data and round-trips**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.6, 4.7**

  - [ ] 4.3 Implement `src/lib/llm.ts`
    - Export `LlmRequest` (exactly `system`, `user`, `maxOutputTokens`, `temperature`), `LlmClient`, `LlmFailureKind`, `LlmResult`, `callLlm(client, request, timeoutMs)`
    - Use an `AbortController`, a timer that sets `timedOut` and aborts, and a race with the abort so a client that ignores the signal cannot stall. Map reject to `unavailable` without keeping the error, non-string or blank text to `invalid_output`. Clear the timer in `finally`
    - No provider import, no `octokit` import, no tools field of any kind
    - Write `llm.test.ts`: success, timeout (fake timers, client never resolves and ignores signal), rejection with a secret in the error message (not present in the result), empty text, non-string text, request object has exactly the five fields
    - _Requirements: 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [ ] 4.4 Implement `src/lib/llm-gemini.ts`
    - Read the installed typings in `node_modules/@google/genai/dist/genai.d.ts` first and confirm `generateContent`, `systemInstruction`, `abortSignal`, `responseMimeType`, `httpOptions.retryOptions.attempts`
    - Export `buildGeminiConfig` (exactly `systemInstruction`, `maxOutputTokens`, `temperature`, `abortSignal`, `responseMimeType: "application/json"`; no tools, `toolConfig`, `thinkingConfig`) and `createGeminiClient({ apiKey, model })`
    - Import the SDK lazily inside `generate`, create `GoogleGenAI` once with `httpOptions: { retryOptions: { attempts: 1 } }`, return `{ text: res.text ?? "" }`. This is the only file that names the provider. The key goes only to the constructor
    - Write `llm-gemini.test.ts` with `vi.mock("@google/genai")`: config has exactly five keys, `attempts` is 1, lazy import happens on first `generate` only, no real request
    - _Requirements: 5.6, 5.9, 4.8_

- [ ] 5. Fallback plan, retry and service
  - [ ] 5.1 Implement `src/lib/resurrection/fallback.ts`
    - Export `FallbackFacts`, `FALLBACK_TEMPLATES` (one per `CauseCode`, using the next-step and `effort` table in the design), `fallbackLabel`, `buildFallbackPlan`
    - `fallbackLabel`: `capText` to 60, keep `[A-Za-z0-9._ -]`, trim, collapse spaces, use `"this repo"` when empty or `containsBannedWord` (imported from `@/lib/epitaphs`, verified in task 1.2)
    - Write each template in the product tone: the repo is paused and can be revived, no banned word, no fact beyond `name`, `causeCode`, `status`, title within 100 code points, issue body a short paragraph plus a task list with no `<`, `@`, `![` or backtick
    - Write `fallback.test.ts`: loop over all six causes and four statuses (banned words, limits, forbidden characters, schema valid, six distinct plans), empty name, 100-code-point name, `@`/backtick/HTML names, a name equal to `quit`
    - _Requirements: 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ] 5.2 Write property test for the fallback plan
    - File `fallback.property.test.ts`
    - **Property 9: Fallback plan is valid, stable, deterministic and in tone**
    - **Validates: Requirements 7.5, 7.6, 7.7, 7.8**

  - [ ] 5.3 Implement `src/lib/resurrection/attempts.ts`
    - Export `runAttempts(call, maxAttempts)` and `toFallbackReason(kind)`
    - Loop at most `maxAttempts`, catch a rejected `call` as `unavailable`, run `parsePlan` on `ok` text and count failure as `invalid_output`, return at once on a valid plan, return the last kind after the final attempt. The same `call` closure is used for both attempts
    - Write `attempts.test.ts` for the six sequences of Requirement 16.5, and assert the two requests are identical and the first invalid output is absent from the second
    - _Requirements: 4.9, 7.1, 7.2, 7.3, 7.4, 16.5, 16.6_

  - [ ] 5.4 Write property test for retry orchestration
    - File `attempts.property.test.ts`. Sequences of two results from {valid, invalid, timeout, reject}
    - **Property 10: Retry orchestration**
    - **Validates: Requirements 4.9, 7.1, 7.2, 7.3, 7.4**

  - [ ] 5.5 Implement `src/lib/resurrection/service.ts`
    - Export `ResurrectOutcome` and `resurrect(deps, input)`: `gatherContext`, `deriveRepoHealth`, `scoreRepo(health, now)`, `capBundle`, `buildPrompt`; `makeLlmClient()` returning `null` gives `buildFallbackPlan` with `llm_not_configured` and zero LLM calls; otherwise `runAttempts(() => callLlm(...), 2)`
    - Build the `LlmRequest` once before the loop. Take no action on plan content. Log nothing
    - Write `service.test.ts` with a fake requester and fake `LlmClient`: AI plan, retry then AI, fallback after two failures with each reason, missing key (0 calls, response has no env var name), `ScanFailureError` propagates and the LLM is not called, injected README text is processed like any other README, zero non-GET requests
    - _Requirements: 2.3, 4.10, 4.11, 4.12, 5.7, 7.1, 7.2, 7.3, 7.4, 7.10, 15.7, 16.5, 16.9_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Rate limiting, request validation and safe errors
  - [ ] 7.1 Implement `rate-limit.ts`, `inflight.ts` and `state.ts`
    - `evaluateWindow`: normalize non-finite or future timestamps to `nowMs`, keep entries with `nowMs - t < windowMs`, sort, allow when `kept.length < limit` and append `nowMs`, otherwise deny with `max(1, ceil((oldest + windowMs - nowMs) / 1000))` and no append. Pure, no clock
    - `createRateLimitStore` over a `Map` as LRU with `maxKeys`; `createInFlightSet`; `getResurrectionState()` on `globalThis` under `Symbol.for("repo-graveyard.resurrection")` holding the resurrect, demo and issue stores and the in-flight set
    - Write `rate-limit.test.ts` at limit 10, window 600,000: 10th allowed, 11th denied with `retryAfterSeconds >= 1`, exactly 600,000 ms later allowed, denied not recorded, future timestamp, `NaN`, store eviction at `MAX_TRACKED_KEYS`, and `inflight.test.ts`, `state.test.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.12, 8.13, 8.14, 16.7_

  - [ ] 7.2 Write property test for the sliding window
    - File `rate-limit.window.property.test.ts`
    - **Property 11: Sliding window never exceeds the limit**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ] 7.3 Write property test for retry-after honesty
    - File `rate-limit.retry-after.property.test.ts`
    - **Property 12: Retry-after is honest and clock skew is tolerated**
    - **Validates: Requirements 8.3, 8.5**

  - [ ] 7.4 Write property test for the bounded store
    - File `rate-limit.store.property.test.ts`
    - **Property 13: Rate limit store is bounded and keys are isolated**
    - **Validates: Requirements 8.8, 8.9**

  - [ ] 7.5 Implement `src/lib/resurrection/request.ts`
    - Export `ResurrectRequestSchema`, `IssueRequestSchema`, `isAllowedOrigin`, `isJsonContentType`, `readBodyLimited`. Import `boundedText` from `plan.ts`
    - Repo name regex `^[A-Za-z0-9._-]{1,100}$` and also reject `.` and `..`. `demo` must be a real boolean. Unknown keys are stripped
    - `readBodyLimited` counts bytes per chunk, cancels the reader past the limit, uses a fatal `TextDecoder`, does not trust `Content-Length`
    - Write `request.test.ts`: `owner`/`username`/`labels` stripped, `demo: "true"` rejected, `.` and `..` rejected, origin absent allowed, `"null"` rejected, content type with `; charset`, body at and above 20,000 bytes, invalid UTF-8
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 10.3_

  - [ ] 7.6 Write property test for request schemas
    - File `request.schema.property.test.ts`
    - **Property 14: Request schemas ignore unknown fields and reject bad names**
    - **Validates: Requirements 1.1, 1.2, 10.1**

  - [ ] 7.7 Write property test for the origin check
    - File `request.origin.property.test.ts`
    - **Property 15: Origin check**
    - **Validates: Requirements 1.4, 10.3**

  - [ ] 7.8 Write property test for body size limiting
    - File `request.body.property.test.ts`. Generate text and arbitrary chunk splits of its UTF-8 bytes
    - **Property 16: Body size limit does not depend on chunking**
    - **Validates: Requirements 1.3, 10.2**

  - [ ] 7.9 Implement `errors.ts` and `response.ts`
    - `errors.ts`: `RESURRECTION_ERROR_TABLE` (messages reused from auth-ingestion are imported from its table, not copied), `ISSUE_CREATE_UNAVAILABLE_MESSAGE`, `ResurrectionErrorSchema`, `toSafeError` (accepts a custom message only from that constant; sets `Retry-After` for the two rate-limit codes), `RouteFailure`, `mapGitHubFailure` using `classifyGitHubFailure` and the mapping table in the design (user, demo and issue-create columns)
    - `response.ts` (client-safe): `FallbackReasonSchema`, `ResurrectSuccessSchema` (refine: `fallbackReason` present exactly when `source` is `fallback`), `IssueSuccessSchema`
    - Write `errors.test.ts` (every table row, every message at most 140 characters, token-revoked clears session, demo 401 gives `demo_unavailable`) and `response.test.ts`
    - _Requirements: 1.11, 2.7, 2.8, 2.9, 2.10, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 11.1, 11.2, 11.3, 11.6, 11.7, 11.8_

  - [ ] 7.10 Write property test for safe errors
    - File `errors.property.test.ts`. Generate thrown values with marker strings in `message`, `stack`, `response` and headers
    - **Property 18: Safe errors never carry upstream text**
    - **Validates: Requirements 2.7, 2.8, 2.9, 2.10, 9.7, 9.8, 11.8, 15.6**

- [ ] 8. Issue creation
  - [ ] 8.1 Implement `src/lib/resurrection/issue.ts`
    - Export `ISSUE_FOOTER` (one line, under 120 characters), `prepareIssue`, `isExpectedIssueUrl` (case-insensitive string equality with `https://github.com/{login}/{repo}/issues/{number}`, no URL parsing), `createIssue`
    - `prepareIssue` sanitizes with `sanitizePlanText`, validates against the plan limits, then appends `"\n\n" + ISSUE_FOOTER`
    - `createIssue` sends exactly one `POST /repos/{owner}/{repo}/issues` with params `owner`, `repo`, `title`, `body`, no loop. Map 410 to `issues_disabled`, 422 to `issue_rejected`, 404 to `repo_not_found`, bad response or bad URL to `issue_result_unknown`, others through `mapGitHubFailure` with phase `issue-create`
    - Write `issue.test.ts`: exact params, footer, one POST in the success case, zero in rejected input, 410, 422, timeout message, URL with query or port rejected
    - _Requirements: 10.12, 10.13, 10.14, 10.15, 11.4, 11.5, 11.6, 11.9, 16.10_

  - [ ] 8.2 Write property test for the issue payload
    - File `issue.payload.property.test.ts` with a recording fake requester
    - **Property 19: Issue payload is exact**
    - **Validates: Requirements 10.12, 10.13**

  - [ ] 8.3 Write property test for the issue URL check
    - File `issue.url.property.test.ts`
    - **Property 20: Issue URL check accepts exactly the expected URL**
    - **Validates: Requirements 10.14, 10.15**

- [ ] 9. Test fakes, configuration, handlers and routes
  - [ ] 9.1 Implement the server-side fakes in `src/lib/e2e/`
    - `config.ts`: `readFakeConfig(env)` returns non-null only when `E2E_FAKES === "1"` and `VERCEL_ENV !== "production"`, reading `E2E_RECORD_DIR`, `E2E_LLM_TIMEOUT_MS`, `E2E_DEMO_RESURRECT_LIMIT`
    - `fixtures.ts` with the repo fixtures and LLM scripts named in the design (`plain-ok`, `retry-then-ok`, `llm-invalid-twice`, `llm-yaml-twice`, `llm-timeout`, `llm-reject`, `injection-readme`, `owned-by-other`, `archived-repo`, `no-issues`, `issue-422`, `issue-500`, `issue-timeout`, `issue-410`)
    - `fake-github.ts`: `createFakeRequester(token, cfg)` matching `GitHubRequester`, throwing `RequestError`-shaped objects, behavior by token (`ghu_FAKE_REVOKED`, `ghu_FAKE_RATELIMITED`), recording `{ t: "github", method, route, bodyKeys }` and never the token
    - `fake-llm.ts`: `createFakeLlmClient(cfg)` new per request, step chosen from `JSON.parse(extractDataBlock(user)).name`, steps `valid`, `fenced`, `invalid`, `yaml`, `reject`, `hang`, recording `{ t: "llm", attempt, system, user }`. `recorder.ts` appends JSON lines
    - Write unit tests for each: `readFakeConfig` null in production and when unset, requester records no token, LLM step selection and last step repeats
    - _Requirements: 18.1, 18.2_

  - [ ] 9.2 Implement `src/lib/resurrection/config.ts`
    - Export `ResurrectionConfig` and `readResurrectionConfig(env)`: `llmApiKey` (null when missing or blank), `llmModel` (`LLM_MODEL` validated against `^[A-Za-z0-9._-]{1,64}$`, else `DEFAULT_LLM_MODEL`), `llmTimeoutMs`, `demoLimit`, `appOrigins` from `NEXTAUTH_URL`. Fake-config overrides apply only when `readFakeConfig` is non-null
    - Write `config.test.ts`: missing and blank key, bad model id falls back, override ignored without `E2E_FAKES`, key never appears in `JSON.stringify` of anything except the config object itself
    - _Requirements: 5.6, 5.7, 18.2_

  - [ ] 9.3 Implement `src/lib/resurrection/handle-resurrect.ts`
    - Export `ResurrectDeps` and `handleResurrect(deps, req)` in the design's order: request id and single `now`, origin, content type, size, JSON, schema, actor (demo uses `readDemoConfig` and never reads the session; user uses `readUserToken`), in-flight acquire (409), rate limiter (429 with `Retry-After`), `readOnly(makeRequester(token))`, `resurrect`, validate with `ResurrectSuccessSchema`, return 200. Release in `finally`
    - Errors only through `toSafeError`; `ScanFailureError` through `mapGitHubFailure`; `clearSession` appends clearing cookies; `log` receives `{ code, requestId }` only. In-flight key: login (user) or `demo:<repo lowercased>` (demo)
    - Write `handle-resurrect.test.ts` with a fake requester, fake session and fake LLM covering Requirement 16.8 for this route: unauthenticated, bad origin, invalid body, rate limited, busy, token revoked on read, GitHub rate limit, GitHub 403, repo not found, GitHub unavailable, demo not configured, demo 401. Each asserts status, code, and that the body holds no token or fake secret. Assert zero non-GET requests in every test and zero GitHub/LLM calls when rejected early
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 8.10, 8.12, 8.13, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 15.6, 16.8, 16.9_

  - [ ] 9.4 Implement `src/lib/resurrection/handle-issue.ts`
    - Export `IssueDeps` and `handleIssue(deps, req)`: origin, content type, size, schema, `prepareIssue` (400 before limiter and GitHub), `demo` true gives 403 `demo_mode` without reading the session, `readUserToken` (401), issue limiter (429), `GET /repos/{login}/{repo}` with `RepoWithIssuesSchema`, owner check (case-insensitive), archived, `has_issues`, `createIssue`, 201 validated with `IssueSuccessSchema`
    - Never import `service.ts`, `llm.ts` or `context.ts`. The owner path segment is always the session login. Log only `{ code, requestId }`
    - Write `handle-issue.test.ts` covering the issue cases of Requirement 16.8: unauthenticated, bad origin, invalid body, demo mode, rate limited, token revoked, GitHub rate limit, 403, repo not found, not owner, archived, issues disabled, 410, 422, timeout, invalid response. Assert exactly one POST with only `title` and `body` on success and zero issue POSTs in every rejected case
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 16.8, 16.10_

  - [ ] 9.5 Implement `src/lib/resurrection/deps.ts`
    - Export `createResurrectionDeps(env)`: real mode uses `createOctokitRequester`, `readUserToken`, `createGeminiClient` only when `llmApiKey` is set, `getResurrectionState()`, `crypto.randomUUID`, and a `log` that writes only `{ code, requestId }`. Fake mode (when `readFakeConfig(env)` is non-null) swaps only `makeRequester` and `makeLlmClient`
    - Write `deps.test.ts`: fakes selected only with `E2E_FAKES=1`, ignored with `VERCEL_ENV=production`, no `makeLlmClient` result when the key is missing, `log` drops any extra fields
    - _Requirements: 5.6, 5.7, 15.9, 18.2_

  - [ ] 9.6 Create the route files
    - Read the Next.js route handler docs first. Create `src/app/api/resurrect/route.ts` (`export const maxDuration = 70`, `POST` calling `handleResurrect(createResurrectionDeps(process.env), req)`) and `src/app/api/issue/route.ts` (`maxDuration = 30`, `POST` calling `handleIssue`)
    - Export only `POST` and `maxDuration`. No `runtime`, `dynamic` or `revalidate` (Cache Components is enabled)
    - Write `route.test.ts` for each route asserting the module exports exactly `POST` and `maxDuration` and no `GET`
    - _Requirements: 1.1, 10.1, 15.10_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Client logic
  - [ ] 11.1 Implement `src/lib/resurrection/copy.ts` (client-safe)
    - Export `RESURRECT_COPY` with every sentence of Requirements 9.1, 9.9, 12 and 13 and 14 as constants, plus `formatCooldown(n)` and `formatGithubReset(resetAt)` (reuses `formatUtcTime`)
    - Write `copy.test.ts`: exact text of each sentence, `{n}` formatting, `HH:mm UTC` suffix, and a loop that applies `containsBannedWord` to every string
    - _Requirements: 9.1, 9.9, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 14.3, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.14, 15.1_

  - [ ] 11.2 Implement `src/lib/graveyard/issue-link.ts`
    - Export `safeIssueLink(url)`: returns the URL only for protocol `https:`, hostname `github.com`, empty port, no username or password; `null` otherwise or when it does not parse
    - Write `issue-link.test.ts` with accepted and rejected examples
    - _Requirements: 14.6_

  - [ ] 11.3 Write property test for issue link safety
    - File `issue-link.property.test.ts`
    - **Property 22: Issue link safety**
    - **Validates: Requirements 14.6**

  - [ ] 11.4 Implement `src/lib/graveyard/resurrect-client.ts`
    - Export `requestResurrect`, `requestIssue`, `classifyResurrectError`, `classifyIssueError` and the view types. Relative URLs only, `AbortSignal.any([signal, AbortSignal.timeout(...)])` with `CLIENT_TIMEOUT_MS` and `ISSUE_CLIENT_TIMEOUT_MS`, every response validated with Zod before use, `aborted` when the caller's signal aborted, `generic` for anything else, no `console` calls, no rethrow
    - A view kind needs both the status and the code to match. `check_issue_list` carries the server message only when it equals one of the two constant messages. Import only client-safe modules
    - Write `resurrect-client.test.ts` with an injected `fetchImpl`: success, each error view, invalid body gives `generic`, network error, timeout, abort, request body keys (`repo`, `demo` for resurrect; `repo`, `title`, `body` for issue), URL is relative
    - _Requirements: 9.8, 9.9, 12.3, 12.5, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14, 14.4, 14.12, 14.13, 14.14_

  - [ ] 11.5 Write property test for client error views
    - File `resurrect-client.errors.property.test.ts`
    - **Property 21: Client error views never expose response content**
    - **Validates: Requirements 9.9, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14, 14.12, 14.13, 14.14**

  - [ ] 11.6 Implement `resurrect-state.ts` and `plan-cache.ts`
    - `resurrect-state.ts`: `PlanView`, `ResurrectState`, `ResurrectEvent`, `resurrectTransition` (`start: true` only for `activate` from `idle`, `plan`, `error`; `pending` and `cooldown` ignore `activate`; `aborted` returns to `plan` when a previous plan exists, else `idle`) and `issueTransition` (`idle`, `pending`, `filed`, `error`; `filed` never returns to `idle`)
    - `plan-cache.ts`: `createPlanCache()` with `get`, `set`, `markRevealed`, `isRevealed`, `setFiled`, `getFiled`; a new plan clears `filed` and `revealed` for that repo
    - Write `resurrect-state.test.ts` and `plan-cache.test.ts`
    - _Requirements: 12.4, 12.6, 12.7, 12.10, 13.7, 14.6_

  - [ ] 11.7 Write property test for single in-flight request
    - File `resurrect-state.property.test.ts`
    - **Property 23: At most one request in flight**
    - **Validates: Requirements 12.3, 12.4, 12.10**

  - [ ] 11.8 Implement `src/lib/graveyard/use-resurrect.ts`
    - `"use client"` hook `useResurrect(entry, demo, cache)`: one `AbortController` in a ref, `run()` returns early when `start` is false, ignores `aborted`, dispatches `succeeded` (and writes the cache) or `failed`, starts a cooldown timer for `cooldown` errors, aborts on unmount, reads the cache on mount so a reopened drawer shows the stored plan with no request
    - Write `use-resurrect.test.tsx` with `renderHook` and a fake `requestResurrect`: one request per activation, second activation ignored while pending, abort on unmount, cache hit makes no request, cooldown ends after `n` seconds (fake timers)
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7, 12.10_

- [ ] 12. Resurrect area UI
  - [ ] 12.1 Create icons and the sign-in button
    - Read the graveyard-ui components and Next.js client component docs first
    - `effort-icon.tsx` (1, 2 or 3 bars), `source-icon.tsx` (four-point star for AI, folded page for fallback), both inline SVG with `currentColor` and `aria-hidden="true"`. `src/components/auth/sign-in-button.tsx` reusing an existing exported button if graveyard-ui already has one; it is the only new importer of `next-auth/react`
    - Tokens only, 44 by 44 px target, 2 px `--color-focus` ring
    - Write `*.test.tsx` for each: three effort values render three different shapes, text label present beside each icon
    - _Requirements: 13.1, 13.2, 13.3, 15.2, 12.16_

  - [ ] 12.2 Implement `src/components/graveyard/fog-reveal.tsx`
    - Two `m.div` panels inside the drawer's existing `LazyMotion`: left `origin-left`, right `origin-right`, each 50% wide, `aria-hidden="true"`, `pointer-events: none`, animating `scaleX 1 to 0` and `opacity 1 to 0` over `FOG_REVEAL_MS` with ease-out, once. `onAnimationComplete` unmounts them
    - Render nothing when `useReducedMotion()` is true, when `cache.isRevealed(url)` is true, or after completion. Call `markRevealed(url)` on first appearance. Colors from `bg-surface` and `bg-glow-soft` only
    - Write `fog-reveal.test.tsx`: renders two `aria-hidden` panels, removed after completion, absent under reduced motion, absent when already revealed
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [ ] 12.3 Implement `src/components/graveyard/plan-view.tsx`
    - Props `{ view, demo, repo, fogEnabled }`. Order: `h3` "Revival plan" (`tabIndex={-1}`, display font at 20 px or larger) with the source badge, `diagnosis`, "Smallest next step", "Effort" with icon and label, issue preview ("Issue title", "Issue body" in a read-only `role="region"` with `aria-label`, `tabIndex={0}`, `whitespace-pre-wrap`, `overflow-wrap: anywhere`, vertical scroll), then "File this issue"
    - All text rendered as React text, never `dangerouslySetInnerHTML`. `ai` badge "Drafted by AI, checked by rules" shows no score, status or cause; `fallback` shows "Offline plan" and the notice
    - "File this issue": `aria-disabled="true"` in Demo_Mode with `aria-describedby` to the look-only text and zero requests; pending state with "Filing…" in `role="status"` `aria-live="polite"`; success replaces the button with "Issue filed. This repo has a pulse again." and a link only when `safeIssueLink` is non-null (`target="_blank"`, `rel="noopener noreferrer"`); error text in `role="alert"` for each Requirement 14 case; filed info stored in the plan cache
    - Wrap content so no horizontal scroll at 360 px and 200% zoom. Use `--color-ember` only for errors
    - Write `plan-view.test.tsx`: five plan parts in order, `<b>x</b>` shown as text, demo button behavior, one `requestIssue` call per activation, each error text, link hidden for a non-GitHub URL
    - _Requirements: 6.11, 13.1, 13.2, 13.3, 13.10, 13.11, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.13, 14.14, 14.15, 15.2, 15.5_

  - [ ] 12.4 Implement `resurrect-area.tsx` and wire it into the drawer
    - Replace the placeholder with `ResurrectArea({ entry, demo })`: one button "Resurrect" (or "Resurrect again" when a plan exists) with `aria-disabled="true"` while pending or in cooldown and focus kept; always-present `role="status"` `aria-live="polite"` region holding "Consulting the spirits…"; `role="alert"` error block from `copy.ts` with "Sign in with GitHub" or "Try again" as required; focus moves to the plan heading when a plan arrives and back to the Resurrect button after "Try again"; `FogReveal` over `PlanView`
    - Remove the "Revival plans are coming soon" text. Add the `demo` prop to `DetailDrawer`, render `<ResurrectArea key={entry.repo.url} .../>`, create the plan cache with `useMemo(() => createPlanCache(), [entries])` in `GraveyardApp` and expose it through a small React context. Do not change the drawer layout, focus trap or Escape handling
    - Write `resurrect-area.test.tsx`: idle shows one button, pending state, each error text and button, cooldown with static `{n}`, focus moves to heading, reopening shows the stored plan with no request, the old placeholder text is gone
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14, 12.15, 12.16, 15.3, 15.4_

  - [ ] 12.5 Write accessibility component tests
    - File `src/components/graveyard/resurrect-a11y.test.tsx`: every control has a 44 px minimum class, visible focus ring class, status/effort/source each have a text label next to the icon, no hex, rgb or hsl string in the component sources (read source with `fs` and regex), every error is inside `role="alert"`, no error code or token-like string appears in rendered output
    - _Requirements: 12.15, 12.16, 13.9, 13.10, 14.15, 15.2, 15.5_

- [ ] 13. Build guards and flagged-assumption verification
  - [ ] 13.1 Add lint and bundle-leak guards
    - In `eslint.config.mjs` add `no-restricted-imports` for `src/components` and `src/lib/graveyard`: forbid `octokit`, `@google/genai`, `next-auth/jwt`, `@/lib/llm`, `@/lib/llm-gemini`, `@/lib/e2e/*`, and every `@/lib/resurrection/*` module except `plan`, `response`, `copy`, `limits`, `errors`. Keep `react/no-danger` as error
    - Extend the existing post-build grep of `.next/static` (from graveyard-ui) with `@google/genai`, `GoogleGenAI`, `generativelanguage.googleapis.com`, `LLM_API_KEY`, `E2E_FAKES`, `ghu_FAKE`, and `src/lib/llm`
    - Run `npm run lint` and `npm run typecheck` and fix findings in this spec's files only
    - _Requirements: 5.8, 15.8, 18.17_

  - [ ] 13.2 Verify `serverExternalPackages` for `@google/genai` and the route segment config
    - Read the `serverExternalPackages` and `maxDuration` docs under `node_modules/next/dist/docs/`
    - Run `npm run build`. If the output warns about bundling `@google/genai` (or its `ws` / `google-auth-library` dependencies), add `serverExternalPackages: ["@google/genai"]` to `next.config.ts` and rebuild until clean. If there is no warning, leave `next.config.ts` unchanged and note the result in the task completion message
    - Confirm the build accepts `maxDuration` on both routes with `cacheComponents: true`. If it does not, report it and use the alternative the Next docs describe
    - Run the `.next/static` grep from task 13.1 and confirm it finds none of the forbidden terms
    - _Requirements: 5.8, 15.8_

- [ ] 14. End-to-end tests (Playwright)
  - [ ] 14.1 Configure Playwright and add helpers
    - Set `webServer` to `next build && next start` with `E2E_FAKES=1`, `E2E_RECORD_DIR`, `E2E_LLM_TIMEOUT_MS` (about 1,500), `E2E_DEMO_RESURRECT_LIMIT` (1,000), and dummy `GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL` (http), `LLM_API_KEY` (a recognizable fake string), `GITHUB_DEMO_USERNAME`, `GITHUB_DEMO_TOKEN`. Do not add any `E2E_*` name to `.env.example`
    - `e2e/helpers/fakes.ts`: `readEvents`, `resetEvents`, `countLlmCalls`, `countGithubWrites`. `e2e/helpers/session.ts`: `signInAs(context, { login, accessToken })` using `encode` from `next-auth/jwt` and cookie `next-auth.session-token` (`httpOnly`, `sameSite: "Lax"`, `path: "/"`). Each test uses its own login
    - Add `npm run e2e` support if not present
    - _Requirements: 18.1, 18.2_

  - [ ] 14.2 Write the resurrect flow spec in `e2e/resurrection.spec.ts`
    - Demo happy path: `/graveyard?demo=1`, open a tombstone, activate "Resurrect", exactly one `POST /api/resurrect`, five plan parts, focus on "Revival plan", zero non-GET GitHub requests
    - Injection README (`injection-readme`): README appears only inside the serialized data block of the `user` message, `system` equals the constant, plan valid, zero GitHub writes
    - YAML twice: Fallback_Plan, "Offline plan" badge and notice, exactly 2 LLM calls. Retry flows: invalid then valid gives AI plan with 2 calls, invalid twice gives fallback with 2 calls. Timeout and reject cases finish within 10 seconds and show the notice
    - Signed-in rate limit: 10 allowed, the 11th shows "The keeper needs a breather. Try again in {n} seconds." with `n >= 1`, button `aria-disabled="true"`, no 11th LLM call. Unauthenticated: direct `POST` returns 401 `unauthenticated` and the UI shows the Requirement 12.9 text
    - Secrets: no response body, HTML or console message contains `LLM_API_KEY`, `GITHUB_SECRET`, `AUTH_SECRET`, `GITHUB_DEMO_TOKEN` values or token strings
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.13_

  - [ ] 14.3 Write the issue flow spec in `e2e/resurrection-issue.spec.ts`
    - Signed-in success: exactly one `POST /api/issue`, exactly one recorded issue creation with only `title` and `body`, success text and the link shown
    - Demo mode: "File this issue" is `aria-disabled="true"`, reachable by Tab, shows its explanation, sends zero requests; direct `POST /api/issue` with `demo: true` returns 403 `demo_mode`
    - Error table via fixtures: `owned-by-other`, `archived-repo`, `no-issues`, revoked token (401, then the next request returns 401 `unauthenticated`), rate limit token, `issue-422`, `issue-500`, `issue-timeout`; assert the Requirement 14 text for each and that no response contains the fake token
    - _Requirements: 18.10, 18.11, 18.12, 18.13_

  - [ ] 14.4 Write the motion, layout and bundle spec in `e2e/resurrection-a11y.spec.ts`
    - Reduced motion emulated: no fog panel element, plan text visible within 150 ms
    - Normal motion: fog panels `aria-hidden="true"`, do not block a click on "File this issue", absent from the DOM within 1,500 ms
    - 360 px viewport: no horizontal scroll with a plan shown, every control at least 44 by 44 px, Escape closes the drawer while a plan is shown and focus returns to the control that opened it
    - Scan every loaded JavaScript response for `octokit`, `@google/genai`, `GoogleGenAI`, `LLM_API_KEY` and `src/lib/llm`
    - _Requirements: 18.14, 18.15, 18.16, 18.17_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Verification tasks for the design's flagged assumptions: 1.2 (`BANNED_WORDS` export), 1.3 (manifest-date function export), 1.4 (`LLM_MODEL` in `.env.example`, names only), 13.2 (`serverExternalPackages` for `@google/genai`).
- No sub-task is marked optional, because `tech.md` requires unit tests for every `src/lib` function and the design's 23 properties each get one fast-check test.
- Each property test lives in its own `*.property.test.ts` file, so tasks in the same wave never write the same file.
- Property 17 in the design is numbered by topic, not by order of implementation. Task order differs from property numbering.
- Playwright tests run against `next start` with server-side fakes, so the production client bundle is what gets tested.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.3", "7.1", "11.2", "12.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "4.4", "7.2", "7.3", "7.4", "11.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "3.3", "5.1", "5.3", "7.5", "7.9", "11.1"] },
    { "id": 5, "tasks": ["3.4", "3.5", "3.6", "4.1", "5.2", "5.4", "7.6", "7.7", "7.8", "7.10", "8.1", "11.4"] },
    { "id": 6, "tasks": ["4.2", "5.5", "8.2", "8.3", "9.1", "11.5", "11.6"] },
    { "id": 7, "tasks": ["9.2", "11.7", "11.8", "12.2"] },
    { "id": 8, "tasks": ["9.3", "9.4", "12.3"] },
    { "id": 9, "tasks": ["9.5", "12.4"] },
    { "id": 10, "tasks": ["9.6", "12.5", "13.1"] },
    { "id": 11, "tasks": ["13.2", "14.1"] },
    { "id": 12, "tasks": ["14.2", "14.3", "14.4"] }
  ]
}
```
