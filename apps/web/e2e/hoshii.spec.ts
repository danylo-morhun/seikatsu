import {
	accounts,
	db,
	eq,
	hoshiiItems,
	hoshiiLists,
	hoshiiSettings,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";
import { expect, test, uid, workspaceId } from "./fixtures";

const day = (offset: number) =>
	new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function fresh() {
	const wsId = await workspaceId();
	await db.delete(hoshiiItems).where(eq(hoshiiItems.workspaceId, wsId));
	await db.delete(hoshiiLists).where(eq(hoshiiLists.workspaceId, wsId));
	await db.delete(hoshiiSettings).where(eq(hoshiiSettings.workspaceId, wsId));
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
	return ws;
}

type Seed = Partial<typeof hoshiiItems.$inferInsert> & { title: string };

async function seed(wsId: string, currency: string, items: Seed[]) {
	await db.insert(hoshiiItems).values(
		items.map((i) => ({
			workspaceId: wsId,
			currency,
			addedOn: day(-40),
			coolUntil: day(-1),
			...i,
		})),
	);
}

test("add a want by name: it cools by its price", async ({ page }) => {
	await fresh();
	await page.goto("/hoshii");
	await expect(page.getByRole("heading", { name: "Want it, then wait." })).toBeVisible();

	await page.getByRole("button", { name: "Add a want" }).first().click();
	const dialog = page.getByRole("dialog", { name: "Add a Want" });
	await dialog.getByLabel("Link or name").fill("Kindle Colorsoft");
	await dialog.getByLabel("Price").fill("849");
	await expect(dialog.getByText(/Cools for \d+ days/)).toBeVisible();
	await dialog.getByRole("button", { name: "Add Want" }).click();

	await expect(page.getByRole("heading", { name: "Cooling", exact: true })).toBeVisible();
	await expect(page.locator("[data-hoshii-row]", { hasText: "Kindle Colorsoft" })).toContainText(
		"days",
	);
});

test("decide: keep joins the Plan, undo, then let go counts as saved", async ({ page }) => {
	const ws = await fresh();
	const name = `Headphones ${uid()}`;
	await seed(ws.id, ws.baseCurrency, [{ title: name, price: "300" }]);
	await page.goto("/hoshii");

	const row = () => page.locator("[data-hoshii-row]", { hasText: name });
	await expect(page.getByRole("heading", { name: "Decide", exact: true })).toBeVisible();
	await page.getByRole("button", { name: `${name}: keep` }).click();
	await expect(row().getByRole("button", { name: `${name}: bought it` })).toBeVisible();

	await page.getByRole("button", { name: "Undo" }).click();
	await expect(page.getByRole("button", { name: `${name}: keep` })).toBeVisible();

	await page.getByRole("button", { name: `${name}: let go` }).click();
	await expect(row()).toHaveCount(0);

	await page.goto("/hoshii/summary");
	await expect(page.getByText("1 want let go after cooling")).toBeVisible();
	await expect(page.getByText(name)).toBeVisible();
});

test("the piggy fills the Plan from the top, and a purchase leaves it", async ({ page }) => {
	const ws = await fresh();
	const tag = uid();
	const [piggy, gift] = await db
		.insert(accounts)
		.values([
			{ workspaceId: ws.id, name: `Piggy ${tag}`, type: "ASSET", currency: ws.baseCurrency },
			{ workspaceId: ws.id, name: `Gift ${tag}`, type: "INCOME", currency: ws.baseCurrency },
		])
		.returning();
	const [tx] = await db
		.insert(transactions)
		.values({ workspaceId: ws.id, date: day(-5), description: "Saved" })
		.returning();
	await db.insert(transactionEntries).values([
		{
			transactionId: tx.id,
			accountId: piggy.id,
			amount: "1000",
			currency: ws.baseCurrency,
			baseAmount: "1000",
		},
		{
			transactionId: tx.id,
			accountId: gift.id,
			amount: "-1000",
			currency: ws.baseCurrency,
			baseAmount: "-1000",
		},
	]);
	await db.insert(hoshiiSettings).values({ workspaceId: ws.id, piggyAccountId: piggy.id });
	await seed(ws.id, ws.baseCurrency, [
		{ title: `First ${tag}`, price: "600", state: "plan", planPosition: "a0", keptOn: day(-2) },
		{ title: `Second ${tag}`, price: "600", state: "plan", planPosition: "a1", keptOn: day(-2) },
	]);

	await page.goto("/hoshii");
	const first = page.locator("[data-hoshii-row]", { hasText: `First ${tag}` });
	const second = page.locator("[data-hoshii-row]", { hasText: `Second ${tag}` });
	await expect(first).toContainText("Can buy");
	await expect(second).toContainText("400");
	await expect(second).toContainText("saved");

	await page.getByRole("button", { name: `First ${tag}: bought it` }).click();
	const dialog = page.getByRole("dialog", { name: "Bought It" });
	await expect(dialog.getByLabel("Paid")).toHaveValue("600");
	// No expense category picked yet: nothing goes to Kuroji unless asked.
	await expect(dialog.getByRole("button", { name: "Record in Kuroji" })).toBeVisible();
	await dialog.getByRole("button", { name: "Bought", exact: true }).click();
	await expect(first).toHaveCount(0);

	await page.goto("/hoshii/lists?past=1");
	await expect(page.getByRole("button", { name: new RegExp(`First ${tag}`) })).toContainText(
		"Bought",
	);
});

test("a link shared from another app opens Add a Want with it", async ({ page }) => {
	await fresh();
	await page.goto(`/hoshii/share?text=${encodeURIComponent("Look: http://localhost:1/nothing")}`);
	const dialog = page.getByRole("dialog", { name: "Add a Want" });
	await expect(dialog.getByLabel("Link or name")).toHaveValue("http://localhost:1/nothing");
	// Not the public web: it can't be read, and the name is asked for.
	await expect(dialog.getByText(/Couldn't read/)).toBeVisible();
	await expect(page).toHaveURL(/\/hoshii$/);
});
