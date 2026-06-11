import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const stubBoard = {
  columns: [
    { id: "col-ai", title: "AI Column", cardIds: ["card-ai"] },
  ],
  cards: {
    "card-ai": {
      id: "card-ai",
      title: "AI created card",
      details: "Added by the assistant.",
    },
  },
};

test("chat sidebar applies AI board updates to the UI", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: { reply: "I created a card for you.", board: stubBoard },
    })
  );

  await page.getByRole("button", { name: /ai assistant/i }).click();
  await page.getByPlaceholder(/ask the assistant/i).fill("Create a card");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByText("I created a card for you.")).toBeVisible();
  await expect(page.getByText("AI created card")).toBeVisible();
  await expect(page.getByTestId("column-col-ai")).toBeVisible();
});
