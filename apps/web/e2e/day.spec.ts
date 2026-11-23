import {
	and,
	dayPlans,
	daySnoozes,
	db,
	eq,
	kyuuApplications,
	notificationPrefs,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The day's rhythm: the morning sorts and picks, Today works through the picks, the evening
// closes. The browser runs in UTC, so "today" is the UTC day.

const day = (offset: number) =>
	new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let doneColumnId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(dayPlans).where(eq(dayPlans.workspaceId, wsId));
	await db.delete(daySnoozes).where(eq(daySnoozes.workspaceId, wsId));
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	await db.delete(kyuuApplications).where(eq(kyuuApplications.workspaceId, wsId));
	// The evening starts at the very end of the day, so Today stays in the morning's phase.
	await db
		.insert(notificationPrefs)
		.values({ workspaceId: wsId, eveningTime: "23:59" })
		.onConflictDoUpdate({ target: notificationPrefs.workspaceId, set: { eveningTime: "23:59" } });

	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E day", position: "a0" })
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
	doneColumnId = done.id;
	await db.insert(seiryuCards).values([
		{
			projectId: project.id,
			columnId: todo.id,
			title: "E2E pick me",
			position: "a0",
			dueDate: day(0),
		},
		{
			projectId: project.id,
			columnId: todo.id,
			title: "E2E not today",
			position: "a1",
			dueDate: day(0),
		},
	]);
	await db.insert(kyuuApplications).values({
		workspaceId: wsId,
		company: "E2E Quiet",
		role: "Engineer",
		status: "applied",
		dateApplied: day(-60),
	});
});

// A planned or closed day folds Today's list: leave none behind for the other specs.
test.afterEach(async () => {
	const wsId = await workspaceId();
	await db.delete(dayPlans).where(eq(dayPlans.workspaceId, wsId));
	await db.delete(daySnoozes).where(eq(daySnoozes.workspaceId, wsId));
});

test("the morning puts a row off, picks the day, and Today works through it", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("link", { name: /Plan the day/ }).click();
	await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible();

	// Later → Tomorrow on the quiet application: snoozed, gone from the list.
	const waiting = page.getByRole("list", { name: "Waiting" });
	await waiting.getByRole("button", { name: /Later: 1 application with no answer/ }).click();
	await page.getByRole("menuitem", { name: /Tomorrow/ }).click();
	await expect(waiting).not.toContainText("with no answer");
	await expect
		.poll(async () => {
			const rows = await db
				.select({ key: daySnoozes.key, until: daySnoozes.until })
				.from(daySnoozes)
				.where(eq(daySnoozes.workspaceId, await workspaceId()));
			return rows;
		})
		.toEqual([{ key: "kyuu:ghost", until: day(1) }]);

	await page.getByRole("button", { name: /Next · pick/ }).click();
	await page
		.getByRole("list", { name: "Pick up to three" })
		.getByRole("button", { name: /E2E pick me/ })
		.click();
	await page.getByRole("button", { name: "Start the day" }).click();
	await expect(page).toHaveURL(/\/$/);

	const myDay = page.getByRole("list", { name: "My day" });
	await expect(myDay).toContainText("E2E pick me");
	// Picked: up top; the rest beside it (folded behind one line on a phone), without the
	// picked or the snoozed row.
	const todo = page.getByRole("list", { name: "Waiting today" });
	await expect(todo).toBeVisible();
	await expect(todo).not.toContainText("E2E pick me");
	await expect(todo).toContainText("E2E not today");
	await expect(todo).not.toContainText("with no answer");

	// Ticking a picked card finishes it in Seiryu.
	await myDay.getByRole("button", { name: "Done: E2E pick me" }).click();
	await expect
		.poll(async () => {
			const [card] = await db
				.select({ columnId: seiryuCards.columnId })
				.from(seiryuCards)
				.where(eq(seiryuCards.title, "E2E pick me"));
			return card?.columnId;
		})
		.toBe(doneColumnId);
});

test("the evening sorts what's left and closes the day", async ({ page }) => {
	await page.goto("/evening");
	await expect(page.getByRole("heading", { name: "How did today go?" })).toBeVisible();
	await page.getByRole("button", { name: /Next · what's left/ }).click();

	// The card due today wasn't picked: Tomorrow moves its date.
	const left = page.getByRole("list", { name: "What's left" });
	const row = left.getByRole("listitem").filter({ hasText: "E2E pick me" });
	await row.getByRole("button", { name: "Tomorrow" }).click();
	await expect(row).toContainText("Tomorrow");
	await expect
		.poll(async () => {
			const [card] = await db
				.select({ dueDate: seiryuCards.dueDate })
				.from(seiryuCards)
				.where(eq(seiryuCards.title, "E2E pick me"));
			return card?.dueDate;
		})
		.toBe(day(1));

	await page.getByRole("button", { name: /Next · tomorrow/ }).click();
	await page.getByRole("button", { name: "Close the day" }).click();
	await expect(page.getByRole("heading", { name: "Day closed" })).toBeVisible();
	await expect
		.poll(async () => {
			const wsId = await workspaceId();
			const [plan] = await db
				.select({ closedAt: dayPlans.closedAt })
				.from(dayPlans)
				.where(and(eq(dayPlans.workspaceId, wsId), eq(dayPlans.day, day(0))));
			return Boolean(plan?.closedAt);
		})
		.toBe(true);

	await page.goto("/");
	await expect(page.getByRole("region", { name: "My day" }).getByText("Day closed.")).toBeVisible();
});
