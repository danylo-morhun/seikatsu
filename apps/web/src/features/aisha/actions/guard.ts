// Shared ownership guards for aisha server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { auth } from "@/auth";
import { aishaVehicles, db, eq, workspaces } from "@seikatsu/db";

export async function requireUser(): Promise<string | null> {
	const session = await auth();
	return session?.user?.id ?? null;
}

/** Returns the workspace row if it belongs to the current user, else null. */
export async function getOwnedWorkspace(workspaceId: string) {
	const userId = await requireUser();
	if (!userId) return null;
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
	if (!ws || ws.userId !== userId) return null;
	return ws;
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
