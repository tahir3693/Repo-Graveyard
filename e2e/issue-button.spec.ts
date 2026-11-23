import { expect, test } from "@playwright/test";
import {
  DEMO_SCAN_RESPONSE,
  MOCK_PLAN,
  MOCK_RESURRECT_RESPONSE,
  TARGET_REPO,
} from "./fixtures/demo";

/**
 * Demo graveyards are look-only: "File this issue" is focusable, announced as
 * disabled, explains why, and sends no request. The clock is not pinned here
 * because a pinned clock freezes Framer Motion.
 */
test("demo mode: File this issue is look-only and sends no request", async ({ page }) => {
  const issueRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/issue") {
      issueRequests.push(request.url());
    }
  });
  await page.route("**/api/scan", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEMO_SCAN_RESPONSE),
    }),
  );
  await page.route("**/api/resurrect", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RESURRECT_RESPONSE),
    }),
  );

  await page.goto("/graveyard?demo=1");
  await page.getByRole("button", { name: new RegExp(`^${TARGET_REPO}, `) }).click();
  const drawer = page.getByRole("dialog", { name: TARGET_REPO });
  await drawer.getByRole("button", { name: "Resurrect" }).click();
  await expect(drawer.getByText(MOCK_PLAN.diagnosis)).toBeVisible();

  // The issue preview is shown read-only before the button.
  await expect(drawer.getByText("Issue title")).toBeVisible();
  const body = drawer.getByRole("region", { name: /Issue body/ });
  await expect(body).toBeVisible();
  await expect(body).toHaveAttribute("tabindex", "0");

  const button = drawer.getByRole("button", { name: "File this issue" });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).not.toHaveAttribute("disabled", /.*/);

  const describedBy = await button.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const note = page.locator(`[id="${describedBy}"]`);
  await expect(note).toBeVisible();
  await expect(note).toContainText("Filing issues is turned off in the demo.");

  // Reachable by keyboard.
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await button.click({ force: true });

  await expect(button).toBeFocused();
  await expect(drawer.getByText(/^Filing…$/)).toHaveCount(0);
  await expect(drawer.getByText("Issue filed")).toHaveCount(0);
  expect(issueRequests).toEqual([]);
});
