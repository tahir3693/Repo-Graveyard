# Requirements Document

## Introduction

This feature adds the user interface of Repo Graveyard: a landing page, and a graveyard page that shows each scanned repository as a tombstone. It consumes the scan response of `POST /api/scan` (auth-ingestion spec) and the `Tombstone` result of `scoreRepo` (death-scoring spec). It reuses the `RepoHealth`, `Tombstone`, `Status` and `Cause_Code` types from those specs and does not redefine them.

The UI follows the design-system steering document (tokens only, Cinzel and Inter, motion rules, visual vocabulary, accessibility rules), the product steering document (tone and terminology) and the tech steering document (App Router, strict TypeScript, named exports, no GitHub or LLM calls from the client).

Out of scope: scoring rules, the scan route, sign-in configuration, the AI revival plan, the GitHub issue text and the AI epitaph polish. The Resurrect button area is a placeholder in this spec.

### Assumptions and open questions to confirm

1. **Years of life cannot be derived.** You asked for "years of life (first to last commit)". `RepoHealth` has only `lastCommitAt`, and `Tombstone` has no first-commit date. This spec therefore shows the **last-commit year** by default, labelled "Last commit 2023", and never invents a first year. Proposed upgrade: ask auth-ingestion to add an optional `createdAt` (ISO 8601 or null) to `RepoHealth`. Requirement 4, criterion 3 shows the full range ("2019 to 2023") only WHERE that field exists. Please confirm, or choose to keep last-commit year only.
2. **Tombstone does not carry `stars`.** Stone size depends on `stars`, which is on `RepoHealth`. The UI works on a `Grave_Entry`, a pair of one `RepoHealth` and the `Tombstone` computed from it (Requirement 1).
3. **Where scoring runs.** `scoreRepo` is pure, so a pure function in `src/lib/graveyard` may call it with `now` passed in. The clock is read once at the page boundary, not inside scoring or components. Components receive finished `Grave_Entry` values and contain no scoring logic. Please confirm that scoring on the client is acceptable, or the design phase may move it to the server route.
4. **Scan response field names.** auth-ingestion defines the response content (repository list, skipped-fork count, `truncated`, `stale`, cached time, reset time, `mode`, `code`, skipped invalid entry count) but not exact JSON names. The design phase imports the scan response schema from auth-ingestion and uses its names. This spec refers to fields by concept.
5. **Vines and cracks are on or off.** death-scoring provides booleans, not counts. The design-system wording "more vines, more cracks" cannot be met with this data, so each is drawn at one fixed density. Text equivalents say "outdated dependencies" and "CI failing" without a count.
6. **Many tombstones.** A scan returns at most 300 repositories. Looping animation on 300 stones is costly, so loops are switched off above 60 displayed stones (Requirement 6, criterion 9). The threshold is a tunable constant.
7. **No component test library.** The stack has Vitest, fast-check and Playwright only. Pure logic gets Vitest and fast-check tests. Component behavior gets Playwright tests. No jsdom or Testing Library is added.
8. **Filters live in memory.** There is no database. Filter, sort and view choices are held in client state and reset on reload. They are not stored in the URL or in storage.

## Glossary

- **Landing_Page**: The page at route `/`.
- **Graveyard_Page**: The page at route `/graveyard`. The query parameter `demo=1` selects Demo_Mode.
- **Scan_Client**: The client module that sends `POST /api/scan` to the application's own server and parses the response with the auth-ingestion scan response Zod schema. It never calls GitHub or an LLM provider.
- **Grave_Entry**: A pair of one `RepoHealth` and the `Tombstone` that `scoreRepo` returns for it.
- **Graveyard_Logic**: The pure functions in `src/lib/graveyard/`: `buildGraveEntries`, `filterEntries`, `sortEntries`, `countByStatus`, `listLanguages`, `stoneSize`, `fogLayerCount`, `buildAccessibleName`, `describeFacts`, `formatLifespan`, `statusLabel`. They perform no network access, no filesystem access, no clock read and no randomness.
- **Graveyard_Scene**: The visual layout of Tombstone_Stones in the Graveyard_Page.
- **List_View**: The plain list of the same Grave_Entry values, equivalent to the Graveyard_Scene.
- **Tombstone_Stone**: One interactive stone in the Graveyard_Scene. It is a native `button` element.
- **Fog_Layer**: A decorative SVG or CSS layer that drifts across a Tombstone_Stone.
- **Candle**: A decorative SVG flame drawn on a Tombstone_Stone.
- **Cracks**: Decorative SVG lines drawn on a Tombstone_Stone.
- **Vines**: Decorative SVG foliage drawn on a Tombstone_Stone.
- **Summary_Header**: The header showing the count of Grave_Entry values per Status.
- **Filter_Bar**: The control group with the Status filter and the Language filter.
- **Sort_Control**: The control that selects the sort order.
- **Detail_Drawer**: The panel that opens when a Tombstone_Stone or a List_View row is activated.
- **Resurrect_Area**: The region of the Detail_Drawer that holds the Resurrect button. It is a placeholder in this spec.
- **Loading_State**, **Empty_State**, **Error_State**, **Stale_Notice**: The screens or banners described in Requirements 11 to 14.
- **Status**: One of `alive`, `dying`, `dead`, `ancient`. Display labels are "Alive", "Dying", "Dead", "Ancient".
- **Demo_Mode**: A scan of the fixed demo account, requested with `demo` set to true.
- **Token_Colors**: The CSS variables defined in the design-system steering document.
- **Breakpoints**: `sm` 640px, `md` 768px, `lg` 1024px (Tailwind defaults).
- **Stone_Size**: The pixel width and height of a Tombstone_Stone, defined in Requirement 5.
- **Max_Animated_Stones**: 60. The largest number of displayed stones that keep looping animation.

## Requirements


### Requirement 1: Grave entries and data flow

**User Story:** As a developer of the UI, I want one typed pairing of a repo and its tombstone, so that every component gets the facts it needs without scoring logic.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL export the type `Grave_Entry` as an object with exactly the fields `repo` (type `RepoHealth` imported from `src/lib/github/repo-health.ts`) and `tombstone` (type `Tombstone` imported from `src/lib/scoring.ts`), and SHALL NOT redefine either type.
2. WHEN `buildGraveEntries(repos, now)` is called with an array of 0 to 1000 `RepoHealth` items, THE Graveyard_Logic SHALL return an array of the same length with one Grave_Entry per input item, in the input order, where each `tombstone` deeply equals `scoreRepo(repo, now)` and each `repo` is the corresponding input item.
3. WHEN `buildGraveEntries` is called with an empty array, THE Graveyard_Logic SHALL return an empty array.
4. THE Graveyard_Logic SHALL receive `now` as an argument, SHALL NOT read the system clock, and SHALL return deeply equal results for repeated calls with the same `repos` and `now`.
5. WHEN the Scan_Client sends a scan request, THE Scan_Client SHALL send it only to the application's own route `POST /api/scan`, and SHALL NOT send any request to a GitHub host or an LLM provider host.
6. WHEN the Scan_Client receives a response, THE Scan_Client SHALL validate the body with the auth-ingestion scan response Zod schema before any component reads a field from it.
7. IF the response body fails validation, THEN THE Scan_Client SHALL return the generic error described in Requirement 14, criterion 10, SHALL NOT display, log or expose any fragment of the invalid body, and SHALL leave previously displayed Grave_Entry data unchanged.
8. THE Graveyard_Page SHALL contain no token, API key or secret value (including the values of `GITHUB_SECRET`, `AUTH_SECRET`, `LLM_API_KEY`, `GITHUB_DEMO_TOKEN` and user access tokens) in rendered HTML, client JavaScript bundles, network responses received by the browser, or browser console output.
9. THE Graveyard_Logic SHALL export every function as a named export and SHALL NOT contain a default export.

