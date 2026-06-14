"use client";

import { Spinner } from "@/components/Spinner";
import { type TsundokuSession, deleteSession } from "@/features/tsundoku/actions/sessions";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function SessionLog({ sessions }: { sessions: TsundokuSession[] }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	function onDelete(id: string) {
		setDeletingId(id);
		startTransition(async () => {
			const res = await deleteSession(id);
			setDeletingId(null);
			if ("error" in res) toast.error(res.error);
			else router.refresh();
		});
	}

	if (sessions.length === 0) {
		return <p className="text-sm text-muted-foreground">No sessions logged yet.</p>;
	}

	return (
		<ul className="space-y-1.5">
			{sessions.map((s) => (
				<li
					key={s.id}
					className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm"
				>
					<span className="text-muted-foreground">{format(new Date(s.date), "MMM d, yyyy")}</span>
					<span className="flex items-center gap-3">
						<span className="font-medium tabular-nums">{s.pagesRead} pages</span>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-muted-foreground hover:text-destructive"
							onClick={() => onDelete(s.id)}
							disabled={isPending && deletingId === s.id}
							aria-label="Delete session"
						>
							{isPending && deletingId === s.id ? (
								<Spinner />
							) : (
								<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
							)}
						</Button>
					</span>
				</li>
			))}
		</ul>
	);
}
