import { expect, test } from "@playwright/test";
import {
  DEMO_SCAN_RESPONSE,
  FIXED_NOW,
  MOCK_PLAN,
  MOCK_RESURRECT_RESPONSE,
  TARGET_REPO,
} from "./fixtures/demo";

/**
 * Demo path: landing page, Try demo graveyard, tombstones, open one, Resurrect,
 * revival plan. Both API calls are mocked at the browser boundary, so the test
 * needs no GitHub, no LLM key and no network, and the data never changes.
 */
test("demo path: from the landing page to a revival plan", async ({ page }) => {
  // Scoring runs in the browser, so pin the clock to keep statuses stable.
  await page.clock.setFixedTime(FIXED_NOW);

  const scanBodies: unknown[] = [];
  const resurrectBodies: unknown[] = [];
  const externalHosts = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "localhost") externalHosts.add(url.hostname);
  });

  await page.route("**/api/scan", async (route) => {
    scanBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEMO_SCAN_RESPONSE),
    });
  });

  await page.route("**/api/resurrect", async (route) => {
    resurrectBodies.push(route.request().postDataJSON());
    // A short wait makes the loading state observable without making the test slow.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RESURRECT_RESPONSE),
    });
  });

  // 1. Landing page.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub" }),
  ).toBeVisible();

  // 2. Try the demo graveyard.
  await page.getByRole("button", { name: "Try demo graveyard" }).click();
  await expect(page).toHaveURL(/\/graveyard\?demo=1$/);

  // 3. Wait for tombstones. Each stone is a button named "{name}, {status}, {cause}".
  const stones = page.getByRole("button", {
    name: /^.+, (Alive|Dying|Dead|Ancient), .+$/,
  });
  await expect(stones).toHaveCount(DEMO_SCAN_RESPONSE.repos.length);
  expect(scanBodies).toHaveLength(1);
  expect(scanBodies[0]).toMatchObject({ demo: true });

  // 4. Open one tombstone.
  await page.getByRole("button", { name: new RegExp(`^${TARGET_REPO}, `) }).click();
  const drawer = page.getByRole("dialog", { name: TARGET_REPO });
  await expect(drawer).toBeVisible();

  // 5. Resurrect.
  await drawer.getByRole("button", { name: "Resurrect" }).click();
  await expect(drawer.getByRole("status")).toContainText(
    "The fog is gathering",
  );

  // 6. The revival plan appears.
  await expect(
    drawer.getByRole("heading", { name: "Revival plan" }),
  ).toBeVisible();
  await expect(drawer.getByText(MOCK_PLAN.diagnosis)).toBeVisible();
  await expect(drawer.getByText(MOCK_PLAN.smallestNextStep)).toBeVisible();
  await expect(drawer.getByText("A weekend")).toBeVisible();

  // The resurrect request named the right repo and used demo mode. No owner is sent.
  expect(resurrectBodies).toHaveLength(1);
  expect(resurrectBodies[0]).toMatchObject({ repo: TARGET_REPO, demo: true });
  expect(resurrectBodies[0]).not.toHaveProperty("owner");

  // Nothing left the app: no GitHub, no LLM provider.
  expect([...externalHosts].filter((host) => !host.includes("font"))).toEqual(
    [],
  );
});