### Requirement 2: Landing page

**User Story:** As a first-time visitor, I want a moody landing page with two clear ways in, so that I can sign in or look around without an account.

#### Acceptance Criteria

1. THE Landing_Page SHALL show exactly one `h1` heading, exactly one descriptive sentence of 1 to 140 characters that states what the app does, and exactly two primary buttons labelled "Sign in with GitHub" and "Try demo graveyard".
2. WHEN a visitor activates "Sign in with GitHub", THE Landing_Page SHALL start the Auth.js GitHub sign-in flow within 1 second, and no GitHub or LLM request SHALL originate from client code.
3. WHEN a visitor activates "Try demo graveyard", THE Landing_Page SHALL navigate to `/graveyard?demo=1` without requiring a session and without starting the sign-in flow.
4. WHILE a signed-in session exists, THE Landing_Page SHALL show an "Open my graveyard" link to `/graveyard`, a sign-out button, and the "Try demo graveyard" button, and SHALL NOT show the "Sign in with GitHub" button.
5. WHEN a signed-in visitor activates the sign-out button, THE Landing_Page SHALL end the session and, within 2 seconds, show the signed-out layout (criterion 1).
6. THE Landing_Page SHALL build its hero scene from inline SVG and CSS only, with at most 3 Fog_Layer elements and no raster image (PNG, JPEG, WebP, GIF or AVIF).
7. THE Landing_Page SHALL mark every decorative hero element, including every Fog_Layer, `aria-hidden="true"`.
8. IF the Landing_Page is loaded with a sign-in error indicator from auth-ingestion Requirement 1 (cancelled or failed), THEN THE Landing_Page SHALL show a message of at most 140 characters in the product voice (dark humor, kind, "paused, not failed" framing) and a "Try again" button that restarts the sign-in flow, and SHALL NOT show error codes, stack traces, provider names beyond "GitHub", or token values.
9. IF the server reports that sign-in is not configured, THEN THE Landing_Page SHALL disable the "Sign in with GitHub" button, SHALL show a text message that sign-in is unavailable, and SHALL keep "Try demo graveyard" enabled.
10. THE Landing_Page SHALL render every button and link with a rendered size of at least 44px by 44px, at viewport widths from 360px to 1920px, without horizontal scrolling.
11. WHILE the user agent reports `prefers-reduced-motion: reduce`, THE Landing_Page SHALL show no looping animation (including Fog_Layer drift), and all text and buttons SHALL remain readable and usable.

### Requirement 3: Graveyard page loading and entry

**User Story:** As a visitor, I want the graveyard to load my scan and show it, so that I can see my repositories as graves.

#### Acceptance Criteria

1. WHEN the Graveyard_Page opens with the query `demo=1`, THE Scan_Client SHALL send exactly one `POST /api/scan` request with `demo` set to true and `includeForks` set to false.
2. WHEN the Graveyard_Page opens without the query `demo=1`, THE Scan_Client SHALL send exactly one `POST /api/scan` request with `demo` absent or false and `includeForks` set to false.
3. THE Scan_Client SHALL NOT include a username in the request body.
4. WHILE the scan request is pending, THE Graveyard_Page SHALL show the Loading_State and SHALL NOT show the Summary_Header, Filter_Bar, Sort_Control or Graveyard_Scene.
5. WHEN a scan response with at least one repository is parsed and passes validation, THE Graveyard_Page SHALL call `buildGraveEntries` exactly once for that response and SHALL render the Summary_Header, Filter_Bar, Sort_Control and Graveyard_Scene, and SHALL hide the Loading_State.
6. WHEN a scan response is parsed, passes validation and contains zero repositories, THE Graveyard_Page SHALL hide the Loading_State, SHALL show the Empty_State described in Requirement 13, and SHALL NOT call `buildGraveEntries`.
7. IF the scan request fails with a network error, a non-success response, or a response that fails validation, THEN THE Graveyard_Page SHALL hide the Loading_State and SHALL show the Error_State described in Requirement 14.
8. WHEN the response `mode` is `demo`, THE Graveyard_Page SHALL show the text badge "Demo graveyard".
9. WHEN the response `truncated` is true, THE Graveyard_Page SHALL show the text "Showing the first 300 repositories".
10. WHEN the response skipped-fork count is greater than 0, THE Graveyard_Page SHALL show the text "{n} forks skipped", where {n} is the skipped-fork count as a base-10 integer.
11. WHEN the response skipped-invalid-entry count is greater than 0, THE Graveyard_Page SHALL show the text "{n} repositories could not be read", where {n} is the skipped-invalid-entry count as a base-10 integer.
12. THE Graveyard_Page SHALL provide a keyboard-operable control labelled "Include forks" with a touch target of at least 44 by 44 px.
13. WHEN the "Include forks" control is toggled, THE Scan_Client SHALL send exactly one new `POST /api/scan` request with `includeForks` set to the control's new boolean value, and THE Graveyard_Page SHALL show the Loading_State until that request completes.
14. WHEN the "Include forks" control is toggled while a scan request is pending, THE Scan_Client SHALL cancel the pending request and ignore its response.

### Requirement 4: Tombstone content

**User Story:** As a developer, I want each stone to show the repo name, a lifespan, the cause of death and the epitaph, so that I can read a repo's story at a glance.

#### Acceptance Criteria

1. THE Tombstone_Stone SHALL show the repo `name` in the display font at 20px or larger, the lifespan text, the `cause.label` and the `epitaph` as text content.
2. THE Tombstone_Stone SHALL show the Status as a text label together with an icon whose shape differs for each of the four Status values (`alive`, `dying`, `dead`, `ancient`).
3. WHERE the `RepoHealth` includes an optional `createdAt` that is a valid date AND `lastCommitAt` is a valid date, THE `formatLifespan` function SHALL return "{createdYear} to {lastCommitYear}", or "{createdYear}" when both years are equal.
4. WHERE the `RepoHealth` includes an optional `createdAt` that is a valid date AND `lastCommitAt` is null or not a valid date, THE `formatLifespan` function SHALL return "{createdYear}".
5. WHEN `lastCommitAt` is a valid date and no valid `createdAt` exists, THE `formatLifespan` function SHALL return "Last commit {year}", where `{year}` is the four-digit UTC year of `lastCommitAt`.
6. WHEN `lastCommitAt` is null or not a valid date and no valid `createdAt` exists, THE `formatLifespan` function SHALL return "No commits recorded".
7. THE `formatLifespan` function SHALL compute years in UTC, SHALL NOT depend on the system time zone or clock, and SHALL return the same output for the same input.
8. WHEN a repo name is longer than 24 characters, THE Tombstone_Stone SHALL limit the visible name to at most 2 lines, SHALL end the second line with an ellipsis, and SHALL keep the full name in the accessible name and the Detail_Drawer.
9. WHEN an epitaph is displayed, THE Tombstone_Stone SHALL display the `epitaph` text exactly as returned in the Tombstone, as plain text, without interpreting it as HTML, so that a value such as `<b>x</b>` appears literally as `<b>x</b>`.
10. THE Tombstone_Stone SHALL render text on the surface token `--color-surface-raised` with the text token `--color-text`, and SHALL render the Status label in `--color-glow` for `alive` and in `--color-ember` for `dying`, `dead` and `ancient`.

