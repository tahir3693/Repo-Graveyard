# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: issue-button.spec.ts >> demo mode: File this issue is look-only and sends no request
- Location: e2e\issue-button.spec.ts:14:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('dialog', { name: 'todo-app' }).getByText('Filing')
Expected: 0
Received: 1
Timeout:  7000ms

Call log:
  - Expect "toHaveCount" getByRole('dialog', { name: 'todo-app' }).getByText('Filing') with timeout 7000ms
  - waiting for getByRole('dialog', { name: 'todo-app' }).getByText('Filing')
    17 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to graveyard" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - main [ref=e3]:
    - generic [ref=e4]:
      - link "Back to home" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [aria-hidden] [ref=e7]: ←
        - text: Back to home
      - heading "The Graveyard" [level=1] [ref=e8]
      - paragraph [ref=e9]: "4 repos: 1 alive, 0 dying, 2 dead, 1 ancient"
      - paragraph [ref=e10]: Demo
    - generic [ref=e11]:
      - group "Filter by status" [ref=e12]:
        - button "All 4" [pressed] [ref=e13] [cursor=pointer]:
          - generic [aria-hidden] [ref=e14]: ✓
          - text: All
          - generic [ref=e15]: "4"
        - button "Alive 1" [ref=e16] [cursor=pointer]:
          - text: Alive
          - generic [ref=e17]: "1"
        - button "Dying 0" [ref=e18] [cursor=pointer]:
          - text: Dying
          - generic [ref=e19]: "0"
        - button "Dead 2" [ref=e20] [cursor=pointer]:
          - text: Dead
          - generic [ref=e21]: "2"
        - button "Ancient 1" [ref=e22] [cursor=pointer]:
          - text: Ancient
          - generic [ref=e23]: "1"
      - generic [ref=e24]:
        - generic [ref=e25]: Sort by
        - combobox "Sort by" [ref=e26] [cursor=pointer]:
          - option "Newest activity" [selected]
          - option "Oldest activity"
          - option "Most stars"
    - status [ref=e27]: Showing 4 of 4 repos
    - generic [ref=e29]:
      - paragraph [ref=e30]: 1 of 4 repos alive. The moon is brighter when more repos are alive.
      - list "Graveyard" [ref=e32]:
        - listitem [ref=e33]:
          - button "fresh-start, Alive, Still active" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: fresh-start
            - generic [ref=e36]: Alive
            - generic [ref=e39]: Still active
            - generic [ref=e40]: fresh-start stirs. 12 stars watch it rise.
        - listitem [ref=e41]:
          - button "todo-app, Dead, Abandoned with failing CI" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: todo-app
            - generic [ref=e44]: Dead
            - generic [ref=e47]: Abandoned with failing CI
            - generic [ref=e48]: todo-app rests with red tests. A fix could wake it.
        - listitem [ref=e49]:
          - button "old-blog-engine, Dead, Outdated and forgotten" [ref=e50] [cursor=pointer]:
            - generic [ref=e51]: old-blog-engine
            - generic [ref=e52]: Dead
            - generic [ref=e55]: Outdated and forgotten
            - generic [ref=e56]: Vines cover old-blog-engine's old deps. Prune to revive.
        - listitem [ref=e57]:
          - button "retired-cli, Ancient, Archived and laid to rest" [ref=e58] [cursor=pointer]:
            - generic [ref=e59]: retired-cli
            - generic [ref=e60]: Ancient
            - generic [ref=e63]: Archived and laid to rest
            - generic [ref=e64]: retired-cli is archived, resting until someone reopens it.
    - dialog "todo-app" [ref=e65]:
      - generic [ref=e66]:
        - generic [ref=e67]:
          - heading "todo-app" [level=2] [ref=e68]
          - button "Close" [ref=e69] [cursor=pointer]:
            - generic [aria-hidden] [ref=e70]: ×
            - text: Close
        - paragraph [ref=e71]:
          - generic [ref=e72]: Dead
          - generic [ref=e75]: Death score 69 of 100
        - paragraph [ref=e76]: "Cause of death: Abandoned with failing CI"
      - generic [ref=e77]:
        - generic "Repo facts" [ref=e78]:
          - generic [ref=e79]:
            - term [ref=e80]: Last commit
            - definition [ref=e81]: 6 months ago
          - generic [ref=e82]:
            - term [ref=e83]: Stars
            - definition [ref=e84]: "3"
          - generic [ref=e85]:
            - term [ref=e86]: CI
            - definition [ref=e87]: Failing
          - generic [ref=e88]:
            - term [ref=e89]: Dependencies
            - definition [ref=e90]: Outdated
          - generic [ref=e91]:
            - term [ref=e92]: Open issues
            - definition [ref=e93]: "4"
        - paragraph [ref=e94]: todo-app rests with red tests. A fix could wake it.
        - link "Open on GitHub" [ref=e95] [cursor=pointer]:
          - /url: https://github.com/demo-user/todo-app
        - region "Resurrect todo-app" [ref=e96]:
          - status [ref=e97]: Revival plan ready for todo-app.
          - generic [ref=e98]:
            - heading "Revival plan" [level=3] [ref=e99]
            - region "Diagnosis" [ref=e100]:
              - heading "Diagnosis" [level=4] [ref=e101]
              - paragraph [ref=e102]: Paused after the dependencies drifted out of date. Nothing here is broken beyond repair.
            - region "Smallest next step" [ref=e103]:
              - heading "Smallest next step" [level=4] [ref=e104]
              - paragraph [ref=e105]: Bump the dependencies, run the tests, and fix the first red one.
            - region "Time estimate" [ref=e106]:
              - heading "Time estimate" [level=4] [ref=e107]
              - paragraph [ref=e108]: A weekend
            - region "Drafted issue" [ref=e109]:
              - heading "Drafted issue" [level=4] [ref=e110]
              - heading "Issue title" [level=5] [ref=e111]
              - paragraph [ref=e112]: "Revive todo-app: update dependencies"
              - heading "Issue body" [level=5] [ref=e113]
              - region "Issue body, read-only preview" [ref=e114]: Start with the lockfile, then re-run CI and fix whatever turns red first.
              - generic [ref=e115]:
                - button "Copy issue" [ref=e116] [cursor=pointer]
                - button "File this issue" [disabled] [active] [ref=e117]
              - paragraph [ref=e118]: Filing issues is turned off in the demo.
              - status
  - alert [ref=e119]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import {
  3  |   DEMO_SCAN_RESPONSE,
  4  |   MOCK_PLAN,
  5  |   MOCK_RESURRECT_RESPONSE,
  6  |   TARGET_REPO,
  7  | } from "./fixtures/demo";
  8  | 
  9  | /**
  10 |  * Demo graveyards are look-only: "File this issue" is focusable, announced as
  11 |  * disabled, explains why, and sends no request. The clock is not pinned here
  12 |  * because a pinned clock freezes Framer Motion.
  13 |  */
  14 | test("demo mode: File this issue is look-only and sends no request", async ({ page }) => {
  15 |   const issueRequests: string[] = [];
  16 |   page.on("request", (request) => {
  17 |     if (new URL(request.url()).pathname === "/api/issue") {
  18 |       issueRequests.push(request.url());
  19 |     }
  20 |   });
  21 |   await page.route("**/api/scan", (route) =>
  22 |     route.fulfill({
  23 |       status: 200,
  24 |       contentType: "application/json",
  25 |       body: JSON.stringify(DEMO_SCAN_RESPONSE),
  26 |     }),
  27 |   );
  28 |   await page.route("**/api/resurrect", (route) =>
  29 |     route.fulfill({
  30 |       status: 200,
  31 |       contentType: "application/json",
  32 |       body: JSON.stringify(MOCK_RESURRECT_RESPONSE),
  33 |     }),
  34 |   );
  35 | 
  36 |   await page.goto("/graveyard?demo=1");
  37 |   await page.getByRole("button", { name: new RegExp(`^${TARGET_REPO}, `) }).click();
  38 |   const drawer = page.getByRole("dialog", { name: TARGET_REPO });
  39 |   await drawer.getByRole("button", { name: "Resurrect" }).click();
  40 |   await expect(drawer.getByText(MOCK_PLAN.diagnosis)).toBeVisible();
  41 | 
  42 |   // The issue preview is shown read-only before the button.
  43 |   await expect(drawer.getByText("Issue title")).toBeVisible();
  44 |   const body = drawer.getByRole("region", { name: /Issue body/ });
  45 |   await expect(body).toBeVisible();
  46 |   await expect(body).toHaveAttribute("tabindex", "0");
  47 | 
  48 |   const button = drawer.getByRole("button", { name: "File this issue" });
  49 |   await expect(button).toBeVisible();
  50 |   await expect(button).toHaveAttribute("aria-disabled", "true");
  51 |   await expect(button).not.toHaveAttribute("disabled", /.*/);
  52 | 
  53 |   const describedBy = await button.getAttribute("aria-describedby");
  54 |   expect(describedBy).toBeTruthy();
  55 |   const note = page.locator(`[id="${describedBy}"]`);
  56 |   await expect(note).toBeVisible();
  57 |   await expect(note).toContainText("Filing issues is turned off in the demo.");
  58 | 
  59 |   // Reachable by keyboard.
  60 |   await button.focus();
  61 |   await expect(button).toBeFocused();
  62 |   await page.keyboard.press("Enter");
  63 |   await page.keyboard.press("Space");
  64 |   await button.click({ force: true });
  65 | 
  66 |   await expect(button).toBeFocused();
> 67 |   await expect(drawer.getByText("Filing")).toHaveCount(0);
     |                                            ^ Error: expect(locator).toHaveCount(expected) failed
  68 |   await expect(drawer.getByText("Issue filed")).toHaveCount(0);
  69 |   expect(issueRequests).toEqual([]);
  70 | });
  71 | 
```