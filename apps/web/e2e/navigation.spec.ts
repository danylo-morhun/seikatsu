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

test("the sidebar holds the shell; Apps opens every app", async ({ page }) => {
	await page.goto("/");
	const sidebar = page.locator('[data-sidebar="sidebar"]');
	for (const name of ["Today", "Week", "Goals", "Apps"])
		await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Kuroji" })).toHaveCount(0);

	for (const [name, path] of [
		["Seiryu", "/seiryu"],
		["Tsundoku", "/tsundoku"],
		["Keizoku", "/keizoku"],
		["Kyuu", "/kyuu"],
		["Aisha", "/aisha"],
		["Kuroji", "/kuroji"],
	]) {
		await page.goto("/apps");
		await page
			.getByRole("main")
			.getByRole("link", { name: new RegExp(name) })
			.first()
			.click();
		await expect(page).toHaveURL(new RegExp(path));
		// Inside an app, Apps stays lit in the sidebar.
		await expect(sidebar.getByRole("link", { name: "Apps" })).toHaveAttribute(
			"data-active",
			"true",
		);
	}
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
