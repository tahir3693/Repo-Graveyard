# Requirements Document

## Introduction

This feature introduces GitHub sign-in and repository ingestion for Repo Graveyard. A signed-in user, or a visitor in Demo Mode, calls a server route that fetches repositories from GitHub, validates every response, and returns a list of RepoHealth objects. Later specs (scoring, graveyard UI, resurrection) consume that list.

This spec is where Auth.js and API routes are introduced. The earlier project-scaffold spec excluded them only for the scaffold.

Scoring, death score, status, cause of death, epitaphs and AI calls are out of scope. This spec only collects facts.

### Open question: Auth.js version

The installed package is `next-auth` ^4.24.15 (Auth.js v4 API). The requirements do not depend on a version. The design phase must confirm whether to stay on v4 or move to v5 (`AUTH_SECRET` and `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` naming differs), and must read `node_modules/next/dist/docs/` before writing Next.js code. The env variable names fixed for this spec are `GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET` and `GITHUB_DEMO_TOKEN`.

## Glossary

- **Auth_System**: The Auth.js configuration with the GitHub provider that signs users in and holds the session.
- **Scan_Route**: The server route `POST /api/scan`.
- **Ingestion_Service**: The server-side module that calls GitHub through Octokit and builds RepoHealth objects.
- **GitHub_Validator**: The Zod schemas that validate GitHub responses and Scan_Route input.
- **Scan_Cache**: The in-memory cache of scan results, keyed by GitHub login. It is not a database.
- **RepoHealth**: The validated object describing one repository with these fields: `name` (string), `url` (string), `description` (string or null), `lastCommitAt` (ISO 8601 string or null), `openIssues` (non-negative integer), `archived` (boolean), `ciStatus` (`passing`, `failing` or `none`), `hasReadme` (boolean), `outdatedDeps` (boolean or null, where null means unknown), `stars` (non-negative integer), `language` (string or null).
- **Signed_In_Mode**: A scan of the repositories owned by the authenticated user, using that user's access token.
- **Demo_Mode**: A scan of the public repositories of the fixed demo username, with no login.
- **Demo_Username**: The fixed public GitHub username used by Demo_Mode, read from server configuration.
- **Demo_Token**: The optional server token in `GITHUB_DEMO_TOKEN`, used only in Demo_Mode.
- **User_Token**: The GitHub OAuth access token of the signed-in user, held only in the Auth.js session on the server.
- **Fork**: A repository that GitHub marks as a fork.
- **Rate_Limit_Response**: A GitHub response that signals the primary or secondary rate limit is exhausted.
- **Safe_Error**: A response body containing an error code and a short generic message, with no token, secret, stack trace or raw GitHub payload.
- **Demo_Cache_TTL**: The cache lifetime for Demo_Mode results, set to 5 minutes.

## Requirements

### Requirement 1: GitHub sign-in

**User Story:** As a developer, I want to sign in with GitHub using the narrowest permission that works, so that I can scan my repositories without over-sharing access.

#### Acceptance Criteria

1. WHEN a visitor starts sign-in, THE Auth_System SHALL redirect the visitor to GitHub OAuth requesting the scope `public_repo` and no other scope.
2. WHEN GitHub completes the OAuth callback successfully, THE Auth_System SHALL create a session that identifies the user by GitHub login.
3. THE Auth_System SHALL keep the User_Token only in server-side session data, and SHALL exclude the User_Token from every client response, rendered page, log entry and error message.
4. THE Auth_System SHALL read `GITHUB_ID`, `GITHUB_SECRET` and `AUTH_SECRET` from environment variables.
5. WHEN a client requests the session, THE Auth_System SHALL return the GitHub login and avatar URL without the User_Token.
6. IF the visitor denies the OAuth consent, THEN THE Auth_System SHALL return the visitor to the landing page with a Safe_Error stating that sign-in was cancelled, and SHALL create no session.
7. IF the OAuth callback fails for any reason other than consent denial (including GitHub being unreachable, an invalid state value, or a code exchange failure), THEN THE Auth_System SHALL return the visitor to the landing page with a Safe_Error stating that sign-in failed and can be retried, and SHALL create no session.
8. IF any of `GITHUB_ID`, `GITHUB_SECRET` or `AUTH_SECRET` is missing or an empty string, THEN THE Auth_System SHALL disable sign-in, AND THE Scan_Route SHALL return a Safe_Error with the code `auth_not_configured`, AND the Safe_Error SHALL NOT include the name or value of any environment variable.
9. WHEN a signed-in user requests sign-out, THE Auth_System SHALL end the session, discard the User_Token, and return the user to the landing page within 2 seconds.

