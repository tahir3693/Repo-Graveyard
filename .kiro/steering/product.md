# Repo Graveyard: Product

## What it is

Repo Graveyard is a haunted web dashboard. It shows a developer's abandoned GitHub repositories as tombstones in a graveyard scene. It scores each repo's health with deterministic rules, then uses AI to write a revival plan and a ready-to-file GitHub issue.

## Audience

Students, freelancers and hobbyist developers who have many unfinished repos. They are not enterprise teams. They want a clear, low-pressure way to decide which projects are worth reviving.

## Hackathon category

Costume Contest. The UI must be polished and haunting, and every spooky element must serve the app's function. A decoration that carries no information (status, score, age, cause) does not belong.

## Principles

- **Spooky with a purpose.** Fog, glow, tombstone size and grave condition encode data. They are never only ornament.
- **Scores are deterministic.** The death score, status and cause of death come from fixed rules over GitHub data. The same input always gives the same result. AI is not used for scoring.
- **AI writes, rules judge.** AI is used only for the revival plan, the epitaph polish and the GitHub issue text.
- **Usable first.** Animation must not block reading or interaction. Respect reduced-motion settings.
- **Secrets stay server-side.** Tokens and API keys are never sent to the browser.

## Tone

Dark humor, kind to the user, never insulting.

- Joke about the repo's fate, never about the person. "Last words: `// TODO: finish this`" is fine. "You never finish anything" is not.
- Frame abandoned repos as paused, not failed. Every dead repo can be resurrected.
- Keep copy short and clear. The joke never hides the information.

## Glossary

- **Tombstone**: The visual representation of one GitHub repo in the graveyard scene.
- **Death score**: A number from 0 to 100 that shows how abandoned a repo is. Higher means more abandoned. It is computed by deterministic rules.
- **Status**: A band of the death score. One of `alive`, `dying`, `dead` or `ancient`.
  - `alive`: recently active.
  - `dying`: activity is slowing down.
  - `dead`: no meaningful activity for a long time.
  - `ancient`: abandoned for years.
- **Cause of death**: The main rule-based reason a repo is considered abandoned, such as no recent commits, unanswered issues or an archived state.
- **Epitaph**: A short, darkly funny one-line inscription on a tombstone, based on the repo's facts.
- **Resurrect**: The action of generating a revival plan and a ready-to-file GitHub issue for a repo, to bring it back to life.
