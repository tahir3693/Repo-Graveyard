# How Kiro was used to build Repo Graveyard

Draft write-up for the hackathon submission (Costume Contest category).

Every number and example below was read from this repo: the `.kiro/` folder, `git log`, the `tasks.md` files and the source, or observed in the session that updated this file. Anything I could not verify is marked **TODO (you)**. Fill those in yourself. Please don't let anyone guess for you.

## At a glance

| Kiro feature | What exists in the repo |
|---|---|
| Steering | 5 files in `.kiro/steering/`: `product.md`, `tech.md`, `design-system.md`, `security.md`, `submission-guard.md` |
| Specs | 5 specs in `.kiro/specs/` (requirements, design, tasks), about 632 KB of files |
| Spec tasks | 230 task lines: 102 checked, 128 unchecked (per-spec counts below) |
| Hooks | 4 agent hooks in `.kiro/hooks/`. Seen firing: 3. No evidence either way: 1 (details below) |
| MCP | 2 servers in `.kiro/settings/mcp.json`: `github` (read-only) and `playwright` |
| Custom agent | `gravedigger` in `.kiro/agents/gravedigger.md` |
| Property-based tests | 76 properties designed across 4 specs. 22 files are named `*.property.test.ts` and 32 test files import fast-check |
| Tests | Last full run in the session that updated this file: 85 files, 645 tests passed |
| Source | 78 non-test `.ts` and `.tsx` files in `src/` and 88 test files (`src/` and `e2e/`) |
| Powers | None installed |

Git history: 11 commits from 2026-11-18 to 2026-11-21.

> **TODO (you):** add the total time you spent and how much of it was the hackathon window.

## IDE vs CLI

What the repo shows:

- Custom agents, hooks and MCP config are plain files under `.kiro/`, so they work the same way in the Kiro IDE and in Kiro CLI. The agent file `gravedigger.md` uses the Markdown format with YAML settings at the top, which Kiro documents for both IDE 1.0 and CLI V3.
- The two save hooks use the `PostFileSave` trigger and the README hook uses `PostTaskExec`. Kiro's docs list both as available in the IDE and in CLI V3.
- A manual hook cannot be created in the IDE, so the pre-submission check is a steering file with `inclusion: manual` in `.kiro/steering/submission-guard.md`. You run it by typing `/submission-guard` in chat.
- `AGENTS.md` (from `create-next-app`) tells the agent that this Next.js version has breaking changes and to read `node_modules/next/dist/docs/` first.

> **TODO (you):** say which surface you used for each activity. I only know the session that produced this draft ran in the IDE. For example: "spec authoring in the IDE, ... in the CLI". If you never used the CLI, say that plainly.

## Specs vs vibe coding

I used both, on purpose, so you can compare them.

**Spec-driven (5 specs).** The specs were written first. Task counts below are read from each `tasks.md` (a task line is any `- [ ]` or `- [x]` line, parents and sub-tasks both). No task is marked optional with an asterisk.

| Spec | Requirements | Correctness properties | Tasks checked | Tasks unchecked | Total |
|---|---|---|---|---|---|
| `project-scaffold` | 9 | 0 (config and a static page) | 0 | 18 | 18 |
| `auth-ingestion` | 11 | 16 | 32 | 16 | 48 |
| `death-scoring` | 13 | 19 | 14 | 19 | 33 |
| `graveyard-ui` | 21 | 18 | 1 | 50 | 51 |
| `resurrection` | 18 | 23 | 55 | 25 | 80 |
| **Total** | 72 | 76 | **102** | **128** | **230** |

Notes on the table:

- `project-scaffold` has 0 checked tasks, but the app it describes (Next.js, Tailwind, Vitest, Playwright, ESLint) exists and runs. The task list was simply never ticked.
- In `graveyard-ui` only task 1.1 is checked. It added `src/lib/graveyard/types.ts` and its test.
- The property counts come from the headings in each `design.md`. `death-scoring` has 19, up from 17 in the earlier draft of this file.

Concrete examples from the specs:

