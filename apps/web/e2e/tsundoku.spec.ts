import { db, eq, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

let bookId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(tsundokuBooks).where(eq(tsundokuBooks.workspaceId, wsId));
	const [book] = await db
		.insert(tsundokuBooks)
		.values({
			workspaceId: wsId,
			title: "E2E Book",
			authors: ["Ann Author"],
			pageCount: 200,
			status: "want",
			source: "manual",
			position: "a0",
		})
		.returning({ id: tsundokuBooks.id });
	if (!book) throw new Error("book not created");
	bookId = book.id;
});

const bookRow = async () => {
	const [row] = await db.select().from(tsundokuBooks).where(eq(tsundokuBooks.id, bookId));
	return row;
};

test("N opens capture; a book added by hand lands on the pile", async ({ page }) => {
	await page.goto("/tsundoku");
	const dialog = page.getByRole("dialog", { name: "Add Book" });
	// The library is server-rendered: N only works once it has hydrated, so press until it opens.
	await expect(async () => {
		await page.keyboard.press("n");
		await expect(dialog).toBeVisible({ timeout: 500 });
	}).toPass();

	await dialog.getByRole("tab", { name: "By hand" }).click();
	await dialog.getByLabel("Title").fill("Second Book");
	await dialog.getByLabel("Pages").fill("120");
	await dialog.getByRole("button", { name: "Add book" }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByRole("link", { name: /^Second Book/ })).toBeVisible();
	const wsId = await workspaceId();
	await expect
		.poll(async () =>
			(await db.select().from(tsundokuBooks).where(eq(tsundokuBooks.workspaceId, wsId)))
				.filter((b) => b.title === "Second Book")
				.map((b) => `${b.status}:${b.pageCount}`),
		)
		.toEqual(["want:120"]);
});

test("L on a book takes progress in percent and counts the day", async ({ page }) => {
	await page.goto("/tsundoku");
	const tile = page.locator(`[data-book-id="${bookId}"]`);
	await expect(async () => {
		await tile.focus();
		await page.keyboard.press("l");
		await expect(page.getByRole("dialog", { name: "E2E Book" })).toBeVisible({ timeout: 500 });
	}).toPass();

	await page.keyboard.type("25%");
	await expect(page.getByText("Page 50")).toBeVisible();
	await page.keyboard.press("Enter");

	await expect.poll(async () => (await bookRow())?.currentPage).toBe(50);
	const row = await bookRow();
	expect(row?.status).toBe("reading");
	const sessions = await db
		.select()
		.from(tsundokuSessions)
		.where(eq(tsundokuSessions.bookId, bookId));
	expect(sessions.map((s) => s.pagesRead)).toEqual([50]);
	// The day is the user's (tz cookie = the browser's zone), and the year shows it.
	await page.goto("/tsundoku/year");
	await expect(
		page.getByRole("img", { name: `1 reading day in ${sessions[0]?.date.slice(0, 4)}` }),
	).toBeVisible();
});

test("book keys rate and set status; notes save themselves", async ({ page }) => {
	await page.goto(`/tsundoku/${bookId}`);
	await expect(async () => {
		await page.keyboard.press("4");
		expect((await bookRow())?.rating).toBe(8);
	}).toPass();
	await page.keyboard.press("d");
	await expect.poll(async () => (await bookRow())?.status).toBe("read");
	await expect(page.getByRole("heading", { name: "Finished" })).toBeVisible();

	await page.getByRole("button", { name: "Add notes" }).click();
	await page.getByRole("textbox", { name: "Notes" }).fill("Stayed with me");
	await page.getByRole("heading", { name: "Quotes" }).click();
	await expect.poll(async () => (await bookRow())?.review).toBe("Stayed with me");

	await page.reload();
	await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Stayed with me");
});

test("deleting a reading day takes its pages back", async ({ page }) => {
	await page.goto(`/tsundoku/${bookId}`);
	const field = page.getByLabel("Page you're on, or percent");
	await field.fill("200");
	await page.getByRole("button", { name: "Update" }).click();
	await expect(page.getByRole("heading", { name: "Finished" })).toBeVisible();

	await page.getByRole("button", { name: "Reading day actions" }).click();
	await page.getByRole("menuitem", { name: /Delete/ }).click();
	await expect.poll(async () => (await bookRow())?.currentPage).toBe(0);
	expect((await bookRow())?.status).toBe("reading");
});

test("a malformed book link is a not-found page inside the shell", async ({ page }) => {
	await page.goto("/tsundoku/not-a-book");
	await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
	// The shell stays: it's a page, not a crash.
	await expect(page.getByRole("link", { name: "Back to the library" })).toBeVisible();
});
