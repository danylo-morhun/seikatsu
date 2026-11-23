import { expect, test } from "./fixtures";

// Hydration errors fail the test through the consoleErrors fixture.
test("Kuroji tabs switch content", async ({ page }) => {
	await page.goto("/kuroji");
	const tabs = page.getByRole("navigation").filter({ hasText: "Transactions" });

	await tabs.getByRole("link", { name: "Accounts" }).click();
	await expect(page).toHaveURL(/tab=accounts/);
	await expect(page.getByText("Savings").first()).toBeVisible();

	await tabs.getByRole("link", { name: "Transactions" }).click();
	await expect(page).toHaveURL(/tab=transactions/);
	await expect(page.getByRole("heading", { name: "Transactions", level: 1 })).toBeVisible();

	await tabs.getByRole("link", { name: "Expenses" }).click();
	await expect(page).not.toHaveURL(/tab=/);
});

test("the sidebar lists Home and every app that's on", async ({ page }) => {
	await page.goto("/");
	const sidebar = page.locator('[data-sidebar="sidebar"]');
	for (const name of ["Home", "Week", "Goals"])
		await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();

	for (const [name, path] of [
		["Seiryu", "/seiryu"],
		["Tsundoku", "/tsundoku"],
		["Keizoku", "/keizoku"],
		["Kyuu", "/kyuu"],
		["Aisha", "/aisha"],
		["Kuroji", "/kuroji"],
	]) {
		const link = sidebar.getByRole("link", { name, exact: true });
		await link.click();
		await expect(page).toHaveURL(new RegExp(path));
		await expect(link).toHaveAttribute("data-active", "true");
	}

	// The old launcher sends old links home.
	await page.goto("/apps");
	await expect(page).toHaveURL(/\/$/);
});

test("the header's switcher moves between apps", async ({ page }) => {
	await page.goto("/kuroji");
	await expect(async () => {
		await page.getByRole("button", { name: "Kuroji: switch app" }).click();
		await expect(page.getByRole("menuitem", { name: /Hoshii/ })).toBeVisible({ timeout: 500 });
	}).toPass();
	await page.getByRole("menuitem", { name: /Hoshii/ }).click();
	await expect(page).toHaveURL(/\/hoshii/);
});
