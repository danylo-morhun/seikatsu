import {
	and,
	db,
	eq,
	goalLinks,
	goals,
	isNotNull,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
	weekPlans,
} from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

// The week's rhythm: look back, pick the focus, tick it on Week, find it first in the morning;
// Goals shows each goal's next step and asks for one when there's none.

let emptyProjectId: string;

const isSunday = new Date().getUTCDay() === 0;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(weekPlans).where(eq(weekPlans.workspaceId, wsId));
	await db.delete(goals).where(eq(goals.workspaceId, wsId));
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));

	const [project, empty] = await db
		.insert(seiryuProjects)
		.values([
			{ workspaceId: wsId, name: "E2E road", position: "a0" },
			{ workspaceId: wsId, name: "E2E blank", position: "a1" },
		])
		.returning({ id: seiryuProjects.id });
	if (!project || !empty) throw new Error("projects not created");
	emptyProjectId = empty.id;
	const [, doing] = await db
		.insert(seiryuColumns)
		.values([
			{ projectId: project.id, name: "Todo", position: "a0" },
			{ projectId: project.id, name: "Doing", position: "a1" },
			{ projectId: project.id, name: "Done", position: "a2", isDone: true },
			{ projectId: empty.id, name: "Todo", position: "a0" },
		])
		.returning({ id: seiryuColumns.id });
	if (!doing) throw new Error("columns not created");
	await db
		.insert(seiryuCards)
		.values({ projectId: project.id, columnId: doing.id, title: "E2E under way", position: "a0" });

	const [road, blank] = await db
		.insert(goals)
		.values([
			{ workspaceId: wsId, name: "E2E road goal", position: "a0" },
			{ workspaceId: wsId, name: "E2E blank goal", position: "a1" },
		])
		.returning({ id: goals.id });
	if (!road || !blank) throw new Error("goals not created");
	await db.insert(goalLinks).values([
		{ goalId: road.id, kind: "project", refId: project.id },
		{ goalId: blank.id, kind: "project", refId: empty.id },
	]);
});

test.afterEach(async () => {
	await db.delete(weekPlans).where(eq(weekPlans.workspaceId, await workspaceId()));
});

test("the week is looked back on, planned, and its focus ticked", async ({ page }) => {
	await page.goto("/week");
	await page.getByRole("link", { name: /Plan the week|plan next week/ }).click();
	await expect(page).toHaveURL(/\/week\/plan$/);
	await page.getByRole("button", { name: /^Next · / }).click();

	const list = page.getByRole("list", { name: "Pick up to three" });
	// A goal's next step says which goal it moves.
	await expect(list.getByRole("button", { name: /E2E under way/ })).toContainText("E2E road goal");
	await list.getByRole("button", { name: /E2E under way/ }).click();
	await page.getByPlaceholder("In your own words…").fill("E2E own focus");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await page.getByRole("button", { name: /^Plan (the|next) week$/ }).click();

	const focus = page.getByRole("list", { name: "Week focus" });
	await expect(focus).toContainText("E2E under way");
	await expect(focus).toContainText("E2E own focus");
	await focus.getByRole("button", { name: "Done: E2E own focus" }).click();
	await expect
		.poll(async () => {
			const [plan] = await db
				.select({ focus: weekPlans.focus, ticked: weekPlans.ticked })
				.from(weekPlans)
				.where(and(eq(weekPlans.workspaceId, await workspaceId()), isNotNull(weekPlans.plannedAt)))
				.limit(1);
			const own = plan?.focus.find((f) => f.title === "E2E own focus");
			return Boolean(own && plan?.ticked.includes(own.key));
		})
		.toBe(true);

	// This week's focus comes first in the morning (on Sunday evening the plan is for next week).
	if (!isSunday) {
		await page.goto("/morning?step=pick");
		const picks = page.getByRole("list", { name: "Pick up to three" });
		await expect(picks.getByRole("button", { name: /E2E under way/ })).toContainText("Week focus");
	}
});

test("a goal with nothing to do next asks for its next step", async ({ page }) => {
	await page.goto("/goals");
	const road = page.getByRole("listitem", { name: "E2E road goal" });
	await expect(road).toContainText("E2E under way");

	const blank = page.getByRole("listitem", { name: "E2E blank goal" });
	await expect(blank).toContainText("No next step");
	await blank.getByPlaceholder("The next thing to do").fill("E2E first step");
	await blank.getByRole("button", { name: "Add", exact: true }).click();
	await expect(blank).toContainText("E2E first step");
	await expect
		.poll(async () => {
			const rows = await db
				.select({ title: seiryuCards.title })
				.from(seiryuCards)
				.where(eq(seiryuCards.projectId, emptyProjectId));
			return rows.map((r) => r.title);
		})
		.toEqual(["E2E first step"]);
});
