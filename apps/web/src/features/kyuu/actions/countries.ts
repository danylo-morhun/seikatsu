"use server";

import { requireWorkspace } from "@/lib/session";
import { and, count, db, eq, isNull, kyuuApplications } from "@seikatsu/db";
import { geminiConfigured } from "../lib/gemini";
import { fillCountries } from "./country-fill";
import { type Result, revalidateKyuu } from "./guard";

/** Settings: works out the country of the latest applications that have none. */
export async function fillMissingCountries(): Promise<Result<{ checked: number; filled: number }>> {
	const ws = await requireWorkspace();
	if (!geminiConfigured()) return { error: "AI is not configured" };
	try {
		const data = await fillCountries(ws.id, { limit: 90 });
		revalidateKyuu();
		return { success: true, data };
	} catch {
		return { error: "Couldn't reach Gemini. Try again in a minute." };
	}
}

/** How many applications have no country. */
export async function countMissingCountries(): Promise<number> {
	const ws = await requireWorkspace();
	const [row] = await db
		.select({ n: count() })
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.workspaceId, ws.id), isNull(kyuuApplications.country)));
	return row?.n ?? 0;
}