### Requirement 2: Scan signed-in repositories

**User Story:** As a signed-in developer, I want to scan my repositories, so that I get a list of facts about each one.

#### Acceptance Criteria

1. WHEN a signed-in user sends `POST /api/scan`, THE Scan_Route SHALL return a JSON list of RepoHealth objects for the repositories owned by that user.
2. THE Scan_Route SHALL return every RepoHealth field defined in the Glossary for each repository, with each field holding a value of the type defined in the Glossary or null where the Glossary permits null.
3. WHEN the repository has no commits, THE Ingestion_Service SHALL set `lastCommitAt` to null.
4. WHEN the repository has no CI check results, THE Ingestion_Service SHALL set `ciStatus` to `none`.
5. WHEN the most recent CI check results on the default branch include at least one failed check, THE Ingestion_Service SHALL set `ciStatus` to `failing`.
6. WHEN the most recent CI check results on the default branch exist and none failed, THE Ingestion_Service SHALL set `ciStatus` to `passing`.
7. WHEN the dependency manifest of a repository cannot be read or is not supported, THE Ingestion_Service SHALL set `outdatedDeps` to null.
8. WHEN the repository has a README file, THE Ingestion_Service SHALL set `hasReadme` to true.
9. WHEN the repository has no README file, THE Ingestion_Service SHALL set `hasReadme` to false.
10. WHEN the Scan_Route receives a request, THE Scan_Route SHALL validate the request body with the GitHub_Validator before processing it.
11. IF the request body fails validation, THEN THE Scan_Route SHALL return HTTP 400 with a Safe_Error, SHALL NOT call GitHub, and SHALL NOT include the rejected input or any token in the response.
12. IF a request to the Scan_Route has no session and does not request Demo_Mode, THEN THE Scan_Route SHALL return HTTP 401 with a Safe_Error that asks the visitor to sign in.
13. IF a GitHub response for the scan fails Zod validation, GitHub is unreachable, or GitHub does not respond within 10 seconds, THEN THE Scan_Route SHALL return HTTP 502 with a Safe_Error indicating that the scan could not be completed, and SHALL NOT return partial RepoHealth results.
14. THE Scan_Route SHALL determine the scanned account from the session or from the Demo_Username, and SHALL ignore any username supplied in the request body.
15. THE Scan_Route SHALL return RepoHealth objects sorted by `name` in ascending order using a case-sensitive comparison by Unicode code point, so that the same GitHub data always yields the same response.

### Requirement 3: Fork handling

**User Story:** As a developer, I want forks left out by default, so that the graveyard shows only projects I started.

#### Acceptance Criteria

1. WHEN a scan request does not set `includeForks` or sets `includeForks` to false, THE Ingestion_Service SHALL exclude every repository that GitHub reports as a Fork from the result.
2. WHERE the request body sets `includeForks` to true, THE Ingestion_Service SHALL include every Fork in the result, with the same fields as non-Fork repositories.
3. WHEN a scan request is received, THE Ingestion_Service SHALL include archived repositories in the result with `archived` set to true, whether or not `includeForks` is set.
4. WHEN a scan completes, THE Scan_Route SHALL include in the response a skipped-Fork count that is an integer from 0 to the number of repositories scanned, equal to the number of Forks excluded, and equal to 0 when `includeForks` is true.
5. IF the request body sets `includeForks` to a value that is not a boolean, THEN THE Scan_Route SHALL reject the request without calling GitHub, return a generic validation error to the client, and leave no partial scan result.
6. WHEN a repository is both a Fork and archived and `includeForks` is false, THE Ingestion_Service SHALL exclude it and count it once in the skipped-Fork count.

### Requirement 4: Pagination

**User Story:** As a developer with many repositories, I want every repository scanned, so that none is missing from the graveyard.

#### Acceptance Criteria

