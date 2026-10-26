import { createHash } from "node:crypto";
import {
	accounts,
	and,
	db,
	eq,
	exchangeRates,
	kurojiCaptureKeys,
	kurojiCaptures,
	transactionEntries,
	transactions,
} from "@seikatsu/db";
import { expect, test, uid, workspaceId } from "./fixtures";

const KEY = "kuroji_e2e-apple-pay-key";

/** A fresh key and an empty inbox. */
async function seedKey() {
	const wsId = await workspaceId();
	await db.delete(kurojiCaptures).where(eq(kurojiCaptures.workspaceId, wsId));
	const keyHash = createHash("sha256").update(KEY).digest("hex");
	await db
		.insert(kurojiCaptureKeys)
		.values({ workspaceId: wsId, keyHash })
		.onConflictDoUpdate({ target: kurojiCaptureKeys.workspaceId, set: { keyHash } });
}

test("an Apple Pay payment opens the dialog filled in", async ({ page, request }) => {
	await seedKey();
	const merchant = `E2E Biedronka ${uid()}`;

	const refused = await request.post("/api/kuroji/capture", {
		headers: { Authorization: "Bearer wrong" },
		data: { amount: "12,50 zł", merchant },
	});
	expect(refused.status()).toBe(401);

	const sent = await request.post("/api/kuroji/capture", {
		headers: { Authorization: `Bearer ${KEY}` },
		data: { amount: "12,50 zł", merchant, card: "Mastercard" },
	});
	expect(sent.status()).toBe(201);
	const { id } = (await sent.json()) as { id: string };

	// Where the push's tap lands.
	await page.goto(`/kuroji?capture=${id}`);
	const dialog = page.getByRole("dialog", { name: "New Transaction" });
	await expect(dialog.getByLabel("Amount")).toHaveValue("12,50");
	await expect(dialog.getByLabel("Description")).toHaveValue(merchant);
	await expect(page).toHaveURL(/\/kuroji$/);

	await dialog.getByRole("combobox", { name: "Paid from" }).click();
	await page.getByRole("option", { name: "Wallet" }).click();
	await dialog.getByRole("radio", { name: "Groceries" }).click();
	await dialog.getByRole("button", { name: "Save" }).click();

	await expect(dialog).toBeHidden();
	// Saved, it leaves the inbox (and the inbox, now empty, goes too).
	await expect(page.getByRole("heading", { name: /Apple Pay/ })).toHaveCount(0);
	const [saved] = await db
		.select({ externalId: transactions.externalId })
		.from(transactions)
		.where(eq(transactions.externalId, `applepay:${id}`));
	expect(saved).toBeDefined();
	const [row] = await db.select().from(kurojiCaptures).where(eq(kurojiCaptures.id, id));
	expect(row.state).toBe("added");
});

test("a waiting payment can be dismissed from the inbox", async ({ page, request }) => {
	await seedKey();
	const merchant = `E2E Zabka ${uid()}`;
	await request.post("/api/kuroji/capture", {
		headers: { Authorization: `Bearer ${KEY}` },
		data: { amount: "PLN 4.99", merchant },
	});

	await page.goto("/kuroji?tab=transactions");
	const row = page.getByRole("listitem").filter({ hasText: merchant });
	await expect(row).toContainText("4,99");
	await row.getByRole("button", { name: `Dismiss ${merchant}` }).click();
	await expect(row).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole("listitem").filter({ hasText: merchant })).toHaveCount(0);
});

test("a UAH card paying in PLN is entered in UAH, learning the bank's markup", async ({
	page,
	request,
}) => {
	await seedKey();
	const wsId = await workspaceId();
	const wallet = `E2E Privat ${uid()}`;
	await db
		.insert(accounts)
		.values({ workspaceId: wsId, name: wallet, type: "ASSET", currency: "UAH" });
	// The official rate, cached so nothing goes to the network: 1 PLN = 10 UAH.
	const today = new Date().toISOString().slice(0, 10);
	await db.delete(exchangeRates).where(eq(exchangeRates.date, today));
	await db
		.insert(exchangeRates)
		.values({ date: today, fromCurrency: "PLN", toCurrency: "UAH", rate: "10" });

	const pay = async (amount: string, merchant: string) => {
		const sent = await request.post("/api/kuroji/capture", {
			headers: { Authorization: `Bearer ${KEY}` },
			data: { amount, merchant, card: wallet },
		});
		return ((await sent.json()) as { id: string }).id;
	};

	// First time: the card's account is picked, the amount turns into UAH at the official rate.
	const first = await pay("23,40 zł", "Lidl");
	await page.goto(`/kuroji?capture=${first}`);
	let dialog = page.getByRole("dialog", { name: "New Transaction" });
	await dialog.getByRole("combobox", { name: "Paid from" }).click();
	await page.getByRole("option", { name: wallet }).click();
	await expect(dialog.getByLabel("Amount")).toHaveValue("234,00");
	await expect(dialog.getByRole("combobox", { name: "Currency" })).toHaveText("UAH");
	await expect(dialog.getByLabel("Description")).toHaveValue(/^Lidl \(23,40\szł\)$/);
	// What the bank's push said actually left the card.
	await dialog.getByLabel("Amount").fill("240,00");
	await dialog.getByRole("radio", { name: "Groceries" }).click();
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(dialog).toBeHidden();

	const [leg] = await db
		.select({ amount: transactionEntries.amount, currency: transactionEntries.currency })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.where(
			and(eq(transactions.externalId, `applepay:${first}`), eq(transactionEntries.currency, "UAH")),
		);
	expect(leg).toEqual({ amount: "-240.0000", currency: "UAH" });

	// Next time the card's account comes back, with the bank's markup on the rate.
	const second = await pay("10,00 zł", "Zabka");
	await page.goto(`/kuroji?capture=${second}`);
	dialog = page.getByRole("dialog", { name: "New Transaction" });
	await expect(dialog.getByRole("combobox", { name: "Paid from" })).toHaveText(wallet);
	// 10 PLN × 10 × (240 ÷ 234)
	await expect(dialog.getByLabel("Amount")).toHaveValue("102,56");
});