### Requirement 5: Stone size scaled by stars

**User Story:** As a developer, I want popular repos to have bigger stones, so that size tells me how much a project was loved.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL export a pure function `stoneSize(stars)` that returns an object with integer `width` and integer `height`, both in pixels, and that performs no network, filesystem, clock or randomness access.
2. WHEN `stoneSize` is called with a valid `stars` value, THE `stoneSize` function SHALL compute `t = min(log10(1 + stars) / log10(1001), 1)`, then `width = round(96 + t × 64)`, then `height = round(width × 1.25)`, where `round` rounds halves away from zero.
3. THE `stoneSize` function SHALL return a width from 96 to 160 inclusive and a height from 120 to 200 inclusive for every input, including invalid inputs.
4. IF `stars` is negative, not an integer, `NaN`, `Infinity`, `-Infinity`, `null`, `undefined` or not of type number, THEN THE `stoneSize` function SHALL treat `stars` as 0, SHALL return width 96 and height 120, and SHALL NOT throw.
5. WHEN `stars` is 0, THE `stoneSize` function SHALL return width 96 and height 120.
6. WHEN `stars` is 1000 or more, up to `Number.MAX_SAFE_INTEGER`, THE `stoneSize` function SHALL return width 160 and height 200.
7. THE `stoneSize` function SHALL return a width that never decreases as `stars` increases, and SHALL return the same output for the same input on every call.
8. THE Tombstone_Stone SHALL take its width and height from `stoneSize(repo.stars)` and SHALL render at a width of at least 96px and a height of at least 120px at every viewport width from 360px upward, with no horizontal page scroll.
9. THE Tombstone_Stone SHALL present its star count as text in its accessible description (the `describeFacts` result), so that stone size is not the only indication of stars.

### Requirement 6: Fog, candle, cracks and vines

**User Story:** As a developer, I want fog, candles, cracks and vines to match the repo's facts, so that I can read the condition of a grave by sight.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL export `fogLayerCount(fog)` returning 0 for `fog` 0, 1 for 0.33, 2 for 0.66 and 3 for 1, and returning 0 for any other input, including `NaN`, `undefined`, `null`, negative numbers and numbers greater than 1.
2. THE Tombstone_Stone SHALL render exactly `fogLayerCount(tombstone.scene.fog)` Fog_Layer elements, each with `aria-hidden="true"` and `pointer-events: none`.
3. WHILE motion is allowed and the number of displayed stones is at most Max_Animated_Stones (60), THE Fog_Layer SHALL drift with a CSS loop of 6000ms using ease-in-out and animating `transform` and `opacity` only.
4. WHEN `tombstone.scene.candle` is true, THE Tombstone_Stone SHALL render exactly one Candle with `aria-hidden="true"`.
5. WHEN `tombstone.scene.candle` is false, THE Tombstone_Stone SHALL render zero Candle elements.
6. WHILE motion is allowed and the number of displayed stones is at most Max_Animated_Stones (60), THE Candle flame SHALL flicker with a loop period of 1200ms or longer, so that nothing flickers more than 3 times per second.
7. WHEN `tombstone.scene.cracks` is true, THE Tombstone_Stone SHALL render exactly one inline SVG Cracks element with `aria-hidden="true"`.
8. WHEN `tombstone.scene.cracks` is false, THE Tombstone_Stone SHALL render zero Cracks elements.
9. WHEN `tombstone.scene.vines` is true, THE Tombstone_Stone SHALL render exactly one inline SVG Vines element with `aria-hidden="true"`.
10. WHEN `tombstone.scene.vines` is false, THE Tombstone_Stone SHALL render zero Vines elements.
11. WHILE more than Max_Animated_Stones (60) stones are displayed, THE Graveyard_Scene SHALL render Fog_Layer and Candle elements with no looping animation, and SHALL still render the same number of Fog_Layer and Candle elements as when 60 or fewer stones are displayed.
12. WHILE the user's `prefers-reduced-motion` setting is `reduce`, THE Graveyard_Scene SHALL render Fog_Layer and Candle elements with no looping animation, and SHALL still render the same number of Fog_Layer and Candle elements as when motion is allowed.
13. THE Tombstone_Stone SHALL draw Fog_Layer, Candle, Cracks and Vines with Token_Colors only and SHALL NOT contain a hex, rgb, hsl or named color value.
14. THE Graveyard_Scene SHALL render no decorative element other than Fog_Layer, Candle, Cracks, Vines, the stone and the ground, so that every decoration maps to a data field.
15. THE Fog_Layer, Candle, Cracks and Vines SHALL NOT receive focus, SHALL NOT be reachable by Tab key navigation, and SHALL NOT change the Tombstone_Stone accessible name.

### Requirement 7: Accessible names and text equivalents

**User Story:** As a screen reader or keyboard user, I want every tombstone to say what it is, so that I can use the graveyard without seeing it.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL export `buildAccessibleName(entry)` returning the string "{name}, {statusLabel}, {cause.label}", where `statusLabel` is "Alive" for status `alive`, "Dying" for `dying`, "Dead" for `dead` and "Ancient" for `ancient`.
2. IF `repo.name` is an empty string or contains only whitespace characters, THEN THE `buildAccessibleName` function SHALL use "Unnamed repository" in place of the name.
3. THE `buildAccessibleName` function SHALL return the same string for equal input, and the returned string SHALL contain at least 1 character and SHALL NOT contain the text "undefined", "null" or "NaN" as a result of a missing value.
4. IF `cause.label` is an empty string or missing, THEN THE `buildAccessibleName` function SHALL omit the cause segment and return "{name}, {statusLabel}" without a trailing comma.
5. THE Tombstone_Stone SHALL be a native `button` element whose accessible name equals the `buildAccessibleName` result.
6. THE Graveyard_Logic SHALL export `describeFacts(entry)` returning a string of comma-separated parts in this fixed order: inactivity part, "CI failing", "outdated dependencies", stars part. Each of "CI failing" and "outdated dependencies" SHALL be present only when its fact holds.
7. THE `describeFacts` function SHALL always include the inactivity part and the stars part, using "Inactive {n} days" when `daysInactive` is a non-negative integer and "No commits recorded" WHEN `daysInactive` is null.
8. THE `describeFacts` function SHALL use "1 day" and "1 star" when the value is exactly 1, and "{n} days" and "{n} stars" for every other non-negative integer, including 0.
9. WHEN `tombstone.scene.cracks` is true, THE `describeFacts` function SHALL include "CI failing"; WHEN `tombstone.scene.cracks` is false, THE `describeFacts` function SHALL omit it.
10. WHEN `tombstone.scene.vines` is true, THE `describeFacts` function SHALL include "outdated dependencies"; WHEN `tombstone.scene.vines` is false, THE `describeFacts` function SHALL omit it.
11. THE Tombstone_Stone SHALL expose the `describeFacts` result as its accessible description through `aria-describedby` that references a visually hidden element containing exactly that text, and the hidden element SHALL remain available to assistive technology.

