"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { PeriodEmptyActions } from "@/features/kuroji/components/PeriodEmptyActions";
import type { BankProblem } from "@/features/kuroji/lib/bank-health";
import { buildPeriodLabel } from "@/features/kuroji/lib/dates";
import { ReceiptTextIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface Props {
	workspaceId: string;
	baseCurrency: string;
	/** The resolved period on screen; both undefined means all time. */
	from?: string;
	to?: string;
	/** Set when the period starts after a bank stopped syncing: that explains the gap. */
	syncGap?: BankProblem | null;
}

function copyFor(periodLabel: string | null, syncGap: BankProblem | null | undefined) {
	if (syncGap) {
		const expired = syncGap.kind === "expired";
		return {
			title: `No transactions since ${syncGap.name} ${expired ? "stopped syncing" : "last synced"} on ${syncGap.sinceLabel}`,
			hint: expired
				? "Reconnect the bank to import the rest, or look at another period."
				: "Run a sync in Settings, or look at another period.",
		};
	}
	if (periodLabel) {
		return {
			title: `No income or expenses in ${periodLabel}`,
			hint: "Look at another period, or record what you spent.",
		};
	}
	return {
		title: "No income or expenses yet",
		hint: "Record an expense or income to see where your money goes.",
	};
}

export function ExpensesEmptyState({ workspaceId, baseCurrency, from, to, syncGap }: Props) {
	const periodLabel = from && to ? buildPeriodLabel(from, to) : null;
	const { title, hint } = copyFor(periodLabel, syncGap);

	return (
		<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
				<HugeiconsIcon icon={ReceiptTextIcon} size={24} className="text-muted-foreground" />
			</div>
			<div>
				<p className="font-medium">{title}</p>
				<p className="mt-1 text-sm text-muted-foreground">{hint}</p>
			</div>
			<AddTransactionModal workspaceId={workspaceId} baseCurrency={baseCurrency} />
			<PeriodEmptyActions from={from} to={to} />
		</div>
	);
}
