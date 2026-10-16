import { accounts, and, db, eq, keizokuHabits, kyuuApplications } from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

const ROUTES = [
	"/kuroji",
	"/kuroji?tab=accounts",
	"/kuroji?tab=transactions",
	"/kuroji/settings",
	"/seiryu",
	"/tsundoku",
	"/tsundoku?s=read&view=list",
	"/tsundoku/year",
	"/tsundoku/stats",
	"/keizoku",
	"/keizoku/year",
	"/keizoku/archive",
	"/kyuu",
	"/kyuu?view=waiting",
	"/kyuu?view=archived",
	"/kyuu/stats",
	"/aisha",
	"/settings",
	"/settings/account",
	"/settings/kuroji",
	"/settings/seiryu",
	"/settings/seiryu?section=labels",
	"/settings/seiryu?section=archive",
	"/settings/tsundoku",
	"/settings/keizoku",
	"/settings/kyuu",
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

	const [application] = await db
		.insert(kyuuApplications)
		.values({
			workspaceId: wsId,
			company: "E2E detail",
			role: "Engineer",
			dateApplied: "2026-01-05",
		})
		.returning({ id: kyuuApplications.id });

	for (const path of [
		`/kuroji/accounts/${wallet.id}`,
		`/keizoku/${habit.id}`,
		`/kyuu/${application.id}`,
	]) {
		const res = await page.goto(path);
		expect(res?.status(), path).toBeLessThan(400);
		await expect(page.getByRole("main").first()).toBeVisible();
	}
});
