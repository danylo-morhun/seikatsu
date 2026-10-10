import { expect, test, uid } from "./fixtures";

test("New Transaction adds an expense", async ({ page }) => {
	const description = `E2E groceries ${uid()}`;
	await page.goto("/kuroji?tab=transactions");

	await page.locator("header").getByRole("button", { name: "New Transaction" }).click();
	const dialog = page.getByRole("dialog", { name: "New Transaction" });
	await dialog.getByRole("combobox").filter({ hasText: "Select account" }).click();
	await page.getByRole("option", { name: "Wallet" }).click();
	await dialog.getByRole("button", { name: "More…" }).click();
	await page.getByPlaceholder("Find a category").fill("Groc");
	await page.getByRole("option", { name: "Groceries" }).click();
	await expect(dialog.getByRole("radio", { name: "Groceries" })).toBeChecked();
	await dialog.getByLabel("Amount").fill("12,34");
	await dialog.getByLabel("Description").fill(description);
	await dialog.getByRole("button", { name: "Save" }).click();

	await expect(dialog).toBeHidden();
	await expect(page.getByRole("listitem").filter({ hasText: description })).toBeVisible();
	await expect(
		page.locator("header").getByRole("button", { name: "New Transaction" }),
	).toBeEnabled();
});
