"use server";

import { getOwnedVehicle, getOwnedWorkspace } from "@/features/aisha/actions/guard";
import {
	type CreateVehicleValues,
	type VehicleFormValues,
	createVehicleSchema,
	vehicleFormSchema,
} from "@/features/aisha/lib/aisha-schemas";
import { presetsFor } from "@/features/aisha/lib/constants";
import {
	accounts,
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaVehicles,
	and,
	db,
	eq,
	inArray,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type AishaVehicle = typeof aishaVehicles.$inferSelect;

/** Creates the vehicle, its first odometer reading and the default maintenance plan. */
export async function createVehicle(
	workspaceId: string,
	values: CreateVehicleValues,
): Promise<{ error: string } | { success: true; data: AishaVehicle }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = createVehicleSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { currentKm, today, servicedNow, ...v } = parsed.data;

	const vehicle = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(aishaVehicles)
			.values({ workspaceId, ...v })
			.returning();
		await tx
			.insert(aishaOdometerReadings)
			.values({ vehicleId: row.id, date: today, km: currentKm });
		await tx.insert(aishaMaintenanceItems).values(
			presetsFor(v.fuelType).map((p) => ({
				vehicleId: row.id,
				name: p.name,
				intervalKm: p.intervalKm,
				intervalMonths: p.intervalMonths,
				note: p.note,
				...(servicedNow ? { baselineDate: today, baselineKm: currentKm } : {}),
			})),
		);
		return row;
	});

	revalidatePath("/aisha", "layout");
	revalidatePath("/settings/aisha");
	revalidatePath("/");
	return { success: true, data: vehicle };
}

export async function updateVehicle(
	vehicleId: string,
	values: VehicleFormValues,
): Promise<{ error: string } | { success: true }> {
	const vehicle = await getOwnedVehicle(vehicleId);
	if (!vehicle) return { error: "Vehicle not found" };

	const parsed = vehicleFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	await db
		.update(aishaVehicles)
		.set({ ...v, engine: v.engine ?? null, plate: v.plate ?? null, vin: v.vin ?? null })
		.where(eq(aishaVehicles.id, vehicleId));

	revalidatePath("/aisha", "layout");
	revalidatePath("/settings/aisha");
	revalidatePath("/");
	return { success: true };
}

/** Where "Record in Kuroji" posts by default; null clears it. Checked when a service is saved. */
export async function setKurojiDefaults(
	vehicleId: string,
	defaults: { walletId: string | null; categoryId: string | null },
): Promise<{ error: string } | { success: true }> {
	const vehicle = await getOwnedVehicle(vehicleId);
	if (!vehicle) return { error: "Vehicle not found" };
	const ids = [defaults.walletId, defaults.categoryId].filter((id): id is string => id != null);
	if (ids.length > 0) {
		const owned = await db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(inArray(accounts.id, ids), eq(accounts.workspaceId, vehicle.workspaceId)));
		if (owned.length !== new Set(ids).size) return { error: "Account not found" };
	}
	await db
		.update(aishaVehicles)
		.set({ kurojiWalletId: defaults.walletId, kurojiCategoryId: defaults.categoryId })
		.where(eq(aishaVehicles.id, vehicleId));
	revalidatePath("/settings/aisha");
	return { success: true };
}
