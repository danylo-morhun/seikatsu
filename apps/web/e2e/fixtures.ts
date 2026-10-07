import { type Page, test as base, expect } from "@playwright/test";
import { db, eq, workspaces } from "@seikatsu/db";
import { E2E_USER } from "./env";

// Every test fails on a console error or uncaught exception — hydration mismatches
// (minified React #418/#423/#425 in prod) surface here.
export const test = base.extend<{ consoleErrors: string[] }>({
	consoleErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on("console", (msg) => {
				// Speed Insights' script only exists on Vercel; it 404s under `next start`.
				const source = msg.location().url;
				if (msg.type() !== "error" || source.includes("/_vercel/")) return;
				errors.push(`${msg.text()} (${source || page.url()})`);
			});
			page.on("pageerror", (err) => errors.push(`${err.message} (${page.url()})`));
			await use(errors);
			expect(errors, "console errors").toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/** The E2E user's workspace (created by auth.setup on the first visit). */
export async function workspaceId(): Promise<string> {
	const [ws] = await db
		.select({ id: workspaces.id })
		.from(workspaces)
		.where(eq(workspaces.userId, E2E_USER.id));
	if (!ws) throw new Error("E2E workspace missing — did auth.setup run?");
	return ws.id;
}

/** Unique suffix so reruns against the same DB never collide. */
export const uid = () => Date.now().toString(36);

/**
 * Holds server-action responses until `release()` — lets a test see the optimistic UI
 * while the action is still in flight, then the real re-render once it lands.
 */
export async function holdServerActions(page: Page): Promise<() => void> {
	let release!: () => void;
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/*", async (route) => {
		if (route.request().headers()["next-action"]) await released;
		await route.continue();
	});
	return release;
}
