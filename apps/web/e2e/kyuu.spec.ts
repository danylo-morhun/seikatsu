import { and, db, eq, kyuuApplications, kyuuEvents } from "@seikatsu/db";
import { expect, holdServerActions, test, workspaceId } from "./fixtures";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(kyuuApplications).where(eq(kyuuApplications.workspaceId, wsId));
	await db.insert(kyuuApplications).values([
		{
			workspaceId: wsId,
			company: "E2E Draft Corp",
			role: "Engineer",
			status: "drafted",
			dateApplied: daysAgo(1),
			notes: "Apply by hand: captcha on the form.",
		},
		{
			workspaceId: wsId,
			company: "E2E Quiet Corp",
			role: "Engineer",
			status: "applied",
			dateApplied: daysAgo(30),
		},
	]);
});

test("Now: a drafted application is marked sent with a key", async ({ page }) => {
	await page.goto("/kyuu");
	const toSend = page.getByRole("region", { name: /To send/ });
	const row = toSend.locator("[data-app-row]", { hasText: "E2E Draft Corp" });
	await expect(row).toContainText("captcha on the form.");

	const release = await holdServerActions(page);
	await row.hover();
	await page.keyboard.press("x");
	// Optimistic: marked sent while the action is in flight; it leaves To send once it lands.
	await expect(row).toContainText("Applied");
	release();
	await expect(toSend).toHaveCount(0);

	await page.reload();
	await expect(page.getByRole("region", { name: /To send/ })).toHaveCount(0);
	const [saved] = await db
		.select({ status: kyuuApplications.status })
		.from(kyuuApplications)
		.where(eq(kyuuApplications.company, "E2E Draft Corp"));
	expect(saved.status).toBe("applied");
});

test("Now: a long-quiet application closes as ghosted", async ({ page }) => {
	await page.goto("/kyuu");
	const ghost = page.getByRole("region", { name: /No answer for/ });
	const row = ghost.locator("[data-app-row]", { hasText: "E2E Quiet Corp" });
	const release = await holdServerActions(page);
	await row.hover();
	await page.keyboard.press("g");
	// Optimistic: closed at once; it leaves Now when the action lands.
	await expect(row).toContainText("Ghosted");
	release();
	await expect(ghost).toHaveCount(0);

	await expect
		.poll(async () => {
			const [app] = await db
				.select({ id: kyuuApplications.id, status: kyuuApplications.status })
				.from(kyuuApplications)
				.where(eq(kyuuApplications.company, "E2E Quiet Corp"));
			const events = await db
				.select({ kind: kyuuEvents.kind })
				.from(kyuuEvents)
				.where(and(eq(kyuuEvents.applicationId, app.id), eq(kyuuEvents.kind, "ghosted")));
			return `${app.status}:${events.length}`;
		})
		.toBe("ghosted:1");
});

test("the sheet books a screening onto the timeline", async ({ page }) => {
	await page.goto("/kyuu/all");
	await page.locator("[data-app-id]", { hasText: "E2E Quiet Corp" }).click();

	const sheet = page.getByRole("dialog", { name: "E2E Quiet Corp" });
	await expect(sheet.getByRole("heading", { name: "Timeline" })).toBeVisible();
	await sheet.getByRole("button", { name: "Book a screening" }).click();

	const dialog = page.getByRole("dialog", { name: "Book a screening" });
	await dialog.getByLabel("Time").fill("10:30");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();

	await expect(sheet.getByRole("button", { name: /^Screening/ })).toBeVisible();
	await expect(sheet.getByRole("combobox", { name: "Status" })).toContainText("Screening");
});
