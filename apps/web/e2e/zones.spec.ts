import { expect, test } from "./fixtures";

// Zones group the apps: Money, Do, Life. Each has its own page, reached from the sidebar, and the
// header moves between a zone's apps without the sidebar.
test("sidebar opens each zone's page", async ({ page }) => {
	await page.goto("/kuroji");
	const sidebar = page.locator('[data-sidebar="sidebar"]');

	for (const [name, path] of [
		["Do", "/do"],
		["Life", "/life"],
		["Money", "/money"],
	]) {
		await sidebar.getByRole("link", { name, exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`${path}$`));
		await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
		await expect(sidebar.getByRole("link", { name, exact: true })).toHaveAttribute(
			"aria-current",
			"page",
		);
	}
});

test("header switches between a zone's apps", async ({ page }) => {
	await page.goto("/kuroji");
	await page.locator("header").getByRole("button", { name: "Money: switch app" }).click();
	await page.getByRole("menuitem", { name: /Hoshii/ }).click();
	await expect(page).toHaveURL(/\/hoshii/);

	await page.locator("header").getByRole("button", { name: "Money: switch app" }).click();
	await page.getByRole("menuitem", { name: "Money", exact: true }).click();
	await expect(page).toHaveURL(/\/money$/);
});

test("a zone page's number keys open its apps", async ({ page }) => {
	await page.goto("/life");
	await expect(page.getByRole("heading", { name: "Life", level: 1 })).toBeVisible();
	await page.keyboard.press("1");
	await expect(page).toHaveURL(/\/tsundoku/);
});
