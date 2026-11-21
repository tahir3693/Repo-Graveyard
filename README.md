# Repo Graveyard

A haunted dashboard for your unfinished GitHub projects. Each abandoned repo becomes a tombstone in a graveyard scene. Fixed rules score how abandoned it is, and an AI writes a revival plan and a ready-to-file GitHub issue to bring it back.

Built for students, freelancers and hobbyists with too many half-finished repos. The tone is dark humor that jokes about a repo's fate, never about you. A repo is paused, not failed.

> **Project status:** work in progress. The design system, tombstone, graveyard scene and resurrection animation are built. Sign-in, GitHub scanning, scoring, the graveyard page and the AI routes are specified in `.kiro/specs/` and not yet implemented. See [Features](#features) for what works today.

![Screenshot placeholder: the graveyard scene with tombstones, fog and a moon](docs/screenshot.png)

*Screenshot coming soon. Save one as `docs/screenshot.png` and it will show up here.*

## Features

Status: **built** works today, **specified** has a full spec but no code yet.

- **Tombstone** (built): one stone per repo, with the name, status, epitaph, a rising entrance, a hover lift and a flickering candle glow.
- **Graveyard scene** (built): a moon and sky whose brightness follows how many repos are alive, three drifting fog layers, and subtle pointer parallax. Pure SVG and CSS.
- **Resurrection animation** (built): fog parts around the stone, the stone glows, then the revival plan fades in. It includes loading and error states and finishes in 1.4 seconds after the plan arrives.
- **Design system** (built): dark palette, Cinzel and Inter fonts, spacing, radius and motion tokens as CSS variables. Reduced motion is respected everywhere.
- **Sign in with GitHub** (specified): Auth.js with the narrowest scope that works, `public_repo`.
- **Scan** (specified): `POST /api/scan` reads your repos with Octokit on the server, handles pagination and rate limits, skips forks by default, and validates every response with Zod.
- **Death score** (built): `scoreRepo` gives a 0 to 100 score, a status, a cause of death, an epitaph and scene values from fixed rules; only the status and cause rules are tested so far. No AI in scoring.
- **Graveyard page** (specified): summary counts, filters, sorting, a plain list view and a detail drawer.
- **Resurrect and File this issue** (specified): `POST /api/resurrect` builds a revival plan, and `POST /api/issue` files it only for the repo's owner and never in demo mode.
- **Demo mode** (specified): try the graveyard on a fixed public account with no login.

Every spooky element carries data. Fog thickness is days of inactivity, a lit candle is recent activity, cracks are failing CI, vines are outdated dependencies, and a bigger stone is more stars.

## How it works

1. **Sign in or try the demo.** Sign in with GitHub, or open the demo graveyard with no account.
2. **Scan.** The server reads your repositories from GitHub and checks every response against a Zod schema.
3. **Score.** Fixed rules turn each repo's facts into a death score, a status, a cause of death and an epitaph. The same input always gives the same result.
4. **Visit the graveyard.** Each repo is a tombstone. Fog, candle, cracks, vines and size show its condition.
5. **Resurrect.** Open a tombstone and click Resurrect. The server gathers a small, length-capped bundle of repo context and asks an LLM for a plan. The plan is validated, then you can file it as a GitHub issue.

AI writes, rules judge. The LLM only writes the revival plan and the issue text. It never scores anything.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) and React 19, with strict TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4 and plain CSS using design tokens
- [Framer Motion](https://www.framer.com/motion/) for animation
- [Auth.js](https://authjs.dev) (`next-auth` v4) with the GitHub provider
- [Octokit](https://github.com/octokit/octokit.js) for GitHub API calls, server-side only
- [Zod](https://zod.dev) for runtime validation
- [Google Gen AI SDK](https://www.npmjs.com/package/@google/genai) behind a provider-agnostic adapter, server-side only
- [Vitest](https://vitest.dev) and [fast-check](https://fast-check.dev) for unit and property tests
- [Playwright](https://playwright.dev) for end-to-end tests

There is no database. State lives in memory or in the Auth.js session.

## Setup

You need Node.js 20 or newer and a GitHub account.

### 1. Clone and install

```bash
git clone https://github.com/tahir3693/Repo-Graveyard.git
cd Repo-Graveyard
npm install
```

### 2. Create a GitHub OAuth App

1. Open GitHub, then **Settings**, **Developer settings**, **OAuth Apps**, **New OAuth App**.
2. Set **Homepage URL** to `http://localhost:3000`.
3. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`.
4. Register the app, copy the **Client ID**, and generate a **Client secret**.

### 3. Fill in `.env.local`

```bash
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local`.

| Variable | What to put there |
|---|---|
| `GITHUB_ID` | The OAuth App's Client ID. |
| `GITHUB_SECRET` | The OAuth App's Client secret. |
| `AUTH_SECRET` | A random string that signs session cookies. Generate one with `openssl rand -base64 32`. |
| `LLM_API_KEY` | Your LLM provider key, used only on the server to write revival plans. |
| `GITHUB_DEMO_TOKEN` | Optional. A GitHub token with no scopes. It raises rate limits for demo mode. |

`.env.local` is ignored by git. Never commit it, and never put a real value in `.env.example`.

The specs also name `NEXTAUTH_URL` (set it to `http://localhost:3000`), `GITHUB_DEMO_USERNAME` (the public account that demo mode scans) and `LLM_MODEL`. These are not in `.env.example` yet.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Try the demo mode

Demo mode lets anyone explore the graveyard with no login:

1. Open the landing page.
2. Click **Try demo graveyard**. You go to `/graveyard?demo=1`.
3. Click a tombstone to open its drawer, then click **Resurrect** to see a revival plan.

Demo mode scans one fixed public account that the server chooses. It is read-only, its results are cached for a few minutes, and **File this issue** is disabled in it. Setting `GITHUB_DEMO_TOKEN` gives it higher GitHub rate limits.

The landing page, graveyard page and demo routes are still specified, not built, so this flow does not run yet.

## Tests

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint, including rules that keep server-only code and secrets out of client files. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest unit tests and fast-check property tests, which live next to the code as `*.test.ts`. |
| `npm run e2e` | Playwright end-to-end tests in `e2e/`. They build the app, start it on port 3100 and run in your installed Google Chrome. |

The end-to-end demo path test (`e2e/demo-path.spec.ts`) mocks `/api/scan` and `/api/resurrect`. It is written ahead of the pages it drives, so it fails until the landing page and graveyard page exist.

## How Kiro was used

This project was built with [Kiro](https://kiro.dev), with the rules written down before the code.

### Steering

Always-on rules in `.kiro/steering/`:

- `product.md`: what the app is, the audience, the tone and the glossary.
- `tech.md`: the stack, the server-and-secrets rules, validation, pure scoring, no database, testing.
- `design-system.md`: palette, fonts, spacing, motion, the visual vocabulary, epitaph voice and accessibility. Components must use its CSS variables, never hard-coded colors.
- `submission-guard.md`: a pre-submission checklist you run with `/submission-guard`.

### Specs

Five specs in `.kiro/specs/`, each with requirements in EARS format, a design and a task list:

- `project-scaffold`: the Next.js base and tooling.
- `auth-ingestion`: GitHub sign-in and the scan route.
- `death-scoring`: the deterministic score, status, cause and epitaph.
- `graveyard-ui`: the landing page, graveyard, filters and drawer.
- `resurrection`: the revival plan, the issue route and prompt-injection handling.

The Tombstone, graveyard scene and resurrection animation were built directly, with no spec, to compare the two ways of working.

### Hooks

Agent hooks in `.kiro/hooks/`:

- Lint and typecheck on every `.ts` or `.tsx` save.
- Run the scoring tests, including the property tests, when `scoring.ts` or `epitaphs.ts` is saved.
- Check for hard-coded colors whenever a file in `src/components` is saved.
- Update the feature list in this README when a spec task is completed.

### MCP

Configured in `.kiro/settings/mcp.json`:

- **GitHub MCP** (read-only): used to list repositories, read commits and read workflow runs. It reads its token from the `GITHUB_MCP_TOKEN` environment variable, so no token is stored in any file.
- **Playwright MCP**: opens the running app in Chrome, takes screenshots and reads computed styles, so the design-system audits use real measurements.

### Custom agent

`gravedigger` in `.kiro/agents/` polishes the UI against the design system. It may edit only the UI files and never scoring, API, auth or GitHub code.

### Property-based tests

The specs define 74 correctness properties across the four code specs (16 for ingestion, 17 for scoring, 18 for the UI logic and 23 for resurrection). They cover things like:

- the score is always an integer from 0 to 100
- more inactivity never lowers the score
- archived repos are always ancient
- failing CI never lowers the score
- the same input always gives the same output
- every epitaph is bounded and clean
- context capping and plan parsing hold for all inputs

fast-check runs them over generated inputs. Two property suites exist today, for the moon brightness rule and the resurrect state machine. The rest are specified and will be implemented with their specs.

## License

[MIT](LICENSE)