### Requirement 8: Summary header

**User Story:** As a developer, I want a one-line count of my alive, dying, dead and ancient repos, so that I see the state of the whole graveyard immediately.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL export `countByStatus(entries)` returning an object with integer counts, each from 0 to the number of input entries, for `alive`, `dying`, `dead` and `ancient`.
2. THE `countByStatus` function SHALL return counts whose sum equals the number of input entries, and SHALL return 0 for all four counts WHEN `entries` is empty.
3. THE Summary_Header SHALL show all four counts in the order alive, dying, dead, ancient, as text in the format "{a} alive, {b} dying, {c} dead, {d} ancient" (for example "14 alive, 2 dying, 9 dead, 3 ancient"), including counts of 0.
4. THE Summary_Header SHALL compute the four counts from all Grave_Entry values, regardless of the active filters.
5. WHILE one or more filters are active, THE Summary_Header SHALL show the text "Showing {k} of {n}", where `{k}` is the number of visible entries and `{n}` is the total number of Grave_Entry values.
6. WHEN a re-scan completes and changes any of the four counts, THE Summary_Header SHALL update the displayed counts, inside an element with `role="status"` and `aria-live="polite"`, so that a screen reader announces the change.
7. THE Summary_Header SHALL pair each count with the Status icon and the Status text label (`alive`, `dying`, `dead` or `ancient`), so that no Status is shown by color alone.
8. IF the Grave_Entry list is not yet loaded or the scan has failed, THEN THE Summary_Header SHALL NOT show any counts and SHALL show a text indicating that counts are unavailable, instead of showing zeros.

### Requirement 9: Filter bar and sort control

**User Story:** As a developer with many repos, I want to filter by status and language and choose an order, so that I can find the graves worth revisiting.

#### Acceptance Criteria

1. THE Filter_Bar SHALL provide a Status filter with four toggle buttons (Alive, Dying, Dead, Ancient), each with a text label, an `aria-pressed` attribute set to "true" or "false" that matches its state, and independent toggling so that any combination of zero to four buttons can be pressed.
2. WHILE no Status toggle button is pressed, THE Graveyard_Page SHALL apply no Status filter.
3. THE Filter_Bar SHALL provide a Language `select` whose options are, in this order: "All languages", each distinct non-null `language` value sorted by Unicode code point ascending with duplicates removed, and "Unknown language" only IF at least one entry has a null `language`.
4. THE Filter_Bar SHALL initialize with no Status button pressed and the Language `select` set to "All languages".
5. THE Graveyard_Logic SHALL export `filterEntries(entries, { statuses, language })` that returns, in the input order, the entries whose Status is in `statuses` (or all entries IF `statuses` is empty) and whose `language` equals the `language` filter value exactly, case-sensitive (or all entries IF `language` is null). The "Unknown language" option SHALL match only entries whose `language` is null.
6. THE `filterEntries` function SHALL return a subset of the input entries, SHALL return an empty array for an empty input array, and SHALL NOT modify the input array or any entry.
7. WHEN `filterEntries` is applied twice with the same filter, THE Graveyard_Logic SHALL return a result equal to applying it once.
8. THE Sort_Control SHALL provide exactly these five options: "Most abandoned first" (`score` descending, default), "Least abandoned first" (`score` ascending), "Name A to Z" (`name` ascending), "Most stars first" (`stars` descending) and "Longest silence first" (`daysInactive` descending, with null treated as larger than any number).
9. THE Graveyard_Logic SHALL export `sortEntries(entries, order)` that returns a new array containing the same entries with the same count, ordered by the selected key, and that breaks ties by `repo.name` ascending using code point comparison and then by `repo.url` ascending.
10. THE `sortEntries` function SHALL return the same order for the same input and SHALL NOT modify the input array or any entry.
11. THE Graveyard_Page SHALL apply `filterEntries` first and `sortEntries` second, and SHALL pass the identical resulting array to the Graveyard_Scene and the List_View.
12. IF the filters reduce the visible entries to zero while the total entry count is greater than zero, THEN THE Graveyard_Page SHALL show the text "No graves match these filters" and a "Clear filters" button, and SHALL keep the Filter_Bar visible.
13. WHEN the user activates the "Clear filters" button, THE Graveyard_Page SHALL unpress all Status buttons, set the Language `select` to "All languages", keep the current sort order, and show all entries.
14. THE Filter_Bar and Sort_Control SHALL render each control with a height of at least 44px and a visible text label that remains visible at all times.
15. WHEN a filter or sort value changes, THE Graveyard_Page SHALL update the visible stones within 400ms and SHALL keep keyboard focus on the control that changed.

### Requirement 10: Scene and list views

**User Story:** As a developer, I want a plain list that matches the scene, so that I can scan repos quickly and use assistive technology.

#### Acceptance Criteria

1. WHEN the Graveyard_Page loads, THE Graveyard_Page SHALL show a view toggle with exactly two buttons labelled "Scene" and "List", each exposing `aria-pressed`, with "Scene" having `aria-pressed="true"` and "List" having `aria-pressed="false"`.
2. WHEN the user activates the "List" or "Scene" button, THE Graveyard_Page SHALL show only the selected view, set `aria-pressed="true"` on the selected button and `aria-pressed="false"` on the other, and keep the current filter and sort values unchanged.
3. THE List_View SHALL show one row per visible entry, and each row SHALL contain, as text, the repo name, the Status label with an icon, the death score as an integer from 0 to 100, the cause of death label, the epitaph, the lifespan, and the star count.
4. THE List_View SHALL show the same entries in the same order as the Graveyard_Scene for the same filter and sort values.
5. THE List_View SHALL render each row's primary control as a native `button` element whose accessible name equals the accessible name of the matching Tombstone_Stone (repo name, Status and cause of death).
6. THE Graveyard_Scene SHALL lay out stones in a wrapping flow in sort order, with a gap of `--space-6` (24px) below the `md` breakpoint and `--space-8` (32px) at and above the `md` breakpoint.
7. WHILE the viewport width is 360px, THE Graveyard_Page SHALL show no horizontal scrollbar in either the Scene or the List_View, with stones wrapping to as few as 1 per row.
8. WHILE the viewport is at 200% zoom or has text-only enlargement of 200%, THE Graveyard_Page SHALL show no horizontal scrollbar in either the Scene or the List_View at a 360px width.
9. THE Graveyard_Scene SHALL keep DOM order equal to visual order, so that Tab order follows reading order.
10. THE Graveyard_Page SHALL give the Scene and the List_View each a heading or `aria-label` that names the view, and SHALL expose the Scene as a list of buttons with an `aria-label` of "Graveyard".
11. IF the visible entry set is empty for the current filter values, THEN THE Graveyard_Page SHALL show a text message in the active view stating that no repos match, and SHALL render zero stones and zero list rows.

