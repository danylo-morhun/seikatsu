"use client";

import { updateStatus } from "@/features/tsundoku/actions/books";
import { BOOK_STATUSES, type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@seikatsu/ui";
import { useTransition } from "react";
import { toast } from "sonner";

export function StatusSelect({ bookId, status }: { bookId: string; status: BookStatus }) {
	const [isPending, startTransition] = useTransition();

	function onChange(value: string) {
		startTransition(async () => {
			const res = await updateStatus(bookId, value);
			if ("error" in res) toast.error(res.error);
		});
	}

	return (
		<Select value={status} onValueChange={onChange} disabled={isPending}>
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
