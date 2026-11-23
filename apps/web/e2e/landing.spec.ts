import { expect, test } from "./fixtures";

// Signed out, the home is the landing: what seikatsu is, the apps, and the way in.
test.use({ storageState: { cookies: [], origins: [] } });

test("the landing shows the apps and leads to sign-in", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { level: 1, name: "Everyday life, in small exact tools." }),
	).toBeVisible();
	await expect(page.locator("#apps li")).toHaveCount(7);
	await page.getByRole("link", { name: "Get started" }).click();
	await expect(page).toHaveURL(/#start$/);
	await expect(page.getByRole("button", { name: /GitHub/ })).toBeVisible();
	await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
});

test("the landing fits a phone without sideways scroll", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await expect(page.getByRole("heading", { level: 1, name: /small exact tools/ })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
