---
inclusion: manual
---

# submission-guard

Run this checklist before submitting the project. Run each check, then report a table with one row per check: PASS or FAIL, and for each FAIL the exact evidence and a one-line fix. Do not change any file. Offer to apply the fixes afterwards and wait for the user's answer.

## 1. `.kiro` is not ignored

- Run `git check-ignore -v .kiro/steering/product.md`. Exit code 1 and no output means PASS. Any output means FAIL.
- Read `.gitignore` and confirm no line ignores `.kiro` (for example `.kiro`, `.kiro/`, `.kiro/*`, `**/.kiro`).
- Run `git ls-files .kiro` and `git status --short .kiro`. If `.kiro` files exist but are untracked, report that as a warning: they are not ignored, but they still need `git add`.

## 2. LICENSE exists and is MIT

- Confirm `LICENSE` exists in the repo root.
- Confirm the first non-empty line is `MIT License` and the text contains the phrase `Permission is hereby granted, free of charge`. Confirm a `Copyright (c)` line with a year and a name.

## 3. No env files or secrets are tracked

- Run `git ls-files` and list every tracked path whose file name starts with `.env`. Only `.env.example` may be tracked. Check `git log --all --name-only --pretty=format:` for any other `.env*` file in history and report it as a FAIL (history needs a rewrite and key rotation, so tell the user, do not do it yourself).
- Read `.env.example`. Every line must be a comment, blank, or `NAME=` with an empty value.
- Run `git grep -nIE "(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)"` and report any match with file and line, but never print the matched secret itself; show only the first 4 characters followed by `...`.
- Run `git check-ignore .env.local`. It must print the path (ignored).
- Never print the contents of `.env.local` or any real secret value.

## 4. README has setup instructions

Read `README.md`. PASS only when it has all of these:

- What the project is, in one or two sentences, and a features list.
- Prerequisites (Node.js version).
- Install step (`npm install`).
- Environment setup: copy `.env.example` to `.env.local`, with each variable name listed (`GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`, `LLM_API_KEY`, `GITHUB_DEMO_TOKEN`) and how to get the GitHub OAuth values (callback URL).
- How to run: `npm run dev`, plus the `lint`, `typecheck`, `test` and `e2e` scripts.
- A note that demo mode works without sign-in.

Report a README that is still the default create-next-app text as FAIL.

## Final line

End with `READY TO SUBMIT` only when every check is PASS (warnings allowed). Otherwise end with `NOT READY` and the number of failed checks.