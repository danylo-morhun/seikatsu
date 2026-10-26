import {
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaServiceRecords,
	aishaVehicles,
	db,
	eq,
	transactions,
} from "@seikatsu/db";
import { expect, test, workspaceId } from "./fixtures";

/** A car added two weeks ago at 100 000 km with two items, never serviced in Aisha. */
async function seedCar() {
	const wsId = await workspaceId();
	await db.delete(aishaVehicles).where(eq(aishaVehicles.workspaceId, wsId));
	const [vehicle] = await db
		.insert(aishaVehicles)
		.values({ workspaceId: wsId, make: "Skoda", model: "Octavia", year: 2015, fuelType: "petrol" })
		.returning();
	const added = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
	await db
		.insert(aishaOdometerReadings)
		.values({ vehicleId: vehicle.id, date: added, km: 100_000 });
	await db.insert(aishaMaintenanceItems).values([
		{ vehicleId: vehicle.id, name: "Engine oil", intervalKm: 10_000, intervalMonths: 12 },
		{ vehicleId: vehicle.id, name: "Wiper blades", intervalKm: null, intervalMonths: 12 },
	]);
	return vehicle;
}

test("a new car starts with its plan, counted from the purchase", async ({ page }) => {
	const wsId = await workspaceId();
	await db.delete(aishaVehicles).where(eq(aishaVehicles.workspaceId, wsId));

	await page.goto("/aisha");
	await page.getByLabel("Make").fill("Toyota");
	await page.getByLabel("Model").fill("Corolla");
	await page.getByLabel("Year").fill("2019");
	await page.getByLabel("Mileage now, km").fill("85 000");
	await page.getByRole("button", { name: "Add the car" }).click();

	await expect(page.getByText("Odometer · Toyota Corolla")).toBeVisible();
	// "Serviced when I got it" was ticked: nothing is left unknown.
	await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Never logged" })).toHaveCount(0);
});

test("count as done at purchase, then undo", async ({ page }) => {
	await seedCar();
	await page.goto("/aisha");
	await expect(page.getByRole("heading", { name: "Never logged" })).toBeVisible();

	await page.getByRole("button", { name: "Count as done at purchase" }).click();
	await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
	await expect(page.locator("[data-aisha-row]", { hasText: "Engine oil" })).toContainText(
		"before Aisha",
	);

	await page.getByRole("button", { name: "Undo" }).click();
	await expect(page.getByRole("heading", { name: "Never logged" })).toBeVisible();
});

test("log a service from the queue, into Kuroji, then edit its date", async ({ page }) => {
	// Kuroji fetches the day's exchange rate for the expense, twice.
	test.slow();
	const vehicle = await seedCar();
	await page.goto("/aisha");

	await page.getByRole("button", { name: "Engine oil: log as done" }).click();
	const dialog = page.getByRole("dialog", { name: "Log Service" });
	await expect(dialog.getByRole("button", { name: "Engine oil" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await dialog.getByLabel("Mileage, km").fill("101 500");
	await dialog.getByLabel("Cost, PLN").fill("450");
	await dialog.getByRole("button", { name: "Record in Kuroji" }).click();
	await dialog.getByRole("combobox", { name: "Paid from" }).click();
	await page.getByRole("option").first().click();
	await dialog.getByRole("combobox", { name: "Expense category" }).click();
	await page.getByRole("option").first().click();
	await dialog.getByRole("button", { name: "Log Service" }).click();
	await expect(dialog).toBeHidden();

	await expect(page.locator("[data-aisha-row]", { hasText: "Engine oil" })).toContainText("last");
	const [record] = await db
		.select()
		.from(aishaServiceRecords)
		.where(eq(aishaServiceRecords.vehicleId, vehicle.id));
	expect(record.kurojiTransactionId).not.toBeNull();

	// Every field of a logged visit can change, the date included; Kuroji follows.
	await page.goto("/aisha/history");
	await page.locator("[data-aisha-id^='service:']").first().click();
	const edit = page.getByRole("dialog", { name: "Edit Service" });
	const earlier = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
	await edit.getByLabel("Date").fill(earlier);
	await edit.getByRole("button", { name: "Save" }).click();
	await expect(edit).toBeHidden();

	const [moved] = await db
		.select({ date: transactions.date })
		.from(transactions)
		.where(eq(transactions.id, record.kurojiTransactionId!));
	expect(moved.date).toBe(earlier);
	await db.delete(transactions).where(eq(transactions.id, record.kurojiTransactionId!));
});

test("update the mileage with M, then fix the reading in History", async ({ page }) => {
	await seedCar();
	await page.goto("/aisha");
	await expect(page.getByText("Odometer · Skoda Octavia")).toBeVisible();

	await page.keyboard.press("m");
	const dialog = page.getByRole("dialog", { name: "Update Mileage" });
	await dialog.getByLabel("Odometer, km").fill("100 900");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText(/100\s900/).first()).toBeVisible();

	await page.goto("/aisha/history");
	await page
		.locator("[data-aisha-row]", { hasText: /100\s900 km/ })
		.locator("[data-aisha-id]")
		.click();
	const edit = page.getByRole("dialog", { name: "Edit Reading" });
	await edit.getByLabel("Odometer, km").fill("100 800");
	await edit.getByRole("button", { name: "Save" }).click();
	await expect(edit).toBeHidden();
	await expect(page.locator("[data-aisha-row]", { hasText: /100\s800 km/ })).toBeVisible();
});
