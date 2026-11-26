# How Kiro was used to build Repo Graveyard

Draft write-up for the hackathon submission (Costume Contest category).

Every number below was counted from this repo (the `.kiro/` folder, `git log`, the `tasks.md` files, the source and the test runs) or observed in the session that updated this file. Anything I could not verify is marked **TODO (you)**. Fill those in yourself. A full list is at the end.

## At a glance

| Kiro feature | What exists in the repo |
|---|---|
| Steering | 5 files in `.kiro/steering/`: `product.md`, `tech.md`, `design-system.md`, `security.md` (always included) and `submission-guard.md` (`inclusion: manual`) |
| Specs | 5 specs in `.kiro/specs/` (requirements, design, tasks), 633 KB of files |
| Spec tasks | 230 task lines: 104 checked, 126 unchecked (per-spec counts below) |
| Hooks | 4 agent hooks in `.kiro/hooks/`. Seen firing in an earlier session: 3. No evidence either way: 1 (details below) |
| MCP | 2 servers in `.kiro/settings/mcp.json`: `github` (read-only) and `playwright` |
| Custom agent | `gravedigger` in `.kiro/agents/gravedigger.md` |
| Unit and property tests | 106 test files in `src/`, 860 tests, all passing on the last run. 22 files are named `*.property.test.ts` and 38 source files import fast-check |
| End-to-end tests | 4 Playwright spec files in `e2e/`, 8 tests, all passing on the last run |
| Source | 97 non-test `.ts` and `.tsx` files in `src/` (not counting `*.test.*`, `test-utils/` folders and `*fixtures*` files) |
| Powers | None installed |

Git history: 22 commits from 2026-11-18 to 2026-11-23.

> **TODO (you):** add the total time you spent and how much of it was the hackathon window.

## IDE vs CLI

What the repo shows:

- Custom agents, hooks and MCP config are plain files under `.kiro/`, so they work the same way in the Kiro IDE and in Kiro CLI. The agent file `gravedigger.md` uses the Markdown format with YAML settings at the top, which Kiro documents for both IDE 1.0 and CLI V3.
- The two save hooks use the `PostFileSave` trigger and the README hook uses `PostTaskExec`. Kiro's docs list both as available in the IDE and in CLI V3.
- A manual hook cannot be created in the IDE, so the pre-submission check is a steering file with `inclusion: manual` in `.kiro/steering/submission-guard.md`. You run it by typing `/submission-guard` in chat.
- `AGENTS.md` (from `create-next-app`) tells the agent that this Next.js version has breaking changes and to read `node_modules/next/dist/docs/` first.

The sessions that produced and updated this file ran in the Kiro IDE.

> **TODO (you):** say which surface you used for each activity, for example "spec authoring in the IDE, ... in the CLI". If you never used the CLI, say that plainly.

## Specs vs vibe coding

I used both, on purpose, so you can compare them.

**Spec-driven (5 specs).** The specs were written first. Task counts below are read from each `tasks.md` (a task line is any `- [ ]` or `- [x]` line, parents and sub-tasks both). No task is in progress. 35 unchecked tasks are marked optional with `*`: 16 in `auth-ingestion` and 19 in `death-scoring`. Their `tasks.md` files say the optional tasks are the test-writing ones that can be skipped for a faster MVP. The earlier version of this file said no task was optional, and that was wrong.

| Spec | Requirements | Correctness properties | Tasks checked | Tasks unchecked | Total |
|---|---|---|---|---|---|
| `project-scaffold` | 9 | 0 (config and a static page) | 0 | 18 | 18 |
| `auth-ingestion` | 11 | 16 | 32 | 16 | 48 |
| `death-scoring` | 13 | 19 | 14 | 19 | 33 |
| `graveyard-ui` | 21 | 18 | 3 | 48 | 51 |
| `resurrection` | 18 | 23 | 55 | 25 | 80 |
| **Total** | 72 | 76 | **104** | **126** | **230** |

Notes on the table:

