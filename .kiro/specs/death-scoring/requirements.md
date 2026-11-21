# Requirements Document

## Introduction

This feature adds the deterministic scoring core of Repo Graveyard. A pure function, `scoreRepo`, takes one `RepoHealth` object and the current date, and returns a `Tombstone`: a death score, a status, a cause of death, an epitaph and the scene values that drive the tombstone visuals (fog, candle, cracks, vines).

Code lives in `src/lib/scoring.ts` and `src/lib/epitaphs.ts`. Scoring uses no network, no filesystem, no clock reads, no randomness and no AI. The `RepoHealth` type is defined in the auth-ingestion spec (`src/lib/github/repo-health.ts`) and is reused here, not redefined.

Out of scope: fetching data, the graveyard UI, AI epitaph polish, revival plans and GitHub issue text.

### Assumptions and ambiguities to confirm

1. **Archived score.** The request says archived repos are "always ancient". This spec forces the score to at least 90 for archived repos (Requirement 5), so status always matches the score band. The alternative, keeping the computed score and overriding only the status, would let a tombstone show status `ancient` with a score of, for example, 12. Please confirm.
2. **"Stale open issues".** `RepoHealth` carries only `openIssues` (a count), with no issue age or response data. This spec defines an issue as stale when the repo itself has been inactive for at least 90 days. Real issue age would need an ingestion change.
3. **Outdated dependencies are a boolean.** `outdatedDeps` is `true`, `false` or `null`, so there is no dependency count. The design system says "more outdated dependencies gives more vines". With this data, vines are on or off.
4. **Cracks are a boolean.** `ciStatus` has no count of failing checks, so cracks are on or off. The design system's "more cracks for more failing checks" cannot be met until ingestion supplies a count.
5. **Fog bands.** The design system says fog steps match the status bands. This spec derives fog from days of inactivity only, so an archived but recently committed repo is not wrapped in thick fog that would misstate its inactivity. Please confirm.
6. **Extra output field.** The `Tombstone` includes `daysInactive` (integer or null), which you did not list. The design system requires text such as "Inactive 412 days" for every visual element, and the UI must not recompute it.
7. **No commits.** A repo with no valid last-commit date is treated as maximally inactive (365 days for scoring), the same as a repo untouched for a year or more.
8. **Cause shape.** The cause of death is an object with a stable `code` and a display `label`, so the UI and tests can match on the code.
9. **Status first, seventh cause.** Status is computed from the score before the cause is chosen, and the cause is chosen from the status. Status `alive` can only produce the living cause `still_active`. Status `dying`, `dead` or `ancient` can only produce a death cause and never `still_active`. A seventh cause, `fading_health` (label "Health fading"), is the last-resort death cause for a non-alive repo that matches no earlier death rule. This removes two contradictions: a repo with 29 days of inactivity, failing CI, outdated dependencies and no README scores 28 (`dying`) and is now `fading_health` instead of "Still active", and a repo with 3 open issues and 90 days of inactivity scores 23 (`alive`) and is now `still_active` instead of "Died with open issues". The day gates and labels of the existing causes are unchanged.

## Glossary

