# Design Document

## Overview

This design reconciles the partially scaffolded repository with `requirements.md`. The repository already holds a Next.js 16.4.6 App Router app with React 19.3, TypeScript strict mode, ESLint 9, and most dependencies installed. The work is a set of small, targeted edits to configuration files plus one placeholder page. No product feature is built.

Gaps found by inspecting the repository and `node_modules/next/dist/docs/`:

| Area | Current state | Gap | Requirement |
| --- | --- | --- | --- |
| Tailwind | `next.config.ts` routes `*.css` through `@tailwindcss/turbopack`. No `postcss.config.mjs`. | The Next docs (`01-getting-started/11-css.md`) document `@tailwindcss/postcss` with a `postcss.config.mjs`. The loader rule is a non-documented default and must be replaced. | 1.3, 2.2 |
| Home page | Default create-next-app page with images, links, and "Deploy Now" buttons. | Must be a static placeholder showing "Repo-Graveyard" with no interactive elements. | 9.2 |
| Layout metadata | Title is "Create Next App". | Should name the project. | 1 |
| Scripts | `dev`, `build`, `start`, `lint` only. | Missing `typecheck`, `test`, `e2e`. | 5 |
| Vitest | No config. | Needs config scoped to `src`, excluding `e2e`, passing with no tests. | 4.3, 4.6 |
| Playwright | No config. | Needs config scoped to `e2e`. | 4.4 |
| Prettier | No config. | Needs a config file. | 4.5 |
| `.gitignore` | `.env*` is unanchored and matches files in any directory, including under `.kiro`. Missing `playwright-report` and `test-results`. Duplicate env rules. | Anchor env rules to the root, add missing paths, guarantee `.kiro` is tracked. | 7 |
| `.env.example` | Five required names, empty values, comments only. | Already compliant. No change. | 6 |
| `package.json` | All required dependencies present. `@google/genai` is extra. `@tailwindcss/turbopack` becomes unused. | Add `@tailwindcss/postcss`. Report `@google/genai` and leave it. | 3, 9.5 |
| `LICENSE` | Absent from the repository. | Do not create one. Report the absence. | 8.3 |
| `AGENTS.md` | Present. | Must not be touched. | 2.5 |

### Design decisions

1. **Edit, do not regenerate.** Running `create-next-app` again would overwrite `AGENTS.md`, `.gitignore`, and `package.json`. Each change is a targeted edit.
2. **Follow the Next docs over the existing default.** Requirement 2.2 requires it. The Tailwind setup is the one place where the repository differs from the docs, so it is switched to `@tailwindcss/postcss`.
3. **Keep `cacheComponents` and `partialPrefetching`.** `cacheComponents.md` and `partialPrefetching.md` document both flags together in `next.config.ts`. They are already set, are not in conflict with any requirement, and removing them would be an unrequested change. The placeholder page is fully static, so it prerenders under Cache Components without `use cache` or Suspense.
4. **Do not remove `@google/genai`.** Requirement 9.5 says an undeclared extra dependency is reported and the manifest is left unchanged until the user decides.
5. **Leave unused `public/*.svg` files.** They are template assets, not product features. Deleting them is not required.
6. **404 behavior comes from Next.js.** No `not-found.tsx` is added. Next.js returns the default 404 page for unmatched paths (`not-found.md`). Requirement 9.6 holds as long as no other routes exist.

## Architecture

The scaffold is a flat set of root configuration files and one `src/app` route tree.

```mermaid
graph TD
    pkg[package.json<br/>deps + scripts] --> next[next.config.ts]
    pkg --> vitest[vitest.config.mts]
    pkg --> pw[playwright.config.ts]
    pkg --> eslint[eslint.config.mjs]
    pkg --> prettier[.prettierrc.json]
    next --> postcss[postcss.config.mjs<br/>@tailwindcss/postcss]
    postcss --> css[src/app/globals.css<br/>@import tailwindcss]
    css --> layout[src/app/layout.tsx]
    layout --> page[src/app/page.tsx<br/>placeholder]
    vitest -->|include src/**/*.test.ts,tsx| unit[unit tests]
    pw -->|testDir e2e| e2e[e2e tests]
    git[.gitignore] -.protects.-> env[.env.local]
    git -.keeps tracked.-> kiro[.kiro/]
```

### Target file layout

```
.
├─ .env.example              (unchanged)
├─ .gitignore                (edited)
├─ .prettierrc.json          (new)
├─ AGENTS.md                 (untouched)
├─ eslint.config.mjs         (unchanged)
├─ next.config.ts            (edited: remove turbopack loader rule)
├─ package.json              (edited: scripts, @tailwindcss/postcss)
├─ playwright.config.ts      (new)
├─ postcss.config.mjs        (new)
├─ vitest.config.mts         (new)
├─ e2e/                      (new, empty except .gitkeep)
└─ src/app/
   ├─ globals.css            (unchanged)
   ├─ layout.tsx             (edited: metadata)
   └─ page.tsx               (rewritten: placeholder)
```