- `project-scaffold` has 0 checked tasks, but the app it describes (Next.js, Tailwind, Vitest, Playwright, ESLint) exists and runs. The task list was simply never ticked.
- **`graveyard-ui` is 3 of 51, and that number is honest.** Kiro reconciled the task list against the code instead of ticking it to look finished. The three checked tasks are 1.1 (shared types), 2.1 (entries and status helpers) and 6.3 (the landing route). Tasks 2.1 and 6.3 carry a `Note: Differs:` line in `tasks.md` that says what was built instead. For example, 2.1 was built as `tombstones.ts` and `view.ts`, not the planned `entries.ts` and `status.ts`. Task 1.1 notes that its `GraveEntry` type is not used by the app yet.
- **Most of the UI was built outside the spec.** The planned files `src/lib/graveyard/filter.ts`, `entries.ts` and `status.ts`, `src/components/providers.tsx` and `src/app/graveyard/graveyard-app.tsx` do not exist. The working page is `src/app/graveyard/GraveyardView.tsx` with the helpers in `src/lib/graveyard/`. The stone vocabulary, the legend and the Graveyard/List toggle were also added without a spec task.
- Each spec's `tasks.meta.json` records task executions. Counting the tasks that have a record: 32 in `auth-ingestion` (it has 32 checked), 14 in `death-scoring` (14 checked), 56 in `resurrection` (55 checked) and 1 in `graveyard-ui` (task 1.1; its checked 2.1 and 6.3 have none). `project-scaffold` has no `tasks.meta.json`.
- The property counts come from the headings in each `design.md`.

Concrete examples from the specs:

- Requirements are in EARS format with exact numbers. `resurrection/requirements.md` fixes context caps (README 6,000 characters, 10 commit messages, 10 issue titles) and rate limits (10 resurrects per 600 s per login, 5 issues). Its 25 s per LLM attempt was later cut to 7.5 s in the code (see the Gemini section). The spec text still says 25 s.
- Each design records the decisions it settled. The resurrection design keeps `@google/genai`, sets the model with an `LLM_MODEL` variable, and turns the SDK's own retries down to 1 so the "2 LLM calls at most" rule holds.
- Each spec ends in a task list with a dependency graph in waves.

**Vibe-coded (no spec).** Three components were built directly from a short prompt each:

- `src/components/Tombstone.tsx`: rising entrance, hover lift, flickering candle glow.
- `src/components/GraveyardScene.tsx`: moon and sky tied to the alive share, three fog layers, pointer parallax.
- `src/components/ResurrectArea.tsx`: the fog-parting reveal with loading and error states.

`src/components/` also holds `GraveDrawer`, `SignInButton` and `SkipLink`. Later requests added `GraveyardLegend`, `GraveyardList` and `ViewToggle`, also without a spec. `docs/tombstone-iterations.md` logs the rounds on the Tombstone.

**Comparison from this repo:**

- Vibe coding reached something visible fast. Its misses were small and found by looking at it: the Tombstone's CSS Module did not apply (the project's `next.config.ts` sends every `*.css` file through the Tailwind loader), and `ResurrectArea` rendered a different scale on the server and in the browser, which caused a hydration warning.
- The specs caught problems before any code existed. Reading the death-scoring rules showed a contradiction: a repo untouched for 29 days with failing CI, outdated dependencies and no README scores 28 (dying), yet the cause rules label it "Still active". `death-scoring/design.md` now has Property 18 ("Alive status never has a death cause") and Property 19 ("Non-alive status never has still_active"), and the files `src/lib/scoring.alive-cause.property.test.ts` and `src/lib/scoring.death-cause.property.test.ts` exist. I did not trace whether those two came from this exact finding.
- The cost of specs: 126 of 230 task lines are unchecked, and most of `graveyard-ui` is not built the way the spec describes.

> **TODO (you):** your own verdict. Which approach did you prefer, and when? Add real numbers if you have them (hours per spec, hours per component).
>
> **TODO (you):** say how you ran the spec tasks. The execution records above suggest Kiro's task runner for `auth-ingestion`, `death-scoring`, `resurrection` and `graveyard-ui` task 1.1, but I can't tell from the files whether any were done by hand, or how `project-scaffold` was built.

## Steering

Five files in `.kiro/steering/`:

- `product.md`: the product, audience (students, freelancers, hobbyists), the tone rule ("joke about the repo's fate, never about the person") and a glossary (tombstone, death score, status, cause of death, epitaph, resurrect).
- `tech.md`: the stack and hard rules. Examples that later shaped the specs and code: "Scoring is a pure function with no I/O", "AI is never used for scoring", "No database in v1", and "Every external response (GitHub, LLM) is validated with Zod before use".
- `design-system.md`: the palette as CSS variables, Cinzel and Inter fonts, spacing and radius scales, motion rules and a visual vocabulary where every spooky element maps to one data field (fog is days inactive, candle is recent activity, cracks are failing CI, vines are outdated dependencies, stone size is stars). The rule "components must use the CSS variables, never hard-coded colors" is checked by a hook and an agent.
- `security.md`: secrets never reach the client, every GitHub and LLM response is Zod-validated, prompt-injection rules for the LLM, demo mode never creates issues, no database in v1, request limits and response headers.
- `submission-guard.md`: a manual checklist for `.kiro` not ignored, MIT license, no tracked secrets, README setup instructions.