- **Scoring_Engine**: The pure function `scoreRepo(repo, now)` in `src/lib/scoring.ts` and the helper functions it calls.
- **Epitaph_Generator**: The module `src/lib/epitaphs.ts` that holds epitaph templates and selects one for a repo.
- **RepoHealth**: The validated repo object defined by the auth-ingestion spec: `name`, `url`, `description`, `lastCommitAt` (ISO 8601 string or null), `openIssues`, `archived`, `ciStatus` (`passing`, `failing` or `none`), `hasReadme`, `outdatedDeps` (boolean or null), `stars`, `language`.
- **Tombstone**: The result object returned by the Scoring_Engine with these fields: `score`, `status`, `cause`, `epitaph`, `daysInactive`, and `scene`.
- **Death_Score**: An integer from 0 to 100. Higher means more abandoned.
- **Status**: One of `alive`, `dying`, `dead` or `ancient`.
- **Cause_Code**: One of `archived`, `abandoned_failing_ci`, `died_with_issues`, `outdated_and_forgotten`, `quietly_retired`, `fading_health` or `still_active`.
- **Death_Cause**: Every Cause_Code except `still_active`.
- **Living_Cause**: The Cause_Code `still_active`.
- **Cause**: An object `{ code, label }` where `code` is a Cause_Code and `label` is a non-empty human-readable string.
- **Epitaph**: A one-line string of 80 characters or fewer, built from a template and facts about the repo.
- **Scene**: The object `{ fog, candle, cracks, vines }` where `fog` is a number from 0 to 1 and the other three are booleans.
- **Days_Inactive**: The whole number of days from `lastCommitAt` to `now`, rounded down. It is null when no valid last-commit date exists. When `lastCommitAt` is later than `now`, it is 0.
- **Effective_Days**: Days_Inactive, or 365 when Days_Inactive is null. Used wherever a number is needed.
- **Stale_Issues**: The open issue count of a repo whose Effective_Days is at least `STALE_AFTER_DAYS`. It is 0 for any other repo.
- **Constants**: The tunable values in the table below. All live in one exported object in `src/lib/scoring.ts`.

### Constants (tunable defaults)

| Name | Default | Meaning |
|---|---|---|
| `INACTIVITY_MAX_POINTS` | 70 | Points from inactivity at or beyond `INACTIVITY_FLAT_DAYS` |
| `INACTIVITY_FLAT_DAYS` | 365 | Days after which inactivity points stop growing |
| `FAILING_CI_POINTS` | 12 | Points when `ciStatus` is `failing` |
| `ISSUE_POINTS_EACH` | 2 | Points per stale issue |
| `ISSUE_POINTS_CAP` | 8 | Maximum points from stale issues |
| `OUTDATED_DEPS_POINTS` | 6 | Points when `outdatedDeps` is true |
| `NO_README_POINTS` | 4 | Points when `hasReadme` is false |
| `STALE_AFTER_DAYS` | 90 | Inactivity after which open issues count as stale and a repo counts as forgotten |
| `ARCHIVED_MIN_SCORE` | 90 | Minimum score for an archived repo |
| `CANDLE_WINDOW_DAYS` | 30 | A candle is lit when Days_Inactive is at most this value |
| `FOG_STEPS` | 30, 120, 300 days | Fog is 0 below 30 days, 0.33 from 30 to 119, 0.66 from 120 to 299, 1 from 300 |
| `DYING_CAUSE_ISSUES_MIN` | 3 | Stale issues needed for the `died_with_issues` cause |

The maximum total of the point sources is 70 + 12 + 8 + 6 + 4 = 100.

## Requirements


### Requirement 1: Scoring function contract

**User Story:** As a developer of the graveyard UI, I want one pure function that turns a repo's facts into a tombstone, so that every screen shows the same result for the same repo.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL export a function `scoreRepo` that accepts exactly two arguments, one RepoHealth and one `Date` named `now`, and returns exactly one Tombstone.
2. THE Scoring_Engine SHALL perform no network access, no filesystem access, no clock read and no random number generation.
3. WHEN `scoreRepo` is called twice with deeply equal RepoHealth values and `now` values representing the same instant, THE Scoring_Engine SHALL return deeply equal Tombstones.
4. THE Scoring_Engine SHALL leave the RepoHealth argument and the `now` argument unmodified, so that a deep comparison of each argument taken before and after the call shows no difference.
5. THE Scoring_Engine SHALL return a Tombstone that contains `score`, `status`, `cause`, `epitaph`, `daysInactive` and `scene`, where `score` is an integer from 0 to 100 inclusive, `status` is one of `alive`, `dying`, `dead` or `ancient`, `daysInactive` is an integer of 0 or more or null, and `epitaph` is a string of 1 to 80 characters.
6. THE Scoring_Engine SHALL NOT call any AI or LLM provider.
7. THE Scoring_Engine SHALL import the RepoHealth type from the auth-ingestion module and SHALL NOT redefine the type.
8. THE Scoring_Engine SHALL export every function it adds to `src/lib` as a named export and SHALL NOT use a default export.

