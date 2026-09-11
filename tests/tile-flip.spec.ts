import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 15;
    Math.random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 2 ** 32;
    };
  });
});

test("tiles use one color and omit visible identifiers", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tile__label")).toHaveCount(0);
  await expect(page.locator(".tile__square")).toHaveCount(5);
  for (const square of await page.locator(".tile__square").all()) {
    await expect(square).toHaveCSS("fill", "rgb(244, 185, 66)");
  }
});

test("dragging selects an edge-connected group", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: "Tile at column 4, row 15" });
  const second = page.getByRole("button", { name: "Tile at column 5, row 15" });
  const third = page.getByRole("button", { name: "Tile at column 5, row 16" });
  await first.scrollIntoViewIfNeeded();
  const firstBox = (await first.boundingBox())!;
  const secondBox = (await second.boundingBox())!;
  const thirdBox = (await third.boundingBox())!;
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 5 });
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(third).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Group of 3 selected");
});

test("a mobile touch drag selects each tile along a continuous path", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const first = page.getByRole("button", { name: "Tile at column 4, row 15" });
  const second = page.getByRole("button", { name: "Tile at column 5, row 15" });
  const third = page.getByRole("button", { name: "Tile at column 5, row 16" });
  const client = await enableTouch(page);

  await touchDrag(client, [await center(first), await center(second), await center(third)]);

  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(third).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Group of 3 selected");
});

test("a sparse fast touch move selects eligible tiles between events", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const first = page.getByRole("button", { name: "Tile at column 3, row 15" });
  const middle = page.getByRole("button", { name: "Tile at column 4, row 15" });
  const last = page.getByRole("button", { name: "Tile at column 5, row 15" });
  const client = await enableTouch(page);

  await touchDrag(client, [await center(first), await center(last)]);

  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(middle).toHaveAttribute("aria-pressed", "true");
  await expect(last).toHaveAttribute("aria-pressed", "true");
});

test("a cancelled touch drag restores the selection from before the gesture", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const preserved = page.getByRole("button", { name: "Tile at column 4, row 15" });
  const dragStart = page.getByRole("button", { name: "Tile at column 3, row 15" });
  await preserved.click();
  const client = await enableTouch(page);

  await touchDrag(client, [await center(dragStart), await center(preserved)], true);

  await expect(dragStart).toHaveAttribute("aria-pressed", "false");
  await expect(preserved).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Flip selected group/ })).not.toHaveCount(0);
});

test("a compatibility click after a touch drag does not toggle the ending tile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const first = page.getByRole("button", { name: "Tile at column 4, row 15" });
  const last = page.getByRole("button", { name: "Tile at column 5, row 15" });
  const client = await enableTouch(page);

  await touchDrag(client, [await center(first), await center(last)]);
  await last.dispatchEvent("click", { detail: 1 });

  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(last).toHaveAttribute("aria-pressed", "true");
});

test("a player builds an edge-connected group and rejects disconnected changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 5, row 16" }).click();
  await expect(page.getByRole("status")).toContainText("not edge-connected");
  await expect(page.getByRole("button", { name: "Tile at column 5, row 16" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Tile at column 5, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 4, row 16" }).click();
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).press("Enter");
  await expect(page.getByRole("status")).toContainText("split the group");
  await expect(page.getByRole("button", { name: "Tile at column 4, row 15" })).toHaveAttribute("aria-pressed", "true");
});

test("a selected group previews and completes one rigid legal flip", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 5, row 15" }).click();
  const northMove = page.getByRole("button", { name: "Flip selected group north" });
  await expect(northMove).toBeVisible();
  await expect(northMove.locator(".move__preview")).toHaveCount(2);
  await expect(northMove.locator(".move__boundary")).toHaveCount(1);
  const boundaryPath = await northMove.locator(".move__boundary").getAttribute("d");
  expect(boundaryPath?.match(/M /g)).toHaveLength(6);
  await expect(northMove.locator("line")).toHaveCount(0);
  await northMove.locator(".move__preview").first().click({ force: true });
  await expect(page.getByRole("button", { name: "Tile at column 4, row 14" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile at column 5, row 14" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Flip selected group/ })).toHaveCount(0);
});

test("any destination preview activates its complete move", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 5, row 15" }).click();
  const northMove = page.getByRole("button", { name: "Flip selected group north" });
  await northMove.locator(".move__preview").nth(1).click({ force: true });
  await expect(page.getByRole("button", { name: "Tile at column 4, row 14" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tile at column 5, row 14" })).toHaveAttribute("aria-pressed", "false");
});

test("preview activation locks board input and honors reduced motion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 5, row 15" }).click();
  await page.getByRole("button", { name: "Flip selected group north" }).locator(".move__preview").first().click({ force: true });
  await expect(page.getByRole("button", { name: "Tile at column 5, row 16" })).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("status")).toContainText("flipping north");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("button", { name: "Tile at column 4, row 15" }).click();
  await page.getByRole("button", { name: "Tile at column 5, row 15" }).click();
  await page.getByRole("button", { name: "Flip selected group north" }).locator(".move__preview").first().click({ force: true });
  await expect(page.getByRole("status")).toContainText("Group flipped north. Selection cleared.");
});

async function enableTouch(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  return client;
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function touchDrag(
  client: CDPSession,
  points: Array<{ x: number; y: number }>,
  cancel = false,
): Promise<void> {
  const [start, ...moves] = points;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  for (const point of moves) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...point, id: 1 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
}