Concrete effects I verified:

- `globals.css` defines the tokens from `design-system.md` (commit `0a9e390`).
- `design-system.md`'s visual vocabulary became the tombstone's stone size, fog, cracks, vines and candle (`src/lib/graveyard/stone-vocab.ts`), each with a text equivalent in the stone's accessible name.
- `security.md` shaped the code: `npm run check:bundle` passed on the last build ("18 files scanned, no forbidden strings"). The four security headers are set in `next.config.ts`; a Content-Security-Policy is not (a comment there says it needs a nonce first). The ESLint client guards in `eslint.config.mjs` keep server-only imports such as octokit out of client code.
- The sample-repo path added to `/api/resurrect` reads no session, no demo config and no token, and a test asserts the fake GitHub requester is never called.

## Hooks

Four agent hooks in `.kiro/hooks/`, all added in commit `35edaf2`. Git history can show that a hook file was committed, not that it ran. The "Fired?" column therefore rests on what the earlier session that wrote this table observed. In the sessions since, no hook output reached me in a tool result, so I add no new firings.

| Hook | Trigger | What it does | Fired? (evidence) |
|---|---|---|---|
| `lint-typecheck-on-save` | `PostFileSave`, files matching `.ts` or `.tsx` | Runs `npm run lint` and `npm run typecheck` and reports errors. | **Yes, per the earlier session.** It ran after saves of `src/lib/scoring.ts` made with the editor's edit tool, and a sub-agent's report during `graveyard-ui` task 1.1 carried lint and typecheck results, including one lint error that was then fixed. |
| `scoring-tests-on-save` | `PostFileSave`, `src/lib/scoring.ts` or `epitaphs.ts` | Runs the scoring tests, including property tests, and summarizes failures. | **Yes, on editor saves only, per the earlier session.** It fired when a comment was added to and removed from `scoring.ts` with the edit tool, and the tests passed (4 files, 24 tests). A write from the terminal did not trigger it. |
| `readme-feature-list-on-task-complete` | `PostTaskExec` | Updates the Features list in `README.md`. | **Yes, once, per the earlier session.** It fired when `graveyard-ui` task 1.1 was marked completed and made no change, because a types-only task adds no feature. |
| `design-tokens-on-save` | `PostFileSave`, paths under `src/components/` | Flags hard-coded colors and off-scale values against `design-system.md`. | **No evidence.** I can't say whether it ran. |

Git history of `README.md` (10 commits) does not show whether any of those edits came from the hook, because the commit messages don't say.

> **TODO (you):** add a screenshot or a note of a hook firing in the IDE, and say whether one of them ever caught a real mistake. The one catch documented here is the lint error in `src/lib/graveyard/types.ts` during task 1.1.
>
> **TODO (you):** say whether `design-tokens-on-save` ever fired for you.

## MCP

`.kiro/settings/mcp.json` holds two servers, committed in `a2ce960` and `582418e`.

**`github`**: GitHub's hosted server at `/mcp/readonly`, with the header `X-MCP-Readonly: true` and the toolsets `default,actions`. It reads its token from `${GITHUB_MCP_TOKEN}`, so no token value is in any file. The session's tool list shows 31 `github` tools, and none has `create`, `update` or `delete` in its name. This session did not use it.

**`playwright`**: the official `@playwright/mcp`, run through `npx` with the installed Chrome. It opens a page, reads the accessibility tree and runs JavaScript in the page.

What the MCP use found:

- **The deployed-site check (this session).** After the last push I drove `https://repo-graveyard-seven.vercel.app` with the Playwright MCP:
  - The landing page loaded with its three example stones.
  - "Try demo graveyard" showed 9 repos. Fog, cracks and the candle appeared in the stones' accessible names. No stone had vines, so none of the 9 is flagged as having outdated dependencies. All 9 were "small" stones, which means each has fewer than 10 stars.
  - Resurrect on one repo returned HTTP 200 with `source: "ai"` in 14.1 s, with no `fallbackReason`.
  - The "File this issue" button was `aria-disabled="true"` with the text "Filing issues is turned off in the demo.", and clicking it sent no request to `/api/issue`.
  - "Sign in with GitHub" reached `github.com/login` with the app's callback URL and scope `public_repo`.
