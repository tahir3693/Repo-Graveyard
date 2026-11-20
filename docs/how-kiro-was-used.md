# How Kiro was used to build Repo Graveyard

Draft write-up for the hackathon submission (Costume Contest category).

Every number and example below was read from this repo: the `.kiro/` folder, `git log`, the `tasks.md` files and the source. Anything I could not verify from the repo is marked **TODO (you)**. Fill those in yourself. Please don't let anyone guess for you.

## At a glance

| Kiro feature | What exists in the repo |
|---|---|
| Steering | 4 files in `.kiro/steering/`: `product.md`, `tech.md`, `design-system.md`, `submission-guard.md` |
| Specs | 5 specs in `.kiro/specs/` (requirements, design, tasks), about 588 KB of Markdown |
| Hooks | 4 agent hooks in `.kiro/hooks/` |
| MCP | 2 servers in `.kiro/settings/mcp.json`: `github` (read-only) and `playwright` |
| Custom agent | `gravedigger` in `.kiro/agents/gravedigger.md` |
| Property-based tests | 74 properties designed across 4 specs, 2 implemented so far |
| Powers | None installed |

Git history: 6 commits from 2026-11-18 to 2026-11-20.

> **TODO (you):** add the total time you spent and how much of it was the hackathon window.

## IDE vs CLI

What the repo shows:

- Custom agents, hooks and MCP config are plain files under `.kiro/`, so they work the same way in the Kiro IDE and in Kiro CLI. The agent file `gravedigger.md` uses the Markdown format with YAML settings at the top, which Kiro documents for both IDE 1.0 and CLI V3.
- The two save hooks use the `PostFileSave` trigger and the README hook uses `PostTaskExec`. Kiro's docs list both as available in the IDE and in CLI V3.
- A manual hook cannot be created in the IDE, so the pre-submission check is a steering file with `inclusion: manual` in `.kiro/steering/submission-guard.md`. You run it by typing `/submission-guard` in chat.
- `AGENTS.md` (from `create-next-app`) tells the agent that this Next.js version has breaking changes and to read `node_modules/next/dist/docs/` first. The agent follows it for every Next.js change.

> **TODO (you):** say which surface you used for each activity. I only know the session that produced this draft ran in the IDE. For example: "spec authoring in the IDE, ... in the CLI". If you never used the CLI, say that plainly.

## Specs vs vibe coding

I used both, on purpose, so you can compare them.

**Spec-driven (5 specs).** The specs were written first and are far larger than the code so far.

| Spec | Requirements | Correctness properties | Task lines |
|---|---|---|---|
| `project-scaffold` | 9 | 0 (config and a static page) | 18 |
| `auth-ingestion` | 11 | 16 | 48 |
| `death-scoring` | 13 | 17 | 31 |
| `graveyard-ui` | 21 | 18 | 51 |
| `resurrection` | 18 | 23 | 80 |

Concrete examples from the specs:

- Requirements are in EARS format with exact numbers. `resurrection/requirements.md` fixes context caps (README 6,000 characters, 10 commit messages, 10 issue titles), timeouts (25 s per LLM attempt) and rate limits (10 resurrects per 600 s per login, 5 issues).
- Each design records the decisions it settled. The resurrection design keeps `@google/genai`, sets the model with an `LLM_MODEL` variable, and turns the SDK's own retries down to 1 so the "2 LLM calls at most" rule holds.
- Each spec ends in a task list with a dependency graph in waves.

**Vibe-coded (no spec).** Three components were built directly from a short prompt each:

- `src/components/Tombstone.tsx`: rising entrance, hover lift, flickering candle glow.
- `src/components/GraveyardScene.tsx`: moon and sky tied to the alive share, three fog layers, pointer parallax.
- `src/components/ResurrectArea.tsx`: the fog-parting reveal with loading and error states.

`docs/tombstone-iterations.md` keeps a log of feedback rounds for the Tombstone. It currently shows 1 iteration.

**Comparison from this repo:**

- Vibe coding reached something visible fast. Its misses were small and found by looking at it: the Tombstone's CSS Module did not apply (the project's `next.config.ts` sends every `*.css` file through the Tailwind loader), and `ResurrectArea` rendered a different scale on the server and in the browser, which caused a hydration warning.
- The specs caught problems before any code existed. For example, reading the death-scoring rules showed a contradiction: a repo untouched for 29 days with failing CI, outdated dependencies and no README scores 28 (dying), yet the cause rules label it "Still active". This was found by hand-running the formulas. It is not written down in a repo file yet, so add it to `death-scoring/design.md` if you want to cite it.
- The cost of specs: all 228 task checkboxes are still unchecked (0 done), and none of the spec code has been built yet.

