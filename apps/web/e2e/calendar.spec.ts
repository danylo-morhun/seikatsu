import { calendarEvents, db, eq, seiryuCards, seiryuColumns, seiryuProjects } from "@seikatsu/db";
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

test("an event is made with E, changed and deleted", async ({ page }) => {
	const wsId = await workspaceId();
	await db.delete(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	await page.goto("/?v=week");
	await expect(page.getByRole("navigation", { name: "Home view" })).toBeVisible();

	await page.keyboard.press("e");
	const dialog = page.getByRole("dialog", { name: "New event" });
	await dialog.getByLabel("Event name").fill("E2E dentist");
	await dialog.getByLabel("All day").click();
	await dialog.getByLabel("From").fill("15:00");
	await dialog.getByLabel("To", { exact: true }).fill("16:30");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();

	const block = page.getByRole("button", { name: /15:00–16:30\s*E2E dentist/ });
	await expect(block).toBeVisible();
	await block.click();
	const edit = page.getByRole("dialog", { name: "Edit event" });
	await edit.getByLabel("Event name").fill("E2E dentist, Dr Nowak");
	await edit.getByRole("button", { name: "Save" }).click();
	await expect(page.getByRole("button", { name: /E2E dentist, Dr Nowak/ })).toBeVisible();

	const [saved] = await db
		.select()
		.from(calendarEvents)
		.where(eq(calendarEvents.workspaceId, wsId));
	expect(saved).toMatchObject({ title: "E2E dentist, Dr Nowak", date: today, endTime: "16:30:00" });

	await page.getByRole("button", { name: /E2E dentist, Dr Nowak/ }).click();
	await page
		.getByRole("dialog", { name: "Edit event" })
		.getByRole("button", { name: "Delete" })
		.click();
	await expect(page.getByRole("button", { name: /E2E dentist/ })).toHaveCount(0);
});

test("a card dragged into the hours gets that day and time", async ({ page }) => {
	const isSunday = new Date().getUTCDay() === 0;
	test.skip(isSunday, "no later day this week to drop on");
	const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
	await page.goto("/?v=week");
	const card = page.getByRole("link", { name: "E2E any time today" });
	await expect(card).toBeVisible();
	// The hours of tomorrow's column: 56 px an hour from midnight.
	const column = page
		.locator("div.cursor-cell")
		.nth(
			new Date(`${tomorrow}T00:00:00Z`).getUTCDay() === 0
				? 6
				: new Date(`${tomorrow}T00:00:00Z`).getUTCDay() - 1,
		);
	await card.dragTo(column, {
		sourcePosition: { x: 4, y: 2 },
		targetPosition: { x: 20, y: 14 * 56 + 2 },
	});
	await expect(page.getByRole("link", { name: /14:00\s*E2E any time today/ })).toBeVisible();
	const [saved] = await db
		.select({ dueDate: seiryuCards.dueDate, dueTime: seiryuCards.dueTime })
		.from(seiryuCards)
		.where(eq(seiryuCards.title, "E2E any time today"));
	expect(saved).toEqual({ dueDate: tomorrow, dueTime: "14:00:00" });
});
