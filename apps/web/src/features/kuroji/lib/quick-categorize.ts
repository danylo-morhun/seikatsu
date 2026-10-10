// Rules for filing a transaction under another category straight from the list.

import { searchKey } from "./category-groups";

export type CategoryKind = "EXPENSE" | "INCOME";

type Leg = { accountId: string; currency: string };

type Txn = {
	splitCount: number;
	fromAccountId: string;
	fromAccountType: string;
	toAccountId: string;
	toAccountType: string;
	legs: Leg[];
};

type Category = {
	id: string;
	name: string;
	type: string;
	currency: string;
	parentId: string | null;
};

const OWN = new Set(["ASSET", "LIABILITY"]);

/**
 * The category end of a plain two-leg transaction: money out of an own account into an
 * expense, or in from an income. Splits and transfers have no single category to change.
 */
export function categoryEnd(
	txn: Txn,
): { kind: CategoryKind; categoryId: string; currency: string } | null {
	if (txn.splitCount > 1 || txn.legs.length !== 2) return null;
	const end =
		txn.toAccountType === "EXPENSE" && OWN.has(txn.fromAccountType)
			? { kind: "EXPENSE" as const, categoryId: txn.toAccountId }
			: txn.fromAccountType === "INCOME" && OWN.has(txn.toAccountType)
				? { kind: "INCOME" as const, categoryId: txn.fromAccountId }
				: null;
	const leg = end && txn.legs.find((l) => l.accountId === end.categoryId);
	return end && leg ? { ...end, currency: leg.currency } : null;
}

/** The import fallbacks ("Uncategorized Expenses" / "Uncategorized Income"). */
export function isUncategorized(name: string): boolean {
	return /^uncategori[sz]ed\b/i.test(name.trim());
}

/** Categories of `kind` used on these transactions, most recent first (the list is newest first). */
export function recentCategoryIds(txns: Txn[], kind: CategoryKind): string[] {
	const ids: string[] = [];
	for (const t of txns) {
		const end = categoryEnd(t);
		if (end?.kind === kind && !ids.includes(end.categoryId)) ids.push(end.categoryId);
	}
	return ids;
}

/**
 * What the picker offers: leaf categories of the right type in the transaction's currency
 * (the move keeps amounts as they are), matching the search, recent ones first, then A–Z.
 * The fallback buckets are never offered as a destination.
 */
export function pickableCategories<C extends Category>(
	categories: C[],
	opts: { kind: CategoryKind; currency: string; recentIds: string[]; query?: string },
): C[] {
	const parents = new Set(categories.map((c) => c.parentId).filter(Boolean));
	const q = searchKey(opts.query ?? "");
	const rank = (id: string) => {
		const i = opts.recentIds.indexOf(id);
		return i === -1 ? Number.POSITIVE_INFINITY : i;
	};
	return categories
		.filter(
			(c) =>
				c.type === opts.kind &&
				c.currency === opts.currency &&
				!parents.has(c.id) &&
				!isUncategorized(c.name) &&
				searchKey(c.name).includes(q),
		)
		.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

/** The transaction as it reads once filed under `category` (for the optimistic row). */
export function withCategory<T extends Txn & { fromAccount: string; toAccount: string }>(
	txn: T,
	category: { id: string; name: string },
): T {
	const end = categoryEnd(txn);
	if (!end) return txn;
	const legs = txn.legs.map((l) =>
		l.accountId === end.categoryId ? { ...l, accountId: category.id } : l,
	);
	return end.kind === "EXPENSE"
		? { ...txn, legs, toAccountId: category.id, toAccount: category.name }
		: { ...txn, legs, fromAccountId: category.id, fromAccount: category.name };
}
