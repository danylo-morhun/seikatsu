"use server";

import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import { type ReadingValues, readingSchema } from "@/features/aisha/lib/aisha-schemas";
import { readingConflict } from "@/features/aisha/lib/odometer";
import { aishaOdometerReadings, db } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function addReading(
	vehicleId: string,
	values: ReadingValues,
): Promise<{ error: string } | { success: true }> {
	const vehicle = await getOwnedVehicle(vehicleId);
	if (!vehicle) return { error: "Vehicle not found" };

	const parsed = readingSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const conflict = readingConflict(await getReadings(vehicleId), parsed.data);
	if (conflict) return { error: conflict };

	await db.insert(aishaOdometerReadings).values({ vehicleId, ...parsed.data });
	revalidatePath("/aisha");
	return { success: true };
}
