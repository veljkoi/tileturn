import { expect, test, type Page } from "@playwright/test";

async function selectInitialConcaveGroup(page: Page): Promise<void> {
  for (const name of [
    "Tile 1 at column 4, row 7",
    "Tile 2 at column 5, row 7",
    "Tile 3 at column 4, row 8",
  ]) await page.getByRole("button", { name }).click();
}

function initialOuterDiagonalMove(page: Page) {
  return page.getByRole("button", { name: "Flip selected group diagonally along hinge (3,8)–(5,6)" });
}

test("a player builds an edge-connected group and rejects disconnected changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile 1 at column 4, row 7" }).click();
  await page.getByRole("button", { name: "Tile 4 at column 6, row 8" }).click();
  await expect(page.getByRole("status")).toContainText("not edge-connected");
  await expect(page.getByRole("button", { name: "Tile 4 at column 6, row 8" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Tile 2 at column 5, row 7" }).click();
  await page.getByRole("button", { name: "Tile 3 at column 4, row 8" }).click();
  await page.getByRole("button", { name: "Tile 1 at column 4, row 7" }).press("Enter");
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
  await northMove.locator(".move__hit-target").click({ force: true });
  await expect(page.getByRole("button", { name: "Tile 1 at column 4, row 6" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile 2 at column 5, row 6" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Flip selected group/ })).toHaveCount(0);
});

test("a player activates a diagonal flip through its hinge handle", async ({ page }) => {
  await page.goto("/");
  await selectInitialConcaveGroup(page);

  const diagonalMove = initialOuterDiagonalMove(page);
  await expect(diagonalMove).toBeVisible();
  await expect(diagonalMove.locator(".move__preview")).toHaveCount(3);
  await diagonalMove.locator(".move__hit-target").click({ force: true });

  await expect(page.getByRole("button", { name: "Tile 1 at column 5, row 8" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile 2 at column 5, row 7" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile 3 at column 4, row 8" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Flip selected group/ })).toHaveCount(0);
});

test("a diagonal flip locks board input and honors reduced motion", async ({ page }) => {
  await page.goto("/");
  await selectInitialConcaveGroup(page);

  await initialOuterDiagonalMove(page).locator(".move__hit-target").click({ force: true });
  await expect(page.getByRole("button", { name: "Tile 4 at column 6, row 8" })).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("status")).toContainText("flipping diagonally");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Reset" }).click();
  await selectInitialConcaveGroup(page);
  await initialOuterDiagonalMove(page).locator(".move__hit-target").click({ force: true });
  await expect(page.getByRole("status")).toContainText("Group flipped diagonally. Selection cleared.");
});
