// Read-side queries for hoshii. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages or server actions.

import {
	type HoshiiItemRow,
	type HoshiiSettingsRow,
	convert,
	getSettings,
} from "@/features/hoshii/actions/guard";
import type { CoolingTiers } from "@/features/hoshii/lib/cooling";
import { type Funded, fundPlan, splitQueue } from "@/features/hoshii/lib/queue";
import type { SummaryItem } from "@/features/hoshii/lib/summary";
import { getBalances } from "@/features/kuroji/actions/balances";
import { accountScope, displayBalance } from "@/features/kuroji/lib/balance";
import type { Workspace } from "@/lib/session";
import { accounts, and, asc, db, eq, hoshiiItems, hoshiiLists } from "@seikatsu/db";
import { cache } from "react";

export type HoshiiItem = HoshiiItemRow & {
	/** The price in the base currency (today's rate); null if unknown. */
	base: number | null;
	listName: string | null;
};
export type HoshiiList = { id: string; name: string; position: string; count: number };
export type Piggy = { accountId: string; name: string; balance: number };
export type WantsBudget = { name: string; limit: number; spent: number };
export type PlanEntry = Funded<HoshiiItem>;

export type HoshiiData = {
	currency: string;
	settings: HoshiiSettingsRow;
	lists: HoshiiList[];
	items: HoshiiItem[];
	piggy: Piggy | null;
	budget: WantsBudget | null;
	queue: { decide: HoshiiItem[]; cooling: HoshiiItem[]; plan: PlanEntry[] };
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Everything the pages show, computed once per request. */
export const getHoshii = cache(async (ws: Workspace, today: string): Promise<HoshiiData> => {
	const [settings, lists, rows] = await Promise.all([
		getSettings(ws.id),
		db
			.select()
			.from(hoshiiLists)
			.where(eq(hoshiiLists.workspaceId, ws.id))
			.orderBy(asc(hoshiiLists.position)),
		db.select().from(hoshiiItems).where(eq(hoshiiItems.workspaceId, ws.id)),
	]);

	// One rate per currency, today's: totals in the base currency.
	const currencies = [...new Set(rows.map((r) => r.currency))];
	const rates = new Map(
		await Promise.all(
			currencies.map(async (c) => [c, await convert(1, c, ws.baseCurrency, today)] as const),
		),
	);
	const names = new Map(lists.map((l) => [l.id, l.name]));
	const items: HoshiiItem[] = rows.map((r) => {
		const rate = rates.get(r.currency);
		return {
			...r,
			base: r.price != null && rate != null ? Number(r.price) * rate : null,
			listName: r.listId ? (names.get(r.listId) ?? null) : null,
		};
	});

	const { piggy, budget } = await getPiggyAndBudget(ws, today, settings);
	const queue = splitQueue(items, today);
	return {
		currency: ws.baseCurrency,
		settings,
		lists: lists
			.map((l) => ({
				id: l.id,
				name: l.name,
				position: l.position,
				count: items.filter((i) => i.listId === l.id && live(i)).length,
			}))
			.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)),
		items,
		piggy,
		budget,
		queue: {
			decide: queue.decide,
			cooling: queue.cooling,
			plan: fundPlan(
				queue.plan.map((item) => ({ item, cost: item.base })),
				piggy?.balance ?? 0,
			),
		},
	};
});

export const live = (i: { state: string }) => i.state === "cooling" || i.state === "plan";

/** The piggy's balance today and the wants budget for this month, as Kuroji counts them. */
async function getPiggyAndBudget(
	ws: Workspace,
	today: string,
	settings: HoshiiSettingsRow,
): Promise<{ piggy: Piggy | null; budget: WantsBudget | null }> {
	const { piggyAccountId, categoryId } = settings;
	if (!piggyAccountId && !categoryId) return { piggy: null, budget: null };
	const balances = await getBalances(ws.id, `${today.slice(0, 7)}-01`, today);
	const scoped = (id: string, type: "ASSET" | "EXPENSE") =>
		sum(
			accountScope(id, type, balances).map((a) =>
				Number(balances.find((b) => b.accountId === a)?.balance ?? 0),
			),
		);

	const piggyRow = piggyAccountId && balances.find((b) => b.accountId === piggyAccountId);
	const piggy = piggyRow
		? {
				accountId: piggyRow.accountId,
				name: piggyRow.name,
				balance: scoped(piggyRow.accountId, "ASSET"),
			}
		: null;

	let budget: WantsBudget | null = null;
	const categoryRow = categoryId && balances.find((b) => b.accountId === categoryId);
	if (categoryRow) {
		const [account] = await db
			.select({ budget: accounts.budget })
			.from(accounts)
			.where(and(eq(accounts.id, categoryRow.accountId), eq(accounts.workspaceId, ws.id)))
			.limit(1);
		const limit = account?.budget != null ? Number(account.budget) : 0;
		if (limit > 0) {
			budget = {
				name: categoryRow.name,
				limit,
				spent: displayBalance("EXPENSE", scoped(categoryRow.accountId, "EXPENSE")),
			};
		}
	}
	return { piggy, budget };
}

/** What the Summary counts, each amount in the base currency. */
export async function getSummaryItems(ws: Workspace, today: string): Promise<SummaryItem[]> {
	const { items } = await getHoshii(ws, today);
	const rates = new Map<string, number | null>();
	for (const i of items) {
		if (i.boughtCurrency && !rates.has(i.boughtCurrency)) {
			rates.set(i.boughtCurrency, await convert(1, i.boughtCurrency, ws.baseCurrency, today));
		}
	}
	return items.map((i) => {
		const paidRate = i.boughtCurrency ? rates.get(i.boughtCurrency) : null;
		return {
			state: i.state,
			addedOn: i.addedOn,
			keptOn: i.keptOn,
			boughtOn: i.boughtOn,
			releasedOn: i.releasedOn,
			skippedCooling: i.skippedCooling,
			amount:
				i.state === "bought" && i.boughtPrice != null && paidRate != null
					? Number(i.boughtPrice) * paidRate
					: i.base,
		};
	});
}

export type ChromeData = {
	workspaceId: string;
	currency: string;
	lists: { id: string; name: string }[];
	tiers: CoolingTiers;
	/** Purchases default to these: the last used, else the piggy. */
	kuroji: { walletId: string | null; categoryId: string | null };
};

export async function getChromeData(ws: Workspace, today: string): Promise<ChromeData> {
	const { settings, lists } = await getHoshii(ws, today);
	return {
		workspaceId: ws.id,
		currency: ws.baseCurrency,
		lists: lists.map(({ id, name }) => ({ id, name })),
		tiers: {
			smallBelow: settings.smallBelow,
			largeFrom: settings.largeFrom,
			smallDays: settings.smallDays,
			midDays: settings.midDays,
			largeDays: settings.largeDays,
		},
		kuroji: {
			walletId: settings.walletId ?? settings.piggyAccountId,
			categoryId: settings.categoryId,
		},
	};
}
