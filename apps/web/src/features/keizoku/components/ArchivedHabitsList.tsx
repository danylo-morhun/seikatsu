"use client";

import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import { deleteHabit, unarchiveHabit } from "@/features/keizoku/actions/habits";
import { Archive01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function ArchivedHabitsList({
	habits,
	onChange,
}: {
	habits: KeizokuHabit[];
	onChange: () => void;
}) {
	const [isPending, startTransition] = useTransition();
	const [loadingId, setLoadingId] = useState<string | null>(null);

	if (habits.length === 0) return null;

	function handleRestore(id: string, name: string) {
		setLoadingId(id);
		startTransition(async () => {
			const result = await unarchiveHabit(id);
			if ("error" in result) toast.error(result.error);
			else {
				toast.success(`"${name}" restored`);
				onChange();
			}
			setLoadingId(null);
		});
	}

	function handleDelete(id: string, name: string) {
		setLoadingId(id);
		startTransition(async () => {
			const result = await deleteHabit(id);
			if ("error" in result) toast.error(result.error);
			else {
				toast.success(`"${name}" deleted`);
				onChange();
			}
			setLoadingId(null);
		});
	}

	return (
		<section className="mt-8">
			<h2 className="mb-1 text-sm font-semibold">Archived habits</h2>
			<p className="mb-3 text-xs text-muted-foreground">
				Hidden from Today, but their history is preserved.
			</p>
			<div className="divide-y rounded-md border">
				{habits.map((h) => (
					<div key={h.id} className="flex items-center justify-between px-3 py-2.5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4 shrink-0" />
							<span>
								{h.emoji} {h.name}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="ghost"
								disabled={isPending && loadingId === h.id}
								onClick={() => handleDelete(h.id, h.name)}
							>
								Delete
							</Button>
							<Button
								size="sm"
								variant="outline"
								disabled={isPending && loadingId === h.id}
								onClick={() => handleRestore(h.id, h.name)}
							>
								{isPending && loadingId === h.id ? "Restoring…" : "Restore"}
							</Button>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
