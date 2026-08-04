import { expect, test } from "@playwright/test";

test("a player builds an edge-connected group and rejects disconnected changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile 1 at column 4, row 7" }).click();
  await page.getByRole("button", { name: "Tile 4 at column 5, row 8" }).click();
  await expect(page.getByRole("status")).toContainText("not edge-connected");
  await expect(page.getByRole("button", { name: "Tile 4 at column 5, row 8" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Tile 2 at column 5, row 7" }).click();
  await page.getByRole("button", { name: "Tile 3 at column 4, row 8" }).click();
  await page.getByRole("button", { name: "Tile 1 at column 4, row 7" }).click();
  await expect(page.getByRole("status")).toContainText("split the group");
  await expect(page.getByRole("button", { name: "Tile 1 at column 4, row 7" })).toHaveAttribute("aria-pressed", "true");
});

test("a selected group previews and completes one rigid legal flip", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile 1 at column 4, row 7" }).click();
  await page.getByRole("button", { name: "Tile 2 at column 5, row 7" }).click();
  const northMove = page.getByRole("button", { name: "Flip selected group north" });
  await expect(northMove).toBeVisible();
  await expect(northMove.locator(".move__preview")).toHaveCount(2);
  await northMove.locator(".move__preview").first().click();
  await expect(page.getByRole("button", { name: "Tile 1 at column 4, row 6" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile 2 at column 5, row 6" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Flip selected group/ })).toHaveCount(0);
});
