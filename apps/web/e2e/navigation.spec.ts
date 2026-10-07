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
	await expect(page.getByRole("table")).toBeVisible();

	await tabs.getByRole("link", { name: "Expenses" }).click();
	await expect(page).not.toHaveURL(/tab=/);
});

test("sidebar opens every app", async ({ page }) => {
	await page.goto("/kuroji");
	const sidebar = page.locator('[data-sidebar="sidebar"]');

	for (const [name, path] of [
		["清 Seiryu", "/seiryu"],
		["積 Tsundoku", "/tsundoku"],
		["継 Keizoku", "/keizoku"],
		["求 Kyuu", "/kyuu"],
		["愛 Aisha", "/aisha"],
		["黒 Kuroji", "/kuroji"],
	]) {
		await sidebar.getByRole("link", { name }).click();
		await expect(page).toHaveURL(new RegExp(path));
		await expect(sidebar.getByRole("link", { name })).toHaveAttribute("data-active", "true");
	}
});
