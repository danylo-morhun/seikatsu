"use server";

import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import type { AishaVehicle } from "@/features/aisha/actions/vehicles";
import { type ServiceFormValues, serviceFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { readingConflict } from "@/features/aisha/lib/odometer";
import { createTransaction, updateTransaction } from "@/features/kuroji/actions/transactions";
import {
	accounts,
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaServiceRecordItems,
	aishaServiceRecords,
	aishaVehicles,
	and,
	db,
	eq,
	inArray,
	isNull,
	transactionEntries,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result = { error: string } | { success: true; warning?: string };

function revalidate() {
	revalidatePath("/aisha", "layout");
	revalidatePath("/settings/aisha");
	revalidatePath("/");
}

async function getOwnedRecord(recordId: string) {
	const [record] = await db
		.select()
		.from(aishaServiceRecords)
		.where(eq(aishaServiceRecords.id, recordId))
		.limit(1);
	if (!record) return null;
	const vehicle = await getOwnedVehicle(record.vehicleId);
	return vehicle ? { record, vehicle } : null;
}

/** The items must be this car's; returns the distinct valid ids, or null. */
async function validItems(vehicleId: string, itemIds: string[]) {
	const valid = await db
		.select({ id: aishaMaintenanceItems.id, name: aishaMaintenanceItems.name })
		.from(aishaMaintenanceItems)
		.where(
			and(
				inArray(aishaMaintenanceItems.id, itemIds),
				eq(aishaMaintenanceItems.vehicleId, vehicleId),
			),
		);
	return valid.length === new Set(itemIds).size ? valid : null;
}

/** A wallet to pay from and an expense category, both open and in the car's workspace. */
async function kurojiAccountsValid(vehicle: AishaVehicle, walletId: string, categoryId: string) {
	const rows = await db
		.select({ id: accounts.id, type: accounts.type })
		.from(accounts)
		.where(
			and(
				inArray(accounts.id, [walletId, categoryId]),
				eq(accounts.workspaceId, vehicle.workspaceId),
				isNull(accounts.archivedAt),
			),
		);
	const type = (id: string) => rows.find((r) => r.id === id)?.type;
	const wallet = type(walletId);
	return (wallet === "ASSET" || wallet === "LIABILITY") && type(categoryId) === "EXPENSE";
}

function expenseText(vehicle: AishaVehicle, itemNames: string[], shop?: string) {
	const what = itemNames.join(", ");
	return `${vehicle.make} ${vehicle.model}: ${what}${shop ? ` · ${shop}` : ""}`;
}

/** Records a garage visit. Its mileage also counts as an odometer reading. */
export async function logService(vehicleId: string, values: ServiceFormValues): Promise<Result> {
	const vehicle = await getOwnedVehicle(vehicleId);
	if (!vehicle) return { error: "Vehicle not found" };

	const parsed = serviceFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { id, itemIds, cost, kuroji, ...v } = parsed.data;

	if (id) {
		// Sent again (offline replay, lost response): the first one stands, its expense too.
		const existing = await getOwnedRecord(id);
		if (existing) {
			return existing.vehicle.id === vehicleId ? { success: true } : { error: "Conflict" };
		}
	}

	const valid = await validItems(vehicleId, itemIds);
	if (!valid) return { error: "Unknown maintenance item" };

	const conflict = readingConflict(await getReadings(vehicleId), { date: v.date, km: v.km });
	if (conflict) return { error: conflict };

	if (kuroji && !(await kurojiAccountsValid(vehicle, kuroji.walletId, kuroji.categoryId))) {
		return { error: "Pick a Kuroji wallet and an expense category" };
	}

	const recordId = await db.transaction(async (tx) => {
		const [record] = await tx
			.insert(aishaServiceRecords)
			.values({
				id,
				vehicleId,
				...v,
				cost: cost != null ? cost.toFixed(2) : null,
				currency: CURRENCY,
			})
			.returning({ id: aishaServiceRecords.id });
		await tx
			.insert(aishaServiceRecordItems)
			.values(valid.map(({ id }) => ({ recordId: record.id, itemId: id })));
		await tx
			.insert(aishaOdometerReadings)
			.values({ vehicleId, date: v.date, km: v.km, serviceRecordId: record.id });
		return record.id;
	});

	let warning: string | undefined;
	if (kuroji && cost) {
		warning = await recordInKuroji(vehicle, recordId, kuroji, {
			amount: cost,
			date: v.date,
			description: expenseText(
				vehicle,
				valid.map((i) => i.name),
				v.shop,
			),
		});
	}

	revalidate();
	return { success: true, warning };
}

/** Posts the cost to Kuroji and links it; the visit is saved either way. */
async function recordInKuroji(
	vehicle: AishaVehicle,
	recordId: string,
	kuroji: { walletId: string; categoryId: string },
	expense: { amount: number; date: string; description: string },
): Promise<string | undefined> {
	const result = await createTransaction({
		workspaceId: vehicle.workspaceId,
		fromAccountId: kuroji.walletId,
		toAccountId: kuroji.categoryId,
		currency: CURRENCY,
		...expense,
	});
	if ("error" in result) return `Saved, but Kuroji didn't take the expense: ${result.error}`;
	await db.transaction(async (tx) => {
		await tx
			.update(aishaServiceRecords)
			.set({ kurojiTransactionId: result.data.id })
			.where(eq(aishaServiceRecords.id, recordId));
		// The next visit offers the same wallet and category.
		await tx
			.update(aishaVehicles)
			.set({ kurojiWalletId: kuroji.walletId, kurojiCategoryId: kuroji.categoryId })
			.where(eq(aishaVehicles.id, vehicle.id));
	});
	return undefined;
}

/** Any of a visit's details. Its reading moves with it; a linked Kuroji expense follows. */
export async function updateService(recordId: string, values: ServiceFormValues): Promise<Result> {
	const owned = await getOwnedRecord(recordId);
	if (!owned) return { error: "Record not found" };
	const { record, vehicle } = owned;

	const parsed = serviceFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { id: _, itemIds, cost, kuroji, ...v } = parsed.data;

	const valid = await validItems(vehicle.id, itemIds);
	if (!valid) return { error: "Unknown maintenance item" };

	const others = (await getReadings(vehicle.id)).filter((r) => r.serviceRecordId !== recordId);
	const conflict = readingConflict(others, { date: v.date, km: v.km });
	if (conflict) return { error: conflict };

	if (kuroji && !(await kurojiAccountsValid(vehicle, kuroji.walletId, kuroji.categoryId))) {
		return { error: "Pick a Kuroji wallet and an expense category" };
	}

	await db.transaction(async (tx) => {
		await tx
			.update(aishaServiceRecords)
			.set({
				...v,
				shop: v.shop ?? null,
				note: v.note ?? null,
				cost: cost != null ? cost.toFixed(2) : null,
			})
			.where(eq(aishaServiceRecords.id, recordId));
		await tx.delete(aishaServiceRecordItems).where(eq(aishaServiceRecordItems.recordId, recordId));
		await tx
			.insert(aishaServiceRecordItems)
			.values(valid.map(({ id }) => ({ recordId, itemId: id })));
		await tx
			.delete(aishaOdometerReadings)
			.where(eq(aishaOdometerReadings.serviceRecordId, recordId));
		await tx
			.insert(aishaOdometerReadings)
			.values({ vehicleId: vehicle.id, date: v.date, km: v.km, serviceRecordId: recordId });
	});

	const expense = {
		amount: cost ?? 0,
		date: v.date,
		description: expenseText(
			vehicle,
			valid.map((i) => i.name),
			v.shop,
		),
	};
	let warning: string | undefined;
	if (record.kurojiTransactionId && cost) {
		warning = await updateKurojiExpense(record.kurojiTransactionId, expense);
	} else if (!record.kurojiTransactionId && kuroji && cost) {
		warning = await recordInKuroji(vehicle, recordId, kuroji, expense);
	}

	revalidate();
	return { success: true, warning };
}

/** Same wallet and category as before; the amount, date and words follow the visit. */
async function updateKurojiExpense(
	transactionId: string,
	expense: { amount: number; date: string; description: string },
): Promise<string | undefined> {
	const legs = await db
		.select({ accountId: transactionEntries.accountId, amount: transactionEntries.amount })
		.from(transactionEntries)
		.where(eq(transactionEntries.transactionId, transactionId));
	const from = legs.find((l) => Number(l.amount) < 0);
	const to = legs.find((l) => Number(l.amount) > 0);
	if (legs.length !== 2 || !from || !to) {
		return "Saved. The Kuroji expense has more parts than one visit, so edit it in Kuroji.";
	}
	const result = await updateTransaction({
		transactionId,
		fromAccountId: from.accountId,
		toAccountId: to.accountId,
		currency: CURRENCY,
		...expense,
	});
	return "error" in result
		? `Saved, but the Kuroji expense wasn't updated: ${result.error}`
		: undefined;
}

/** The visit and its reading go; a Kuroji expense stays in Kuroji. */
export async function deleteService(recordId: string): Promise<Result> {
	if (!(await getOwnedRecord(recordId))) return { error: "Record not found" };
	await db.delete(aishaServiceRecords).where(eq(aishaServiceRecords.id, recordId));
	revalidate();
	return { success: true };
}
