// Shared helpers for hoshii server actions: ownership, settings, money.
// Not a "use server" module — these are called inside server actions and RSC loaders.

import { DEFAULT_TIERS } from "@/features/hoshii/lib/cooling";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import { generateKeyBetween } from "@/lib/position";
import { getCurrentWorkspace } from "@/lib/session";
import {
	accounts,
	and,
	db,
	eq,
	hoshiiItems,
	hoshiiLists,
	hoshiiSettings,
	inArray,
	isNull,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type HoshiiItemRow = typeof hoshiiItems.$inferSelect;
export type HoshiiSettingsRow = typeof hoshiiSettings.$inferSelect;

export function revalidateHoshii() {
	revalidatePath("/hoshii", "layout");
	revalidatePath("/settings/hoshii");
	revalidatePath("/");
}

/** The item, if it is in the current user's workspace. */
export async function getOwnedItem(itemId: string) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [item] = await db
		.select()
		.from(hoshiiItems)
		.where(and(eq(hoshiiItems.id, itemId), eq(hoshiiItems.workspaceId, ws.id)))
		.limit(1);
	return item ? { item, ws } : null;
}

export async function isOwnedList(listId: string, workspaceId: string) {
	const [list] = await db
		.select({ id: hoshiiLists.id })
		.from(hoshiiLists)
		.where(and(eq(hoshiiLists.id, listId), eq(hoshiiLists.workspaceId, workspaceId)))
		.limit(1);
	return Boolean(list);
}

/** The workspace's settings, or the defaults before the first save. */
export async function getSettings(workspaceId: string): Promise<HoshiiSettingsRow> {
	const [row] = await db
		.select()
		.from(hoshiiSettings)
		.where(eq(hoshiiSettings.workspaceId, workspaceId))
		.limit(1);
	return (
		row ?? {
			workspaceId,
			piggyAccountId: null,
			walletId: null,
			categoryId: null,
			...DEFAULT_TIERS,
		}
	);
}

/** `amount` in `to`, at the day's Kuroji rate; null when there's no rate. */
export async function convert(
	amount: number,
	from: string,
	to: string,
	date: string,
): Promise<number | null> {
	if (from === to) return amount;
	try {
		return amount * (await getExchangeRate(from, to, date));
	} catch {
		return null;
	}
}

/** A position after the last want in the Plan. */
export async function endOfPlan(workspaceId: string): Promise<string> {
	const rows = await db
		.select({ position: hoshiiItems.planPosition })
		.from(hoshiiItems)
		.where(and(eq(hoshiiItems.workspaceId, workspaceId), eq(hoshiiItems.state, "plan")));
	// Compared in JS: fractional keys are case-sensitive, a DB collation may not be.
	const last = rows
		.map((r) => r.position)
		.filter((p): p is string => p != null)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.at(-1);
	return generateKeyBetween(last ?? null, null);
}

type AccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";

/** Each id is an open account of the workspace, of one of the allowed types. */
export async function accountsValid(
	workspaceId: string,
	wanted: { id: string; types: AccountType[] }[],
): Promise<boolean> {
	if (wanted.length === 0) return true;
	const rows = await db
		.select({ id: accounts.id, type: accounts.type })
		.from(accounts)
		.where(
			and(
				inArray(
					accounts.id,
					wanted.map((w) => w.id),
				),
				eq(accounts.workspaceId, workspaceId),
				isNull(accounts.archivedAt),
			),
		);
	return wanted.every((w) => {
		const type = rows.find((r) => r.id === w.id)?.type;
		return type != null && w.types.includes(type);
	});
}
