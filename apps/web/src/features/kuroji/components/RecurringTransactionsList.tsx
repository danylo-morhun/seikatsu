"use client";

import { deleteRecurringTransaction, toggleRecurring } from "@/features/kuroji/actions/recurring";
import type { RecurringTransaction } from "@/features/kuroji/actions/recurring";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@seikatsu/ui";
import { Alert01Icon, Delete01Icon, PauseIcon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

const FREQ_LABELS: Record<string, string> = {
	daily: "Daily",
	weekly: "Weekly",
	monthly: "Monthly",
	yearly: "Yearly",
};

function fmtDate(iso: string) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function RecurringTransactionsList({
	items,
	currency,
}: {
	items: RecurringTransaction[];
	currency: string;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [loadingId, setLoadingId] = React.useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = React.useState<{ id: string } | null>(null);

	function handleToggle(id: string) {
		setLoadingId(id);
		startTransition(async () => {
			const result = await toggleRecurring(id);
			if ("error" in result) toast.error(result.error);
			else router.refresh();
			setLoadingId(null);
		});
	}

	function handleDelete() {
		if (!deleteTarget) return;
		const { id } = deleteTarget;
		startTransition(async () => {
			const result = await deleteRecurringTransaction(id);
			if ("error" in result) toast.error(result.error);
			else {
				toast.success("Recurring transaction deleted.");
				router.refresh();
			}
			setDeleteTarget(null);
		});
	}

	if (items.length === 0) {
		return <p className="text-sm text-muted-foreground">No recurring transactions set up yet.</p>;
	}

	return (
		<>
			<div className="divide-y rounded-md border">
				{items.map((rt) => (
					<div
						key={rt.id}
						className={`flex items-start justify-between gap-3 px-4 py-3 ${!rt.isActive ? "opacity-50" : ""}`}
					>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 text-sm font-medium">
								<span className="truncate">
									{rt.fromAccountName} → {rt.toAccountName}
								</span>
								<span
									className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium border ${rt.isActive ? "border-green-500/40 text-green-400" : "border-muted-foreground/30 text-muted-foreground"}`}
								>
									{rt.isActive ? "active" : "paused"}
								</span>
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{formatCurrency(
									Number(rt.amount),
									rt.currency !== currency ? rt.currency : currency,
								)}
								{rt.currency !== currency && <span className="ml-1">({rt.currency})</span>}
								{" · "}
								{FREQ_LABELS[rt.frequency]}
								{rt.description && <span> · {rt.description}</span>}
							</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Next: {fmtDate(rt.nextDate)}
								{rt.endDate && <span> · Until {fmtDate(rt.endDate)}</span>}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								disabled={isPending && loadingId === rt.id}
								onClick={() => handleToggle(rt.id)}
								title={rt.isActive ? "Pause" : "Resume"}
							>
								<HugeiconsIcon
									icon={rt.isActive ? PauseIcon : PlayCircleIcon}
									className="h-3.5 w-3.5"
								/>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-destructive hover:text-destructive"
								onClick={() => setDeleteTarget({ id: rt.id })}
							>
								<HugeiconsIcon icon={Delete01Icon} className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				))}
			</div>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(v) => {
					if (!v) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
							Delete recurring transaction?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the schedule. Already-generated transactions are not affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isPending}
							onClick={handleDelete}
						>
							<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
							{isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
