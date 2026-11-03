import { expect, test } from "./fixtures";

// Capture: one line into any app. Reading the line needs the AI (not in CI); opening it is
// what every page shares.
test("⌘K opens capture anywhere, even while typing", async ({ page }) => {
	await page.goto("/kuroji");
	const dialog = page.getByRole("dialog", { name: "Capture" });

	// The listener attaches on hydration: press until it opens.
	await expect(async () => {
		await page.keyboard.press("ControlOrMeta+KeyK");
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await expect(dialog.getByLabel("What happened")).toBeFocused();
	await expect(dialog.getByRole("button", { name: "Read" })).toBeDisabled();

	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();

	await page.locator("header").getByRole("button", { name: "Capture" }).click();
	await expect(dialog).toBeVisible();
});

test("the home's line opens capture with what was typed", async ({ page }) => {
	await page.goto("/");
	const line = page.getByLabel("Capture: one line about what happened");
	const dialog = page.getByRole("dialog", { name: "Capture" });

	// The form's handler attaches on hydration: submit until the dialog takes the line.
	await expect(async () => {
		await line.fill("хочу Kindle");
		await line.press("Enter");
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await expect(dialog.getByLabel("What happened")).toHaveValue("хочу Kindle");
	await expect(line).toHaveValue("");
});
