"use client";

import type { AccountBalance } from "@/features/kuroji/actions/balances";
import { formatCurrency } from "@/features/kuroji/lib/format";
import Link from "next/link";

interface Props {
	balances: AccountBalance[];
	currency: string;
}

export function ExpenseCategoryList({ balances, currency }: Props) {
	const expenses = balances
		.filter((b) => b.type === "EXPENSE")
		.map((b) => ({ ...b, amount: Math.abs(Number(b.balance)) }))
		.filter((b) => b.amount > 0)
		.sort((a, b) => b.amount - a.amount);

	const total = expenses.reduce((acc, b) => acc + b.amount, 0);

	if (expenses.length === 0) {
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">
				No expenses in this period
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-baseline justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Expenses
				</h2>
				<span className="text-lg font-bold">{formatCurrency(total, currency)}</span>
			</div>
			<div className="space-y-3">
				{expenses.map((b) => {
					const pct = total > 0 ? (b.amount / total) * 100 : 0;
					return (
						<div key={b.accountId} className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between gap-2">
								<Link
									href={`/kuroji/accounts/${b.accountId}`}
									className="min-w-0 truncate text-sm font-medium hover:underline underline-offset-2"
								>
									{b.name}
								</Link>
								<div className="flex shrink-0 items-center gap-3 text-sm">
									<span className="w-10 text-right text-xs text-muted-foreground">
										{pct.toFixed(1)}%
									</span>
									<span className="w-24 text-right font-medium">
										{formatCurrency(b.amount, currency)}
									</span>
								</div>
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full transition-all bg-primary"
									style={{ width: `${pct}%` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
