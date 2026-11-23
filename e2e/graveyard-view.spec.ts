import { expect, test } from "@playwright/test";
import { DEMO_REPOS, DEMO_SCAN_RESPONSE, FIXED_NOW } from "./fixtures/demo";

/** The view toggle: Graveyard (default) or List, remembered in the URL as ?view=list. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.route("**/api/scan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEMO_SCAN_RESPONSE),
    });
  });
});

const toggle = (page: import("@playwright/test").Page, name: "Graveyard" | "List") =>
  page.getByRole("group", { name: "View" }).getByRole("button", { name, exact: true });

test("defaults to the graveyard and keeps the choice in the URL", async ({ page }) => {
  // Three page loads (open, toggle, reload) in one test, so it gets more time than the default.
  test.setTimeout(90_000);
  await page.goto("/graveyard?demo=1");
  await expect(toggle(page, "Graveyard")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(page, "List")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("list", { name: "Graveyard" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Graveyard list" })).toHaveCount(0);

  const box = await toggle(page, "List").boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await toggle(page, "List").click();
  await expect(toggle(page, "List")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/graveyard\?demo=1&view=list$/);
  const table = page.getByRole("table", { name: "Graveyard list" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("list", { name: "Graveyard" })).toHaveCount(0);
  await expect(table.getByRole("row")).toHaveCount(DEMO_REPOS.length + 1);
  await expect(table.getByRole("columnheader")).toHaveText(["Repo", "Status", "Cause", "Last commit", "Stars", "CI"]);

  // The URL is the memory: a reload keeps the list.
  await page.reload();
  await expect(toggle(page, "List")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table", { name: "Graveyard list" })).toBeVisible();

  await toggle(page, "Graveyard").click();
  await expect(page).toHaveURL(/\/graveyard\?demo=1$/);
  await expect(page.getByRole("list", { name: "Graveyard" })).toBeVisible();
});

test("the list uses the same filter chips, sort and summary", async ({ page }) => {
  await page.goto("/graveyard?demo=1&view=list");
  const table = page.getByRole("table", { name: "Graveyard list" });
  await expect(table).toBeVisible();
  await expect(page.locator(".graveyard-summary")).toContainText(`${DEMO_REPOS.length} repos`);

  await page.getByRole("button", { name: /^Ancient/ }).click();
  const shown = await table.getByRole("row").count();
  await expect(page.locator(".graveyard-results")).toContainText(`Showing ${shown - 1} of ${DEMO_REPOS.length}`);

  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByLabel("Sort by").selectOption("stars");
  const stars = await table.locator("tbody tr td:nth-child(5)").allTextContents();
  const numbers = stars.map(Number);
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
});

test("a repo in the list opens the drawer and focus returns to its button", async ({ page }) => {
  await page.goto("/graveyard?demo=1&view=list");
  const open = page.getByRole("button", { name: DEMO_REPOS[0]?.name ?? "", exact: true });
  await open.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(open).toBeFocused();
});

test("the list fits a 360px phone with no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/graveyard?demo=1&view=list");
  await expect(page.getByRole("table", { name: "Graveyard list" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
