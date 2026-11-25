import { db, eq, seiryuCards, seiryuColumns, seiryuProjects } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The home as a calendar: a card due at a time sits in the week's hours, the month lists it on
// its day, the keys switch views, and the home opens on the view last used.

const today = new Date().toISOString().slice(0, 10); // the browser runs in UTC

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E calendar", position: "a0" })
		.returning({ id: seiryuProjects.id });
	if (!project) throw new Error("project not created");
	const [todo] = await db
		.insert(seiryuColumns)
		.values({ projectId: project.id, name: "Todo", position: "a0" })
		.returning({ id: seiryuColumns.id });
	if (!todo) throw new Error("column not created");
	await db.insert(seiryuCards).values([
		{
			projectId: project.id,
			columnId: todo.id,
			title: "E2E call at ten",
			position: "a0",
			dueDate: today,
			dueTime: "10:30",
		},
		{
			projectId: project.id,
			columnId: todo.id,
			title: "E2E any time today",
			position: "a1",
			dueDate: today,
		},
	]);
});

test("the week puts a timed card in its hour and the rest above", async ({ page }) => {
	await page.goto("/?v=week");
	await expect(page.getByRole("link", { name: /10:30\s*E2E call at ten/ })).toBeVisible();
	await expect(page.getByRole("link", { name: "E2E any time today" })).toBeVisible();
});

test("keys switch views and the home opens on the last one", async ({ page }) => {
	await page.goto("/?v=week");
	await expect(page.getByRole("navigation", { name: "Home view" })).toBeVisible();

	await page.keyboard.press("m");
	await expect(page).toHaveURL(/v=month/);
	await expect(page.getByRole("link", { name: /E2E call at ten/ })).toBeVisible();

	await page.keyboard.press("]");
	await expect(page).toHaveURL(/v=month&d=\d{4}-\d{2}-01/);
	await page.keyboard.press("t");
	await expect(page).toHaveURL(/\/\?v=month$/);

	await page.goto("/");
	await expect(page.getByRole("link", { name: "Month", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);

	await page.keyboard.press("c");
	await expect(page).toHaveURL(/v=widgets/);
	await page.keyboard.press("c");
	await expect(page).toHaveURL(/v=month/);
});
