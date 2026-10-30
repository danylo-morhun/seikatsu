import { expect, test } from "./fixtures";

// Settings → Account → Appearance switches the look on this device, live and across reloads.
test("appearance switches between Liquid Glass and Classic", async ({ page, context }) => {
	await context.clearCookies({ name: "design" });
	await page.goto("/settings/account");
	const html = page.locator("html");
	const sidebar = page.locator('[data-slot="sidebar"]').first();

	await expect(html).toHaveAttribute("data-design", "glass");
	await expect(sidebar).toHaveAttribute("data-variant", "floating");

	const appearance = page.getByRole("radiogroup", { name: "Appearance" });
	await appearance.getByRole("radio", { name: /Classic/ }).click();
	await expect(html).toHaveAttribute("data-design", "classic");
	await expect(sidebar).toHaveAttribute("data-variant", "inset");
	await expect(appearance.getByRole("radio", { name: /Classic/ })).toHaveAttribute(
		"aria-checked",
		"true",
	);

	// The server renders the chosen structure too, with no flash of the other look.
	await page.reload();
	await expect(html).toHaveAttribute("data-design", "classic");
	await expect(sidebar).toHaveAttribute("data-variant", "inset");

	await appearance.getByRole("radio", { name: /Liquid Glass/ }).click();
	await expect(html).toHaveAttribute("data-design", "glass");
});
