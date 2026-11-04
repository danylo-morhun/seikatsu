"use server";

import { aishaOdometerReadings, aishaVehicles, and, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { getReadings } from "@/features/aisha/actions/data";
import { getOwnedVehicle, isUuid } from "@/features/aisha/actions/guard";
import { type ReadingValues, readingSchema } from "@/features/aisha/lib/aisha-schemas";
import { readingConflict } from "@/features/aisha/lib/odometer";
import { revalidateShell } from "@/lib/revalidate";
import { getCurrentWorkspace } from "@/lib/session";

type Result = { error: string } | { success: true };

function revalidate() {
	revalidatePath("/aisha", "layout");
	revalidateShell();
}

async function getOwnedReading(readingId: string) {
	if (!isUuid(readingId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({ reading: aishaOdometerReadings })
		.from(aishaOdometerReadings)
		.innerJoin(aishaVehicles, eq(aishaVehicles.id, aishaOdometerReadings.vehicleId))
		.where(and(eq(aishaOdometerReadings.id, readingId), eq(aishaVehicles.workspaceId, ws.id)))
		.limit(1);
	return row?.reading ?? null;
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