> **TODO (you):** your own verdict. Which approach did you prefer, and when? Add real numbers if you have them (hours per spec, hours per component).
>
> **TODO (you):** decide whether to run the spec tasks with Kiro's task runner before submitting. Today the README hook (below) has never fired, because no task has been completed through Kiro.

## Steering

Four files, all committed in `35edaf2`:

- `product.md`: the product, audience (students, freelancers, hobbyists), the tone rule ("joke about the repo's fate, never about the person") and a glossary (tombstone, death score, status, cause of death, epitaph, resurrect).
- `tech.md`: the stack and hard rules. Examples that later shaped the specs and code: "Scoring is a pure function with no I/O", "AI is never used for scoring", "No database in v1", and "Every external response (GitHub, LLM) is validated with Zod before use".
- `design-system.md`: the palette as CSS variables, Cinzel and Inter fonts, spacing and radius scales, motion rules and a visual vocabulary where every spooky element maps to one data field (fog is days inactive, candle is recent activity, cracks are failing CI, vines are outdated dependencies, stone size is stars). The rule "components must use the CSS variables, never hard-coded colors" is enforced by a hook and an agent.
- `submission-guard.md`: a manual checklist for `.kiro` not ignored, MIT license, no tracked secrets, README setup instructions.

Concrete effects:

- `globals.css` now defines every token from `design-system.md` with the exact values it gives (commit `0a9e390`).
- Components use those variables only. A scan of `Tombstone`, `GraveyardScene`, `ResurrectArea` and `SkipLink` found no hard-coded colors.
- A planned security audit expected `.kiro/steering/security.md`, which does not exist. The audit used the server-and-secrets rules in `tech.md` instead.

## Hooks

Four agent hooks in `.kiro/hooks/`, committed in `35edaf2`:

| Hook | Trigger | What it does |
|---|---|---|
| `lint-typecheck-on-save` | `PostFileSave` on `.ts` and `.tsx` | Runs `npm run lint` and `npm run typecheck` and reports errors. |
| `design-tokens-on-save` | `PostFileSave` in `src/components/` | Flags hard-coded colors and off-scale values against `design-system.md`. |
| `scoring-tests-on-save` | `PostFileSave` on `scoring.ts` or `epitaphs.ts` | Runs the scoring tests, including property tests, and summarizes failures. |
| `readme-feature-list-on-task-complete` | `PostTaskExec` | Updates the Features list in `README.md`. |

What I can say honestly:

- The lint and typecheck hook ran many times during development after saves of `.ts` and `.tsx` files.
- `scoring-tests-on-save` has never run: `src/lib/scoring.ts` and `epitaphs.ts` do not exist yet.
- `readme-feature-list-on-task-complete` has never run, for the reason above. The README already has the "Features" heading it looks for.

> **TODO (you):** add a screenshot or a note of a hook firing in the IDE, and say whether one of them ever caught a real mistake.

## MCP

`.kiro/settings/mcp.json` holds two servers, committed in `a2ce960` and `582418e`:

- **`github`**: GitHub's hosted read-only server. It reads its token from `${GITHUB_MCP_TOKEN}`, so no token value is in any file. It exposes 31 tools and none create, update or delete anything, so it is safe to leave on. The Actions toolset is enabled with `X-MCP-Toolsets: default,actions`. Example: asking it for the latest commits of this repo returned the commits shown by `git log`. The workflow-runs check had to look at a different repo, because Repo-Graveyard has no CI workflow.
- **`playwright`**: the official `@playwright/mcp` run through `npx` with your installed Chrome. I used it to open the running app, take screenshots and read computed styles, so the design audits quote measured values instead of guesses. The "before" screenshot is committed as `docs/screenshots/before-starter-page.png`.

Lesson from the repo: the Playwright MCP reloaded the page on each action, which made keyboard-focus checks unreliable. For those I switched to a short Playwright script. The app was fine.

> **TODO (you):** add an "after" screenshot to `docs/screenshots/` once the real landing and graveyard pages exist, and say whether the MCP servers changed how you work.

## Property-based testing

