import { z } from "zod";

export const TRANSACTIONS_PAGE_SIZE = 10;

/**
 * What the transaction list shows. The CSV export takes the same object, so the
 * file always holds exactly the rows the list does.
 */
export const transactionFiltersSchema = z.object({
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
	/** One account, or an account plus its rolled-up sub-accounts. */
	accountIds: z.array(z.uuid()).max(500).optional(),
	tagId: z.uuid().optional(),
	q: z.string().optional(),
	sortField: z.enum(["date", "amount"]).optional(),
	sortDir: z.enum(["asc", "desc"]).optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

/** A page past the end shows the last page; an empty list has one page, page 0. */
export function clampPage(page: number, total: number, pageSize = TRANSACTIONS_PAGE_SIZE) {
	const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
	return Math.min(Math.max(0, page), lastPage);
}
