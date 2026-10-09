import type { TransactionFilters } from "@/features/kuroji/lib/transaction-filters";
import {
	and,
	asc,
	db,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	sql,
	transactionEntries,
	transactionTags,
	transactions,
} from "@seikatsu/db";

/** The rows a filter selects — shared by the list and the CSV export. */
export function transactionWhere(workspaceId: string, f: TransactionFilters) {
	const accountIds = f.accountIds ?? [];
	return and(
		eq(transactions.workspaceId, workspaceId),
		f.from ? gte(transactions.date, f.from) : undefined,
		f.to ? lte(transactions.date, f.to) : undefined,
		f.q ? ilike(transactions.description, `%${f.q}%`) : undefined,
		accountIds.length > 0
			? inArray(
					transactions.id,
					db
						.selectDistinct({ id: transactionEntries.transactionId })
						.from(transactionEntries)
						.where(inArray(transactionEntries.accountId, accountIds)),
				)
			: undefined,
		f.tagId
			? inArray(
					transactions.id,
					db
						.selectDistinct({ id: transactionTags.transactionId })
						.from(transactionTags)
						.where(eq(transactionTags.tagId, f.tagId)),
				)
			: undefined,
	);
}

/** The order a filter asks for: by date (newest first by default) or by amount. */
export function transactionOrder(f: TransactionFilters) {
	const dir = f.sortDir === "asc" ? asc : desc;
	const byDate = [dir(transactions.date), dir(transactions.createdAt)];
	if (f.sortField !== "amount") return byDate;
	const amount = sql`(select coalesce(sum(abs(te.base_amount)), 0) from transaction_entries te where te.transaction_id = ${transactions.id} and cast(te.base_amount as numeric) > 0)`;
	return [dir(amount), dir(transactions.date)];
}
