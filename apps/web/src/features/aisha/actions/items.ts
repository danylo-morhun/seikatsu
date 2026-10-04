"use server";

import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import { type ItemFormValues, itemFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { aishaMaintenanceItems, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

async function getOwnedItem(itemId: string) {
	const [item] = await db
		.select()
		.from(aishaMaintenanceItems)
		.where(eq(aishaMaintenanceItems.id, itemId))
		.limit(1);
	if (!item || !(await getOwnedVehicle(item.vehicleId))) return null;
	return item;
}

export async function createItem(
	vehicleId: string,
	values: ItemFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };

	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db.insert(aishaMaintenanceItems).values({ vehicleId, ...parsed.data });
	revalidatePath("/aisha");
	return { success: true };
}

export async function updateItem(
	itemId: string,
	values: ItemFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedItem(itemId))) return { error: "Item not found" };

	const parsed = itemFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.update(aishaMaintenanceItems)
		.set({ ...parsed.data, note: parsed.data.note ?? null })
		.where(eq(aishaMaintenanceItems.id, itemId));
	revalidatePath("/aisha");
	return { success: true };
}

/** Also drops the item from past service records (they stay, minus this item). */
export async function deleteItem(itemId: string): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedItem(itemId))) return { error: "Item not found" };
	await db.delete(aishaMaintenanceItems).where(eq(aishaMaintenanceItems.id, itemId));
	revalidatePath("/aisha");
	return { success: true };
}