- **The model problem.** The author's account is that this kind of check on the deployed site is what showed Resurrect was not getting an AI plan because of the model setting. The Gemini section below has the code facts. I did not see the failing response myself.
- **The focus bug.** The author's account is that the Playwright MCP found a keyboard-focus bug. I can't tie it to a commit. The code that handles focus is in `ResurrectArea.tsx` (the Resurrect button stays focusable while loading, and focus moves to the error heading or the plan heading) and in `GraveyardView.tsx` (focus returns to the stone that opened the drawer).
- **A limit of the MCP.** An earlier session found that the MCP reloaded the page on each action, which made keyboard-focus checks unreliable, so it used a short Playwright script for that check.

The screenshots at 360, 768 and 1280 px for the stone vocabulary (`vocab-graveyard-*.png`) and the list view (`list-graveyard-*.png`) were taken with a Playwright script (`@playwright/test`), not the MCP.

> **TODO (you):** describe the focus bug (what was wrong, which screen, which commit fixed it). The earlier version of this file said the keyboard-focus check was done with a script and "the app was fine", so say whether this is a different, later bug.
>
> **TODO (you):** paste what the deployed check showed for the model problem (the `fallbackReason` or error you saw).
>
> **TODO (you):** say whether the MCP servers changed how you work.

## The Gemini model change, and why

What changed (commit `02119a4`, 2026-11-22):

| Setting | Before | After |
|---|---|---|
| `DEFAULT_LLM_MODEL` (`src/lib/resurrection/limits.ts`) | `gemini-2.5-flash-lite` (added in `04ff08c`) | `gemini-3.5-flash-lite` |
| `LLM_TIMEOUT_MS` | 25,000 | 7,500 |
| `CLIENT_TIMEOUT_MS` | 65,000 | 30,000 |
| Worst case for one Resurrect (10 s of GitHub reads plus 2 LLM attempts) | 60 s | 25 s |
| `maxDuration` on the resurrect route | 70 | 30 |
| Retries | Every failure was retried once | An error with a status other than 429 or 503 (401, 403, 404 and the rest) stops at once. Timeouts, invalid output and errors with no status are still retried once |
| When the AI fails | Fallback plan | Fallback plan right away, and the drawer says "Rule-based plan (the AI was unavailable)" |

Why, from the code:

- A model id the provider does not know is answered with a 404 (model not found), and a retry cannot help. The adapter maps any rejected call to `unavailable`, so such a failure shows up as `source: "fallback"` with `fallbackReason: "llm_unavailable"`. Before this change it was retried and waited out for up to 60 s.
- `LLM_MODEL` in the environment overrides the default whenever it matches the id pattern (`src/lib/resurrection/config.ts`). Changing the default in code does nothing while an old value is still set in the environment.
- The local `.env.local` has `LLM_MODEL=gemini-3.5-flash-lite`. I can't see the Vercel environment.
- After the change, the deployed Resurrect returned `source: "ai"` (see the MCP section).

Tests for this: `llm-failure-path.test.ts` (fake client, fake timers) checks that 401, 403 and 404 make one call, that 429 and 503 make exactly two and finish within the 25 s budget, and that the default model applies when `LLM_MODEL` is unset.

I can't verify that `gemini-3.5-flash-lite` is the right model name beyond the fact that the deployed call succeeded.

> **TODO (you):** say what exactly was wrong with the old default (retired, renamed or not available to your key) and the date you noticed it.

## Property-based testing

The idea: instead of writing example inputs, describe a rule that must hold for all inputs and let fast-check generate hundreds of cases.

- **Designed:** 76 properties across four designs (16 ingestion, 19 scoring, 18 graveyard logic, 23 resurrection). Examples from `death-scoring/design.md`: score is always an integer from 0 to 100; more inactivity never lowers the score; archived repos are always ancient; failing CI never lowers the score.
- **Implemented:** 22 files named `*.property.test.ts`, and 38 source files that import fast-check. I did not count individual properties, so I make no claim about how many of the 76 are covered.
- **Added in this round:** more stars never gives a smaller stone, and more days of silence never gives thinner fog (through the real scoring), in `stone-vocab.test.ts`; and the view-mode URL round trip in `view-mode.test.ts`.
- **One real catch:** `rate-limit.window.property.test.ts` failed in 3 of 30 runs with random seeds (`2041569074`, `-1952780431`, `990765677`). All three shrank to `limit=1, windowMs=1000, deltas=[0,0]`. Two requests in the same millisecond: the first is allowed and stored at `t=0`, the second is correctly denied, and the assertion "a denial does not contain `now`" then failed because the first request's timestamp equals `now`. The rate limiter was right and the property was weak. I replaced it with an assertion that a denial adds no timestamp, and 40 further runs passed.

