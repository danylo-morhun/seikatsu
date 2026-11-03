import { db, eq, seiryuCards, seiryuColumns, seiryuProjects } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The week beside Today: cards due this week, movable to another day; done cards in the recap.

const today = new Date().toISOString().slice(0, 10); // the browser runs in UTC
const isSunday = new Date().getUTCDay() === 0;
const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const nameOf = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

let doneId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E week", position: "a0" })
		.returning({ id: seiryuProjects.id });
	if (!project) throw new Error("project not created");
	const [todo, done] = await db
		.insert(seiryuColumns)
		.values([
			{ projectId: project.id, name: "Todo", position: "a0" },
			{ projectId: project.id, name: "Done", position: "a1", isDone: true },
		])
		.returning({ id: seiryuColumns.id });
	if (!todo || !done) throw new Error("columns not created");
	doneId = done.id;
	await db.insert(seiryuCards).values({
		projectId: project.id,
		columnId: todo.id,
		title: "E2E due this week",
		position: "a0",
		dueDate: today,
	});
});

test("the week shows today's due card and moves it to another day", async ({ page }) => {
	await page.goto("/");
	await page
		.getByRole("navigation", { name: "Today or week" })
		.getByRole("link", { name: "Week" })
		.click();
	await expect(page).toHaveURL(/\/week$/);

	const todayRow = page.getByRole("listitem", { name: nameOf(today) });
	await expect(todayRow).toContainText("E2E due this week");
	test.skip(isSunday, "no later day this week to move to");

	await todayRow.getByRole("button", { name: "Move E2E due this week to another day" }).click();
	await page.getByRole("menuitem", { name: nameOf(tomorrow) }).click();
	await expect(page.getByRole("listitem", { name: nameOf(tomorrow) })).toContainText(
		"E2E due this week",
	);
	const [card] = await db
		.select({ dueDate: seiryuCards.dueDate })
		.from(seiryuCards)
		.where(eq(seiryuCards.title, "E2E due this week"));
	expect(card?.dueDate).toBe(tomorrow);
});

test("a card marked done from Today lands in the week's recap", async ({ page }) => {
	await page.goto("/");
	await page
		.getByRole("list", { name: "Waiting today" })
		.getByRole("button", { name: "Done: E2E due this week" })
		.click();
	await expect
		.poll(async () => {
			const [card] = await db
				.select({ columnId: seiryuCards.columnId, doneOn: seiryuCards.doneOn })
				.from(seiryuCards)
				.where(eq(seiryuCards.title, "E2E due this week"));
			return card;
		})
		.toEqual({ columnId: doneId, doneOn: today });

	await page.goto("/week");
	const todayRow = page.getByRole("listitem", { name: nameOf(today) });
	await expect(todayRow).toContainText("E2E due this week");
	await expect(todayRow).toContainText("done");
});

test("earlier weeks are a link away", async ({ page }) => {
	await page.goto("/week");
	await page.getByRole("link", { name: "Previous week" }).click();
	await expect(page.getByText("A week behind you")).toBeVisible();
	await page.getByRole("link", { name: "This week" }).click();
	await expect(page.getByText(/^This week/)).toBeVisible();
});
