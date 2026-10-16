// Shared ownership guards for kyuu server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getCurrentWorkspace, isUuid } from "@/lib/session";
import { and, db, eq, kyuuApplications, kyuuEvents } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { type Status, toStatus } from "../lib/stages";

export type Result<T = undefined> =
	| { error: string }
	| ({ success: true } & (T extends undefined ? object : { data: T }));

export const FAILED = { error: "Couldn't save. Check your connection." } as const;

/** The application's id, workspace and status if it's the current user's, else null. */
export async function getOwnedApplication(
	applicationId: string,
): Promise<{ id: string; status: Status; dateApplied: string } | null> {
	// A mistyped link can't name a row (and would make Postgres throw on the uuid cast).
	if (!isUuid(applicationId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({
			id: kyuuApplications.id,
			status: kyuuApplications.status,
			dateApplied: kyuuApplications.dateApplied,
		})
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.id, applicationId), eq(kyuuApplications.workspaceId, ws.id)))
		.limit(1);
	return row ? { ...row, status: toStatus(row.status) } : null;
}

/** The event and its application's status, if the application is the current user's. */
export async function getOwnedEvent(eventId: string) {
	if (!isUuid(eventId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({
			id: kyuuEvents.id,
			applicationId: kyuuEvents.applicationId,
			kind: kyuuEvents.kind,
		})
		.from(kyuuEvents)
		.innerJoin(kyuuApplications, eq(kyuuApplications.id, kyuuEvents.applicationId))
		.where(and(eq(kyuuEvents.id, eventId), eq(kyuuApplications.workspaceId, ws.id)))
		.limit(1);
	return row ?? null;
}

/** A calendar day as the forms send it. */
export function isDay(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

export function revalidateKyuu() {
	revalidatePath("/kyuu", "layout");
	revalidatePath("/settings/kyuu");
	revalidatePath("/");
}