1. WHEN GitHub reports that a further page of repositories exists, THE Ingestion_Service SHALL request the next page, and SHALL continue until GitHub reports no further page or the 300-repository limit in criterion 3 is reached.
2. THE Ingestion_Service SHALL request 100 repositories per page.
3. IF GitHub returns more than 300 repositories for the user, THEN THE Ingestion_Service SHALL stop requesting pages once 300 repositories are collected, SHALL discard any repositories beyond the first 300 in GitHub's returned order, and THE Scan_Route SHALL set `truncated` to true in the response.
4. IF the number of repositories returned by GitHub is 300 or fewer, THEN THE Scan_Route SHALL set `truncated` to false in the response.
5. WHILE per-repository detail requests are in progress, THE Ingestion_Service SHALL keep no more than 5 detail requests in flight at any time.
6. IF a page request fails after GitHub has returned at least one earlier page, THEN THE Ingestion_Service SHALL fail the scan, THE Scan_Route SHALL return a generic error response that contains no token or GitHub response body, and THE Scan_Route SHALL NOT return a partial list of RepoHealth objects.
7. FOR ALL lists of repositories split across any number of pages, THE Ingestion_Service SHALL return the same set of RepoHealth objects, with the same order, as for a single page containing the same repositories (pagination invariant).

### Requirement 5: Server-side GitHub access

**User Story:** As a developer, I want GitHub calls kept on the server, so that my token is never exposed.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL call GitHub through Octokit only in server code, and THE Ingestion_Service SHALL NOT import or execute any GitHub call from a client component, so that the production client bundle contains zero references to Octokit.
2. THE Scan_Route SHALL NOT include the User_Token, the Demo_Token, `GITHUB_SECRET`, `AUTH_SECRET` or `LLM_API_KEY` in any response body, response header or error message.
3. THE Ingestion_Service SHALL NOT write the User_Token, the Demo_Token, `GITHUB_SECRET`, `AUTH_SECRET` or `LLM_API_KEY` to any log, at any log level.
4. IF an unexpected error occurs during a scan, THEN THE Scan_Route SHALL return HTTP 500 with a Safe_Error, SHALL log only an error code and a request identifier, and SHALL NOT include stack traces, upstream GitHub response bodies or token values in the response or the log.
5. IF the Scan_Route receives GitHub data that fails Zod validation, THEN THE Scan_Route SHALL discard the data, return a Safe_Error that contains no fragment of the invalid data, and log only an error code and a request identifier.
6. THE Scan_Route SHALL NOT use a database, and SHALL keep scan state only in memory or in the Auth.js session, so that no scan state remains after the server process restarts, except for data held in the Auth.js session.

### Requirement 6: Rate limiting and cached results

**User Story:** As a developer, I want a clear message when GitHub limits my requests, so that I know to wait and still see my earlier results.

#### Acceptance Criteria

1. IF GitHub returns a Rate_Limit_Response, THEN THE Scan_Route SHALL return HTTP 429 with the code `rate_limited` and a message indicating that GitHub request limits were reached and that the user can try again later.
2. IF GitHub returns a Rate_Limit_Response AND GitHub provides a reset time, THEN THE Scan_Route SHALL include the reset time in the response as an ISO 8601 UTC string.
3. IF GitHub returns a Rate_Limit_Response AND GitHub provides no reset time, THEN THE Scan_Route SHALL return the `rate_limited` error with the reset time omitted.
4. IF GitHub returns a Rate_Limit_Response AND the Scan_Cache holds an unexpired result for the same GitHub login, THEN THE Scan_Route SHALL return the cached result with `stale` set to true and the time the result was cached as an ISO 8601 UTC string, together with the `rate_limited` code and the reset time when available.
5. IF GitHub returns a Rate_Limit_Response AND the Scan_Cache holds no unexpired result for the same GitHub login, THEN THE Scan_Route SHALL return the `rate_limited` error with no result list and with `stale` absent or set to false.
6. WHEN a scan succeeds for a Signed_In_Mode account, THE Scan_Route SHALL store the result in the Scan_Cache keyed by GitHub login, replacing any existing entry for that login.
7. THE Scan_Cache SHALL hold entries only in server memory, SHALL treat an entry as expired 3600 seconds after it was stored, and SHALL NOT return an expired entry.
8. THE Scan_Cache SHALL NOT store any access token, API key or secret, either alone or as part of a cached result.

### Requirement 7: Revoked token and GitHub errors