- Requirements are in EARS format with exact numbers. `resurrection/requirements.md` fixes context caps (README 6,000 characters, 10 commit messages, 10 issue titles), timeouts (25 s per LLM attempt) and rate limits (10 resurrects per 600 s per login, 5 issues).
- Each design records the decisions it settled. The resurrection design keeps `@google/genai`, sets the model with an `LLM_MODEL` variable, and turns the SDK's own retries down to 1 so the "2 LLM calls at most" rule holds.
- Each spec ends in a task list with a dependency graph in waves.

**Vibe-coded (no spec).** Three components were built directly from a short prompt each:

- `src/components/Tombstone.tsx`: rising entrance, hover lift, flickering candle glow.
- `src/components/GraveyardScene.tsx`: moon and sky tied to the alive share, three fog layers, pointer parallax.
- `src/components/ResurrectArea.tsx`: the fog-parting reveal with loading and error states.

`src/components/` also holds `GraveDrawer`, `SignInButton` and `SkipLink`. `docs/tombstone-iterations.md` keeps a log of feedback rounds for the Tombstone. It currently shows 1 iteration.

**Comparison from this repo:**

- Vibe coding reached something visible fast. Its misses were small and found by looking at it: the Tombstone's CSS Module did not apply (the project's `next.config.ts` sends every `*.css` file through the Tailwind loader), and `ResurrectArea` rendered a different scale on the server and in the browser, which caused a hydration warning.
- The specs caught problems before any code existed. Reading the death-scoring rules showed a contradiction: a repo untouched for 29 days with failing CI, outdated dependencies and no README scores 28 (dying), yet the cause rules label it "Still active". `death-scoring/design.md` now has Property 18 ("Alive status never has a death cause") and Property 19 ("Non-alive status never has still_active"), and the files `src/lib/scoring.alive-cause.property.test.ts` and `src/lib/scoring.death-cause.property.test.ts` exist. I did not trace whether those two came from this exact finding.
- The cost of specs: 128 of 230 task lines are still unchecked, and most of `graveyard-ui` is not built.

