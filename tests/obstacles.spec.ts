import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 15;
    Math.random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 2 ** 32;
    };
  });
});

test("renders 32 slate obstacles only in the middle rows", async ({ page }) => {
  await page.goto("/");
  const obstacles = page.locator(".obstacle");
  await expect(obstacles).toHaveCount(32);
  for (const obstacle of await obstacles.all()) {
    await expect(obstacle).toHaveCSS("fill", "rgb(71, 85, 105)");
    const y = Number(await obstacle.getAttribute("y"));
    expect(y).toBeGreaterThanOrEqual(2 * 64);
    expect(y).toBeLessThan(14 * 64);
  }
  await expect(page.getByRole("button", { name: /^Tile at/ })).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Tile at column 4, row 15" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tile at column 5, row 16" })).toBeVisible();
});

test("obstacles clear selection and block destination moves", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("button", { name: "Tile at column 3, row 15" });
  await tile.click();
  await expect(page.getByRole("button", { name: "Flip selected group north" })).toHaveCount(0);
  await page.locator(".obstacle").first().click();
  await expect(tile).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status")).toContainText("Selection cleared");
});
