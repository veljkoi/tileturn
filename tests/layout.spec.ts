import { expect, test } from "@playwright/test";

const portraitViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
];

test("renders only the board while retaining accessible status updates", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tileturn" })).toHaveCount(0);
  await expect(page.getByText("Turn connected tiles over the grid.")).toHaveCount(0);
  await expect(page.locator("p.status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveJSProperty("tagName", "DIV");
  await expect(page.getByRole("status")).toContainText("The board is ready");
});

for (const viewport of portraitViewports) {
  test(`fits the board without scrolling at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.locator(".board")).toBeVisible();
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const board = document.querySelector(".board-frame")!.getBoundingClientRect();
      return {
        noHorizontalOverflow: root.scrollWidth <= root.clientWidth,
        noVerticalOverflow: root.scrollHeight <= root.clientHeight,
        boardInsideViewport:
          board.left >= 0 && board.top >= 0 &&
          board.right <= window.innerWidth && board.bottom <= window.innerHeight,
      };
    });

    expect(layout).toEqual({
      noHorizontalOverflow: true,
      noVerticalOverflow: true,
      boardInsideViewport: true,
    });
  });
}

test("asks for portrait orientation instead of rendering an unusably small board", async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/");

  await expect(page.getByText("Rotate your device to play.")).toBeVisible();
  await expect(page.locator(".board-frame")).toBeHidden();
});
