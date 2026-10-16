import { and, db, eq, kyuuApplications, kyuuEvents } from "@seikatsu/db";
import { expect, holdServerActions, test, workspaceId } from "./fixtures";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function statusOf(company: string) {
	const [app] = await db
		.select({ id: kyuuApplications.id, status: kyuuApplications.status })
		.from(kyuuApplications)
		.where(eq(kyuuApplications.company, company));
	return app;
}

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

test("the table marks a drafted application sent with a key", async ({ page }) => {
	await page.goto("/kyuu");
	const row = page.locator("[data-app-row]", { hasText: "E2E Draft Corp" });
	await expect(row).toContainText("To send");

	const release = await holdServerActions(page);
	await row.hover();
	await page.keyboard.press("x");
	// Optimistic: the status changes while the action is still in flight.
	await expect(row).toContainText("Applied");
	release();

	await expect.poll(async () => (await statusOf("E2E Draft Corp")).status).toBe("applied");
	await page.reload();
	await expect(page.locator("[data-app-row]", { hasText: "E2E Draft Corp" })).toContainText(
		"Applied",
	);
});

test("Waiting closes long-quiet applications as ghosted", async ({ page }) => {
	await page.goto("/kyuu?view=waiting");
	await page.getByRole("button", { name: "Close as ghosted" }).click();
	await page.getByRole("button", { name: "Close 1" }).click();

	await expect
		.poll(async () => {
			const app = await statusOf("E2E Quiet Corp");
			const events = await db
				.select({ kind: kyuuEvents.kind })
				.from(kyuuEvents)
				.where(and(eq(kyuuEvents.applicationId, app.id), eq(kyuuEvents.kind, "ghosted")));
			return `${app.status}:${events.length}`;
		})
		.toBe("ghosted:1");
	// It leaves Waiting once the page re-renders.
	await expect(page.locator("[data-app-row]", { hasText: "E2E Quiet Corp" })).toHaveCount(0);
});

test("an application's page books a screening onto its timeline", async ({ page }) => {
	await page.goto("/kyuu");
	await page.locator("[data-app-id]", { hasText: "E2E Quiet Corp" }).click();
	await expect(page.getByRole("textbox", { name: "Company" })).toHaveValue("E2E Quiet Corp");

	await page.getByRole("button", { name: "Book a screening" }).click();
	await page.getByLabel("Time", { exact: true }).fill("10:30");
	await page.getByRole("button", { name: "Log it" }).click();

	const timeline = page.getByRole("region", { name: "Timeline" });
	await expect(timeline.getByRole("button", { name: /Screening/ })).toBeVisible();
	await expect.poll(async () => (await statusOf("E2E Quiet Corp")).status).toBe("hr_screening");
});