### Requirement 11: Detail drawer

**User Story:** As a developer, I want to open a grave and read every fact about the repo, so that I can decide whether to revive it.

#### Acceptance Criteria

1. WHEN a user activates a Tombstone_Stone or List_View row by click, Enter or Space, THE Graveyard_Page SHALL open the Detail_Drawer for that entry within 400ms and SHALL keep the Detail_Drawer for only one entry open at a time.
2. WHEN the Detail_Drawer opens, THE Detail_Drawer SHALL show: the repo name as a heading, the Status label and icon, the score as "{score} of 100", the cause label, the epitaph, the lifespan text, the last commit date in `YYYY-MM-DD` (UTC) or "No commits recorded", Days_Inactive as the `describeFacts` text, open issue count, CI state ("Passing", "Failing" or "No CI"), dependency state ("Outdated", "Up to date" or "Unknown"), README state ("Has README" or "No README"), star count, language or "Unknown language", archived state ("Archived" or "Not archived"), and the description or "No description".
3. IF `repo.url` has the scheme `https` and the host `github.com`, THEN THE Detail_Drawer SHALL show a link to `repo.url` that opens in a new tab with `rel="noopener noreferrer"`.
4. IF `repo.url` does not have the scheme `https` and the host `github.com`, THEN THE Detail_Drawer SHALL NOT render a link to `repo.url`.
5. THE Detail_Drawer SHALL render the description and every other repo field as plain text and SHALL NOT interpret any field as HTML.
6. THE Detail_Drawer SHALL use `role="dialog"`, `aria-modal="true"` and an accessible name equal to the repo name.
7. WHEN the Detail_Drawer opens, THE Detail_Drawer SHALL move keyboard focus to the drawer heading.
8. WHILE the Detail_Drawer is open, THE Detail_Drawer SHALL keep keyboard focus inside the drawer, so that Tab from the last focusable element moves focus to the first and Shift+Tab from the first moves focus to the last.
9. WHEN the user presses Escape or activates the "Close" button, THE Detail_Drawer SHALL close and SHALL return keyboard focus to the control that opened it.
10. WHEN the user activates the backdrop, THE Detail_Drawer SHALL close and SHALL return keyboard focus to the control that opened it.
11. WHILE the viewport width is below 768px, THE Detail_Drawer SHALL appear as a bottom sheet of full viewport width and at most 85% of the viewport height, and SHALL scroll its content vertically inside the drawer when the content exceeds that height.
12. WHILE the viewport width is 768px or above, THE Detail_Drawer SHALL appear as a right-side panel of 420px width and full viewport height, and SHALL scroll its content vertically inside the drawer when the content exceeds that height.
13. THE Detail_Drawer SHALL keep the "Close" button at least 44px wide and at least 44px high.
14. WHILE the Detail_Drawer is open, THE Graveyard_Page SHALL prevent the background from scrolling, and WHEN the Detail_Drawer closes, THE Graveyard_Page SHALL restore background scrolling.
15. WHEN a re-scan completes and the open entry no longer appears in the data, THE Graveyard_Page SHALL close the Detail_Drawer and SHALL move keyboard focus to the Graveyard_Page main heading.
16. WHILE the user has enabled `prefers-reduced-motion: reduce`, THE Detail_Drawer SHALL open and close with no motion or with a fade of 150ms or less, and SHALL show the same content.

### Requirement 12: Resurrect placeholder

**User Story:** As a developer, I want to see where revival will happen, so that the path forward is clear even before it exists.

#### Acceptance Criteria

1. WHEN the Detail_Drawer opens for a Grave_Entry of any Status (`alive`, `dying`, `dead` or `ancient`), THE Resurrect_Area SHALL show exactly one button with the visible label "Resurrect".
2. THE Resurrect button SHALL have `aria-disabled="true"`, SHALL NOT have the `disabled` attribute, and SHALL remain reachable by the Tab key.
3. THE Resurrect_Area SHALL show the text "Revival plans are coming soon. This repo is only paused." and SHALL reference that text from the Resurrect button through `aria-describedby`.
4. WHEN the Resurrect button is activated by click, tap, Enter key or Space key, THE Graveyard_Page SHALL send 0 network requests, SHALL keep the Detail_Drawer open, and SHALL keep keyboard focus on the Resurrect button.
5. THE Resurrect button SHALL have a touch target of at least 44 by 44 px and SHALL show a visible focus ring of at least 2px when focused by keyboard.
6. THE Resurrect_Area SHALL be one self-contained component that accepts a single `Grave_Entry` as its input, so that a later spec can replace the placeholder without changing the Detail_Drawer layout.

### Requirement 13: Loading, empty and stale states

**User Story:** As a visitor, I want waiting and empty screens that match the app's voice, so that nothing feels broken.

#### Acceptance Criteria

1. WHILE the scan request is pending, THE Loading_State SHALL show fog rolling in, built from 1 to 3 Fog_Layer elements in SVG or CSS, and the text "Fog is rolling in. Counting graves…".
2. WHILE the scan request is pending, THE Loading_State SHALL expose `role="status"` with the same text as criterion 1, and SHALL mark every Fog_Layer `aria-hidden="true"`.
3. WHILE the scan request is pending and `prefers-reduced-motion: reduce` is set, THE Loading_State SHALL show the same text as criterion 1 with static fog and no looping animation.
4. WHEN the scan response is the code `empty_account` or contains zero repositories, THE Empty_State SHALL show a graveyard scene with zero tombstones, the heading "No graves here", and the text "Every repo is still alive, or none have been laid down yet."
5. WHEN the Empty_State follows a scan with a skipped-fork count of 1 or more and `includeForks` not true, THE Empty_State SHALL show the text "{n} forks were left out", where {n} is the skipped-fork count as a decimal integer, and an "Include forks" button of at least 44 by 44 px that is reachable and activatable with the keyboard.
6. WHEN the user activates the "Include forks" button, THE Graveyard_Page SHALL request a new scan with `includeForks` set to true and SHALL show the Loading_State until the response arrives.
7. IF the scan request started by the "Include forks" button fails, THEN THE Graveyard_Page SHALL keep showing the Empty_State and SHALL show an error message indicating that the scan could not be completed, with a retry control.
8. WHILE the Empty_State is shown, THE Graveyard_Page SHALL NOT show the Summary_Header, Filter_Bar or Sort_Control, and SHALL show a link back to the Landing_Page.
9. WHEN the scan response has `stale` set to true, THE Graveyard_Page SHALL show the Stale_Notice above the Summary_Header with the cached time in `YYYY-MM-DD HH:mm` UTC and the text "GitHub asked us to rest. Showing the graveyard as of {time}.", and SHALL keep rendering all cached entries.
10. WHERE the stale response includes a reset time, THE Stale_Notice SHALL add "You can try again after {time}" with the reset time in `HH:mm` UTC.
11. WHILE the Stale_Notice is shown, THE Stale_Notice SHALL use `role="status"` and SHALL pair an icon and text with `--color-ember`, so that the state is not conveyed by color alone.

### Requirement 14: Error states