### Requirement 2: Days of inactivity

**User Story:** As a developer, I want inactivity measured the same way everywhere, so that scores, fog and candles agree.

#### Acceptance Criteria

1. WHEN `lastCommitAt` is a valid ISO 8601 date earlier than or equal to `now` and `now` is a valid `Date`, THE Scoring_Engine SHALL compute Days_Inactive as the whole number of 24-hour periods (86,400,000 milliseconds each) between `lastCommitAt` and `now`, rounded down, so that a difference of 86,399,999 ms gives 0 and a difference of 86,400,000 ms gives 1.
2. WHEN `lastCommitAt` is a valid ISO 8601 date later than `now` and `now` is a valid `Date`, THE Scoring_Engine SHALL set Days_Inactive to 0.
3. WHEN `lastCommitAt` is null, THE Scoring_Engine SHALL set Days_Inactive to null.
4. IF `lastCommitAt` is a string that does not parse to a valid ISO 8601 date (including an empty string), THEN THE Scoring_Engine SHALL treat `lastCommitAt` as null, SHALL set Days_Inactive to null, and SHALL NOT throw.
5. IF `now` is an invalid `Date`, THEN THE Scoring_Engine SHALL set Days_Inactive to null regardless of the value of `lastCommitAt`, and SHALL NOT throw.
6. THE Scoring_Engine SHALL return Days_Inactive in the Tombstone as either an integer from 0 to 36,500 inclusive or null, and SHALL cap any computed value above 36,500 at 36,500.
7. WHEN the Scoring_Engine is called more than once with the same `lastCommitAt` and `now` values, THE Scoring_Engine SHALL return the same Days_Inactive each time, without reading the system clock.

### Requirement 3: Death score

**User Story:** As a developer with many unfinished repos, I want a single number for how abandoned each repo is, so that I can compare them.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL compute inactivity points as `round(INACTIVITY_MAX_POINTS × min(Effective_Days, INACTIVITY_FLAT_DAYS) / INACTIVITY_FLAT_DAYS)`, using round-half-up, giving an integer from 0 to INACTIVITY_MAX_POINTS inclusive.
2. WHEN `ciStatus` is `failing`, THE Scoring_Engine SHALL add `FAILING_CI_POINTS` to the score.
3. WHEN `ciStatus` is `passing` or `none`, THE Scoring_Engine SHALL add 0 points for CI.
4. WHEN Effective_Days is greater than or equal to `STALE_AFTER_DAYS`, THE Scoring_Engine SHALL add `min(Stale_Issues × ISSUE_POINTS_EACH, ISSUE_POINTS_CAP)` to the score.
5. WHEN Effective_Days is less than `STALE_AFTER_DAYS`, THE Scoring_Engine SHALL add 0 points for issues.
6. WHEN `outdatedDeps` is true, THE Scoring_Engine SHALL add `OUTDATED_DEPS_POINTS` to the score.
7. WHEN `outdatedDeps` is null or false, THE Scoring_Engine SHALL add 0 points for dependencies.
8. WHEN `hasReadme` is false, THE Scoring_Engine SHALL add `NO_README_POINTS` to the score.
9. WHEN `hasReadme` is true, THE Scoring_Engine SHALL add 0 points for the README.
10. THE Scoring_Engine SHALL return a Death_Score that is an integer from 0 to 100 inclusive, computed as the sum of the inactivity, CI, issue, dependency and README points, capped at 100.
11. IF `openIssues` is negative, not an integer or not finite, THEN THE Scoring_Engine SHALL treat it as 0 and SHALL NOT throw.
12. THE Scoring_Engine SHALL NOT use `stars` or `language` in the Death_Score.

### Requirement 4: Status bands

**User Story:** As a developer, I want each repo placed in a clear band, so that I can see at a glance which are alive and which are resting.

#### Acceptance Criteria

