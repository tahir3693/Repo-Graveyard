import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_SCAN_RESPONSE,
  MOCK_PLAN,
  MOCK_RESURRECT_RESPONSE,
  TARGET_REPO,
} from "./fixtures/demo";

/**
 * The resurrection moment: when the plan arrives, the opened stone lights its candle, the
 * fog clears, one violet glow swells, and the badge changes from its death state to
 * "Reviving". It must never block the plan or trap focus, and under reduced motion it jumps
 * straight to the end state. The clock is not pinned here: a pinned clock freezes Framer Motion.
 */
async function mockApis(page: Page) {
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
}

async function openDrawer(page: Page) {
  await page.goto("/graveyard?demo=1");
  const stone = page.getByRole("button", { name: new RegExp(`^${TARGET_REPO}, `) });
  await stone.click();
  const drawer = page.getByRole("dialog", { name: TARGET_REPO });
  await expect(drawer).toBeVisible();
  return { stone, drawer };
}

test("the badge changes from its death state to Reviving when the plan arrives", async ({ page }) => {
  await mockApis(page);
  const { drawer } = await openDrawer(page);
  const badge = drawer.locator(".drawer-status");

  // Before: a status from the rules, with its own word.
  await expect(badge).not.toHaveText("Reviving");
  await expect(badge).toHaveText(/^(Alive|Dying|Dead|Ancient)$/);

  await drawer.getByRole("button", { name: "Resurrect" }).click();
  await expect(drawer.getByRole("heading", { name: "Revival plan" })).toBeVisible();

  await expect(badge).toHaveText("Reviving");
  await expect(badge).toHaveClass(/drawer-status-reviving/);
  // The rule results do not change: the score and the cause stay as they were.
  await expect(drawer.locator(".drawer-score")).toContainText("Death score");
  await expect(drawer.locator(".drawer-cause")).toContainText("Cause of death:");
  // A text equivalent for the sequence, for screen readers.
  await expect(drawer.getByRole("status").filter({ hasText: "Status: reviving" })).toHaveCount(1);
});

test("the plan is readable at once and focus is never trapped", async ({ page }) => {
  await mockApis(page);
  const { stone, drawer } = await openDrawer(page);
  await drawer.getByRole("button", { name: "Resurrect" }).click();

  // The plan does not wait for the stone: its text is on screen well inside the 2s sequence.
  await expect(drawer.getByText(MOCK_PLAN.diagnosis)).toBeVisible({ timeout: 2000 });

  // Focus moved to the plan heading, and the stage is not focusable.
  await expect(drawer.getByRole("heading", { name: "Revival plan" })).toBeFocused();
  expect(await drawer.locator(".resurrect-stage").getAttribute("aria-hidden")).toBe("true");
  const stageFocusable = await drawer
    .locator(".resurrect-stage")
    .evaluate((el) => el.querySelectorAll("a, button, input, select, textarea, [tabindex]").length);
  expect(stageFocusable).toBe(0);

  // Tab keeps moving through the drawer, and Shift+Tab comes back: no trap.
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(first.length).toBeGreaterThan(0);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(drawer).toBeVisible();

  // Escape closes it with the exit animation, and focus returns to the stone.
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(stone).toBeFocused();
});

test("under reduced motion the sequence jumps straight to its end state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockApis(page);
  const { drawer } = await openDrawer(page);
  await drawer.getByRole("button", { name: "Resurrect" }).click();
  await expect(drawer.getByRole("heading", { name: "Revival plan" })).toBeVisible();

  // No waiting: read the end state right away, with no delay and no retry.
  // (One frame is allowed for the browser to apply a zero-length transition.)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(() => {
    const opacity = (selector: string) => {
      const el = document.querySelector(selector);
      return el === null ? null : Number(getComputedStyle(el).opacity);
    };
    const sections = [...document.querySelectorAll(".resurrect-plan > *")].map((el) =>
      Number(getComputedStyle(el).opacity),
    );
    return {
      glow: opacity(".resurrect-glow"),
      lit: opacity(".resurrect-stone-lit"),
      flame: opacity(".resurrect-flame"),
      sections,
    };
  });
  expect(state.glow).toBeCloseTo(0.6, 1);
  expect(state.lit).toBe(1);
  expect(state.flame).toBe(1);
  expect(state.sections.length).toBeGreaterThan(0);
  for (const value of state.sections) expect(value).toBe(1);

  // The fog is gone and the badge already says Reviving.
  await expect(drawer.locator(".drawer-status")).toHaveText("Reviving");
  const fogOpacity = await page.evaluate(() =>
    [...document.querySelectorAll(".resurrect-fog")].map((el) => Number(getComputedStyle(el).opacity)),
  );
  expect(fogOpacity).toEqual([0, 0]);
});

test("the drawer closes smoothly, once, and returns focus to the stone", async ({ page }) => {
  await mockApis(page);
  const { stone, drawer } = await openDrawer(page);

  await drawer.getByRole("button", { name: "Close" }).click();
  // It is still there for a moment while it fades out, then it is gone.
  await expect(drawer).toHaveCount(0);
  await expect(stone).toBeFocused();

  // And it opens again cleanly, with no leftover Reviving label.
  await stone.click();
  const again = page.getByRole("dialog", { name: TARGET_REPO });
  await expect(again).toBeVisible();
  await expect(again.locator(".drawer-status")).not.toHaveText("Reviving");
});

test("a stone lifts and glows on hover without moving its neighbours", async ({ page }) => {
  await mockApis(page);
  await page.goto("/graveyard?demo=1");
  const stones = page.getByRole("button", { name: /^.+, (Alive|Dying|Dead|Ancient), .+$/ });
  await expect(stones.first()).toBeVisible();
  // Wait for the entrance animation to finish, so the boxes are at rest.
  await page.waitForTimeout(800);

  const first = stones.nth(0);
  const second = stones.nth(1);
  // Scroll first, so the hover itself does not scroll the page and move every box.
  await first.scrollIntoViewIfNeeded();
  // The entrance animation is done when both boxes stop changing.
  await expect
    .poll(async () => {
      const before = JSON.stringify([await first.boundingBox(), await second.boundingBox()]);
      await page.waitForTimeout(150);
      return before === JSON.stringify([await first.boundingBox(), await second.boundingBox()]);
    }, { timeout: 5000 })
    .toBe(true);
  const restShadow = await first.evaluate((el) => getComputedStyle(el).boxShadow);
  const neighbourBefore = await second.boundingBox();
  const sizeBefore = await first.boundingBox();

  await first.hover();
  await page.waitForTimeout(400);

  const hoverShadow = await first.evaluate((el) => getComputedStyle(el).boxShadow);
  const neighbourAfter = await second.boundingBox();
  const sizeAfter = await first.boundingBox();

  expect(hoverShadow).not.toBe(restShadow);
  // The stone itself rises (y gets smaller) but keeps its size, and nothing else moves.
  expect(sizeAfter?.height).toBeCloseTo(sizeBefore?.height ?? 0, 0);
  expect(sizeAfter?.width).toBeCloseTo(sizeBefore?.width ?? 0, 0);
  expect(sizeAfter?.y ?? 0).toBeLessThan(sizeBefore?.y ?? 0);
  expect(neighbourAfter).toEqual(neighbourBefore);
});
