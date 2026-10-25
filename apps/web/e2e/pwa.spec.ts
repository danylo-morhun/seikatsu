import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Waits until the service worker controls the page (the first install claims it). */
async function controlled(page: Page) {
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;
		return !!navigator.serviceWorker.controller;
	});
}

async function cachedPages(page: Page): Promise<string[]> {
	return page.evaluate(async () => {
		const cache = await caches.open("seikatsu-pages");
		return (await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
	});
}

test("installable: manifest has PNG and maskable icons", async ({ request }) => {
	const res = await request.get("/manifest.webmanifest");
	expect(res.ok()).toBe(true);
	const manifest = await res.json();
	expect(manifest.display).toBe("standalone");
	const sizes = manifest.icons.map(
		(i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`,
	);
	expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
	for (const icon of manifest.icons) {
		expect((await request.get(icon.src)).ok()).toBe(true);
	}
});

test("a visited page opens offline", async ({ page, context }) => {
	await page.goto("/keizoku");
	await controlled(page);
	// The first load predates the worker; this one goes through it and lands in the cache.
	await page.reload();
	await expect.poll(() => cachedPages(page)).toContain("/keizoku");

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole("main").first()).toBeVisible();
	await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
	await context.setOffline(false);
});

test("every app is warmed for offline before it is visited", async ({ page, context }) => {
	await page.goto("/keizoku");
	await page.evaluate(() => window.localStorage.removeItem("seikatsu:warmed-at"));
	await page.reload();
	await controlled(page);
	await expect.poll(() => cachedPages(page), { timeout: 20_000 }).toContain("/tsundoku");

	await context.setOffline(true);
	await page.goto("/tsundoku");
	await expect(page.getByRole("main").first()).toBeVisible();
	await expect(page.getByText("You're offline")).toHaveCount(0);
	await context.setOffline(false);
});

test("a page never saved shows the offline page", async ({ page, context }) => {
	await page.goto("/keizoku");
	await controlled(page);

	await context.setOffline(true);
	await page.goto("/keizoku/year?never-cached=1");
	await expect(page.getByText("You're offline")).toBeVisible();
	await context.setOffline(false);
});

test("in-app navigation offline falls back to the saved page", async ({ page, context }) => {
	await page.goto("/keizoku");
	await page.evaluate(() => window.localStorage.removeItem("seikatsu:warmed-at"));
	await page.reload();
	await controlled(page);
	await expect.poll(() => cachedPages(page), { timeout: 20_000 }).toContain("/tsundoku");

	await context.setOffline(true);
	await page
		.getByRole("link", { name: /Tsundoku/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/tsundoku$/);
	await expect(page.getByRole("main").first()).toBeVisible();
	await expect(page.getByText("You're offline")).toHaveCount(0);
	await context.setOffline(false);
});