1. WHEN the Death_Score is an integer from 0 to 24 inclusive, THE Scoring_Engine SHALL set `status` to `alive`.
2. WHEN the Death_Score is an integer from 25 to 59 inclusive, THE Scoring_Engine SHALL set `status` to `dying`.
3. WHEN the Death_Score is an integer from 60 to 89 inclusive, THE Scoring_Engine SHALL set `status` to `dead`.
4. WHEN the Death_Score is an integer from 90 to 100 inclusive, THE Scoring_Engine SHALL set `status` to `ancient`.
5. THE Scoring_Engine SHALL export a pure function that maps a Death_Score to a Status, so that tests and the UI use the same bands.
6. WHEN the Status-mapping function is called more than once with the same Death_Score, THE Scoring_Engine SHALL return the same Status each time, so that each integer from 0 to 100 maps to exactly one Status.

### Requirement 5: Archived repositories

**User Story:** As a developer, I want archived repos shown as ancient, so that a repo I closed on purpose is treated as finished.

#### Acceptance Criteria

1. IF the `archived` field of a repository is true, THEN THE Scoring_Engine SHALL set `status` to `ancient`, regardless of the computed Death_Score, days of inactivity, CI state or issue state.
2. IF the `archived` field of a repository is true, THEN THE Scoring_Engine SHALL set the Death_Score to the integer maximum of the computed score and `ARCHIVED_MIN_SCORE`, so that the Death_Score is from 90 to 100 inclusive.
3. IF the `archived` field of a repository is true, THEN THE Scoring_Engine SHALL set the Cause_Code to `archived`, taking precedence over every other Cause_Code, including when other cause rules also match, because the status of an archived repo is always `ancient` and the cause is chosen from the status.
4. IF the `archived` field of a repository is true, THEN THE Scoring_Engine SHALL set `scene.candle` to false, regardless of the date of the most recent activity.
5. IF the `archived` field of a repository is false, THEN THE Scoring_Engine SHALL compute `status`, Death_Score, Cause_Code and `scene.candle` using the standard scoring rules, without applying `ARCHIVED_MIN_SCORE`.

### Requirement 6: Cause of death

**User Story:** As a developer, I want the main reason a repo is considered abandoned, so that I know what to fix first.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL compute the Status from the Death_Score first and SHALL select the Cause from that Status, as follows. WHEN the Status is `alive`, THE Scoring_Engine SHALL select the Cause `still_active` (rule 7) without evaluating rules 1 to 6. WHEN the Status is `dying`, `dead` or `ancient`, THE Scoring_Engine SHALL evaluate the death rules below from item 1 to item 6 in that priority order, and the first rule whose condition is true SHALL win. Evaluation SHALL stop at the first match.
   1. `archived`: `archived` is true. Label: "Archived and laid to rest".
   2. `abandoned_failing_ci`: Effective_Days is at least `STALE_AFTER_DAYS` and `ciStatus` is `failing`. Label: "Abandoned with failing CI".
   3. `died_with_issues`: Stale_Issues is at least `DYING_CAUSE_ISSUES_MIN`. Label: "Died with open issues".
   4. `outdated_and_forgotten`: Effective_Days is at least `STALE_AFTER_DAYS` and `outdatedDeps` is true. Label: "Outdated and forgotten".
   5. `quietly_retired`: Effective_Days is at least `STALE_AFTER_DAYS`. Label: "Quietly retired".
   6. `fading_health`: no earlier death rule matched. Label: "Health fading".
   7. `still_active`: the Status is `alive`. Label: "Still active".
