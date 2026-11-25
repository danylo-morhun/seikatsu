// Server-only: what Settings → Calendar shows about the connected Google account.

import { asc, db, eq, googleAccounts, googleCalendars } from "@seikatsu/db";

export type GoogleSettings = {
	email: string;
	lastSyncedAt: Date | null;
	lastError: string | null;
	calendars: {
		id: string;
		name: string;
		color: string | null;
		shown: boolean;
		own: boolean;
		writable: boolean;
	}[];
} | null;

export async function readGoogleSettings(workspaceId: string): Promise<GoogleSettings> {
	const [account] = await db
		.select()
		.from(googleAccounts)
		.where(eq(googleAccounts.workspaceId, workspaceId));
	if (!account) return null;
	const calendars = await db
		.select({
			id: googleCalendars.id,
			name: googleCalendars.name,
			color: googleCalendars.color,
			shown: googleCalendars.shown,
			own: googleCalendars.own,
			writable: googleCalendars.writable,
		})
		.from(googleCalendars)
		.where(eq(googleCalendars.workspaceId, workspaceId))
		.orderBy(asc(googleCalendars.own), asc(googleCalendars.name));
	return {
		email: account.email,
		lastSyncedAt: account.lastSyncedAt,
		lastError: account.lastError,
		calendars,
	};
}
