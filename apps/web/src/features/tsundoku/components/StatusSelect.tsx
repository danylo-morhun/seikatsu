"use client";

import { updateStatus } from "@/features/tsundoku/actions/books";
import { BOOK_STATUSES, type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@seikatsu/ui";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

export function StatusSelect({ bookId, status }: { bookId: string; status: BookStatus }) {
	const [, startTransition] = useTransition();
	// Shows the pick at once; the action's re-render brings the saved status.
	const [shown, setShown] = useOptimistic(status);

	function onChange(value: string) {
		startTransition(async () => {
			setShown(value as BookStatus);
			const res = await updateStatus(bookId, value);
			if ("error" in res) toast.error(res.error);
		});
	}

	return (
		<Select value={shown} onValueChange={onChange}>
			<SelectTrigger className="w-[150px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{BOOK_STATUSES.map((s) => (
					<SelectItem key={s} value={s}>
						{STATUS_CONFIG[s].label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
