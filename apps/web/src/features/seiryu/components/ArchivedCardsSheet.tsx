"use client";

import { Spinner } from "@/components/Spinner";
import { deleteCard, getArchivedCards, restoreCard } from "@/features/seiryu/actions/cards";
import type { CardData } from "@/features/seiryu/components/KanbanCard";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@seikatsu/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ArchivedCard = Awaited<ReturnType<typeof getArchivedCards>>[number];

interface Props {
	projectId: string;
	columns: { id: string; name: string }[];
	onCardRestore: (card: CardData) => void;
}

export function ArchivedCardsSheet({ projectId, columns, onCardRestore }: Props) {
	const [open, setOpen] = useState(false);
	const [cards, setCards] = useState<ArchivedCard[]>([]);
	const [loading, setLoading] = useState(false);
	const [restoringId, setRestoringId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		getArchivedCards(projectId)
			.then(setCards)
			.catch(() => toast.error("Failed to load archived cards"))
			.finally(() => setLoading(false));
	}, [open, projectId]);

	const columnName = (columnId: string) =>
		columns.find((c) => c.id === columnId)?.name ?? "Unknown column";

	async function handleRestore(card: ArchivedCard) {
		setRestoringId(card.id);
		const result = await restoreCard({ cardId: card.id });
		setRestoringId(null);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		setCards((prev) => prev.filter((c) => c.id !== card.id));
		onCardRestore({
			id: card.id,
			columnId: result.data.columnId,
			projectId: card.projectId,
			title: card.title,
			description: card.description,
			priority: card.priority,
			dueDate: card.dueDate,
			position: result.data.position,
			checklistItems: card.checklistItems,
			labels: card.labels,
		});
		toast.success("Card restored");
	}

	async function handleDelete(cardId: string) {
		if (!confirm("Permanently delete this card? This cannot be undone.")) return;
		setDeletingId(cardId);
		const result = await deleteCard({ cardId });
		setDeletingId(null);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		setCards((prev) => prev.filter((c) => c.id !== cardId));
		toast.success("Card deleted");
	}

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
					Archived
				</Button>
			</SheetTrigger>
			<SheetContent className="flex w-full flex-col sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Archived cards</SheetTitle>
				</SheetHeader>

				{loading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner className="h-5 w-5" />
					</div>
				) : cards.length === 0 ? (
					<p className="mt-4 text-sm text-muted-foreground">No archived cards.</p>
				) : (
					<ul className="mt-2 flex flex-col gap-2 overflow-y-auto">
						{cards.map((card) => (
							<li
								key={card.id}
								className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
							>
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<p className="truncate text-sm font-medium text-card-foreground">{card.title}</p>
									<p className="text-xs text-muted-foreground">{columnName(card.columnId)}</p>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<button
										type="button"
										disabled={restoringId === card.id}
										onClick={() => handleRestore(card)}
										className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
									>
										{restoringId === card.id ? <Spinner className="h-3 w-3" /> : null}
										Restore
									</button>
									<button
										type="button"
										disabled={deletingId === card.id}
										onClick={() => handleDelete(card.id)}
										className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
									>
										{deletingId === card.id ? <Spinner className="h-3 w-3" /> : null}
										Delete
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</SheetContent>
		</Sheet>
	);
}
