"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { formatShortDate } from "@/features/kuroji/lib/dates";
import { deleteCard, restoreCard } from "@/features/seiryu/actions/cards";
import type { ArchivedCardRow } from "@/features/seiryu/lib/archive";
import { Archive01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Row = ArchivedCardRow;

interface Props {
	cards: Row[];
	today: string;
	/** Off on a board, where every card is from the same project. */
	grouped?: boolean;
}

/** Archived cards by project, as Kuroji lists archived accounts: restore in one tap. */
export function SettingsArchive({ cards, today, grouped = true }: Props) {
	const [isPending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<Row | null>(null);

	if (cards.length === 0) {
		return (
			<p className="border-y border-rule py-4 text-sm text-muted-foreground">
				Nothing archived{grouped ? "" : " in this project"}. Archive a card from its menu to clear
				it off the board without losing it.
			</p>
		);
	}

	const groups = new Map<string, { name: string; rows: Row[] }>();
	for (const card of cards) {
		const group = groups.get(card.projectId);
		if (group) group.rows.push(card);
		else groups.set(card.projectId, { name: card.projectName, rows: [card] });
	}

	function handleRestore(card: Row) {
		setBusyId(card.id);
		startTransition(async () => {
			const result = await restoreCard({ cardId: card.id });
			if ("error" in result) toast.error(result.error);
			setBusyId(null);
		});
	}

	return (
		<div className="space-y-10">
			{[...groups.entries()].map(([projectId, group], gi) => (
				<section
					key={projectId}
					aria-label={group.name}
					className="animate-rise"
					style={{ "--i": gi } as React.CSSProperties}
				>
					{grouped && <h3 className="mb-2 text-sm font-semibold">{group.name}</h3>}
					<ul className="divide-y divide-rule border-y border-rule">
						{group.rows.map((card) => (
							<li key={card.id} className="flex items-center gap-3 py-2.5">
								<HugeiconsIcon
									icon={Archive01Icon}
									className="h-4 w-4 shrink-0 text-muted-foreground"
								/>
								<div className="min-w-0 flex-1">
									<Link
										href={`/seiryu/${card.projectId}/${card.id}`}
										prefetch={false}
										className="block truncate text-sm hover:underline hover:underline-offset-4"
									>
										{card.title}
									</Link>
									<p className="text-xs text-muted-foreground">
										{card.columnName}
										{card.archivedOn && <> · archived {formatShortDate(card.archivedOn, today)}</>}
									</p>
								</div>
								<Button
									size="sm"
									variant="ghost"
									className="shrink-0 text-muted-foreground"
									onClick={() => setDeleting(card)}
								>
									Delete
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="shrink-0"
									disabled={isPending && busyId === card.id}
									onClick={() => handleRestore(card)}
								>
									{isPending && busyId === card.id ? "Restoring…" : "Restore"}
								</Button>
							</li>
						))}
					</ul>
				</section>
			))}
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete "${deleting?.title ?? ""}"?`}
				description="The card, its checklist and labels go for good."
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteCard({ cardId: deleting.id });
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</div>
	);
}
