import {
	db,
	eq,
	seiryuCardLabels,
	seiryuCards,
	seiryuColumns,
	seiryuLabels,
	seiryuProjects,
} from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

let projectId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E board", position: "a0" })
		.returning({ id: seiryuProjects.id });
	if (!project) throw new Error("project not created");
	projectId = project.id;
	const [todo] = await db
		.insert(seiryuColumns)
		.values([
			{ projectId, name: "Todo", position: "a0" },
			{ projectId, name: "Done", position: "a1" },
		])
		.returning({ id: seiryuColumns.id });
	if (!todo) throw new Error("columns not created");
	await db
		.insert(seiryuCards)
		.values({ projectId, columnId: todo.id, title: "Write tests", position: "a0" });
});

const lane = (page: import("@playwright/test").Page, name: string) =>
	page.getByRole("region", { name });

test("card edits save themselves, even when the sheet closes mid-typing", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}`);
	await page.getByRole("button", { name: "Write tests" }).click();

	const sheet = page.getByRole("dialog");
	await sheet.getByRole("button", { name: "Add notes" }).click();
	await sheet.getByLabel("Description").fill("Cover the board");
	// Escape straight away: the draft must be committed as the sheet unmounts.
	await page.keyboard.press("Escape");
	await expect(sheet).toBeHidden();

	await expect
		.poll(async () => {
			const [card] = await db
				.select({ description: seiryuCards.description })
				.from(seiryuCards)
				.where(eq(seiryuCards.projectId, projectId));
			return card?.description;
		})
		.toBe("Cover the board");

	await page.reload();
	await page.getByRole("button", { name: "Write tests" }).click();
	await expect(page.getByRole("dialog").getByLabel("Description")).toHaveValue("Cover the board");
});

test("dragging a card to another column moves it for good", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}`);
	const card = page.getByRole("button", { name: "Write tests" });
	const target = lane(page, "Done").getByRole("button", { name: "Add card" });

	const from = await card.boundingBox();
	const to = await target.boundingBox();
	if (!from || !to) throw new Error("no layout");
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	// Past the 5px activation distance, then over the Done lane in steps.
	await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
	await page.mouse.move(to.x + to.width / 2, to.y - 20, { steps: 12 });
	await page.mouse.up();

	await expect(lane(page, "Done").getByRole("button", { name: "Write tests" })).toBeVisible();
	await page.reload();
	await expect(lane(page, "Done").getByRole("button", { name: "Write tests" })).toBeVisible();
});

test("N opens capture; the new card shows at once and stays", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}`);
	const dialog = page.getByRole("dialog", { name: "New Card" });
	// The board is server-rendered: N only works once it has hydrated, so press until it opens.
	await expect(async () => {
		await page.keyboard.press("n");
		await expect(dialog).toBeVisible({ timeout: 500 });
	}).toPass();
	await expect(dialog.getByLabel("Title")).toBeFocused();
	await dialog.getByLabel("Title").fill("Ship it");
	await dialog.getByRole("button", { name: "Add card" }).click();

	await expect(lane(page, "Todo").getByText("Ship it")).toBeVisible();
	await page.reload();
	await expect(lane(page, "Todo").getByText("Ship it")).toBeVisible();
});

test("a malformed card link says nothing is there, inside the app", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}/not-a-uuid`);
	await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
	// The shell and the project list stay: it's a page, not a crash.
	await expect(page.getByRole("link", { name: /E2E board/ })).toBeVisible();
});

test("a label picked from a card's right-click menu shows on its tile and stays", async ({
	page,
}) => {
	await db.insert(seiryuLabels).values({ projectId, name: "Bug", color: "#e57580" });
	await page.goto(`/seiryu/${projectId}`);
	const card = page.getByRole("button", { name: "Write tests" });

	await card.click({ button: "right" });
	const menu = page.getByRole("menu");
	await menu.getByRole("menuitem", { name: "Labels" }).hover();
	await page.getByRole("menuitemcheckbox", { name: "Bug" }).click();
	// Picking a label keeps the menu open for the next one.
	await expect(page.getByRole("menuitemcheckbox", { name: "Bug" })).toBeChecked();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");

	await expect(card).toContainText("Bug");
	await expect.poll(async () => (await db.select().from(seiryuCardLabels)).length).toBe(1);
	await page.reload();
	await expect(page.getByRole("button", { name: "Write tests" })).toContainText("Bug");
});

test("card keys set priority, move between columns and archive", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}`);
	const card = page.getByRole("button", { name: "Write tests" });
	await card.focus();
	const cardRow = async () => {
		const [row] = await db
			.select({
				priority: seiryuCards.priority,
				columnId: seiryuCards.columnId,
				archivedAt: seiryuCards.archivedAt,
			})
			.from(seiryuCards)
			.where(eq(seiryuCards.projectId, projectId));
		return row;
	};

	// Hydration first: press until the key lands.
	await expect(async () => {
		await card.focus();
		await page.keyboard.press("3");
		expect((await cardRow())?.priority).toBe("high");
	}).toPass();

	await page.keyboard.press("]");
	const done = lane(page, "Done").getByRole("button", { name: "Write tests" });
	await expect(done).toBeVisible();
	await expect(done).toBeFocused();

	await page.keyboard.press("e");
	await expect(page.getByRole("button", { name: "Write tests" })).toBeHidden();
	await expect.poll(async () => (await cardRow())?.archivedAt).not.toBeNull();
});

test("? lists the board's shortcuts", async ({ page }) => {
	await page.goto(`/seiryu/${projectId}`);
	const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
	await expect(async () => {
		await page.keyboard.press("Shift+Slash");
		await expect(dialog).toBeVisible({ timeout: 500 });
	}).toPass();
	await expect(dialog.getByText("Move to the previous or next column")).toBeVisible();
});
