import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("edits a card and the edit persists", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: /^edit/i }).click();
  await card.getByLabel("Card title").fill("Edited card title");
  await card.getByLabel("Card details").fill("Edited details.");
  await card.getByRole("button", { name: /^save$/i }).click();

  await expect(card.getByText("Edited card title")).toBeVisible();
  await expect(card.getByText("Edited details.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByTestId("card-card-2").getByText("Edited card title")
  ).toBeVisible();
});

test("persists changes across reload and re-login", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByLabel("Column title").fill("Icebox");
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persistent card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persistent card")).toBeVisible();

  await page.reload();
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Icebox");
  await expect(firstColumn.getByText("Persistent card")).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await signIn(page);
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Icebox");
  await expect(firstColumn.getByText("Persistent card")).toBeVisible();
});
