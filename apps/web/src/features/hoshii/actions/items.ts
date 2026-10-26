"use server";

import {
	accountsValid,
	convert,
	endOfPlan,
	getOwnedItem,
	getSettings,
	isOwnedList,
	revalidateHoshii,
} from "@/features/hoshii/actions/guard";
import { dropPhoto, isStoredPhoto, keepPhoto } from "@/features/hoshii/actions/photo";
import { coolingDays } from "@/features/hoshii/lib/cooling";
import { addDays } from "@/features/hoshii/lib/dates";
import {
	type BuyValues,
	type ItemFormValues,
	type MoveTarget,
	buySchema,
	itemFormSchema,
	moveSchema,
} from "@/features/hoshii/lib/hoshii-schemas";
import { createTransaction, updateTransaction } from "@/features/kuroji/actions/transactions";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { db, eq, hoshiiItems, hoshiiSettings, transactionEntries } from "@seikatsu/db";
import { after } from "next/server";

type Result = { error: string } | { success: true; warning?: string };
const issue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Invalid input";

/** A new want: cooling by its price, or straight to the Plan. Its photo is copied after. */
export async function createItem(
	values: ItemFormValues,
): Promise<{ error: string } | { success: true; data: { id: string; coolUntil: string } }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: issue(parsed.error) };
	const { id, skipCooling, ...v } = parsed.data;

	if (id) {
		// Sent again (offline replay, lost response): the first one stands.
		const existing = await getOwnedItem(id);
		if (existing) return { success: true, data: { id, coolUntil: existing.item.coolUntil } };
	}
	if (v.listId && !(await isOwnedList(v.listId, ws.id))) return { error: "List not found" };

	const today = await getUserToday();
	const settings = await getSettings(ws.id);
	const base = v.price != null ? await convert(v.price, v.currency, ws.baseCurrency, today) : null;
	const coolUntil = addDays(today, coolingDays(base, settings));

	const [row] = await db
		.insert(hoshiiItems)
		.values({
			id,
			workspaceId: ws.id,
			...v,
			price: v.price != null ? String(v.price) : null,
			addedOn: today,
			coolUntil,
			...(skipCooling
				? {
						state: "plan" as const,
						skippedCooling: true,
						keptOn: today,
						planPosition: await endOfPlan(ws.id),
					}
				: {}),
		})
		.onConflictDoNothing()
		.returning({ id: hoshiiItems.id });
	if (!row) return { error: "Conflict" };

	const photo = v.imageUrl;
	if (photo && !isStoredPhoto(photo)) after(() => keepPhoto(row.id, ws.id, photo));
	revalidateHoshii();
	return { success: true, data: { id: row.id, coolUntil } };
}

/** Any detail of a want. A price change while cooling re-times the cooling. */
export async function updateItem(itemId: string, values: ItemFormValues): Promise<Result> {
	const owned = await getOwnedItem(itemId);
	if (!owned) return { error: "Want not found" };
	const { item, ws } = owned;
	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: issue(parsed.error) };
	const { id: _, skipCooling: __, ...v } = parsed.data;
	if (v.listId && !(await isOwnedList(v.listId, ws.id))) return { error: "List not found" };

	let coolUntil = item.coolUntil;
	const priceChanged =
		(v.price ?? null) !== (item.price != null ? Number(item.price) : null) ||
		v.currency !== item.currency;
	if (item.state === "cooling" && priceChanged) {
		const today = await getUserToday();
		const base =
			v.price != null ? await convert(v.price, v.currency, ws.baseCurrency, today) : null;
		coolUntil = addDays(item.addedOn, coolingDays(base, await getSettings(ws.id)));
	}

	await db
		.update(hoshiiItems)
		.set({ ...v, price: v.price != null ? String(v.price) : null, coolUntil })
		.where(eq(hoshiiItems.id, itemId));

	if (v.imageUrl !== item.imageUrl) {
		const photo = v.imageUrl;
		after(async () => {
			await dropPhoto(item.imageUrl);
			if (photo) await keepPhoto(itemId, ws.id, photo);
		});
	}
	revalidateHoshii();
	return { success: true };
}

/**
 * Keep (to the Plan), let go, or back to cooling (undo). Sets the state asked for, so a
 * replay lands the same. Back to the Plan from Bought leaves its Kuroji expense in Kuroji.
 */
export async function moveItem(itemId: string, to: MoveTarget, on: string): Promise<Result> {
	const parsed = moveSchema.safeParse({ itemId, to, on });
	if (!parsed.success) return { error: issue(parsed.error) };
	const owned = await getOwnedItem(itemId);
	if (!owned) return { error: "Want not found" };
	const { item, ws } = owned;
	if (item.state === to) return { success: true };

	const unbought = {
		boughtOn: null,
		boughtPrice: null,
		boughtCurrency: null,
		kurojiTransactionId: null,
	};
	if (to === "plan") {
		const fromCooling = item.state === "cooling";
		await db
			.update(hoshiiItems)
			.set({
				state: "plan",
				releasedOn: null,
				...unbought,
				...(fromCooling ? { keptOn: on, skippedCooling: item.coolUntil > on } : {}),
				planPosition: item.planPosition ?? (await endOfPlan(ws.id)),
			})
			.where(eq(hoshiiItems.id, itemId));
	} else if (to === "released") {
		if (item.state === "bought") return { error: "It's bought already" };
		await db
			.update(hoshiiItems)
			.set({ state: "released", releasedOn: on })
			.where(eq(hoshiiItems.id, itemId));
	} else {
		await db
			.update(hoshiiItems)
			.set({
				state: "cooling",
				keptOn: null,
				releasedOn: null,
				skippedCooling: false,
				planPosition: null,
				...unbought,
			})
			.where(eq(hoshiiItems.id, itemId));
	}
	revalidateHoshii();
	return { success: true };
}

