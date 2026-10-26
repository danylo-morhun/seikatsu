import type { Page } from "@playwright/test";
import { db, eq, seiryuCards, seiryuColumns, seiryuProjects } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

let projectId: string;

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(seiryuProjects).where(eq(seiryuProjects.workspaceId, wsId));
	const [project] = await db
		.insert(seiryuProjects)
		.values({ workspaceId: wsId, name: "E2E offline board", position: "a0" })
		.returning({ id: seiryuProjects.id });
	if (!project) throw new Error("project not created");
	projectId = project.id;
	await db.insert(seiryuColumns).values([
		{ projectId, name: "Todo", position: "a0" },
		{ projectId, name: "Done", position: "a1" },
	]);
});

const lane = (page: Page, name: string) => page.getByRole("region", { name });

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

const cardsTitled = (title: string) =>
	db.select().from(seiryuCards).where(eq(seiryuCards.title, title));

test("a card added offline stays through a reload and syncs once", async ({ page, context }) => {
	const path = `/seiryu/${projectId}`;
	await cachedAndControlled(page, path);

	await context.setOffline(true);
	const dialog = page.getByRole("dialog", { name: "New Card" });
	await expect(async () => {
		await page.keyboard.press("n");
		await expect(dialog).toBeVisible({ timeout: 500 });
	}).toPass();
	await dialog.getByLabel("Title").fill("Offline card");
	await dialog.getByRole("button", { name: "Add card" }).click();
	await expect(lane(page, "Todo").getByText("Offline card")).toBeVisible();

	await page.reload();
	await expect(lane(page, "Todo").getByText("Offline card")).toBeVisible();
	expect(await cardsTitled("Offline card")).toHaveLength(0);

	await context.setOffline(false);
	await expect.poll(async () => (await cardsTitled("Offline card")).length).toBe(1);
	await page.reload();
	await expect(lane(page, "Todo").getByText("Offline card")).toBeVisible();
	expect(await cardsTitled("Offline card")).toHaveLength(1);
});