The idea: instead of writing example inputs, describe a rule that must hold for all inputs and let fast-check generate hundreds of cases.

- **Designed:** 74 properties across four designs (16 ingestion, 17 scoring, 18 graveyard logic, 23 resurrection). Examples from `death-scoring/design.md`: score is always an integer from 0 to 100; more inactivity never lowers the score; archived repos are always ancient; failing CI never lowers the score.
- **Implemented so far:** 2, both with 200 runs. `moon.test.ts` checks that moon brightness stays between 0.25 and 1 and never drops as more repos are alive. `resurrect-state.test.ts` checks that, for any sequence of actions, the success state is only reachable through loading.
- **Current result:** `npm run test` passes with 20 tests in 3 files.
- **Review finding:** reviewing the scoring properties found that none of the 17 would catch the "dying but still active" contradiction above. A coherence property (a non-archived repo is `still_active` only when it is alive) would catch it. I listed this and other missing properties in review but did not add them to the spec.

> **TODO (you):** if you implement `death-scoring`, report how many real bugs fast-check found and show one shrunk counterexample here. I have no such result from this repo yet.

## The gravedigger agent

`.kiro/agents/gravedigger.md` is a custom agent whose job is to polish the UI against `design-system.md`.

- **Workflow in its prompt:** open the page with the Playwright MCP and take a screenshot, list every violation (colors, fonts, spacing, motion, accessibility, touch targets) with the token it should use, fix them with CSS variables only, run lint and typecheck, take a second screenshot and report what changed.
- **Permissions, not just instructions:** it may write only under `src/components/**`, `src/styles/**` and `src/app/globals.css`. It is denied `src/app/api/**`, `src/lib/**`, auth, scoring, GitHub, config files, tests and `.kiro/**`. Dependency commands (`npm install`, `npx`) ask first, and `git commit` and `git push` are denied.
- **Evidence the permissions work:** while the agent profile was active, two attempts to widen its allow list (to add `src/app/layout.tsx` and `page.tsx`) were blocked by its own `.kiro/**` deny rule. The widening was never applied: the committed file (`0a9e390`) still allows only the three paths above, so changes to `layout.tsx` and `page.tsx` are reported as out of scope.
- **What it audited:** the same checklist found real violations on the starter page (white background, Geist and Arial fonts, hard-coded hover colors, 128 px padding, text links shorter than 44 px). The token and font fixes that followed are in `globals.css` and `layout.tsx`.

> **TODO (you):** say whether you actually ran the `gravedigger` agent end to end from the agent picker. I ran the same audit steps myself in the default agent, and I never launched this agent.

## Powers

No Powers are installed (`~/.kiro/powers/installed.json` has an empty list) and nothing in this repo references one.

> **TODO (you):** if you used any Power during the hackathon, describe it here with one concrete example. Otherwise say "we did not use Powers" and, if you like, one line on why (for example: the GitHub and Playwright MCP servers covered the need).

## What did not go smoothly

Honest notes that judges tend to like:

- Spec work got ahead of implementation: 228 unchecked tasks next to 17 source files.
- The CSS Modules problem: the Tailwind loader rule in `next.config.ts` broke class scoping, so components use plain CSS with prefixed class names. The `project-scaffold` design proposes fixing this.
- A Playwright test written ahead of the pages (`e2e/demo-path.spec.ts`) failed Vitest until `vitest.config.ts` excluded `e2e/`.
- Git history oddity: commit `892d8e9` is titled "add Kiro hooks and submission guard" but contains only `LICENSE`. The hooks and specs are in `35edaf2`, which has the same title.
- Uncommitted work: `src/components/`, `src/lib/`, `e2e/`, `playwright.config.ts`, `vitest.config.ts`, `docs/` additions and the README rewrite are not committed yet.

> **TODO (you):** add your own two or three biggest surprises, good and bad, in your own words.

## Fill-in checklist

1. Hours spent and the hackathon window.
2. Which Kiro surface (IDE or CLI) for which activity.
3. Your verdict on specs vs vibe coding.
4. A screenshot of a hook firing, and whether a hook caught a real mistake.
5. An "after" screenshot for the MCP section.
6. Whether you ran `gravedigger` yourself.
7. Whether you used any Power.
8. Whether fast-check found real bugs once scoring is implemented.
9. Your own surprises.
10. Commit the uncommitted work, and consider fixing the `892d8e9` commit message with a note in the README.