**User Story:** As a visitor, I want errors explained gently and with a next step, so that I know what to do.

#### Acceptance Criteria

1. IF the scan response is HTTP 401 with the code `token_revoked`, THEN THE Error_State SHALL show the text "GitHub closed the door on our key. Sign in again to reopen the graveyard." and a "Sign in with GitHub" button.
2. IF the scan response is HTTP 401 with any other code, THEN THE Error_State SHALL show a message asking the visitor to sign in, a "Sign in with GitHub" button and a "Try demo graveyard" button.
3. IF the scan response is HTTP 429 with the code `rate_limited` and no stale result is available, THEN THE Error_State SHALL show the text "GitHub needs a moment to rest. Try again soon." and a "Try again" button.
4. IF the scan response is HTTP 429 with the code `rate_limited`, no stale result is available, and the response contains a valid reset time, THEN THE Error_State SHALL also show the reset time formatted as `HH:mm` in 24-hour UTC, followed by the label "UTC".
5. IF the scan response is HTTP 429 with the code `rate_limited` and the reset time is absent or is not a valid timestamp, THEN THE Error_State SHALL omit the reset time and SHALL NOT show a placeholder in its place.
6. IF the scan response is HTTP 404 with the code `account_not_found`, THEN THE Error_State SHALL show the text "We could not find this graveyard." and a link to the Landing_Page.
7. IF the scan response has the code `auth_not_configured`, or the demo graveyard is unavailable, THEN THE Error_State SHALL show the text "This door is sealed for now." and a link to the Landing_Page, and SHALL NOT show any environment variable name.
8. IF the scan response is HTTP 403 with the code `forbidden`, HTTP 502 with the code `github_unavailable` or `invalid_github_response`, or HTTP 500, THEN THE Error_State SHALL show one generic message in the product voice, written as paused rather than broken, and a "Try again" button.
9. IF the request ends in a network error or receives no response within 30 seconds, THEN THE Error_State SHALL show the same generic message as criterion 8 and a "Try again" button.
10. IF the response body fails the scan response schema, or the HTTP status or code is not listed in this requirement, THEN THE Error_State SHALL show the same generic message as criterion 8 and a "Try again" button.
11. WHEN the user activates "Try again", THE Scan_Client SHALL send exactly one new scan request and THE Graveyard_Page SHALL show the Loading_State until the request resolves.
12. WHEN the Error_State is shown, THE Error_State SHALL render an element with `role="alert"`, a heading, text, and an icon colored with `--color-ember`, and SHALL move keyboard focus to the heading.
13. THE Error_State SHALL NOT show a token, a raw error body, a stack trace, a validation issue, an HTTP status code or an HTTP status text.
14. THE Error_State SHALL NOT use the words "failed", "failure", "lazy", "quit" or "loser" (case-insensitive, whole words) and SHALL NOT describe the visitor's character, in any message defined in this requirement or in Requirements 2 and 13.
15. THE Error_State SHALL present every button and link with a touch target of at least 44 by 44 px and a visible focus ring, so that each action is usable by keyboard alone.

### Requirement 15: Design tokens, typography and layout

**User Story:** As a designer, I want the UI to follow the design system exactly, so that the graveyard looks consistent and passes review.

#### Acceptance Criteria

1. THE UI SHALL define every color through the Token_Colors in `src/app/globals.css`, and SHALL contain zero hex, rgb, rgba, hsl, hsla or CSS named color values (including `white` and `black`, but excluding `transparent` and `currentColor`) in any file under `src/components`, in any file under `src/app` other than `globals.css`, and in any file under `src/lib/graveyard`.
2. THE UI SHALL load Cinzel and Inter through `next/font/google`, exposing `--font-display` and `--font-body`.
3. IF the `next/font/google` load of Cinzel or Inter fails, THEN THE UI SHALL render the affected text with the fallback font (serif for Cinzel, sans-serif for Inter), SHALL keep all text visible, and SHALL show no error to the user.
4. THE UI SHALL apply the display font only to headings, tombstone names and epitaphs whose computed font size is 20px or larger, and SHALL apply the body font to all other text, numbers and metrics.
5. THE UI SHALL set body text to a computed font size of at least 16px and a computed line height of 1.5 times the font size.
6. THE UI SHALL use only the spacing values 4px, 8px, 12px, 16px, 24px, 32px, 48px and 64px (`--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12` and `--space-16`), and only the radius tokens `--radius-sm` (6px), `--radius-md` (12px), `--radius-lg` (20px), `--radius-tomb` and `--radius-full` (9999px), for padding, margin, gap and border radius.
7. THE Tombstone_Stone SHALL use `--radius-tomb` for its top edge.
8. THE UI SHALL write base styles for viewports from 360px wide and SHALL add rules only at the Breakpoints `sm`, `md` and `lg` using upward (min-width) queries, with zero max-width media queries.
9. THE UI SHALL render a dark theme only, SHALL define no light theme, and SHALL ignore the `prefers-color-scheme: light` setting.
10. THE UI SHALL use `--color-glow` and `--color-ember` as the only accent colors, and SHALL add no other accent color token.

### Requirement 16: Motion and reduced motion

**User Story:** As a user sensitive to motion, I want the graveyard to stay readable with no animation, so that nothing blocks or bothers me.

#### Acceptance Criteria

1. THE UI SHALL use a duration of 200ms for hover and focus transitions, 400ms for enter and exit transitions, and a duration from 1200ms to 6000ms for each looping animation.
2. THE UI SHALL use only ease-in-out or ease-out easing for every transition and loop, with no bounce, snap or shake easing.
3. THE UI SHALL animate only `opacity` and `transform` for loops and transitions.
4. THE UI SHALL wrap the app root in Framer Motion `MotionConfig` with `reducedMotion="user"`.
5. WHILE the `prefers-reduced-motion: reduce` setting is active, THE UI SHALL run zero looping animations, meaning zero CSS animations with infinite iteration and zero repeating Framer Motion animations.
6. WHILE the `prefers-reduced-motion: reduce` setting is active, THE UI SHALL replace each enter and exit transition with an instant change or a fade of 150ms or less.
7. WHILE the `prefers-reduced-motion: reduce` setting is active, THE Candle SHALL appear as a static lit flame, and each Fog_Layer SHALL appear in a static position at the same density as in the motion-enabled state, so that every status, score and cause of death remains readable as text.
8. WHEN the `prefers-reduced-motion` setting changes while the page is open, THE UI SHALL apply the new motion behavior within 400ms without a page reload.
9. THE UI SHALL contain no animation that changes brightness or opacity more than 3 times in any 1000ms window.
10. WHEN a Tombstone_Stone receives hover or keyboard focus, THE UI SHALL change its glow or border within 200ms, and the stone's hit area SHALL keep the same position and size (0px shift).
11. WHILE any animation is running, THE UI SHALL keep every control, including each Tombstone_Stone, clickable and keyboard-operable, and no animation SHALL cover or hide text content.

### Requirement 17: Accessibility

**User Story:** As a user with a disability, I want to use the graveyard with a keyboard and a screen reader, so that I get the same information as everyone else.

#### Acceptance Criteria

