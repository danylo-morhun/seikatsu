import type { AccountBalance } from "@/features/kuroji/actions/balances";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import Link from "next/link";

interface Props {
	balances: AccountBalance[];
	currency: string;
	/** Carried to account pages so they open on the same period. */
	periodQuery: string;
}

const VISIBLE = 8;

/**
 * Where the money went, as a ranked list: each category's bar is scaled to the largest,
 * so the comparison reads at a glance and the exact amount sits beside it.
 */
export function CategoryBreakdown({ balances, currency, periodQuery }: Props) {
	const rows = balances
		.filter((b) => b.type === "EXPENSE" && !b.parentId && !b.hidden)
		.map((b) => ({
			id: b.accountId,
			name: b.name,
			value: displayBalance("EXPENSE", Number(b.balance)),
		}))
		.filter((b) => b.value > 0)
		.sort((a, b) => b.value - a.value);

	const total = rows.reduce((sum, r) => sum + r.value, 0);
	const max = rows[0]?.value ?? 0;

	if (rows.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No spending in this period.</p>;
	}

	const renderRow = (r: (typeof rows)[number]) => (
		<li key={r.id} className="pb-1">
			<Link
				href={`/kuroji/accounts/${r.id}${periodQuery}`}
				prefetch
				className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="truncate text-sm group-hover:text-foreground">{r.name}</span>
				<span className="font-figures text-sm font-medium">
					{formatCurrency(r.value, currency)}
					<span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">
						{Math.round((r.value / total) * 100)}%
					</span>
				</span>
				<span aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2">
					<span
						className="block h-full rounded-full bg-primary/80 transition-colors group-hover:bg-primary"
						style={{ width: `${(r.value / max) * 100}%` }}
					/>
				</span>
			</Link>
			{/* Money nobody has filed yet is a to-do, not a category: offer to sort it. */}
			{r.name.startsWith("Uncategorized") && (
				<Link
					href={`/kuroji?tab=transactions&account=${r.id}${periodQuery.replace("?", "&")}`}
					prefetch
					className="mb-1.5 inline-block text-xs text-primary underline-offset-2 hover:underline"
				>
					Categorize these transactions →
				</Link>
			)}
		</li>
	);

	return (
		<div>
			<ol className="divide-y divide-rule">{rows.slice(0, VISIBLE).map(renderRow)}</ol>
			{rows.length > VISIBLE && (
				<details className="group/more">
					<summary className="cursor-pointer list-none py-2.5 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
						<span className="group-open/more:hidden">Show {rows.length - VISIBLE} more</span>
						<span className="hidden group-open/more:inline">Show less</span>
					</summary>
					<ol className="divide-y divide-rule border-t border-rule">
						{rows.slice(VISIBLE).map(renderRow)}
					</ol>
				</details>
			)}
		</div>
	);
}
