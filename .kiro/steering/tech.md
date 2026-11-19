# Repo Graveyard: Tech

## Stack

- Next.js App Router with strict TypeScript
- Tailwind CSS
- Framer Motion
- Auth.js (`next-auth`) with the GitHub provider
- Octokit for GitHub API calls
- Zod for runtime validation
- Vitest and fast-check for unit and property tests
- Playwright for end-to-end tests

This Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).

## Rules

### Server and secrets

- All GitHub and LLM calls happen in server routes only. Client components never call GitHub or an LLM provider.
- Tokens and API keys (`GITHUB_SECRET`, `AUTH_SECRET`, `LLM_API_KEY`, `GITHUB_DEMO_TOKEN`, user access tokens) never reach the client and never appear in logs, error messages or responses.
- Read secrets from environment variables. Never hard-code them. Only variable names go in `.env.example`.

### Validation

- Every external response (GitHub, LLM) is validated with Zod before use. Do not use unvalidated data or type assertions on external data.
- Validate request input on server routes with Zod too.
- Handle validation failure explicitly and return a safe, generic error to the client.

### Scoring

- Scoring is a pure function with no I/O: no network, no filesystem, no clock reads, no randomness. Pass the current time in as an argument.
- The same input always gives the same death score, status and cause of death.
- AI is never used for scoring.

### Data

- No database in v1. Do not add one. Fetch data per request and keep any state in memory or in the Auth.js session.

### Code style

- Prefer small functions with a single purpose.
- Use named exports. Avoid default exports except where Next.js requires them (such as `page.tsx` and `layout.tsx`).
- Keep UI components free of data fetching and scoring logic.

### Testing

- Every new function in `src/lib` gets unit tests with Vitest.
- Use fast-check for properties that should hold for all inputs, especially scoring and validation.
- Playwright tests live in `e2e/`. Unit tests live next to the code as `*.test.ts` or `*.test.tsx`.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: `vitest run`
- `npm run e2e`: `playwright test`
