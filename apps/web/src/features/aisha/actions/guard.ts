// Shared ownership guards for aisha server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getSessionUserId } from "@/lib/session";
import { aishaVehicles, db, eq, workspaces } from "@seikatsu/db";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the vehicle row if it belongs to the current user's workspace, else null. */
export async function getOwnedVehicle(vehicleId: string) {
	const userId = await requireUser();
	if (!userId) return null;
	const [row] = await db
		.select({ vehicle: aishaVehicles, ownerId: workspaces.userId })
		.from(aishaVehicles)
		.innerJoin(workspaces, eq(aishaVehicles.workspaceId, workspaces.id))
		.where(eq(aishaVehicles.id, vehicleId))
		.limit(1);
	if (!row || row.ownerId !== userId) return null;
	return row.vehicle;
}
