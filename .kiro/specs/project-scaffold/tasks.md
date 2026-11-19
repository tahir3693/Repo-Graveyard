# Implementation Plan: Project Scaffold

## Overview

Reconcile the partially scaffolded repository with the requirements through small, targeted edits. Do not re-run `create-next-app`, because it would overwrite `AGENTS.md`, `.gitignore`, and `package.json`. Before editing any Next.js file, read the matching guide in `node_modules/next/dist/docs/`. Do not touch `AGENTS.md` or create a `LICENSE`. The design has no Correctness Properties section, so this plan has no property-based test tasks.

## Tasks

- [ ] 1. Update dependency manifest and Tailwind pipeline
  - [ ] 1.1 Update `package.json` scripts and Tailwind dependencies
    - Set scripts to exactly: `dev` = `next dev`, `build` = `next build`, `start` = `next start`, `lint` = `eslint`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `e2e` = `playwright test`
    - Add `@tailwindcss/postcss` to `devDependencies` at the same version as `tailwindcss`
    - Remove `@tailwindcss/turbopack`
    - Leave `@google/genai` in place and do not modify other dependencies
    - Keep `next`, `eslint-config-next`, `react`, and `react-dom` pinned
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.5_

  - [ ] 1.2 Switch Tailwind to the documented PostCSS setup
    - Read `node_modules/next/dist/docs/01-getting-started/11-css.md`, `cacheComponents.md`, and `partialPrefetching.md` first
    - Create `postcss.config.mjs` with the `@tailwindcss/postcss` plugin
    - Edit `next.config.ts` to remove the `turbopack.rules` block, keeping `cacheComponents` and `partialPrefetching`
    - Leave `src/app/globals.css` unchanged
    - _Requirements: 1.3, 2.1, 2.2, 2.4_

- [ ] 2. Replace app placeholder content
  - [ ] 2.1 Update layout metadata
    - Read the layout file-convention guide under `node_modules/next/dist/docs/03-api-reference/03-file-conventions/` first
    - Change only `metadata` in `src/app/layout.tsx`: title and description set to "Repo-Graveyard"
    - _Requirements: 1.1, 2.1, 2.2_

  - [ ] 2.2 Rewrite `src/app/page.tsx` as a static placeholder
    - Synchronous Server Component with a `<main>` and an `<h1>` showing "Repo-Graveyard", using Tailwind utilities such as `text-3xl` and `p-8`
    - No imports, links, buttons, form controls, event handlers, hooks, or `"use client"`
    - Add no `not-found.tsx`, API routes, or auth files
    - _Requirements: 1.3, 1.4, 9.1, 9.2, 9.3, 9.4, 9.6_

- [ ] 3. Add testing and formatting configuration
  - [ ] 3.1 Create `vitest.config.mts`
    - Include `src/**/*.test.{ts,tsx}`, exclude `e2e/**` and `node_modules/**`, set `passWithNoTests: true`
    - _Requirements: 4.3, 4.6, 4.7_

  - [ ] 3.2 Create `playwright.config.ts` and `e2e/.gitkeep`
    - Read `node_modules/next/dist/docs/02-guides/testing/playwright.md` first
    - Set `testDir: "./e2e"`, `baseURL` `http://localhost:3000`, and a `webServer` running `npm run dev` with `reuseExistingServer: true`
    - Create an empty `e2e/.gitkeep`
    - _Requirements: 4.4_

  - [ ] 3.3 Create `.prettierrc.json`
    - Set `semi: true`, `singleQuote: false`, `trailingComma: "all"`
    - _Requirements: 4.5_

- [ ] 4. Update git ignore rules
  - [ ] 4.1 Rewrite `.gitignore`
    - Replace the duplicate unanchored `.env*` rules with `/.env*` and `!/.env.example`
    - Add `/playwright-report/` and `/test-results/`, and keep `/node_modules`, `/.next/`, `/out/`, `/coverage`
    - End with `!/.kiro/` and `!/.kiro/**`
    - Leave `.env.example` unchanged
    - _Requirements: 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 5. Install dependencies and verify the scaffold
  - [ ] 5.1 Run `npm install` and check the dependency tree
    - Run `npm install` with no `--force` or `--legacy-peer-deps` flags to refresh `package-lock.json`
    - Fix version specifiers if `ERESOLVE` appears
    - Run `npm ls` and confirm no `invalid` or `missing` packages
    - Confirm `package-lock.json` records versions for all runtime dependencies
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [ ] 5.2 Run lint, typecheck, test, and build
    - Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`, each expecting exit code 0
    - Fix any failures at their source
    - Confirm `"strict": true` in `tsconfig.json`
    - Run `npx prettier --check .prettierrc.json`
    - _Requirements: 1.2, 1.5, 1.7, 4.5, 4.6, 4.8, 5.7, 5.8, 5.9_

  - [ ] 5.3 Verify git ignore behavior
    - Run `git check-ignore -v` and confirm ignored (exit 0): `node_modules/x`, `.env.local`, `.env.production`, `.env.development.local`, `.next`, `out`, `coverage`, `playwright-report`, `test-results`
    - Confirm not ignored (exit 1): `.env.example`, `.kiro/specs/project-scaffold/requirements.md`, and a temporary `.kiro/specs/tmp/.env.test` file, then delete the temporary file
    - _Requirements: 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 5.4 Verify env template, protected files, and no product code
    - Confirm `.env.example` has exactly the five `NAME=` lines with empty values
    - Confirm `git diff --stat AGENTS.md` is empty and `LICENSE` is absent
    - Search `src/` for imports of `next-auth`, `octokit`, `zod`, `framer-motion`, and for route or auth files; expect none
    - _Requirements: 2.5, 6.1, 6.2, 6.3, 6.4, 8.1, 8.3, 9.1, 9.3, 9.4_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Report to the user: `LICENSE` is absent and was not created; `@google/genai` is declared outside the agreed dependency sets and was left in place pending their decision; `@tailwindcss/turbopack` was replaced by `@tailwindcss/postcss`; `AGENTS.md` is unchanged.
  - _Requirements: 2.3, 8.3, 8.4, 9.5_

## Notes

- Tasks marked with `*` are optional. This plan has none, because the design has no testable correctness properties.
- Each task references specific requirements for traceability.
- Read the relevant Next.js docs before editing Next.js files, as `AGENTS.md` requires.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "3.3", "4.1"] },
    { "id": 1, "tasks": ["5.1"] },
    { "id": 2, "tasks": ["5.2", "5.3", "5.4"] }
  ]
}
```
