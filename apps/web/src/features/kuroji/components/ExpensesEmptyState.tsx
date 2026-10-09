"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { PeriodEmptyActions } from "@/features/kuroji/components/PeriodEmptyActions";
import { buildPeriodLabel } from "@/features/kuroji/lib/dates";
import { ReceiptTextIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface Props {
	workspaceId: string;
	baseCurrency: string;
	/** The resolved period on screen; both undefined means all time. */
	from?: string;
	to?: string;
}

export function ExpensesEmptyState({ workspaceId, baseCurrency, from, to }: Props) {
	const periodLabel = from && to ? buildPeriodLabel(from, to) : null;

	return (
		<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
				<HugeiconsIcon icon={ReceiptTextIcon} size={24} className="text-muted-foreground" />
			</div>
			<div>
				<p className="font-medium">
					{periodLabel ? `No income or expenses in ${periodLabel}` : "No income or expenses yet"}
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{periodLabel
						? "Look at another period, or record what you spent."
						: "Record an expense or income to see where your money goes."}
				</p>
			</div>
			<AddTransactionModal workspaceId={workspaceId} baseCurrency={baseCurrency} />
			<PeriodEmptyActions from={from} to={to} />
		</div>
	);
}
