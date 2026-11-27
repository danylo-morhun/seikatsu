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
	const views = page.getByRole("navigation", { name: "Home view" });
	/** A key, pressed until the page (hydrated, on its new view) answers it. */
	const press = async (key: string, url: RegExp, tab?: string) => {
		await expect(async () => {
			await page.keyboard.press(key);
			await expect(page).toHaveURL(url, { timeout: 1000 });
		}).toPass();
		if (tab)
			await expect(views.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
				"aria-current",
				"page",
			);
	};
	await page.goto("/?v=week");
	await expect(views.getByRole("link", { name: "Week", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);

	await press("m", /v=month/, "Month");
	await expect(page.getByRole("link", { name: /E2E call at ten/ })).toBeVisible();
	await press("]", /v=month&d=\d{4}-\d{2}-01/, "Month");
	await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
		new Date().toLocaleString("en-GB", { month: "long", timeZone: "UTC" }),
	);
	await press("t", /\/\?v=month$/, "Month");

	await page.goto("/");
	await expect(views.getByRole("link", { name: "Month", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);

	await press("c", /v=widgets/);
	await expect(page.getByRole("link", { name: "Widgets", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await press("c", /v=month/, "Month");
});

test("an event is made with E, changed and deleted", async ({ page }) => {
	const wsId = await workspaceId();
	await db.delete(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	await page.goto("/?v=week");
	await expect(page.getByRole("navigation", { name: "Home view" })).toBeVisible();

	const dialog = page.getByRole("dialog", { name: "New event" });
	await expect(async () => {
		await page.keyboard.press("e");
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
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

test("dragging over empty hours opens an event for that stretch; its edge sets the end", async ({
	page,
}) => {
	const wsId = await workspaceId();
	await db.delete(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	await page.goto(`/?v=day&d=${today}`);
	const hours = page.locator("div.cursor-cell").first();
	await expect(hours).toBeVisible();
	await hours.scrollIntoViewIfNeeded();
	const box = await hours.boundingBox();
	if (!box) throw new Error("no hours");
	// 09:00 to 10:30, at 56 px an hour.
	await page.mouse.move(box.x + 40, box.y + 9 * 56 + 4);
	await page.mouse.down();
	await page.mouse.move(box.x + 40, box.y + 10 * 56, { steps: 4 });
	await page.mouse.move(box.x + 40, box.y + 10.5 * 56, { steps: 4 });
	await page.mouse.up();

	const dialog = page.getByRole("dialog", { name: "New event" });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByLabel("From")).toHaveValue("09:00");
	await expect(dialog.getByLabel("To", { exact: true })).toHaveValue("10:30");
	await dialog.getByLabel("Event name").fill("E2E stretch");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();

	// Its bottom edge, dragged half an hour further: it ends at 11:00.
	const block = page.getByRole("button", { name: /09:00–10:30\s*E2E stretch/ });
	await expect(block).toBeVisible();
	const b = await block.boundingBox();
	if (!b) throw new Error("no block");
	await page.mouse.move(b.x + b.width / 2, b.y + b.height - 2);
	await page.mouse.down();
	await page.mouse.move(b.x + b.width / 2, b.y + b.height + 28, { steps: 4 });
	await page.mouse.up();
	await expect(page.getByRole("button", { name: /09:00–11:00\s*E2E stretch/ })).toBeVisible();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	const [saved] = await db
		.select()
		.from(calendarEvents)
		.where(eq(calendarEvents.workspaceId, wsId));
	expect(saved).toMatchObject({ title: "E2E stretch", startTime: "09:00:00", endTime: "11:00:00" });
});

test.describe("on a touch screen", () => {
	test.use({ hasTouch: true });

	test("a held card follows the finger to another day's hour", async ({ page }) => {
		const isSunday = new Date().getUTCDay() === 0;
		test.skip(isSunday, "no later day this week to drop on");
		const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		await page.goto("/?v=week");
		const card = page.getByRole("link", { name: "E2E any time today" });
		await expect(card).toBeVisible();
		const weekday = new Date(`${tomorrow}T00:00:00Z`).getUTCDay();
		const column = page.locator("div.cursor-cell").nth(weekday === 0 ? 6 : weekday - 1);
		await column.scrollIntoViewIfNeeded();
		const from = await card.boundingBox();
		const to = await column.boundingBox();
		if (!from || !to) throw new Error("no boxes");

		const cdp = await page.context().newCDPSession(page);
		const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: type === "touchEnd" ? [] : [{ x, y }],
			});
		const [x0, y0] = [from.x + 6, from.y + 4];
		const [x1, y1] = [to.x + 20, to.y + 14 * 56 + 4];
		await touch("touchStart", x0, y0);
		await page.waitForTimeout(500); // held: picked up
		for (let i = 1; i <= 8; i++)
			await touch("touchMove", x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
		await touch("touchEnd", x1, y1);

		await expect(page.getByRole("link", { name: /14:00\s*E2E any time today/ })).toBeVisible();
		const [saved] = await db
			.select({ dueDate: seiryuCards.dueDate, dueTime: seiryuCards.dueTime })
			.from(seiryuCards)
			.where(eq(seiryuCards.title, "E2E any time today"));
		expect(saved).toEqual({ dueDate: tomorrow, dueTime: "14:00:00" });
	});
});

test("a repeating event changes on one day, and is cut from a day on", async ({ page }) => {
	const wsId = await workspaceId();
	await db.delete(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	const start = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
	const [series] = await db
		.insert(calendarEvents)
		.values({
			workspaceId: wsId,
			title: "E2E standup",
			date: start,
			startTime: "09:00",
			endTime: "09:15",
			repeat: "day",
		})
		.returning({ id: calendarEvents.id });
	if (!series) throw new Error("no series");

	// Today alone moves to 10:00.
	await page.goto(`/?v=day&d=${today}`);
	await page.getByRole("button", { name: /09:00–09:15\s*E2E standup/ }).click();
	const edit = page.getByRole("dialog", { name: "Edit event" });
	await edit.getByLabel("From").fill("10:00");
	await edit.getByLabel("To", { exact: true }).fill("10:15");
	await edit.getByRole("button", { name: "Save" }).click();
	await edit.getByRole("button", { name: "This event" }).click();
	await expect(edit).toBeHidden();
	await expect(page.getByRole("button", { name: /10:00–10:15\s*E2E standup/ })).toBeVisible();

	let rows = await db.select().from(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	expect(rows).toHaveLength(2);
	expect(rows.find((r) => r.id === series.id)?.skip).toEqual([today]);
	expect(rows.find((r) => r.id !== series.id)).toMatchObject({
		date: today,
		repeat: null,
		startTime: "10:00:00",
	});

	// From tomorrow on, the series is gone; before stays.
	const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
	await page.goto(`/?v=day&d=${tomorrow}`);
	await page.getByRole("button", { name: /09:00–09:15\s*E2E standup/ }).click();
	await edit.getByRole("button", { name: "Delete" }).click();
	await edit.getByRole("button", { name: "This and following" }).click();
	await expect(edit).toBeHidden();
	await expect(page.getByRole("button", { name: /E2E standup/ })).toHaveCount(0);
	rows = await db.select().from(calendarEvents).where(eq(calendarEvents.id, series.id));
	expect(rows[0]?.repeatUntil).toBe(today);
});

test("/ searches the events: ahead first, Esc goes back to the days", async ({ page }) => {
	const wsId = await workspaceId();
	await db.delete(calendarEvents).where(eq(calendarEvents.workspaceId, wsId));
	const ahead = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
	const behind = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
	await db.insert(calendarEvents).values([
		{ workspaceId: wsId, title: "E2E dentist check-up", date: ahead, location: "ul. Długa 5" },
		{ workspaceId: wsId, title: "E2E dentist, first visit", date: behind },
		{ workspaceId: wsId, title: "E2E haircut", date: ahead },
	]);
	await page.goto("/?v=month");
	await expect(page.getByRole("navigation", { name: "Home view" })).toBeVisible();
	const field = page.getByRole("searchbox", { name: "Search events" });
	await expect(async () => {
		await page.keyboard.press("/");
		await expect(field).toBeFocused({ timeout: 1000 });
	}).toPass();
	await field.fill("dentist");
	await expect(page).toHaveURL(/q=dentist/);
	const aheadList = page.getByRole("region", { name: "Ahead" });
	await expect(aheadList.getByRole("button", { name: /E2E dentist check-up/ })).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Behind" }).getByRole("button", { name: /first visit/ }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: /E2E haircut/ })).toHaveCount(0);

	await field.press("Escape");
	await expect(page).not.toHaveURL(/q=/);
	await expect(page.getByRole("list", { name: "Days" })).toBeVisible();
});
