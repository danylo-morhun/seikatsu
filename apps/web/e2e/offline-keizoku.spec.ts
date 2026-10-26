import type { Page } from "@playwright/test";
import { db, eq, keizokuHabitLogs, keizokuHabits } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

let habitId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(keizokuHabits).where(eq(keizokuHabits.workspaceId, wsId));
	const [habit] = await db
		.insert(keizokuHabits)
		.values({ workspaceId: wsId, name: "E2E offline", emoji: "📴", frequencyType: "daily" })
		.returning();
	habitId = habit.id;
});

/** The page is served by the service worker and in its cache, so it opens offline. */
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

const logs = () => db.select().from(keizokuHabitLogs).where(eq(keizokuHabitLogs.habitId, habitId));

test("a tick made offline survives a reload and syncs once back online", async ({
	page,
	context,
}) => {
	await cachedAndControlled(page, "/keizoku");

	await context.setOffline(true);
	await page.getByRole("button", { name: "E2E offline: mark done today" }).click();
	await expect(page.getByRole("button", { name: "E2E offline: done today" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("status").filter({ hasText: "Offline" })).toContainText("1");

	// The cached page knows nothing of it; the queue on this device does.
	await page.reload();
	await expect(page.getByRole("button", { name: "E2E offline: done today" })).toBeVisible();
	expect(await logs()).toHaveLength(0);

	await context.setOffline(false);
	await expect.poll(async () => (await logs()).length).toBe(1);
	await expect(page.getByRole("status")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "E2E offline: done today" })).toBeVisible();

	// A second tab or a lost response replays the same op id: still one row.
	await page.reload();
	await expect(page.getByRole("button", { name: "E2E offline: done today" })).toBeVisible();
	expect(await logs()).toHaveLength(1);
});

test("a change the server refuses is listed to retry or drop", async ({ page, context }) => {
	await cachedAndControlled(page, "/keizoku");

	await context.setOffline(true);
	await page.getByRole("button", { name: "E2E offline: mark done today" }).click();
	// The habit is gone by the time the tick arrives.
	await db.delete(keizokuHabits).where(eq(keizokuHabits.id, habitId));
	await context.setOffline(false);

	const notSynced = page.getByRole("button", { name: "1 not synced" });
	await expect(notSynced).toBeVisible();
	await notSynced.click();
	await expect(page.getByText("Habit not found")).toBeVisible();
	await page.getByRole("button", { name: "Drop" }).click();
	await expect(notSynced).toHaveCount(0);
});