2. THE Scoring_Engine SHALL expose a function `selectCause` that accepts the RepoHealth, the Status and Effective_Days inputs it needs, SHALL return exactly one Cause for each RepoHealth, and for identical inputs SHALL return an identical Cause on every call.
3. THE Scoring_Engine SHALL return a Cause whose `label` is a string of 1 to 80 characters that equals the label listed for the matched rule in criterion 1, including "Health fading" for `fading_health`.
4. WHEN the Cause is `died_with_issues`, THE Scoring_Engine SHALL include the Stale_Issues count as a decimal integer in the Tombstone epitaph and SHALL return the Cause `label` as "Died with open issues" with no count in it.
5. THE Scoring_Engine SHALL define the rule list as an ordered array of data exported for tests, containing exactly 7 entries in this order: `archived`, `abandoned_failing_ci`, `died_with_issues`, `outdated_and_forgotten`, `quietly_retired`, `fading_health`, `still_active`, so that the order is visible in one place and testable.
6. IF Days_Inactive is null, THEN THE Scoring_Engine SHALL use an Effective_Days of 365 when evaluating every rule in criterion 1, and SHALL still return exactly one Cause.
7. IF the Status is `alive`, THEN THE Scoring_Engine SHALL return the Cause `still_active`, which is a Living_Cause and not a Death_Cause.
8. IF the Status is `dying`, `dead` or `ancient`, THEN THE Scoring_Engine SHALL return a Death_Cause and SHALL NOT return the Cause `still_active`.
9. WHEN a repo has 29 days of inactivity, `ciStatus` `failing`, `outdatedDeps` true, `hasReadme` false and `archived` false, THE Scoring_Engine SHALL return the Death_Score 28, the Status `dying` and the Cause `fading_health`.
10. WHEN a repo has 90 days of inactivity, 3 open issues, `ciStatus` `passing`, `outdatedDeps` false, `hasReadme` true and `archived` false, THE Scoring_Engine SHALL return the Death_Score 23, the Status `alive` and the Cause `still_active`.
11. WHEN a repo matches several death rules, THE Scoring_Engine SHALL return the Cause of the match that comes first in the order of criterion 1, so that `archived` wins over `abandoned_failing_ci`, and `abandoned_failing_ci` wins over every later death rule.

### Requirement 7: Scene values

**User Story:** As a developer, I want the tombstone's fog, candle, cracks and vines to match the facts, so that I can read a repo's condition from its look.

#### Acceptance Criteria

1. WHEN Effective_Days is an integer from 0 to 29, THE Scoring_Engine SHALL set `scene.fog` to 0.
2. WHEN Effective_Days is an integer from 30 to 119, THE Scoring_Engine SHALL set `scene.fog` to 0.33.
3. WHEN Effective_Days is an integer from 120 to 299, THE Scoring_Engine SHALL set `scene.fog` to 0.66.
4. WHEN Effective_Days is an integer of 300 or more, THE Scoring_Engine SHALL set `scene.fog` to 1.
5. WHEN `archived` is false and Days_Inactive is not null and Days_Inactive is from 0 to `CANDLE_WINDOW_DAYS` inclusive, THE Scoring_Engine SHALL set `scene.candle` to true.
6. WHEN `archived` is true, or Days_Inactive is null, or Days_Inactive is greater than `CANDLE_WINDOW_DAYS`, THE Scoring_Engine SHALL set `scene.candle` to false.
7. WHEN `ciStatus` is `failing`, THE Scoring_Engine SHALL set `scene.cracks` to true.
8. WHEN `ciStatus` is `passing` or `none`, THE Scoring_Engine SHALL set `scene.cracks` to false.
9. WHEN `outdatedDeps` is true, THE Scoring_Engine SHALL set `scene.vines` to true.
10. WHEN `outdatedDeps` is false or null, THE Scoring_Engine SHALL set `scene.vines` to false.
11. THE Scoring_Engine SHALL return `scene.fog` as exactly one of the values 0, 0.33, 0.66 or 1.
12. THE Scoring_Engine SHALL omit `stars` from the Scene, because the UI derives stone size from `stars` and `stars` is not a Tombstone field.

### Requirement 8: Epitaph templates and selection

**User Story:** As a developer, I want each tombstone to carry a short, funny inscription that stays the same every time I look, so that the graveyard feels like mine.

#### Acceptance Criteria

