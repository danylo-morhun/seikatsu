import { and, db, eq, seiryuProjects, workspaces } from "@seikatsu/db";
import { expect, test, uid, workspaceId } from "./fixtures";

// The first run: a new user picks the apps to keep, how to plan, and a first board, then
// lands on Today with everything else switched off.

const reset = async (onboardedAt: Date | null) =>
	db
		.update(workspaces)
		.set({ onboardedAt, modulesOff: [] })
		.where(eq(workspaces.id, await workspaceId()));

test.afterEach(async () => {
	await reset(new Date());
});

test("a new user sets up their apps and lands on Today", async ({ page }) => {
	await reset(null);
	// A new user has no boards: the setup offers a first one.
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, await workspaceId()));
	const board = `Home ${uid()}`;

	await page.goto("/");
	await expect(page).toHaveURL(/\/welcome$/);
	const next = page.getByRole("button", { name: "Next", exact: true });
	await expect(next).toBeDisabled();

	// A click picks one; 1 the first app.
	const projects = page.getByRole("button", { name: /^Projects/ });
	await projects.click();
	await expect(projects).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("1");
	await expect(page.getByRole("button", { name: /^Finance/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await next.click();

	// A light start: Week on, the rest off.
	await expect(page.getByRole("checkbox", { name: "Week", exact: true })).toBeChecked();
	await expect(page.getByRole("checkbox", { name: "Day", exact: true })).not.toBeChecked();
	await next.click();

	await page.getByLabel("A first board").fill(board);
	await page.getByRole("button", { name: "Start", exact: true }).click();

	await expect(page).toHaveURL(/\/$/);
	const nav = page.locator("[data-sidebar=sidebar]");
	await expect(nav.getByRole("link", { name: "Week" })).toBeVisible();
	await expect(nav.getByRole("link", { name: "Goals" })).toHaveCount(0);

	const wsId = await workspaceId();
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
	expect(ws?.onboardedAt).not.toBeNull();
	expect(ws?.modulesOff).toEqual(
		expect.arrayContaining(["/kyuu", "/tsundoku", "/day", "/goals", "/week/plan"]),
	);
	expect(ws?.modulesOff).not.toContain("/kuroji");
	const made = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.workspaceId, wsId), eq(seiryuProjects.name, board)));
	expect(made).toHaveLength(1);
	await db.delete(seiryuProjects).where(eq(seiryuProjects.name, board));

	// Done once: Today no longer sends there.
	await page.goto("/welcome");
	await expect(page).toHaveURL(/\/$/);
});

test("setting up again starts from what's on", async ({ page }) => {
	await db
		.update(workspaces)
		.set({ modulesOff: ["/kyuu"] })
		.where(eq(workspaces.id, await workspaceId()));
	await page.goto("/settings/apps");
	await page.getByRole("link", { name: "Go through the setup again" }).click();
	await expect(page).toHaveURL(/\/welcome\?again/);
	await expect(page.getByRole("button", { name: /^Job Search/ })).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(page.getByRole("button", { name: /^Finance/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});