**User Story:** As a signed-in developer whose token stopped working, I want to be told to sign in again, so that I can recover.

#### Acceptance Criteria

1. IF GitHub rejects the User_Token with HTTP 401, THEN THE Scan_Route SHALL return HTTP 401 with the code `token_revoked` and a Safe_Error message that asks the user to sign in again, and THE Scan_Route SHALL exclude the User_Token and any other secret from the response body and logs.
2. IF GitHub rejects the User_Token with HTTP 401, THEN THE Auth_System SHALL end the session within 1 second, so that the next request to the Scan_Route without a new sign-in returns HTTP 401.
3. IF GitHub rejects a request with HTTP 403 and the response is not a Rate_Limit_Response, THEN THE Scan_Route SHALL return HTTP 403 with the code `forbidden` and a Safe_Error, and THE Auth_System SHALL keep the session active.
4. IF GitHub does not respond within 10 seconds, the connection fails, or GitHub returns a status from 500 to 599, THEN THE Scan_Route SHALL return HTTP 502 with the code `github_unavailable` and a Safe_Error, and THE Auth_System SHALL keep the session active.
5. IF a single repository detail request fails with a non-fatal error (any GitHub failure other than HTTP 401 or a Rate_Limit_Response), THEN THE Ingestion_Service SHALL keep that repository in the result, set `ciStatus` to `none` and `outdatedDeps` to null for that repository, and leave the facts of all other repositories unchanged.
6. IF a single repository detail request fails with HTTP 401, THEN THE Ingestion_Service SHALL stop the scan, discard partial results, and report the failure to the Scan_Route, which SHALL apply criterion 1.

### Requirement 8: Empty account

**User Story:** As a developer with no repositories, I want a clear empty result, so that I am not shown an error.

#### Acceptance Criteria

1. IF the scanned account has zero repositories after the fork filter is applied and the account has zero Forks, THEN THE Scan_Route SHALL return HTTP 200 with an empty repository list, a skipped fork count of 0, and the code `empty_account`, and SHALL NOT include an error indication in the response.
2. IF the scanned account has at least 1 repository, every repository is a Fork, and `includeForks` is not true, THEN THE Scan_Route SHALL return HTTP 200 with an empty repository list, a skipped fork count equal to the number of Forks excluded, and the code `empty_account`.
3. IF the Demo_Username does not exist on GitHub, THEN THE Scan_Route SHALL return HTTP 404 with the code `account_not_found` and a Safe_Error that contains no token, API key or upstream response body.
4. IF the GitHub request for the account fails for any reason other than the account not existing, including network failure, rate limiting, or a response that fails Zod validation, THEN THE Scan_Route SHALL return a Safe_Error with a code different from `empty_account` and `account_not_found`, so that an upstream failure is never reported as an empty account.

### Requirement 9: Demo mode

**User Story:** As a judge or first-time visitor, I want to try the app without signing in, so that I can see the graveyard immediately.

#### Acceptance Criteria

1. WHEN a request to the Scan_Route sets `demo` to true, THE Scan_Route SHALL scan the public repositories of the Demo_Username without requiring a session.
2. THE Scan_Route SHALL read the Demo_Username from server configuration and SHALL ignore any username supplied in the request.
3. IF the Demo_Username is not set in server configuration, THEN THE Scan_Route SHALL return a generic error response indicating that demo mode is unavailable, SHALL NOT call GitHub, and SHALL NOT store anything in the Scan_Cache.
4. WHILE the Scan_Route runs in Demo_Mode, THE Ingestion_Service SHALL send only read-only GitHub requests (requests that do not create, modify or delete GitHub data).
5. WHERE `GITHUB_DEMO_TOKEN` is set to a non-empty value, THE Ingestion_Service SHALL authenticate Demo_Mode requests with the Demo_Token.
6. WHERE `GITHUB_DEMO_TOKEN` is not set or is empty, THE Ingestion_Service SHALL send Demo_Mode requests without authentication.
7. THE Scan_Route SHALL NOT include the Demo_Token in any response, error message or log entry.
8. WHEN a Demo_Mode scan succeeds, THE Scan_Route SHALL store the result in the Scan_Cache for the Demo_Cache_TTL.
9. IF a Demo_Mode scan fails, THEN THE Scan_Route SHALL return a generic error response, SHALL NOT store anything in the Scan_Cache, and SHALL leave any existing Demo_Mode cache entry unchanged.
10. WHILE a Demo_Mode cache entry is younger than the Demo_Cache_TTL, THE Scan_Route SHALL return the cached result without calling GitHub.
11. WHEN a Demo_Mode scan runs, whether from GitHub or from the Scan_Cache, THE Scan_Route SHALL set `mode` to `demo` in the response.
12. WHEN a signed-in user scans with `demo` not set to true, THE Scan_Route SHALL set `mode` to `user` in the response.
13. IF a session exists and `demo` is true, THEN THE Scan_Route SHALL perform the Demo_Mode scan, SHALL NOT use the User_Token, and SHALL NOT read from or write to any user-mode Scan_Cache entry.

