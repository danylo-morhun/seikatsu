import { db, eq, kyuuApplications } from "@seikatsu/db";
import { expect, holdServerActions, test, workspaceId } from "./fixtures";

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(kyuuApplications).where(eq(kyuuApplications.workspaceId, wsId));
	await db.insert(kyuuApplications).values({
		workspaceId: wsId,
		company: "E2E Corp",
		role: "Engineer",
		status: "applied",
		dateApplied: new Date().toISOString().slice(0, 10), // older "applied" ones show as Ignored
	});
});

test("changing an application's stage sticks", async ({ page }) => {
	await page.goto("/kyuu");
	const row = page.getByRole("row").filter({ hasText: "E2E Corp" });

	const release = await holdServerActions(page);
	await row.getByRole("button", { name: "Applied" }).click();
	await page.getByRole("menuitem", { name: "HR Screening" }).click();

	// Optimistic badge while the action is in flight.
	await expect(row.getByRole("button", { name: "HR Screening" })).toBeVisible();

	// After the action lands the server props must agree, or the optimistic value reverts.
	const saved = page.waitForResponse((res) => !!res.request().headers()["next-action"]);
	release();
	await saved;
	await expect(row.getByRole("button", { name: "HR Screening" })).toBeVisible();

	// A transition stuck after the action would block the next one: sorting must still navigate.
	await page.getByRole("button", { name: /Company/ }).click();
	await expect(page).toHaveURL(/sort=company/);

	await page.reload();
	await expect(row.getByRole("button", { name: "HR Screening" })).toBeVisible();
});