## Components and Interfaces

### 1. `package.json`

Scripts, exactly as required:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "e2e": "playwright test"
}
```

`start` stays because `next start` is the standard companion to `build` and is not prohibited.

Dependency changes:
- Add `@tailwindcss/postcss` to `devDependencies` at the same version as `tailwindcss` (4.3.3). Both are build-time tools, and the Next docs install them with `-D`.
- Remove `@tailwindcss/turbopack`. After the `next.config.ts` change nothing references it. Requirement 9.5 concerns undeclared dependencies outside the required sets. This one is part of the earlier scaffold attempt, so it is removed together with its only consumer. The change is listed in the report so the user can see it.
- Leave `@google/genai`. Report it by name.
- Keep `next` and `eslint-config-next` pinned to 16.4.6, and `react` and `react-dom` pinned to 19.3.0. Pinning guarantees one resolved version and a matching major version (Requirement 3.3).
- Run `npm install` with no flags to refresh `package-lock.json`. If `ERESOLVE` appears, fix the version specifiers. Do not use `--force` or `--legacy-peer-deps`.

Open point for the implementer: `vitest@^5.1.0` and `prettier@^3.10.1` are already installed and resolved. Confirm `npm ls` reports no `invalid` or `missing` entries before finishing.

### 2. `next.config.ts`

Remove the `turbopack.rules` block. Result:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
```

Before editing, read `01-getting-started/11-css.md`, `cacheComponents.md`, and `partialPrefetching.md` (Requirement 2.1). Next.js applies PostCSS configuration without any option in `next.config.ts`.

### 3. `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### 4. `src/app/globals.css`

No change. `@import "tailwindcss";` matches the documented setup.

### 5. `src/app/layout.tsx`

Change only `metadata`:

```ts
export const metadata: Metadata = {
  title: "Repo-Graveyard",
  description: "Repo-Graveyard",
};
```

The `LayoutProps<"/">` helper type and the Geist font setup are kept. Before editing, read the layout file-convention page under `03-api-reference/03-file-conventions/` (Requirement 2.1).

### 6. `src/app/page.tsx`

A synchronous Server Component. No imports, no hooks, no handlers, no links, no form controls, no `"use client"`.

```tsx
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-semibold text-foreground">Repo-Graveyard</h1>
    </main>
  );
}
```

`text-3xl` and `p-8` are the Tailwind utilities that change computed style, which satisfies Requirement 1.3. The `next/image` imports and external links are dropped. The page has no dynamic data, so it prerenders with Cache Components enabled.

### 7. `vitest.config.mts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
```

`passWithNoTests` is required. By default `vitest run` exits non-zero when no test files exist, which would break Requirement 4.6. A failing assertion still gives a non-zero exit and prints the test name (Requirement 4.7). The Next vitest guide also suggests `@vitejs/plugin-react`, `jsdom`, and React Testing Library. Those are for component tests and are not in the agreed dependency list, so they are left out. Product specs can add them later.

### 8. `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

This follows `02-guides/testing/playwright.md`, which describes `baseURL` and `webServer`. `testDir: "./e2e"` keeps Playwright out of `src`.

### 9. `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

These match the formatting of the existing sources, so `prettier --check` loads the file without error. Running `--check` over the whole repository is not a requirement, so existing files are not reformatted.

### 10. `.gitignore`

