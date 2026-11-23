import { db, eq, workspaces } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// Modules: each app and each shell feature (Day, Week, Week plan, Goals) can be switched off in
// Settings → Apps; off means gone from the menus, Today and ⌘K, and its pages send you back here.

const setOff = async (off: string[]) =>
	db
		.update(workspaces)
		.set({ modulesOff: off })
		.where(eq(workspaces.id, await workspaceId()));

test.afterEach(async () => {
	await setOff([]);
});

test("switching Day off turns Today into the plain list", async ({ page }) => {
	await setOff([]);
	await page.goto("/settings/apps");
	const day = page.getByRole("checkbox", { name: "Day", exact: true });
	await expect(day).toBeChecked();
	await day.click();
	await expect(day).not.toBeChecked();

	// Without Day, the home is the apps' widgets; the cross-app To do waits behind Edit.
	await page.goto("/");
	await expect(page.getByRole("region", { name: "Seiryu" })).toBeVisible();
	await expect(page.getByText("Plan the day")).toHaveCount(0);

	// Its pages send you to where it's switched on.
	await page.goto("/morning");
	await expect(page).toHaveURL(/\/settings\/apps\?off=%2Fday/);
	await expect(page.getByText("Day is off. Turn it on below to open it.")).toBeVisible();
});

test("an app or feature that's off leaves the menus and ⌘K", async ({ page }) => {
	await setOff(["/goals", "/kyuu"]);
	await page.goto("/");
	const nav = page.locator("[data-sidebar=sidebar]");
	await expect(nav.getByRole("link", { name: "Week" })).toBeVisible();
	await expect(nav.getByRole("link", { name: "Goals" })).toHaveCount(0);
	await expect(nav.getByRole("link", { name: "Kyuu" })).toHaveCount(0);
	await expect(nav.getByRole("link", { name: "Kuroji" })).toBeVisible();

	await page.goto("/kyuu");
	await expect(page).toHaveURL(/\/settings\/apps\?off=%2Fkyuu/);

	// Week plan needs Week: off with it, and its box can't be ticked.
	await setOff(["/week"]);
	await page.goto("/settings/apps");
	await expect(page.getByRole("checkbox", { name: /Week plan/ })).toBeDisabled();
	await expect(page.getByRole("checkbox", { name: /Week plan/ })).not.toBeChecked();
	await page.goto("/week/plan");
	await expect(page).toHaveURL(/\/settings\/apps\?off=%2Fweek%2Fplan/);
});
