"use server";

import { accounts, db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CURRENCIES } from "@/features/kuroji/lib/constants";
import { createProject } from "@/features/seiryu/actions/projects";
import { canSetCurrency } from "@/features/welcome/lib/data";
import { offFor } from "@/features/welcome/lib/welcome";
import { APP_HREFS, type AppHref, FEATURE_HREFS, type FeatureHref } from "@/lib/modules";
import { requireWorkspace } from "@/lib/session";

const schema = z.object({
	apps: z
		.array(z.enum(APP_HREFS as [AppHref, ...AppHref[]]))
		.min(1, "Pick at least one app")
		.max(APP_HREFS.length),
	features: z
		.array(z.enum(FEATURE_HREFS as [FeatureHref, ...FeatureHref[]]))
		.max(FEATURE_HREFS.length),
	currency: z.enum(CURRENCIES).nullable(),
	board: z.string().trim().max(60, "Keep the board's name short").nullable(),
});

export type WelcomeInput = z.infer<typeof schema>;

/** Saves the first-run setup: the apps and features kept (the rest off), the main currency
 * (with the starter accounts, before any money is recorded) and a first board. */
export async function completeWelcome(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const ws = await requireWorkspace();
	const parsed = schema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { apps, features, currency, board } = parsed.data;

	const setCurrency =
		currency !== null &&
		currency !== ws.baseCurrency &&
		apps.includes("/kuroji") &&
		(await canSetCurrency(ws.id));

	await db.transaction(async (tx) => {
		await tx
			.update(workspaces)
			.set({
				modulesOff: offFor(apps, features),
				onboardedAt: ws.onboardedAt ?? new Date(),
				...(setCurrency ? { baseCurrency: currency } : {}),
				updatedAt: new Date(),
			})
			.where(eq(workspaces.id, ws.id));
		// No money yet: the starter accounts follow the new currency.
		if (setCurrency)
			await tx.update(accounts).set({ currency }).where(eq(accounts.workspaceId, ws.id));
	});

	if (board && apps.includes("/seiryu")) {
		const created = await createProject({ name: board });
		if ("error" in created) return { error: created.error };
	}

	revalidatePath("/", "layout");
	return { success: true };
}
