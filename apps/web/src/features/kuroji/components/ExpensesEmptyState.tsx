"use client";

import { PeriodEmptyActions } from "@/features/kuroji/components/PeriodEmptyActions";
import type { BankProblem } from "@/features/kuroji/lib/bank-health";
import { buildPeriodLabel } from "@/features/kuroji/lib/dates";

interface Props {
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

export function ExpensesEmptyState({ from, to, syncGap }: Props) {
	const periodLabel = from && to ? buildPeriodLabel(from, to) : null;
	const { title, hint } = copyFor(periodLabel, syncGap);

	return (
		// The header carries the one primary action; here only the way to another period.
		<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<div>
				<p className="font-medium">{title}</p>
				<p className="mt-1 text-sm text-muted-foreground">{hint}</p>
			</div>
			<PeriodEmptyActions from={from} to={to} />
		</div>
	);
}