1. THE Epitaph_Generator SHALL hold at least 3 templates for each of the 7 Cause_Code values (archived, abandoned_failing_ci, died_with_issues, outdated_and_forgotten, quietly_retired, fading_health, still_active).
2. THE Epitaph_Generator SHALL select the template for a repo by computing a 32-bit FNV-1a hash of the repo `name` and taking the hash modulo the number of templates for the Cause_Code.
3. WHEN the Epitaph_Generator is called twice with the same `name`, the same Cause_Code and the same facts, THE Epitaph_Generator SHALL return the same Epitaph.
4. WHEN a selected template contains a placeholder for the repo `name`, Days_Inactive, the Stale_Issues count or `stars`, THE Epitaph_Generator SHALL replace each placeholder with the matching value as a base-10 integer (for numbers) or the unmodified `name` (for the name), leaving no unreplaced placeholder in the Epitaph.
5. IF a selected template needs Days_Inactive and Days_Inactive is null, THEN THE Epitaph_Generator SHALL use the text "a long time" in place of a number of days.
6. THE Epitaph_Generator SHALL return an Epitaph of 1 to 80 characters.
7. IF the filled template is longer than 80 characters, THEN THE Epitaph_Generator SHALL truncate only the repo `name` portion, end it with the single character "…", and remove as few characters as needed so that the Epitaph is 80 characters or fewer.
8. IF the repo `name` is an empty string, THEN THE Epitaph_Generator SHALL use the text "this repo" in place of the name and SHALL NOT throw.
9. THE Epitaph_Generator SHALL return a non-empty Epitaph for every one of the 7 Cause_Code values and every valid RepoHealth, including a `name` of up to 100 characters and `stars`, Days_Inactive and Stale_Issues values of up to 999,999,999.
10. THE Epitaph_Generator SHALL use no randomness, no clock read and no AI to select or fill a template.
11. THE Epitaph_Generator SHALL export the template table, so that tests can check every template.
12. THE Epitaph_Generator SHALL write every template so that its fixed text, excluding the name placeholder, is 50 characters or fewer, so that name truncation in criterion 7 always produces an Epitaph of 80 characters or fewer.

### Requirement 9: Epitaph tone

**User Story:** As a developer, I want epitaphs that joke about my repo's fate and never about me, so that the graveyard feels kind.

#### Acceptance Criteria

1. THE Epitaph_Generator SHALL write every template as a joke about the repo's fate, and SHALL NOT address or describe the repo owner.
2. THE Epitaph_Generator SHALL write every template without the words "you", "your", "yours" and "yourself", compared case-insensitively as whole words.
3. THE Epitaph_Generator SHALL write every template without the words "failed", "failure", "lazy", "quit" and "loser", compared case-insensitively as whole words.
4. THE Epitaph_Generator SHALL frame each template as a repo that is paused, resting or waiting, and SHALL include wording that states or implies the repo can be revived.
5. THE Epitaph_Generator SHALL write every template so that it contains no raw color values (hex, rgb or hsl notation) and no markup other than inline code backticks.
6. WHERE a template names a count of stars, issues or days, THE Epitaph_Generator SHALL use the count from the Tombstone facts, and SHALL NOT state any count, date or fact that is absent from the Tombstone facts.
7. THE Epitaph_Generator SHALL write every template as a single line of 1 to 80 characters, including the values substituted from the Tombstone facts.
8. IF a Tombstone fact required by a template is missing or not a valid non-negative integer, THEN THE Epitaph_Generator SHALL select a template that needs no such fact, and SHALL NOT output the placeholder text or the values "undefined", "null" or "NaN".

### Requirement 10: Missing and unusual data

**User Story:** As a developer, I want scoring to keep working when GitHub data is incomplete, so that one odd repo never breaks the graveyard.

#### Acceptance Criteria

