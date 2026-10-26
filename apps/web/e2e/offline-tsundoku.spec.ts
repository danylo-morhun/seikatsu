import type { Page } from "@playwright/test";
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
			title: "E2E Offline Book",
			authors: ["Ann Author"],
			pageCount: 200,
			status: "reading",
			startedAt: "2026-01-10",
			source: "manual",
			position: "a0",
		})
		.returning({ id: tsundokuBooks.id });
	if (!book) throw new Error("book not created");
	bookId = book.id;
});

async function cachedAndControlled(page: Page, path: string) {
	await page.goto(path);
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;
		return !!navigator.serviceWorker.controller;
	});
	await page.reload();
	await expect
		.poll(() =>
			page.evaluate(async (p) => {
				const keys = await (await caches.open("seikatsu-pages")).keys();
				return keys.some((k) => new URL(k.url).pathname === p);
			}, path),
		)
		.toBe(true);
}

const book = async () =>
	(await db.select().from(tsundokuBooks).where(eq(tsundokuBooks.id, bookId)))[0];

test("progress made offline shows after a reload and syncs as one reading day", async ({
	page,
	context,
}) => {
	const path = `/tsundoku/${bookId}`;
	await cachedAndControlled(page, path);

	await context.setOffline(true);
	const field = page.getByLabel("Page you're on, or percent");
	await field.fill("60");
	await page.getByRole("button", { name: "Update" }).click();
	const progress = page.getByText("p. 60 of 200");
	await expect(progress).toBeVisible();
	await expect(page.getByRole("status").filter({ hasText: "Offline" })).toContainText("1");

	await page.reload();
	await expect(progress).toBeVisible();
	expect((await book())?.currentPage).toBe(0);

	await context.setOffline(false);
	await expect.poll(async () => (await book())?.currentPage).toBe(60);
	const days = await db.select().from(tsundokuSessions).where(eq(tsundokuSessions.bookId, bookId));
	expect(days.map((d) => d.pagesRead)).toEqual([60]);
});
