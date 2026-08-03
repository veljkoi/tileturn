import { expect, test } from "@playwright/test";

test("a player selects a tile and completes a legal flip", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("button", { name: "Tile 1 at column 4, row 7" });
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true");

  const northMove = page.getByRole("button", {
    name: "Flip tile 1 north to column 4, row 6",
  });
  await expect(northMove).toBeVisible();
  await northMove.click();

  await expect(
    page.getByRole("button", { name: "Tile 1 at column 4, row 6" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Flip tile 1/ })).toHaveCount(0);
});