/** A new place in the Plan (a fractional key between its new neighbours). */
export async function reorderPlan(itemId: string, position: string): Promise<Result> {
	if (!/^[0-9A-Za-z]{1,64}$/.test(position)) return { error: "Invalid position" };
	const owned = await getOwnedItem(itemId);
	if (!owned) return { error: "Want not found" };
	if (owned.item.state !== "plan") return { error: "It isn't in the Plan" };
	await db.update(hoshiiItems).set({ planPosition: position }).where(eq(hoshiiItems.id, itemId));
	revalidateHoshii();
	return { success: true };
}

/** Bought it: what was paid and when; optionally an expense in Kuroji. */
export async function buyItem(itemId: string, values: BuyValues): Promise<Result> {
	const owned = await getOwnedItem(itemId);
	if (!owned) return { error: "Want not found" };
	const { item, ws } = owned;
	const parsed = buySchema.safeParse(values);
	if (!parsed.success) return { error: issue(parsed.error) };
	const { paid, currency, date, kuroji } = parsed.data;
	if (kuroji && !(await kurojiValid(ws.id, kuroji))) {
		return { error: "Pick the account it's paid from and an expense category" };
	}

	const wasBought = item.state === "bought";
	await db
		.update(hoshiiItems)
		.set({
			state: "bought",
			boughtOn: date,
			boughtPrice: String(paid),
			boughtCurrency: currency,
			releasedOn: null,
			// Bought straight from cooling: that skipped it.
			...(item.state === "cooling" ? { keptOn: date, skippedCooling: true } : {}),
		})
		.where(eq(hoshiiItems.id, itemId));

	const expense = { amount: paid, currency, date, description: `Hoshii: ${item.title}` };
	let warning: string | undefined;
	if (wasBought && item.kurojiTransactionId) {
		warning = await updateExpense(item.kurojiTransactionId, expense);
	} else if (kuroji && paid > 0) {
		warning = await recordExpense(ws.id, itemId, kuroji, expense);
	}
	revalidateHoshii();
	return { success: true, warning };
}

async function kurojiValid(workspaceId: string, k: { walletId: string; categoryId: string }) {
	return accountsValid(workspaceId, [
		{ id: k.walletId, types: ["ASSET", "LIABILITY"] },
		{ id: k.categoryId, types: ["EXPENSE"] },
	]);
}

type Expense = { amount: number; currency: string; date: string; description: string };

/** Posts the purchase to Kuroji and links it; the purchase stands either way. */
async function recordExpense(
	workspaceId: string,
	itemId: string,
	k: { walletId: string; categoryId: string },
	expense: Expense,
): Promise<string | undefined> {
	const result = await createTransaction({
		workspaceId,
		fromAccountId: k.walletId,
		toAccountId: k.categoryId,
		...expense,
	});
	if ("error" in result) return `Saved, but Kuroji didn't take the expense: ${result.error}`;
	await db.transaction(async (tx) => {
		await tx
			.update(hoshiiItems)
			.set({ kurojiTransactionId: result.data.id })
			.where(eq(hoshiiItems.id, itemId));
		// The next purchase offers the same accounts.
		await tx
			.insert(hoshiiSettings)
			.values({ workspaceId, walletId: k.walletId, categoryId: k.categoryId })
			.onConflictDoUpdate({
				target: hoshiiSettings.workspaceId,
				set: { walletId: k.walletId, categoryId: k.categoryId },
			});
	});
	return undefined;
}

/** Same accounts as before; the amount, currency, date and words follow the purchase. */
async function updateExpense(transactionId: string, expense: Expense) {
	const legs = await db
		.select({ accountId: transactionEntries.accountId, amount: transactionEntries.amount })
		.from(transactionEntries)
		.where(eq(transactionEntries.transactionId, transactionId));
	const from = legs.find((l) => Number(l.amount) < 0);
	const to = legs.find((l) => Number(l.amount) > 0);
	if (legs.length !== 2 || !from || !to) {
		return "Saved. The Kuroji expense has more parts than one purchase, so edit it in Kuroji.";
	}
	const result = await updateTransaction({
		transactionId,
		fromAccountId: from.accountId,
		toAccountId: to.accountId,
		...expense,
	});
	return "error" in result
		? `Saved, but the Kuroji expense wasn't updated: ${result.error}`
		: undefined;
}

/** The want goes for good; a Kuroji expense stays in Kuroji. */
export async function deleteItem(itemId: string): Promise<Result> {
	const owned = await getOwnedItem(itemId);
	if (!owned) return { error: "Want not found" };
	await db.delete(hoshiiItems).where(eq(hoshiiItems.id, itemId));
	const photo = owned.item.imageUrl;
	after(() => dropPhoto(photo));
	revalidateHoshii();
	return { success: true };
}
