"use server";

import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import { type ServiceFormValues, serviceFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { readingConflict } from "@/features/aisha/lib/odometer";
import {
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaServiceRecordItems,
	aishaServiceRecords,
	and,
	db,
	eq,
	inArray,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

/** Records a garage visit. Its mileage also counts as an odometer reading. */
export async function logService(
	vehicleId: string,
	values: ServiceFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };

	const parsed = serviceFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { itemIds, cost, ...v } = parsed.data;

	const valid = await db
		.select({ id: aishaMaintenanceItems.id })
		.from(aishaMaintenanceItems)
		.where(
			and(
				inArray(aishaMaintenanceItems.id, itemIds),
				eq(aishaMaintenanceItems.vehicleId, vehicleId),
			),
		);
	if (valid.length !== new Set(itemIds).size) return { error: "Unknown maintenance item" };

	const conflict = readingConflict(await getReadings(vehicleId), { date: v.date, km: v.km });
	if (conflict) return { error: conflict };

	await db.transaction(async (tx) => {
		const [record] = await tx
			.insert(aishaServiceRecords)
			.values({
				vehicleId,
				...v,
				cost: cost != null ? cost.toFixed(2) : null,
				currency: CURRENCY,
			})
			.returning({ id: aishaServiceRecords.id });
		await tx
			.insert(aishaServiceRecordItems)
			.values(valid.map(({ id }) => ({ recordId: record.id, itemId: id })));
		await tx.insert(aishaOdometerReadings).values({ vehicleId, date: v.date, km: v.km });
	});

	revalidatePath("/aisha");
	return { success: true };
}

export async function deleteService(
	recordId: string,
): Promise<{ error: string } | { success: true }> {
	const [record] = await db
		.select({ vehicleId: aishaServiceRecords.vehicleId })
		.from(aishaServiceRecords)
		.where(eq(aishaServiceRecords.id, recordId))
		.limit(1);
	if (!record || !(await getOwnedVehicle(record.vehicleId))) return { error: "Record not found" };

	await db.delete(aishaServiceRecords).where(eq(aishaServiceRecords.id, recordId));
	revalidatePath("/aisha");
	return { success: true };
}
