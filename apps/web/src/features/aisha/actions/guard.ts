// Shared ownership guards for aisha server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getCurrentWorkspace, getSessionUserId } from "@/lib/session";
import { aishaVehicles, and, db, eq } from "@seikatsu/db";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the vehicle row if it belongs to the current user's workspace, else null. */
export async function getOwnedVehicle(vehicleId: string) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [vehicle] = await db
		.select()
		.from(aishaVehicles)
		.where(and(eq(aishaVehicles.id, vehicleId), eq(aishaVehicles.workspaceId, ws.id)))
		.limit(1);
	return vehicle ?? null;
}
