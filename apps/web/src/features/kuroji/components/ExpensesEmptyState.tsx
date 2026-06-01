"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { ReceiptTextIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface Props {
	workspaceId: string;
	baseCurrency: string;
}

export function ExpensesEmptyState({ workspaceId, baseCurrency }: Props) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
				<HugeiconsIcon icon={ReceiptTextIcon} size={24} className="text-muted-foreground" />
			</div>
			<div>
				<p className="font-medium">No transactions this period</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Record an expense or income to see your dashboard come alive.
				</p>
			</div>
			<AddTransactionModal workspaceId={workspaceId} baseCurrency={baseCurrency} />
		</div>
	);
}