1. WHEN `lastCommitAt` is null, THE Scoring_Engine SHALL use an Effective_Days of 365 for the score, the fog and the cause, and SHALL return `daysInactive` as null.
2. WHEN `outdatedDeps` is null, THE Scoring_Engine SHALL treat dependency state as unknown, add 0 points from dependencies, set `scene.vines` to false, and skip the `outdated_and_forgotten` rule.
3. WHEN `lastCommitAt` is later than `now`, THE Scoring_Engine SHALL treat Days_Inactive as 0 and SHALL return `daysInactive` as 0.
4. WHEN `ciStatus` is `none`, THE Scoring_Engine SHALL treat CI as unknown, add 0 CI points, and set `scene.cracks` to false.
5. IF `openIssues` or `stars` is `NaN`, infinite, negative or not an integer, THEN THE Scoring_Engine SHALL treat that field as 0.
6. IF `lastCommitAt` is an invalid date string or `now` is an invalid `Date` (its time value is `NaN`), THEN THE Scoring_Engine SHALL treat Days_Inactive as null and apply the behavior in criterion 1.
7. THE Scoring_Engine SHALL return a Tombstone with a Death_Score that is an integer from 0 to 100 and a `status` of `alive`, `dying`, `dead` or `ancient`, for every RepoHealth input and every `Date` value, including invalid dates, without throwing an exception.

### Requirement 11: Tombstone data shape

**User Story:** As a developer of the graveyard UI, I want a validated, serializable result, so that the UI and routes can pass tombstones around safely.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL export a Zod schema `TombstoneSchema` and the matching `Tombstone` type.
2. WHEN the Scoring_Engine returns a result for a repo, THE Scoring_Engine SHALL return a Tombstone that passes `TombstoneSchema` validation with zero issues.
3. IF a value has a `score` that is not an integer from 0 to 100 inclusive, THEN THE TombstoneSchema SHALL reject it and report a validation issue at the `score` field.
4. IF a value has a `status` that is not exactly one of `alive`, `dying`, `dead` or `ancient`, THEN THE TombstoneSchema SHALL reject it and report a validation issue at the `status` field.
5. IF a value has a `scene.fog` that is not a finite number from 0 to 1 inclusive, THEN THE TombstoneSchema SHALL reject it and report a validation issue at the `scene.fog` field.
6. IF a value has an `epitaph` or `cause.label` that is empty or contains only whitespace, THEN THE TombstoneSchema SHALL reject it and report a validation issue at the offending field.
7. IF a value has an `epitaph` longer than 80 characters, THEN THE TombstoneSchema SHALL reject it and report a validation issue at the `epitaph` field.
8. FOR ALL Tombstones returned by the Scoring_Engine, serializing to JSON then parsing the result with `TombstoneSchema` SHALL succeed and produce an object deeply equal to the original (round-trip property).

### Requirement 12: Unit tests

**User Story:** As a maintainer, I want example tests for the exact rules, so that a change to a weight or threshold shows up immediately.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL include Vitest unit tests, in `*.test.ts` files located next to the code under test, that cover each exported function in `src/lib/scoring.ts` and `src/lib/epitaphs.ts` with at least one success case and at least one failure or boundary case.
2. THE unit tests SHALL assert that a death score of 0 or 24 maps to `alive`, 25 or 59 maps to `dying`, 60 or 89 maps to `dead`, and 90 or 100 maps to `ancient`.
3. THE unit tests SHALL include, for each of the 7 Cause_Code values, at least one RepoHealth example whose computed cause of death equals that Cause_Code.
4. THE unit tests SHALL include at least one RepoHealth example that matches three or more death rules and SHALL assert that the returned cause of death is the one defined first in the rule order, including an example that returns `archived` and an example that returns `abandoned_failing_ci` when later death rules also match.
5. THE unit tests SHALL assert the fog step for inactivity of 29, 30, 119, 120, 299 and 300 days, with each value mapped to the step defined in the scoring rules, so that each step boundary is checked on both sides.
6. THE unit tests SHALL assert that the candle is lit at 30 days of inactivity and unlit at 31 days.
7. THE unit tests SHALL assert, for a `lastCommitAt` date later than `now`, the same candle, fog and status results that the scoring rules define for that case.
8. THE unit tests SHALL include a case for each of the following inputs and SHALL assert the Tombstone the scoring rules define for it without an exception: a repo with no commits, a repo with `outdatedDeps` set to null, a repo with a `lastCommitAt` string that is not a valid date, and a call with an invalid `now`.
9. THE unit tests SHALL generate an epitaph from every epitaph template using a repo name of exactly 100 characters, and SHALL assert that each result is at most 80 characters long, as required by Requirement 9 and Requirement 8.6.
10. THE unit tests SHALL pass a fixed `now` value to every call that takes a time input and SHALL NOT read the system clock.
11. WHEN `npm run test` is run, THE unit tests SHALL finish with all tests passing and exit code 0 on an unmodified checkout.
12. THE unit tests SHALL include the two status and cause contradiction examples of Requirement 6, and SHALL assert that the example with 29 days of inactivity, failing CI, outdated dependencies and no README returns the Death_Score 28, the Status `dying` and the Cause `fading_health`, and that the example with 90 days of inactivity and 3 open issues returns the Death_Score 23, the Status `alive` and the Cause `still_active`.

