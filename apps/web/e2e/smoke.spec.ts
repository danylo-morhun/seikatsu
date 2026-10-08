import { accounts, and, db, eq, keizokuHabits } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

const ROUTES = [
	"/kuroji",
	"/kuroji?tab=accounts",
	"/kuroji?tab=transactions",
	"/kuroji/settings",
	"/seiryu",
	"/tsundoku",
	"/tsundoku/stats",
	"/keizoku",
	"/kyuu",
	"/kyuu/stats",
	"/aisha",
	"/settings",
	"/settings/account",
	"/settings/kuroji",
];

// Every page renders on the prod build with no console errors (the fixture fails on any).
for (const path of ROUTES) {
	test(`renders ${path}`, async ({ page }) => {
		const res = await page.goto(path);
		expect(res?.status()).toBeLessThan(400);
		await expect(page.getByRole("main").first()).toBeVisible();
	});
}

test("renders detail pages", async ({ page }) => {
	const wsId = await workspaceId();
	const [wallet] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.workspaceId, wsId), eq(accounts.name, "Wallet")));
	const [habit] = await db
		.insert(keizokuHabits)
		.values({ workspaceId: wsId, name: "E2E detail", emoji: "📖", frequencyType: "daily" })
		.returning({ id: keizokuHabits.id });

	for (const path of [`/kuroji/accounts/${wallet.id}`, `/keizoku/${habit.id}`]) {
		const res = await page.goto(path);
		expect(res?.status(), path).toBeLessThan(400);
		await expect(page.getByRole("main").first()).toBeVisible();
	}
});