1. THE UI SHALL reach a contrast ratio of at least 4.5:1 for body text (text smaller than 24px, or smaller than 18.66px when bold) and at least 3:1 for large text (24px or larger, or 18.66px or larger when bold) and for UI component boundaries, for every text and background token pair used.
2. THE UI SHALL include a Vitest unit test that parses the token values from `src/app/globals.css`, computes the WCAG contrast ratio of each text and background pair the UI uses, and fails WHEN any pair is below its required ratio.
3. THE UI SHALL NOT place `--color-text-muted` text on a `--color-glow` or `--color-ember` background.
4. THE UI SHALL make every interactive element reachable and operable with the keyboard (Tab and Shift+Tab to move focus, Enter or Space to activate), in an order that follows the visual reading order (top to bottom, then left to right).
5. WHILE an interactive element has keyboard focus, THE UI SHALL show a focus ring of at least 2px width in `--color-focus` with an offset of at least 2px, and the focus ring SHALL NOT be clipped by any parent container.
6. THE UI SHALL give every interactive element a size of at least 44px by 44px, including toggle buttons, the view toggle, the Close button and each Tombstone_Stone, at viewport widths from 360px to 1920px.
7. THE UI SHALL pair each Status, CI state and dependency state with a visible text label, and SHALL pair each of the four Status values (`alive`, `dying`, `dead`, `ancient`) with an icon of a distinct shape, so that no state is conveyed by color alone.
8. THE UI SHALL set a non-empty `lang` attribute on the `html` element and SHALL render exactly one `h1` per page.
9. THE UI SHALL render a "Skip to graveyard" link as the first focusable element on the Graveyard_Page.
10. WHEN the "Skip to graveyard" link is activated, THE UI SHALL move keyboard focus to the main content region of the Graveyard_Page.
11. WHEN the Graveyard_Page is viewed at 200% browser zoom at a 1280px viewport, or WHEN text-only enlargement of 200% is applied, THE Graveyard_Page SHALL show every control and all text with no clipped content and no horizontal scrollbar.
12. THE UI SHALL set `aria-hidden="true"` on every decorative element (fog, particles, and other layers that carry no text) and SHALL NOT set `aria-hidden` on any interactive element or any element that holds text content.

### Requirement 18: Performance

**User Story:** As a visitor on a phone, I want the pages to load fast, so that the haunting does not cost me waiting time.

#### Acceptance Criteria

1. THE UI SHALL draw stones, fog, candles, cracks, vines and the hero scene with inline SVG and CSS, and SHALL request zero raster image files (PNG, JPEG, GIF, WebP, AVIF) on the Landing_Page and the Graveyard_Page, other than the user's GitHub avatar WHEN the user is signed in.
2. THE Landing_Page SHALL transfer no more than 200 kB of JavaScript, CSS and HTML combined, measured gzip-compressed with fonts excluded, in a production build.
3. THE UI SHALL set `font-display: swap` for both the Display font and the Body font through `next/font/google`.
4. WHILE 300 stones are displayed, WHEN the Graveyard_Page first renders the stones or the user changes a filter, THE Graveyard_Page SHALL finish rendering all 300 stones within 400 ms, measured on a 4x CPU slowdown profile.
5. WHEN the Graveyard_Page renders stones for the first time, THE Graveyard_Page SHALL give each stone a fixed width and height computed from `stoneSize` and SHALL produce a Cumulative Layout Shift score of 0.01 or lower from that render until 5 seconds after it.
6. THE Graveyard_Page SHALL render each Fog_Layer, Candle, Cracks and Vines element from shared SVG definitions or CSS classes, and SHALL NOT include the same inline SVG path data more than once per stone variant.

### Requirement 19: Unit tests

**User Story:** As a maintainer, I want example tests for the exact rules, so that a change to a threshold shows up immediately.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL include Vitest unit tests in `*.test.ts` files next to the code, covering each exported function with at least one success case and at least one failure or boundary case.
2. THE unit tests SHALL assert `stoneSize` at 0, 1, 10, 100, 1000 and 1,000,000 stars, and for `NaN`, a negative value (-1) and a non-integer value (1.5), and SHALL assert for each case the exact expected returned size or the exact expected fallback.
3. THE unit tests SHALL assert `fogLayerCount` for 0, 0.33, 0.66 and 1, and for the invalid values `NaN`, -0.1 and 1.1, and SHALL assert for each case the exact expected layer count.
4. THE unit tests SHALL assert `formatLifespan` for a valid last commit, a valid `createdAt` with a different year, a valid `createdAt` with the same year, a null `lastCommitAt`, an invalid date string, and a date of 2023-12-31T23:59:59Z, and SHALL assert that the date of 2023-12-31T23:59:59Z yields the year 2023 when the tests run under at least two different time zone settings, one of them UTC.
5. THE unit tests SHALL assert `buildAccessibleName` and `describeFacts` for a count of 1 (singular), a count of 2 (plural), a count of 0, a null `daysInactive` and an empty name, and SHALL assert for each case the exact expected output string.
6. THE unit tests SHALL assert `sortEntries` for each of the five sort orders, including, for each order, a tie broken by name and an entry with a null `daysInactive`, and SHALL assert the exact expected order of entries.
7. THE unit tests SHALL assert `filterEntries` for an empty `statuses` list, one status, several statuses, a language, an unknown language (null) and a filter that matches nothing, and SHALL assert for each case the exact expected set of returned entries (an empty list for the no-match case).
8. THE unit tests SHALL pass a fixed `now` value to every call that takes a time input, and SHALL NOT read the system clock in any test file.
9. WHEN `npm run test` is run on an unmodified checkout, THE unit tests SHALL finish with all tests passing, no skipped tests and exit code 0.

### Requirement 20: Property-based tests

**User Story:** As a maintainer, I want properties checked over many generated inputs, so that edge cases I did not think of are caught.

#### Acceptance Criteria

