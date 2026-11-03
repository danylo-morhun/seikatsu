import {
	db,
	eq,
	hoshiiItems,
	kyuuApplications,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The home's To do: each row's button does its app's one thing, right there.

const day = (offset: number) =>
	new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let doneColumnId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	await db.delete(hoshiiItems).where(eq(hoshiiItems.workspaceId, wsId));
	await db.delete(kyuuApplications).where(eq(kyuuApplications.workspaceId, wsId));

	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E home", position: "a0" })
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
	await db.insert(seiryuCards).values({
		projectId: project.id,
		columnId: todo.id,
		title: "E2E overdue card",
		position: "a0",
		dueDate: day(-2),
	});

	await db.insert(hoshiiItems).values([
		{
			workspaceId: wsId,
			title: "E2E keep me",
			currency: "PLN",
			addedOn: day(-40),
			coolUntil: day(-1),
		},
		{
			workspaceId: wsId,
			title: "E2E let me go",
			currency: "PLN",
			addedOn: day(-40),
			coolUntil: day(-1),
		},
	]);

	await db.insert(kyuuApplications).values([
		{
			workspaceId: wsId,
			company: "E2E Ghost A",
			role: "Engineer",
			status: "applied",
			dateApplied: day(-60),
		},
		{
			workspaceId: wsId,
			company: "E2E Ghost B",
			role: "Engineer",
			status: "applied",
			dateApplied: day(-60),
		},
	]);
});

const todo = (page: import("@playwright/test").Page) =>
	page.getByRole("list", { name: "Waiting today" });

test("Done moves an overdue card to its project's finish column", async ({ page }) => {
	await page.goto("/");
	const row = todo(page).getByRole("listitem").filter({ hasText: "E2E overdue card" });
	await expect(row).toContainText("2 days overdue");

	await row.getByRole("button", { name: "Done: E2E overdue card" }).click();
	await expect(row).toBeHidden();
	await expect
		.poll(async () => {
			const [card] = await db
				.select({ columnId: seiryuCards.columnId })
				.from(seiryuCards)
				.where(eq(seiryuCards.title, "E2E overdue card"));
			return card?.columnId;
		})
		.toBe(doneColumnId);

	await page.reload();
	await expect(todo(page)).not.toContainText("E2E overdue card");
});

test("a cooled want is kept or let go from its row", async ({ page }) => {
	await page.goto("/");
	await todo(page).getByRole("button", { name: "Keep: E2E keep me" }).click();
	await todo(page).getByRole("button", { name: "Let go: E2E let me go" }).click();
	await expect(todo(page)).not.toContainText("E2E keep me");
	await expect(todo(page)).not.toContainText("E2E let me go");

	const stateOf = async (title: string) => {
		const [item] = await db
			.select({ state: hoshiiItems.state })
			.from(hoshiiItems)
			.where(eq(hoshiiItems.title, title));
		return item?.state;
	};
	await expect.poll(() => stateOf("E2E keep me")).toBe("plan");
	await expect.poll(() => stateOf("E2E let me go")).toBe("released");
});

test("Close all ghosts the quiet applications, after asking", async ({ page }) => {
	await page.goto("/");
	const row = todo(page).getByRole("listitem").filter({ hasText: "with no answer" });
	await expect(row).toContainText("2 applications with no answer");

	await row.getByRole("button", { name: "Close all" }).click();
	const confirm = page.getByRole("alertdialog");
	await confirm.getByRole("button", { name: "Close 2" }).click();
	await expect(confirm).toBeHidden();
	await expect(row).toBeHidden();

	await expect
		.poll(async () => {
			const rows = await db
				.select({ status: kyuuApplications.status })
				.from(kyuuApplications)
				.where(eq(kyuuApplications.workspaceId, await workspaceId()));
			return rows.map((r) => r.status);
		})
		.toEqual(["ghosted", "ghosted"]);
});