Replace the two overlapping env sections with anchored rules and add the missing paths:

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage
/playwright-report/
/test-results/

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files at the repository root (keep the example)
/.env*
!/.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# Kiro specs and config stay tracked, even when a file name matches a rule above
!/.kiro/
!/.kiro/**
```

Why each rule:
- The old `.env*` has no leading slash, so it matches in every directory. A file such as `.kiro/specs/x/.env.notes` would be ignored. `/.env*` limits the rule to the root (Requirements 7.2, 7.8).
- `!/.env.example` after `/.env*` re-includes the template (7.3, 6.5).
- `!/.kiro/**` at the end is a safeguard for Requirements 7.4 and 7.8. Git cannot re-include a file whose parent directory is excluded, but `.kiro` itself is not excluded by any rule, so the negation takes effect.
- `/playwright-report/` and `/test-results/` are new (7.5). `.next`, `out`, and `coverage` already exist.

### 11. `.env.example`

No change. It lists the five variables as `NAME=`, with comment lines only. `.env.local` is ignored by `/.env*`.

### 12. `e2e/.gitkeep`

An empty file so the `e2e` directory exists in Git. Playwright discovers no tests in it, and `npm run e2e` reports no tests found. That is acceptable because Requirement 5 only defines the script, not a passing run on an empty directory.

### 13. Report to the user

At completion the task output states:
- `LICENSE` is absent, so none was created (Requirement 8.3, 8.4).
- `@google/genai` is declared but is not in the agreed dependency sets. It is left in place pending the user's choice (9.5).
- `@tailwindcss/turbopack` was removed and `@tailwindcss/postcss` added, following the Next docs (2.2).
- `AGENTS.md` is unchanged.

## Data Models

The scaffold has no runtime data. The only structured artifacts are configuration files:

- `package.json`: `scripts` (name to command), `dependencies`, `devDependencies` (name to version specifier).
- `.env.example`: five `NAME=` lines, each with an empty value.
- `.gitignore`: ordered ignore and re-include patterns. Order matters because later negations override earlier rules.

## Error Handling

- **`build` failure (1.6).** `next build` writes errors that name the failing file or step to stderr and exits non-zero. No wrapper is added.
- **Script exit codes (5.10).** npm returns the exit code of the script command. Scripts are single direct commands with no `|| true` or `;` chaining, so the code passes through.
- **`npm install` peer conflicts (3.4).** If `ERESOLVE` appears, adjust version specifiers. Never use `--force` or `--legacy-peer-deps`.
- **License conflict (8.2).** No step touches `LICENSE`. If a tool attempts to write it, abort that operation and report.
- **Missing Next docs guide (2.3).** If no guide covers a feature being changed, keep the existing content and report the gap.
- **Unknown routes (9.6).** Next.js returns its default 404. No custom handler is added, so no product content can be served.
- **No Vitest tests (4.6).** `passWithNoTests: true` turns the default failure into exit code 0.

## Testing Strategy

Property-based testing does not apply to this feature. The scaffold consists of configuration files, dependency declarations, and a static placeholder page. There is no function with a meaningful "for all inputs" property. Each requirement is a one-time check of a file or command result, so the correctness-properties section is omitted. Verification uses smoke checks and example-based checks, run once against the finished repository.

### Smoke checks (commands, run once)

| Check | Command | Expected | Requirements |
| --- | --- | --- | --- |
| Install | `npm install` on a clean checkout | Exit 0, no `ERESOLVE` | 3.4 |
| Dependency tree | `npm ls` | Exit 0, no `invalid` or `missing` | 3.5 |
| Lint | `npm run lint` | Exit 0, zero errors | 1.7, 4.8, 5.7 |
| Types | `npm run typecheck` | Exit 0, zero errors | 5.8 |
| Build | `npm run build` | Exit 0, build output present | 1.5, 5.9 |
| Unit tests, none present | `npm run test` | Exit 0 within 30 seconds | 4.6 |
| Prettier config | `npx prettier --check .prettierrc.json` | Exit 0 | 4.5 |
| Strict mode | Inspect `tsconfig.json` | `"strict": true` | 1.2 |

### Example-based checks

- **Manifest content.** Read `package.json`: required dependencies are in the right sections (3.1, 3.2, 4.1, 4.2), script commands match exactly (5.1 to 5.6), and `package-lock.json` contains a resolved version for each (3.6).
- **Env template.** Read `.env.example`: exactly the five names, each `NAME=` with an empty value, no other variables (6.1 to 6.4).
- **Git rules.** Run `git check-ignore -v` on these paths:
  - Ignored (exit 0): `node_modules/x`, `.env.local`, `.env.production`, `.env.development.local`, `.next`, `out`, `coverage`, `playwright-report`, `test-results`.
  - Not ignored (exit 1): `.env.example`, `.kiro/specs/project-scaffold/requirements.md`, and a temporary `.kiro/specs/tmp/.env.test` file (7.8).
  - Also run `git ls-files .env.example` after the file is staged (6.5).
- **Home page.** Start the app and request `/`: HTTP 200, no console errors on the server or in the browser, `<h1>` text is "Repo-Graveyard" (1.4, 9.2). A Playwright check in `e2e` can assert the computed `font-size` of the heading is not the default, which covers Tailwind (1.3). Add this check only if the user wants a committed e2e test, since the requirements do not require one.
- **No product code.** Search `src/` for imports of `next-auth`, `octokit`, `zod`, `framer-motion` (expect none, 9.4). List `src/` for `route.ts`, `api`, and auth files (expect none, 9.1, 9.3). Search `page.tsx` for `<a`, `<button`, `<input`, `<form`, `onClick`, `use`-prefixed hooks, and `"use client"` (expect none, 9.2).
- **404.** Request a path such as `/does-not-exist`: HTTP 404 (9.6).
- **Protected files.** `git diff --stat AGENTS.md` is empty (2.5). `LICENSE` is absent and still absent after the work (8.1 to 8.4).
- **Docs-first.** For each edited Next.js file (`next.config.ts`, `layout.tsx`, `page.tsx`, `postcss.config.mjs`), the matching guide in `node_modules/next/dist/docs/` was read before the edit (2.1).

### Out of scope for testing

No unit or property test files are added. The requirements ask that `npm run test` pass with none present, and product tests belong to later feature specs.
