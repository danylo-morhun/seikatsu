"use server";

import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import { type ReadingValues, readingSchema } from "@/features/aisha/lib/aisha-schemas";
import { readingConflict } from "@/features/aisha/lib/odometer";
import { aishaOdometerReadings, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result = { error: string } | { success: true };

function revalidate() {
	revalidatePath("/aisha", "layout");
	revalidatePath("/");
}

async function getOwnedReading(readingId: string) {
	const [reading] = await db
		.select()
		.from(aishaOdometerReadings)
		.where(eq(aishaOdometerReadings.id, readingId))
		.limit(1);
	if (!reading || !(await getOwnedVehicle(reading.vehicleId))) return null;
	return reading;
}

export async function addReading(vehicleId: string, values: ReadingValues): Promise<Result> {
	const vehicle = await getOwnedVehicle(vehicleId);
	if (!vehicle) return { error: "Vehicle not found" };

	const parsed = readingSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { id, ...reading } = parsed.data;

	if (id) {
		// Sent again (offline replay, lost response): the first one stands.
		const existing = await getOwnedReading(id);
		if (existing)
			return existing.vehicleId === vehicleId ? { success: true } : { error: "Conflict" };
	}

	const conflict = readingConflict(await getReadings(vehicleId), reading);
	if (conflict) return { error: conflict };

	await db.insert(aishaOdometerReadings).values({ id, vehicleId, ...reading });
	revalidate();
	return { success: true };
}

/** A reading's date or km. One from a service visit is edited with that visit. */
export async function updateReading(readingId: string, values: ReadingValues): Promise<Result> {
	const reading = await getOwnedReading(readingId);
	if (!reading) return { error: "Reading not found" };
	if (reading.serviceRecordId) return { error: "This reading belongs to a service: edit that" };

	const parsed = readingSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { id: _, ...next } = parsed.data;

	const others = (await getReadings(reading.vehicleId)).filter((r) => r.id !== readingId);
	const conflict = readingConflict(others, next);
	if (conflict) return { error: conflict };

	await db.update(aishaOdometerReadings).set(next).where(eq(aishaOdometerReadings.id, readingId));
	revalidate();
	return { success: true };
}

export async function deleteReading(readingId: string): Promise<Result> {
	const reading = await getOwnedReading(readingId);
	if (!reading) return { error: "Reading not found" };
	if (reading.serviceRecordId) return { error: "This reading belongs to a service: delete that" };
	// The car always has a mileage.
	if ((await getReadings(reading.vehicleId)).length <= 1) {
		return { error: "The only reading can be edited, not deleted" };
	}

	await db.delete(aishaOdometerReadings).where(eq(aishaOdometerReadings.id, readingId));
	revalidate();
	return { success: true };
}
