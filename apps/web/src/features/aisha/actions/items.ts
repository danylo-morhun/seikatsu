"use server";

import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle, isUuid } from "@/features/aisha/actions/guard";
import { type ItemFormValues, itemFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { getCurrentWorkspace } from "@/lib/session";
import {
	aishaMaintenanceItems,
	aishaServiceRecordItems,
	aishaVehicles,
	and,
	db,
	eq,
	inArray,
	isNull,
	notInArray,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result = { error: string } | { success: true };

function revalidate() {
	revalidatePath("/aisha", "layout");
	revalidatePath("/settings/aisha");
	revalidatePath("/");
}

async function getOwnedItem(itemId: string) {
	if (!isUuid(itemId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({ item: aishaMaintenanceItems })
		.from(aishaMaintenanceItems)
		.innerJoin(aishaVehicles, eq(aishaVehicles.id, aishaMaintenanceItems.vehicleId))
		.where(and(eq(aishaMaintenanceItems.id, itemId), eq(aishaVehicles.workspaceId, ws.id)))
		.limit(1);
	return row?.item ?? null;
}

export async function createItem(vehicleId: string, values: ItemFormValues): Promise<Result> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };

	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db.insert(aishaMaintenanceItems).values({ vehicleId, ...parsed.data });
	revalidate();
	return { success: true };
}

export async function updateItem(itemId: string, values: ItemFormValues): Promise<Result> {
	if (!(await getOwnedItem(itemId))) return { error: "Item not found" };

	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.update(aishaMaintenanceItems)
		.set({ ...parsed.data, note: parsed.data.note ?? null })
		.where(eq(aishaMaintenanceItems.id, itemId));
	revalidate();
	return { success: true };
}

/** Also drops the item from past service records (they stay, minus this item). */
export async function deleteItem(itemId: string): Promise<Result> {
	if (!(await getOwnedItem(itemId))) return { error: "Item not found" };
	await db.delete(aishaMaintenanceItems).where(eq(aishaMaintenanceItems.id, itemId));
	revalidate();
	return { success: true };
}

/**
 * "Everything was done when I got the car": every item Aisha knows nothing about counts as
 * done on the car's first reading. Items with a service or a baseline keep theirs.
 */
export async function countDoneAtPurchase(
	vehicleId: string,
): Promise<{ error: string } | { success: true; data: { ids: string[] } }> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };
	const [first] = await getReadings(vehicleId);
	if (!first) return { error: "Add the car's mileage first" };

	const serviced = db
		.select({ id: aishaServiceRecordItems.itemId })
		.from(aishaServiceRecordItems)
		.innerJoin(aishaMaintenanceItems, eq(aishaServiceRecordItems.itemId, aishaMaintenanceItems.id))
		.where(eq(aishaMaintenanceItems.vehicleId, vehicleId));
	const updated = await db
		.update(aishaMaintenanceItems)
		.set({ baselineDate: first.date, baselineKm: first.km })
		.where(
			and(
				eq(aishaMaintenanceItems.vehicleId, vehicleId),
				isNull(aishaMaintenanceItems.baselineDate),
				notInArray(aishaMaintenanceItems.id, serviced),
			),
		)
		.returning({ id: aishaMaintenanceItems.id });

	revalidate();
	return { success: true, data: { ids: updated.map((r) => r.id) } };
}

/** Undo for countDoneAtPurchase: the items it touched know nothing again. */
export async function clearBaselines(vehicleId: string, itemIds: string[]): Promise<Result> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };
	if (itemIds.length === 0) return { success: true };
	await db
		.update(aishaMaintenanceItems)
		.set({ baselineDate: null, baselineKm: null })
		.where(
			and(
				eq(aishaMaintenanceItems.vehicleId, vehicleId),
				inArray(aishaMaintenanceItems.id, itemIds),
			),
		);
	revalidate();
	return { success: true };
}
