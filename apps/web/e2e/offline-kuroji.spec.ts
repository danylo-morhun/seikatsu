import type { Page } from "@playwright/test";
import { db, eq, transactions } from "@seikatsu/db";
import { expect, test, uid } from "./fixtures";

const PAGE = "/kuroji?tab=transactions";

/** Served by the service worker and in its cache; the capture form's options loaded once. */
async function readyOffline(page: Page) {
	await page.goto(PAGE);
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;
		return !!navigator.serviceWorker.controller;
	});
	await page.reload();
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const keys = await (await caches.open("seikatsu-pages")).keys();
				return keys.some((k) => new URL(k.url).search === "?tab=transactions");
			}),
		)
		.toBe(true);
	await expect
		.poll(() => page.evaluate(() => !!window.localStorage.getItem("seikatsu:kuroji-form-options")))
		.toBe(true);
}

async function capture(page: Page, description: string) {
	await page.locator("header").getByRole("button", { name: "New Transaction" }).click();
	const dialog = page.getByRole("dialog", { name: "New Transaction" });
	await dialog.getByRole("combobox").filter({ hasText: "Select account" }).click();
	await page.getByRole("option", { name: "Wallet" }).click();
	await dialog.getByRole("button", { name: "More…" }).click();
	await page.getByPlaceholder("Find a category").fill("Groc");
	await page.getByRole("option", { name: "Groceries" }).click();
	await dialog.getByLabel("Amount").fill("7,50");
	await dialog.getByLabel("Description").fill(description);
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();
}

const byDescription = (description: string) =>
	db.select().from(transactions).where(eq(transactions.description, description));

test("a transaction captured offline shows as not synced, then syncs once", async ({
	page,
	context,
}) => {
	const description = `E2E offline ${uid()}`;
	await readyOffline(page);

	await context.setOffline(true);
	await page.reload();
	await capture(page, description);
	const row = page.getByRole("listitem").filter({ hasText: description });
	await expect(row).toContainText("Not synced");
	expect(await byDescription(description)).toHaveLength(0);

	await page.reload();
	await expect(row).toContainText("Not synced");

	await context.setOffline(false);
	await expect.poll(async () => (await byDescription(description)).length).toBe(1);
	await expect(row).toBeVisible();
	await expect(row).not.toContainText("Not synced");
});
