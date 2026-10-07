import { db, eq, keizokuHabits } from "@seikatsu/db";
import { expect, holdServerActions, test, workspaceId } from "./fixtures";

test.beforeEach(async () => {
	const wsId = await workspaceId();
	await db.delete(keizokuHabits).where(eq(keizokuHabits.workspaceId, wsId));
	await db
		.insert(keizokuHabits)
		.values({ workspaceId: wsId, name: "E2E stretch", emoji: "🧘", frequencyType: "daily" });
});

test("marking a habit done flips the icon at once and updates the count", async ({ page }) => {
	await page.goto("/keizoku");
	const main = page.getByRole("main");
	await expect(main.getByText("0/1 done")).toBeVisible();

	const release = await holdServerActions(page);
	await page.getByRole("button", { name: "Mark done" }).click();

	// Optimistic: the check shows while the action is still in flight.
	const toggle = page.getByRole("button", { name: "Mark not done" });
	await expect(toggle).toBeVisible();
	await expect(toggle).toBeDisabled();
	await expect(main.getByText("0/1 done")).toBeVisible();

	// The action's re-render lands: count from the server, button usable again.
	release();
	await expect(main.getByText("1/1 done")).toBeVisible();
	await expect(toggle).toBeEnabled();

	await page.reload();
	await expect(page.getByRole("button", { name: "Mark not done" })).toBeVisible();
});