### Requirement 10: Zod validation

**User Story:** As a maintainer, I want every GitHub response validated, so that bad data never reaches the UI or later scoring.

#### Acceptance Criteria

1. WHEN the Ingestion_Service receives a GitHub response, THE GitHub_Validator SHALL validate the response with a Zod schema before the Ingestion_Service reads any field from it.
2. THE Ingestion_Service SHALL NOT use type assertions (`as` casts or non-null assertions) on GitHub data at any point between receiving the response and validation completing.
3. IF a repository-list response fails validation, THEN THE Scan_Route SHALL return HTTP 502 with the code `invalid_github_response` and a Safe_Error, SHALL return no repository data, and SHALL NOT include the raw GitHub response, validation issue details, or any token in the response body.
4. IF a single repository entry fails validation inside an otherwise valid list, THEN THE Ingestion_Service SHALL skip that entry, SHALL continue validating the remaining entries, and THE Scan_Route SHALL include the count of skipped invalid entries (an integer from 0 to the list length) in its response.
5. IF every entry in a repository list fails validation, THEN THE Scan_Route SHALL return HTTP 502 with the code `invalid_github_response` and a Safe_Error.
6. WHEN the Scan_Route is about to return a RepoHealth object, THE GitHub_Validator SHALL validate the object against the RepoHealth Zod schema before it is returned.
7. THE GitHub_Validator SHALL reject a RepoHealth object whose `ciStatus` is not exactly one of `passing`, `failing` or `none`.
8. THE GitHub_Validator SHALL reject a RepoHealth object whose `openIssues` or `stars` is negative, not an integer, `NaN`, or infinite.
9. FOR ALL valid RepoHealth objects, serializing to JSON then parsing the result with the RepoHealth schema SHALL produce an object deeply equal to the original (round-trip property).
10. IF a GitHub repository payload is missing a required field, has a field of the wrong type, or is `null`, THEN THE GitHub_Validator SHALL return a validation failure result and SHALL NOT throw an unhandled exception.

### Requirement 11: Testability

**User Story:** As a maintainer, I want the ingestion logic testable without the network, so that the rules above stay correct.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL map validated GitHub data to RepoHealth through pure functions that perform no network calls, no filesystem access, no clock reads and no random number generation.
2. THE Ingestion_Service SHALL receive the current time as an argument to every mapping function that depends on time.
3. THE mapping functions SHALL return a RepoHealth that is deeply equal across 100 repeated calls with the same validated GitHub input and the same current-time argument.
4. THE Ingestion_Service SHALL accept the Octokit client as an injected dependency, so that tests run with a mocked client and make zero real network requests.
5. THE Ingestion_Service SHALL include at least one Vitest unit test for each exported function in `src/lib` that the Ingestion_Service adds, covering one success case and one failure or boundary case.
6. THE Ingestion_Service SHALL include fast-check property tests, each running at least 100 generated cases, for the pagination invariant, the fork filter and the RepoHealth round trip.
7. WHEN the Playwright test in `e2e/` calls `POST /api/scan` in Demo_Mode with GitHub mocked, THE Playwright test SHALL assert that the response parses against the scan response schema and that the test makes zero requests to the real GitHub API.
8. IF a unit, property or Playwright test attempts a real network request to GitHub, THEN THE test run SHALL fail with an error that identifies the blocked request.
9. IF the Zod validation of a mocked GitHub response fails in a test, THEN THE Ingestion_Service SHALL return a generic error and THE test SHALL assert that the error contains no token, API key or raw GitHub payload.
