"use client";

import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { editFormValues } from "@/features/kuroji/lib/transaction-edit";
import * as React from "react";
import { toast } from "sonner";

interface Props {
	transaction: RecentTransaction;
	workspaceId: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}

/** The capture dialog, prefilled with every leg of a saved transaction. */
export function EditTransactionModal({ transaction, workspaceId, open, onOpenChange }: Props) {
	const values = React.useMemo(() => editFormValues(transaction), [transaction]);

	React.useEffect(() => {
		if (open && !values) {
			toast.error(
				"This transaction has several accounts on both sides. Delete it and record it again to change it.",
			);
			onOpenChange(false);
		}
	}, [open, values, onOpenChange]);

	if (!values) return null;
	return (
		<AddTransactionModal
			workspaceId={workspaceId}
			baseCurrency={values.currency}
			editing={{
				transactionId: transaction.id,
				values,
				tagIds: transaction.tags.map((t) => t.id),
			}}
			open={open}
			onOpenChange={onOpenChange}
		/>
	);
}
