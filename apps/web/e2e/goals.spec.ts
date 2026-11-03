import {
	accounts,
	and,
	db,
	eq,
	goals,
	inArray,
	kurojiFunds,
	like,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";
import { expect, test, uid, workspaceId } from "./fixtures";

// 志 Goals: a goal gathers whole containers from the apps and reads its progress from them.

const day = (offset: number) =>
	new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let tag: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	tag = uid();
	await db.delete(goals).where(eq(goals.workspaceId, wsId));
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	await db.delete(kurojiFunds).where(eq(kurojiFunds.workspaceId, wsId));
	// This file's own accounts from earlier runs, with their transactions.
	const mine = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.workspaceId, wsId), like(accounts.name, "Goal %")));
	if (mine.length > 0) {
		const ids = mine.map((a) => a.id);
		const txs = await db
			.select({ id: transactionEntries.transactionId })
			.from(transactionEntries)
			.where(inArray(transactionEntries.accountId, ids));
		if (txs.length > 0)
			await db.delete(transactions).where(
				inArray(
					transactions.id,
					txs.map((t) => t.id),
				),
			);
		await db.delete(accounts).where(inArray(accounts.id, ids));
	}
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
	if (!ws) throw new Error("workspace missing");

	// A project with one card of two done.
	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: `Trip ${tag}`, position: "a0" })
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
	await db.insert(seiryuCards).values([
		{ projectId: project.id, columnId: todo.id, title: "Book the hut", position: "a0" },
		{ projectId: project.id, columnId: done.id, title: "Pick dates", position: "a0" },
	]);

	// A fund of 1000 with 500 put aside in its account.
	const [piggy, gift] = await db
		.insert(accounts)
		.values([
			{ workspaceId: wsId, name: `Goal piggy ${tag}`, type: "ASSET", currency: ws.baseCurrency },
			{ workspaceId: wsId, name: `Goal gift ${tag}`, type: "INCOME", currency: ws.baseCurrency },
		])
		.returning();
	if (!piggy || !gift) throw new Error("accounts not created");
	const [tx] = await db
		.insert(transactions)
		.values({ workspaceId: wsId, date: day(-3), description: "Saved" })
		.returning();
	if (!tx) throw new Error("transaction not created");
	await db.insert(transactionEntries).values([
		{
			transactionId: tx.id,
			accountId: piggy.id,
			amount: "500",
			currency: ws.baseCurrency,
			baseAmount: "500",
		},
		{
			transactionId: tx.id,
			accountId: gift.id,
			amount: "-500",
			currency: ws.baseCurrency,
			baseAmount: "-500",
		},
	]);
	await db.insert(kurojiFunds).values({
		workspaceId: wsId,
		accountId: piggy.id,
		name: `Tatry ${tag}`,
		target: "1000",
		dueDate: day(90),
	});
});

test("a goal gathers a fund and a project and shows how far they've come", async ({ page }) => {
	await page.goto("/goals");
	await expect(page.getByText("No goals yet")).toBeVisible();

	await page.getByRole("button", { name: "New goal" }).click();
	const dialog = page.getByRole("dialog", { name: "New goal" });
	await dialog.getByLabel("Name").fill("Tatry in February");
	await dialog.getByRole("button", { name: "Create goal" }).click();
	await expect(dialog).toBeHidden();

	const goal = page.getByRole("listitem", { name: "Tatry in February" });
	await expect(goal).toContainText("Open-ended");

	// The fund: half of its target.
	await goal.getByRole("button", { name: /Link a fund/ }).click();
	const link = page.getByRole("dialog", { name: "Link to Tatry in February" });
	await link.getByRole("combobox").click();
	await page.getByRole("option", { name: `Tatry ${tag}` }).click();
	await link.getByRole("button", { name: "Link", exact: true }).click();
	await expect(link).toBeHidden();
	await expect(goal).toContainText(`Tatry ${tag}`);
	await expect(goal).toContainText(/500.*of.*1.000/);

	// The project: one card of two done.
	await goal.getByRole("button", { name: /Link a fund/ }).click();
	await link.getByRole("button", { name: "Project" }).click();
	await link.getByRole("combobox").click();
	await page.getByRole("option", { name: `Trip ${tag}` }).click();
	await link.getByRole("button", { name: "Link", exact: true }).click();
	await expect(goal).toContainText("1 of 2 cards done");
	await expect(goal).toContainText("50% there");

	// Unlinking leaves the project in Seiryu.
	await goal.getByRole("button", { name: `Unlink Trip ${tag}` }).click();
	await expect(goal).not.toContainText(`Trip ${tag}`);
	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(eq(seiryuProjects.name, `Trip ${tag}`));
	expect(project).toBeTruthy();
});

test("a goal can be dated, edited and deleted", async ({ page }) => {
	await page.goto("/goals");
	await page.getByRole("button", { name: "New goal" }).click();
	const dialog = page.getByRole("dialog", { name: "New goal" });
	await dialog.getByLabel("Name").fill("A new job");
	await dialog.getByLabel("By").fill(day(20));
	await dialog.getByRole("button", { name: "Create goal" }).click();

	const goal = page.getByRole("listitem", { name: "A new job" });
	await expect(goal).toContainText("in 20 days");

	await goal.getByRole("button", { name: "A new job: more" }).click();
	await page.getByRole("menuitem", { name: "Edit" }).click();
	const edit = page.getByRole("dialog", { name: "Edit goal" });
	await edit.getByLabel("Name").fill("A new job by spring");
	await edit.getByRole("button", { name: "Save" }).click();
	const renamed = page.getByRole("listitem", { name: "A new job by spring" });
	await expect(renamed).toBeVisible();

	await renamed.getByRole("button", { name: "A new job by spring: more" }).click();
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
	await expect(page.getByText("No goals yet")).toBeVisible();
});