### Requirement 13: Property-based tests

**User Story:** As a maintainer, I want properties checked over many generated repos, so that edge cases I did not think of are caught.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL include fast-check property tests, each running at least 100 generated cases, tagged with `Feature: death-scoring, Property N: <title>`, where N is a unique integer starting at 1 with no duplicates.
2. FOR ALL valid RepoHealth objects and all valid `now` values, THE property tests SHALL check that the Death_Score is an integer from 0 to 100 inclusive.
3. FOR ALL pairs of valid RepoHealth objects that differ only in `lastCommitAt`, where the first has a later or equal last-commit date than the second (a null `lastCommitAt` counts as earlier than every date), THE property tests SHALL check that the second Death_Score is greater than or equal to the first (more inactivity never lowers the score).
4. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that two calls to `scoreRepo` with the same input return deeply equal Tombstones.
5. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that `cause.label` and `epitaph` are non-empty strings (length of at least 1 character after trimming whitespace) for each of the four Statuses (`alive`, `dying`, `dead`, `ancient`), and the generators SHALL produce inputs reaching all four Statuses.
6. FOR ALL valid RepoHealth objects with `archived` true, THE property tests SHALL check that `status` is `ancient`, the Death_Score is at least 90 and the Cause_Code is `archived`.
7. FOR ALL pairs of valid RepoHealth objects that differ only in `ciStatus`, where the first is `passing` or `none` and the second is `failing`, THE property tests SHALL check that the second Death_Score is greater than or equal to the first (failing CI never lowers the score).
8. FOR ALL valid RepoHealth objects, THE property tests SHALL check that the Death_Score does not decrease in each of these three cases, each changed alone with all other fields held equal: `openIssues` increases to a larger non-negative integer, `outdatedDeps` changes from false or null to true, and `hasReadme` changes from true to false.
9. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that `status` equals the Status band that contains the Death_Score, using the band boundaries defined in the scoring requirements.
10. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that every Epitaph is 80 characters or fewer.
11. FOR ALL RepoHealth objects built from arbitrary values for `lastCommitAt` (valid dates, future dates, null and invalid strings), `openIssues` and `now` (including invalid dates), THE property tests SHALL check that `scoreRepo` does not throw and returns a Tombstone that passes `TombstoneSchema`.
12. FOR ALL repo names (including the empty string and strings up to 200 characters) and all Cause_Codes, THE property tests SHALL check that two calls to the Epitaph_Generator with the same input return identical Epitaph strings.
13. FOR ALL valid RepoHealth objects, THE property tests SHALL check that changing only `stars`, `language`, `url` or `description` leaves `score`, `status` and `cause` unchanged.
14. THE property tests SHALL pass `now` as an argument to every `scoreRepo` call and SHALL NOT read the system clock, so that a failing case reproduces from the fast-check seed reported on failure.
15. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that a `status` of `alive` implies a `cause.code` of `still_active` (a Living_Cause and not a Death_Cause).
16. FOR ALL valid RepoHealth objects and valid `now` values, THE property tests SHALL check that a `status` other than `alive` implies a `cause.code` that is not `still_active`, and the generators for criteria 15 and 16 SHALL produce inputs that reach `alive` and each of `dying`, `dead` and `ancient`.
