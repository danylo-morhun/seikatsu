import { db, eq, workspaces } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The home is the user's dashboard: a widget per app that's on, ordered, sized and hidden in
// Edit (E), saved at once; the sidebar lists the apps in the same order.

const saved = async () =>
	(
		await db
			.select({ dashboard: workspaces.dashboard })
			.from(workspaces)
			.where(eq(workspaces.id, await workspaceId()))
	)[0]?.dashboard ?? null;

const reset = async () =>
	db
		.update(workspaces)
		.set({ dashboard: null })
		.where(eq(workspaces.id, await workspaceId()));

test.beforeEach(reset);
test.afterEach(reset);

test("a widget is hidden, shown again and resized in Edit", async ({ page }) => {
	await page.goto("/");
	const grid = page.getByRole("region", { name: "Dashboard" });

	await page.getByRole("button", { name: "Edit" }).click();
	await page.getByRole("button", { name: "Hide Hoshii" }).click();
	await expect(page.getByRole("button", { name: "Move Hoshii" })).toHaveCount(0);
	await expect
		.poll(async () => (await saved())?.find((s) => s.id === "/hoshii")?.hidden)
		.toBe(true);

	// Back from the Hidden list.
	await page.getByRole("button", { name: /Hoshii/ }).click();
	await expect(page.getByRole("button", { name: "Move Hoshii" })).toBeVisible();

	// Kuroji down to small: one link with its figure, no rows.
	await page.getByRole("button", { name: "Small Kuroji" }).click();
	await expect.poll(async () => (await saved())?.find((s) => s.id === "/kuroji")?.size).toBe("s");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
	await expect(grid.getByRole("region", { name: "Kuroji" })).toHaveCount(0);
	await expect(grid.getByRole("link", { name: /^Kuroji/ })).toBeVisible();
});

test("widgets move with the keyboard, and the sidebar follows", async ({ page }) => {
	await page.goto("/");
	const move = page.getByRole("button", { name: "Move Kuroji" });
	// Pressed until the page (hydrated) answers it.
	await expect(async () => {
		await page.getByRole("main").click({ position: { x: 5, y: 5 } });
		await page.keyboard.press("e");
		await expect(move).toBeVisible({ timeout: 1000 });
	}).toPass();

	// dnd-kit measures between key presses: pick up, move one place right, drop.
	await move.focus();
	for (const key of ["Space", "ArrowRight", "Space"]) {
		await page.keyboard.press(key);
		await page.waitForTimeout(200);
	}
	await expect.poll(async () => (await saved())?.[0]?.id).toBe("/seiryu");

	await page.reload();
	const apps = page
		.locator('[data-sidebar="sidebar"]')
		.getByRole("link")
		.filter({ hasText: /^(.)?(Kuroji|Seiryu)$/ });
	await expect(apps.first()).toContainText("Seiryu");
});

test("the old apps page leads home", async ({ page }) => {
	await page.goto("/apps");
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole("region", { name: "Dashboard" })).toBeVisible();
});
