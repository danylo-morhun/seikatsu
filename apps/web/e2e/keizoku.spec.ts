import { db, eq, keizokuHabits } from "@seikatsu/db";
import { expect, holdServerActions, test, workspaceId } from "./fixtures";

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(keizokuHabits).where(eq(keizokuHabits.workspaceId, wsId));
	await db
		.insert(keizokuHabits)
		.values({ workspaceId: wsId, name: "E2E stretch", emoji: "🧘", frequencyType: "daily" });
});

test("marking a habit done flips the check at once and updates the count", async ({ page }) => {
	await page.goto("/keizoku");
	const summary = page.getByRole("region", { name: "Today at a glance" });
	await expect(summary.getByText("to go")).toBeVisible();

	const release = await holdServerActions(page);
	const check = page.getByRole("button", { name: "E2E stretch: mark done today" });
	await check.click();

	// Optimistic: the check and the count change while the action is still in flight.
	const done = page.getByRole("button", { name: "E2E stretch: done today" });
	await expect(done).toHaveAttribute("aria-pressed", "true");
	await expect(summary.getByText("All done for today")).toBeVisible();

	release();
	await expect(page.getByText("1-day run")).toBeVisible();

	await page.reload();
	await expect(page.getByRole("button", { name: "E2E stretch: done today" })).toBeVisible();
});

test("a missed day can be checked in from the week", async ({ page }) => {
	await page.goto("/keizoku");
	const row = page.locator("[data-habit-row]", { hasText: "E2E stretch" });
	const days = row.getByRole("group").getByRole("button");
	await expect(days).toHaveCount(7);

	// Yesterday is the strip's sixth day.
	await days.nth(5).click();
	await expect(days.nth(5)).toHaveAttribute("aria-pressed", "true");
	await page.reload();
	await expect(
		page
			.locator("[data-habit-row]", { hasText: "E2E stretch" })
			.getByRole("group")
			.getByRole("button")
			.nth(5),
	).toHaveAttribute("aria-pressed", "true");
});

test("a mistyped habit link shows not-found inside the app", async ({ page }) => {
	await page.goto("/keizoku/not-a-habit");
	await expect(page.getByText("Nothing here")).toBeVisible();
});