> **TODO (you):** if fast-check found a bug in the product code (not in a test), describe it here with its shrunk counterexample. I have no such result from this repo.

## The gravedigger agent

`.kiro/agents/gravedigger.md` is a custom agent (added in `0a9e390`) whose job is to polish the UI against `design-system.md`.

- **Workflow in its prompt:** open the page with the Playwright MCP and take a screenshot, list every violation (colors, fonts, spacing, motion, accessibility, touch targets) with the token it should use, fix them with CSS variables only, run lint and typecheck, take a second screenshot and report what changed.
- **Permissions, not just instructions:** it may write only under `src/components/**`, `src/styles/**` and `src/app/globals.css`. Its deny list covers `src/lib/**`, `src/app/api/**`, auth, scoring, GitHub code, tests, `e2e/**`, `package.json` and more.
- **Evidence the permissions work:** the earlier session reported that two attempts to widen its allow list were blocked by its own `.kiro/**` deny rule. I did not re-observe this.

> **TODO (you):** say whether you actually ran the `gravedigger` agent end to end from the agent picker. I never launched it.

## Powers

No Powers are installed, and nothing in this repo references one.

> **TODO (you):** if you used any Power during the hackathon, describe it here with one concrete example. Otherwise say "we did not use Powers" and, if you like, one line on why.

## What did not go smoothly

- **The wrong-model default.** The default model id was `gemini-2.5-flash-lite` and the deployed Resurrect was not producing an AI plan because of it (the author's account). Every failure was retried, so a bad call could keep the user waiting up to 60 s before the fallback appeared. The default is now `gemini-3.5-flash-lite`, the worst case is 25 s, and the retry stops on 401, 403 and 404.
- **The stale env values.** `LLM_MODEL` in the environment overrides the code default, so a fix in code is not enough while an old value is set, locally or on Vercel. Environment values do not travel with a push.
- **The flaky property test.** `rate-limit.window.property.test.ts` failed about 1 run in 10 on a weak assertion, not a rate limiter bug (details above). It looked like random noise until the shrunk counterexample showed `deltas=[0,0]`.
- Spec work got ahead of implementation: 126 task lines are unchecked, and `graveyard-ui` is 3 of 51.
- The CSS Modules problem: the Tailwind loader rule in `next.config.ts` broke class scoping, so components use plain CSS with prefixed class names.
- An end-to-end run once failed `demo-path` waiting for stones while the machine was under load. It passed alone in 3.9 s and in the next full run. I did not find the cause beyond the load.
- Git history oddities: commit `892d8e9` is titled "add Kiro hooks and submission guard" but contains only `LICENSE` (the hooks are in `35edaf2`). Commit `99bc0b0` is titled "type: short description", a leftover template message. Four commits (`1fef917`, `0c576be`, `128b65a`, `02119a4`) share the title "docs: add live demo link and deployed screenshots; untrack test output". The last of them also contains the model change and the sample-repo work. Its title says it untracks test output, but 4 files under `test-results/` are still tracked by git, and every `npm run e2e` rewrites them.
- Terminal writes do not trigger save hooks. Only saves through the editor (or the agent's edit tool) did, per the earlier session.

> **TODO (you):** add your own two or three biggest surprises, good and bad, in your own words.

## Fill-in checklist

1. Hours spent and the hackathon window.
2. Which Kiro surface (IDE or CLI) for which activity.
3. Your verdict on specs vs vibe coding.
4. How you ran the spec tasks (task runner or by hand).
5. A screenshot of a hook firing, and whether a hook caught a real mistake.
6. Whether `design-tokens-on-save` ever fired for you.
7. The focus bug: what it was and the commit that fixed it.
8. What the deployed check showed for the model problem, and what exactly was wrong with the old model id (including which environment values were stale, and where).
9. Whether the MCP servers changed how you work.
10. Whether fast-check found a bug in the product code, with its shrunk counterexample.
11. Whether you ran `gravedigger` yourself.
12. Whether you used any Power.
13. Your own surprises.
14. The feedback behind each round in `docs/tombstone-iterations.md`.
15. Decide what to do about `test-results/` (still tracked by git) and the repeated commit titles.
