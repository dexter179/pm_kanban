import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("requires login to see the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("rejects wrong credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("nope");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByText(/invalid username or password/i)
  ).toBeVisible();
});

test("signs in, persists across reload, signs out", async ({ page }) => {
  await signIn(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