> **TODO (you):** your own verdict. Which approach did you prefer, and when? Add real numbers if you have them (hours per spec, hours per component).
>
> **TODO (you):** say how you ran the spec tasks (Kiro's task runner or by hand). The only completion I saw was `graveyard-ui` task 1.1, run in this session through the task tools. I can't tell from git how the other 101 checked tasks were done.

## Steering

Five files in `.kiro/steering/`:

- `product.md`: the product, audience (students, freelancers, hobbyists), the tone rule ("joke about the repo's fate, never about the person") and a glossary (tombstone, death score, status, cause of death, epitaph, resurrect).
- `tech.md`: the stack and hard rules. Examples that later shaped the specs and code: "Scoring is a pure function with no I/O", "AI is never used for scoring", "No database in v1", and "Every external response (GitHub, LLM) is validated with Zod before use".
- `design-system.md`: the palette as CSS variables, Cinzel and Inter fonts, spacing and radius scales, motion rules and a visual vocabulary where every spooky element maps to one data field (fog is days inactive, candle is recent activity, cracks are failing CI, vines are outdated dependencies, stone size is stars). The rule "components must use the CSS variables, never hard-coded colors" is checked by a hook and an agent.
- `security.md`: secrets never reach the client, every GitHub and LLM response is Zod-validated, prompt-injection rules for the LLM, demo mode never creates issues, no database in v1, request limits and response headers.
- `submission-guard.md`: a manual checklist for `.kiro` not ignored, MIT license, no tracked secrets, README setup instructions.

Concrete effects I verified:

- `globals.css` defines the tokens from `design-system.md` (commit `0a9e390`).
- `security.md` led to a code audit in this session: no secret value from `.env.local` (`GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`, `LLM_API_KEY`) appears in the `.next` build output (0 matching files each, 594 files scanned). `GITHUB_DEMO_TOKEN` has no local value, so it was not checked. Every GitHub, LLM and request-body read found in `src/` goes through a Zod `safeParse`. A hostile-README test and the demo-mode `/api/issue` test exist and pass.
- The four security headers from `security.md` are set in `next.config.ts`. A Content-Security-Policy is not set.
- The ESLint client guard that keeps server-only imports out of client code is in `eslint.config.mjs`. In this session it blocked a type import that task `graveyard-ui` 1.1 needed, and I allowed `@/lib/github/repo-health` and `@/lib/github/sort` only.

## Hooks

Four agent hooks in `.kiro/hooks/`, all added in commit `35edaf2`. Git history can show that a hook file was committed, not that it ran, so "fired" below rests only on what I saw in the session that updated this file.

| Hook | Trigger | What it does | Fired? (evidence) |
|---|---|---|---|
| `lint-typecheck-on-save` | `PostFileSave` on `.ts` and `.tsx` | Runs `npm run lint` and `npm run typecheck` and reports errors. | **Yes.** It ran after each save of `src/lib/scoring.ts` made with the editor's edit tool (twice), and its output matched the hook's prompt. A sub-agent's report during `graveyard-ui` task 1.1 also carried lint and typecheck results, including one lint error that I then fixed. |
| `scoring-tests-on-save` | `PostFileSave` on `scoring.ts` or `epitaphs.ts` | Runs the scoring tests, including property tests, and summarizes failures. | **Yes, on editor saves only.** I added a comment to `src/lib/scoring.ts` and removed it again, both with the edit tool. The hook fired both times and the tests passed (4 files, 24 tests). An earlier attempt that wrote the file from the terminal did not trigger it. |
| `readme-feature-list-on-task-complete` | `PostTaskExec` | Updates the Features list in `README.md`. | **Yes, once.** It fired when `graveyard-ui` task 1.1 was marked completed. It made no change to `README.md` because a types-only task adds no feature. |
| `design-tokens-on-save` | `PostFileSave` in `src/components/` | Flags hard-coded colors and off-scale values against `design-system.md`. | **No evidence.** No file in `src/components/` was saved with the edit tool in the session I can see. I can't say whether it ran earlier. |

Corrections to the earlier draft of this file:

- It said `src/lib/scoring.ts` and `epitaphs.ts` do not exist. Both exist and are tracked by git, so `scoring-tests-on-save` can run.
- It said the lint hook "ran many times during development". I can't verify that from the repo, so I replaced it with the firings I saw.
- It said the README hook had never fired. It has fired once, and it made no edit.

Git history of `README.md` (6 commits, 2026-11-18 to 2026-11-21) does not show whether any of those edits came from the hook, because the commit messages don't say.

> **TODO (you):** add a screenshot or a note of a hook firing in the IDE, and say whether one of them ever caught a real mistake. The one catch I can document is the lint error in `src/lib/graveyard/types.ts` during task 1.1.
>
> **TODO (you):** say whether `design-tokens-on-save` ever fired for you.

## MCP

`.kiro/settings/mcp.json` holds two servers, committed in `a2ce960` and `582418e`:

- **`github`**: GitHub's hosted read-only server. It reads its token from `${GITHUB_MCP_TOKEN}`, so no token value is in any file. It exposes 31 tools and none create, update or delete anything, so it is safe to leave on. The Actions toolset is enabled with `X-MCP-Toolsets: default,actions`. Example: asking it for the latest commits of this repo returned the commits shown by `git log`. The workflow-runs check had to look at a different repo, because Repo-Graveyard has no CI workflow.
- **`playwright`**: the official `@playwright/mcp` run through `npx` with your installed Chrome. It opens the running app, takes screenshots and reads computed styles, so the design audits quote measured values instead of guesses. Screenshots are in `docs/screenshots/`: `before-starter-page.png` (commit `0a9e390`), plus `after-landing`, `after-graveyard` and `after-drawer` at desktop and 360 px widths, and two `landing-` shots (commit `40fe0aa`). I did not open the images to check what they show.

Lesson from the repo: the Playwright MCP reloaded the page on each action, which made keyboard-focus checks unreliable. For those I switched to a short Playwright script. The app was fine.

> **TODO (you):** say whether the MCP servers changed how you work.

## Property-based testing

The idea: instead of writing example inputs, describe a rule that must hold for all inputs and let fast-check generate hundreds of cases.

- **Designed:** 76 properties across four designs (16 ingestion, 19 scoring, 18 graveyard logic, 23 resurrection). Examples from `death-scoring/design.md`: score is always an integer from 0 to 100; more inactivity never lowers the score; archived repos are always ancient; failing CI never lowers the score.
- **Implemented:** 22 files named `*.property.test.ts` and 32 test files that import fast-check, under `src/`. I did not count individual properties, so I make no claim about how many of the 76 are covered.
- **Current result:** the last full `npm run test` in the session that updated this file passed with 85 files and 645 tests.

> **TODO (you):** report how many real bugs fast-check found and show one shrunk counterexample here. I have no such result from this repo.

## The gravedigger agent

`.kiro/agents/gravedigger.md` is a custom agent whose job is to polish the UI against `design-system.md`.

- **Workflow in its prompt:** open the page with the Playwright MCP and take a screenshot, list every violation (colors, fonts, spacing, motion, accessibility, touch targets) with the token it should use, fix them with CSS variables only, run lint and typecheck, take a second screenshot and report what changed.
- **Permissions, not just instructions:** it may write only under `src/components/**`, `src/styles/**` and `src/app/globals.css`. It is denied `src/app/api/**`, `src/lib/**`, auth, scoring, GitHub, config files, tests and `.kiro/**`. Dependency commands (`npm install`, `npx`) ask first, and `git commit` and `git push` are denied.
- **Evidence the permissions work:** while the agent profile was active, two attempts to widen its allow list (to add `src/app/layout.tsx` and `page.tsx`) were blocked by its own `.kiro/**` deny rule. The widening was never applied: the committed file (`0a9e390`) still allows only the three paths above.
- **What it audited:** the same checklist found real violations on the starter page (white background, Geist and Arial fonts, hard-coded hover colors, 128 px padding, text links shorter than 44 px). The token and font fixes that followed are in `globals.css` and `layout.tsx`.

> **TODO (you):** say whether you actually ran the `gravedigger` agent end to end from the agent picker. I ran the same audit steps myself in the default agent, and I never launched this agent.

## Powers

No Powers are installed (the Powers tool in the session that updated this file reported none, and nothing in this repo references one).

> **TODO (you):** if you used any Power during the hackathon, describe it here with one concrete example. Otherwise say "we did not use Powers" and, if you like, one line on why (for example: the GitHub and Playwright MCP servers covered the need).

## What did not go smoothly

Honest notes that judges tend to like:

- Spec work got ahead of implementation: 128 task lines are unchecked, and `graveyard-ui` has 1 of 51 checked.
- The CSS Modules problem: the Tailwind loader rule in `next.config.ts` broke class scoping, so components use plain CSS with prefixed class names. The `project-scaffold` design proposes fixing this.
- A Playwright test written ahead of the pages (`e2e/demo-path.spec.ts`) failed Vitest until `vitest.config.ts` excluded `e2e/`. Commit `40fe0aa` is titled "demo path passes".
- Git history oddity: commit `892d8e9` is titled "add Kiro hooks and submission guard" but contains only `LICENSE`. The hooks are in `35edaf2`, which has the same title. Commit `99bc0b0` is titled "type: short description", a leftover template message.
- Terminal writes do not trigger save hooks. Only saves through the editor (or the agent's edit tool) did, so a hook test done from a shell shows nothing.
- Uncommitted work at the time of writing: `eslint.config.mjs`, `.kiro/specs/graveyard-ui/tasks.md`, `.kiro/specs/graveyard-ui/tasks.meta.json`, `src/lib/graveyard/types.ts` and `src/lib/graveyard/types.test.ts`, plus this file's edits.

> **TODO (you):** add your own two or three biggest surprises, good and bad, in your own words.

## Fill-in checklist

1. Hours spent and the hackathon window.
2. Which Kiro surface (IDE or CLI) for which activity.
3. Your verdict on specs vs vibe coding.
4. How you ran the spec tasks (task runner or by hand).
5. A screenshot of a hook firing, and whether a hook caught a real mistake.
6. Whether `design-tokens-on-save` ever fired for you.
7. Whether the MCP servers changed how you work.
8. Whether you ran `gravedigger` yourself.
9. Whether you used any Power.
10. Whether fast-check found real bugs, with one shrunk counterexample.
11. Your own surprises.
12. Commit the uncommitted work, and consider a README note about the `892d8e9` commit message.