1. THE Graveyard_Logic SHALL include fast-check property tests, each running at least 100 generated cases, tagged `Feature: graveyard-ui, Property N: <title>`, where N is a unique integer starting at 1 and increasing by 1 with no gaps or repeats.
2. THE property tests SHALL check, for all arrays of Grave_Entry values from 0 to 200 entries, that `countByStatus` returns exactly four non-negative integers (one each for `alive`, `dying`, `dead` and `ancient`), that their sum equals the array length, and that each count equals the number of entries with that Status.
3. THE property tests SHALL check, for all arrays of Grave_Entry values from 0 to 200 entries and all filters, that `filterEntries` returns a subset in the original relative order, that every result matches the filter, that no matching entry is dropped, and that applying the filter twice equals applying it once (idempotence).
4. THE property tests SHALL check, for all arrays of Grave_Entry values from 0 to 200 entries and all five sort orders, that `sortEntries` returns a permutation of the input (same length, same elements), that every pair of adjacent elements satisfies the sort order, that the input array is unchanged after the call (same length, same element references, same positions), and that sorting twice equals sorting once.
5. THE property tests SHALL check, for all arrays of Grave_Entry values from 0 to 200 entries whose entries have distinct names and distinct URLs, that sorting a shuffled copy of the array gives the same order as sorting the original (confluence), for each of the five sort orders.
6. THE property tests SHALL check, for all arrays of Grave_Entry values from 0 to 200 entries, all filters and all five sort orders, that filtering then sorting gives the same result as sorting then filtering (confluence of filter and sort), for arrays whose entries have distinct names and URLs.
7. THE property tests SHALL check, for all integers and non-integer numbers, including negative values, `NaN`, `Infinity` and `-Infinity`, that `stoneSize` never throws, returns a width from 96 to 160 inclusive and a height from 120 to 200 inclusive, and never returns a smaller width for a larger finite `stars` value (monotonic non-decreasing).
8. THE property tests SHALL check, for all `RepoHealth` and `Tombstone` pairs, including repo names of 0 to 200 characters containing any Unicode characters, that `buildAccessibleName` returns a non-empty string containing the repo name (or "Unnamed repository" when the name is an empty string), the status label and the cause label, and containing none of the substrings "undefined", "null" and "NaN" except where that substring is part of the repo name.
9. THE property tests SHALL check, for all Grave_Entry values, that `describeFacts` returns the same string on repeated calls with the same input, contains "CI failing" if and only if `scene.cracks` is true, and contains "outdated dependencies" if and only if `scene.vines` is true.
10. THE property tests SHALL check, for all `lastCommitAt` values that are valid ISO 8601 strings, invalid strings (including the empty string) or null, that `formatLifespan` never throws, returns a non-empty string, and returns the same string for the same input under each of at least two different `TZ` environment values, one of which is `UTC`.
11. THE property tests SHALL check, for all arrays of `RepoHealth` values from 0 to 200 entries and a valid `now`, that `buildGraveEntries` returns an array with the same length and order as the input, and that every `tombstone` in the result passes `TombstoneSchema` validation.
12. THE property tests SHALL check, for all `fog` values from the set {0, 0.33, 0.66, 1}, that `fogLayerCount` returns an integer from 0 to 3 inclusive, and that the returned value for a larger `fog` is greater than or equal to the value for a smaller `fog`.
13. THE property tests SHALL pass `now` as an argument to every call that takes a time input and SHALL NOT read the system clock (including `Date.now()` and `new Date()` with no arguments), so that a failing case reproduces from the fast-check seed.
14. IF a property test fails, THEN THE property tests SHALL report the fast-check seed and the shrunk counterexample, so that the failure can be replayed with the same seed.

### Requirement 21: End-to-end tests

**User Story:** As a maintainer, I want browser tests of the real pages with a mocked scan route, so that the whole flow is checked without touching GitHub.

#### Acceptance Criteria

1. THE Playwright tests SHALL live in `e2e/` and SHALL mock `POST /api/scan` with `page.route`, using responses that parse against the auth-ingestion scan response schema.
2. IF any browser request goes to a host other than the application's own origin and the fonts host, THEN THE Playwright tests SHALL fail the running test.
3. THE Playwright tests SHALL assert that the count of requests to `api.github.com`, `github.com` and any LLM provider host is 0 in every test.
4. WHEN the Landing_Page loads, THE Playwright tests SHALL check that it shows exactly one `h1`, a "Sign in with GitHub" button and a "Try demo graveyard" button.
5. WHEN "Try demo graveyard" is activated, THE Playwright tests SHALL check that the browser navigates to `/graveyard?demo=1` and that exactly one scan request is sent with `demo` set to true.
6. WHEN "Sign in with GitHub" is activated, THE Playwright tests SHALL check that exactly one request to the Auth.js GitHub sign-in route is made, and that the test intercepts and fulfills that request without it reaching `github.com`.
7. WHEN the Graveyard_Page loads with a mocked response of at least 6 repositories covering all four Status values, THE Playwright tests SHALL check that the Summary_Header shows the expected count for each of `alive`, `dying`, `dead` and `ancient`, and that each stone is a `button` whose accessible name has the form "{name}, {status}, {cause}".
8. WHEN the Graveyard_Page loads with that mocked response, THE Playwright tests SHALL check that a stone shows the candle, cracks or vines decoration if and only if its `candle`, `cracks` or `vines` value is true, and shows no decoration for each value that is false.
9. WHEN the Graveyard_Page loads with mocked repos having 0 stars and 1000 stars, THE Playwright tests SHALL check that their stone widths are 96px and 160px respectively.
10. WHEN a Status button is toggled, a Language is chosen, or the Sort_Control is changed, THE Playwright tests SHALL check that the visible stones and their order match the expected result and that the Summary_Header counts are unchanged.
11. WHEN "Clear filters" is activated, THE Playwright tests SHALL check that all stones from the mocked response are visible again.
12. WHEN the List_View is shown, THE Playwright tests SHALL check that it lists the same entries as the Scene, in the same order.
13. WHEN Enter is pressed on a focused stone, THE Playwright tests SHALL check that the Detail_Drawer opens with the `dialog` role and that keyboard focus moves to an element inside it.
14. WHILE the Detail_Drawer is open, THE Playwright tests SHALL check that after 20 consecutive Tab presses, and after 20 consecutive Shift+Tab presses, the focused element is always inside the drawer.
15. WHEN Escape is pressed while the Detail_Drawer is open, THE Playwright tests SHALL check that the drawer closes and that focus returns to the stone that opened it.
16. WHEN the Detail_Drawer is open, THE Playwright tests SHALL check that the Resurrect button is present, focusable, has `aria-disabled="true"`, and that activating it sends 0 network requests.
17. WHILE a mocked scan response is delayed by at least 1000 ms, THE Playwright tests SHALL check that the Loading_State is visible and that it is no longer visible after the response arrives.
18. WHEN the mocked response is `empty_account`, THE Playwright tests SHALL check that the Empty_State is shown.
19. IF the mocked scan response is a 401 `token_revoked`, a 429 `rate_limited`, a 404 `account_not_found`, a 502 `github_unavailable`, or a body that fails schema validation, THEN THE Playwright tests SHALL check, in a separate test for each case, that the Error_State is shown with text matching that case and that no raw response body or token value is visible.
20. WHEN a mocked 429 response includes a cached result with `stale` true, THE Playwright tests SHALL check that the Stale_Notice is shown together with the cached stones.
21. WHILE running with `reducedMotion: "reduce"`, THE Playwright tests SHALL check on the Landing_Page and the Graveyard_Page that `document.getAnimations()` contains 0 animations with infinite iteration count.
22. WHILE running at a 360px by 640px viewport, THE Playwright tests SHALL check that `document.documentElement.scrollWidth` is at most 360 on the Landing_Page, the Scene, the List_View and the open Detail_Drawer, and that the Detail_Drawer is anchored to the bottom edge of the viewport and spans its full width.
23. WHILE running at a 360px by 640px viewport, THE Playwright tests SHALL check that every visible interactive element on the Graveyard_Page has a bounding box of at least 44px width and 44px height.
24. WHEN Tab is pressed repeatedly from the top of the Graveyard_Page, THE Playwright tests SHALL check that focus reaches, in this order, the skip link, the Filter_Bar controls, the Sort_Control, the view toggle, and then the stones in their visual order.
25. WHEN `npm run e2e` is run on an unmodified checkout, THE Playwright tests SHALL finish with 100% of tests passing and exit code 0, with no real GitHub or LLM credentials set.
