import { expect, test, uid } from "./fixtures";

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const monthName = (d: Date) => d.toLocaleString("en", { month: "long", timeZone: "UTC" });

test("a category plan, its one-month override and removal", async ({ page }) => {
	const now = new Date();
	await page.goto("/kuroji?tab=plan");
	await expect(page.getByRole("heading", { name: /\d{4}$/ })).toBeVisible();

	// P plans a category, from this month on. Keys attach on hydration, so press until it opens.
	let dialog = page.getByRole("dialog", { name: "Plan a category" });
	await expect(async () => {
		await page.keyboard.press("p");
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await dialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Utilities" }).click();
	await dialog.getByLabel("Plan").fill("500");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();
	const row = page.getByRole("button", { name: /^Utilities/ });
	await expect(row).toContainText("/ 500");

	// This month only: next month keeps the default.
	await row.click();
	dialog = page.getByRole("dialog", { name: "Utilities" });
	await dialog.getByLabel("Plan").fill("800");
	await dialog.getByRole("button", { name: `${monthName(now)} only` }).click();
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();
	await expect(row).toContainText("this month");
	await expect(row).toContainText("/ 800");

	await page.keyboard.press("]");
	await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
	await expect(page.getByRole("button", { name: /^Utilities/ })).toContainText("/ 500");
	await page.keyboard.press("[");
	await expect(page).not.toHaveURL(/month=/);

	// Back to the default, then remove the plan.
	await row.click();
	dialog = page.getByRole("dialog", { name: "Utilities" });
	await dialog.getByRole("button", { name: /^Back to/ }).click();
	await expect(dialog).toBeHidden();
	await expect(row).toContainText("/ 500");
	await row.click();
	await page
		.getByRole("dialog", { name: "Utilities" })
		.getByRole("button", { name: "Remove plan" })
		.click();
	await expect(page.getByRole("button", { name: /^Utilities/ })).toBeHidden();
});

test("a fund asks for an even monthly share until its date", async ({ page }) => {
	const name = `Trip ${uid()}`;
	const now = new Date();
	// The 15th two months on: this month and the next two share the target.
	const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 15));
	await page.goto(`/kuroji?tab=plan&month=${ym(now)}`);

	const dialog = page.getByRole("dialog", { name: "New fund" });
	await expect(async () => {
		await page.keyboard.press("f");
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await dialog.getByLabel("Name").fill(name);
	await dialog.getByLabel("Amount").fill("1200");
	await dialog.getByLabel("By").fill(due.toISOString().slice(0, 10));
	await dialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Savings" }).click();
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();

	const fund = page.getByRole("button", { name: new RegExp(`^${name}`) });
	await expect(fund).toContainText(/Put aside 400,00/);

	await fund.click();
	await page.getByRole("dialog", { name }).getByRole("button", { name: "Delete" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: /Delete/ })
		.click();
	await expect(fund).toBeHidden();
});
