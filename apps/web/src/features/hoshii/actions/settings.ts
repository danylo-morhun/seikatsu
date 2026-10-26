"use server";

import { accountsValid, revalidateHoshii } from "@/features/hoshii/actions/guard";
import { type SettingsValues, settingsSchema } from "@/features/hoshii/lib/hoshii-schemas";
import { getCurrentWorkspace } from "@/lib/session";
import { db, hoshiiSettings } from "@seikatsu/db";

/** The piggy, the purchase accounts and the cooling tiers. */
export async function saveSettings(
	values: SettingsValues,
): Promise<{ error: string } | { success: true }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = settingsSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const s = parsed.data;

	const wanted = [
		s.piggyAccountId && { id: s.piggyAccountId, types: ["ASSET" as const] },
		s.walletId && { id: s.walletId, types: ["ASSET" as const, "LIABILITY" as const] },
		s.categoryId && { id: s.categoryId, types: ["EXPENSE" as const] },
	].filter((w) => !!w);
	if (!(await accountsValid(ws.id, wanted))) return { error: "Pick accounts from Kuroji" };

	await db
		.insert(hoshiiSettings)
		.values({ workspaceId: ws.id, ...s })
		.onConflictDoUpdate({ target: hoshiiSettings.workspaceId, set: s });
	revalidateHoshii();
	return { success: true };
}
