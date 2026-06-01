"use client";

import { Spinner } from "@/components/Spinner";
import { createCard } from "@/features/tasso/actions/cards";
import { deleteColumn } from "@/features/tasso/actions/columns";
import { type CardData, KanbanCard } from "@/features/tasso/components/KanbanCard";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@ethos/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type ColumnData = {
	id: string;
	projectId: string;
	name: string;
	color: string | null;
	position: string;
};

interface Props {
	column: ColumnData;
	cards: CardData[];
	onCardClick?: (card: CardData) => void;
}

export function KanbanColumn({ column, cards, onCardClick }: Props) {
	const [addingCard, setAddingCard] = useState(false);
	const [title, setTitle] = useState("");
	const [isCreating, startCreate] = useTransition();
	const [isDeleting, startDelete] = useTransition();

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: column.id,
		data: { type: "column" },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const sortedCards = [...cards].sort((a, b) => (a.position < b.position ? -1 : 1));
	const cardIds = sortedCards.map((c) => c.id);

	function openAddCard() {
		setAddingCard(true);
		setTitle("");
	}

	function cancelAddCard() {
		setAddingCard(false);
		setTitle("");
	}

	async function handleCreateCard(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		startCreate(async () => {
			const result = await createCard({
				columnId: column.id,
				projectId: column.projectId,
				title: trimmed,
			});
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			setTitle("");
			setAddingCard(false);
			toast.success("Card created");
		});
	}

	function handleDeleteColumn() {
		if (!confirm(`Delete column "${column.name}"? All cards inside will be deleted.`)) return;
		startDelete(async () => {
			const result = await deleteColumn({ columnId: column.id });
			if ("error" in result) toast.error(result.error);
			else toast.success("Column deleted");
		});
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group/col flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40",
				isDragging && "opacity-40",
			)}
		>
			{/* Header — drag handle (listeners scoped here, not on delete btn) */}
			<div className="flex items-center gap-2 px-3 pt-3 pb-2">
				<div
					{...attributes}
					{...listeners}
					className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
				>
					{column.color && (
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: column.color }}
						/>
					)}
					<span className="flex-1 truncate text-sm font-medium text-foreground">{column.name}</span>
					<span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
				</div>
				<button
					type="button"
					disabled={isDeleting}
					onClick={handleDeleteColumn}
					className={cn(
						"ml-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground",
						"opacity-0 transition-opacity group-hover/col:opacity-100 hover:text-destructive",
					)}
					aria-label={`Delete column ${column.name}`}
				>
					{isDeleting ? <Spinner className="h-3 w-3" /> : "×"}
				</button>
			</div>

			{/* Cards */}
			<SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
				<div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2">
					{sortedCards.map((card) => (
						<KanbanCard key={card.id} card={card} onClick={onCardClick} />
					))}

					{addingCard ? (
						<form onSubmit={handleCreateCard} className="flex flex-col gap-1.5 pt-1">
							<textarea
								autoFocus
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") cancelAddCard();
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleCreateCard(e as unknown as React.FormEvent);
									}
								}}
								placeholder="Card title…"
								rows={2}
								className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<div className="flex items-center gap-1.5">
								<button
									type="submit"
									disabled={isCreating || !title.trim()}
									className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
								>
									{isCreating && <Spinner className="h-3 w-3" />}
									{isCreating ? "Adding…" : "Add card"}
								</button>
								<button
									type="button"
									onClick={cancelAddCard}
									className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
								>
									Cancel
								</button>
							</div>
						</form>
					) : (
						<button
							type="button"
							onClick={openAddCard}
							className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						>
							<span className="text-base leading-none">+</span>
							Add card
						</button>
					)}
				</div>
			</SortableContext>
		</div>
	);
}

export function KanbanColumnOverlay({
	column,
	cardCount,
}: { column: ColumnData; cardCount: number }) {
	return (
		<div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40 shadow-xl opacity-95 rotate-1">
			<div className="flex items-center gap-2 px-3 pt-3 pb-2">
				{column.color && (
					<span
						className="h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: column.color }}
					/>
				)}
				<span className="flex-1 truncate text-sm font-medium text-foreground">{column.name}</span>
				<span className="text-xs text-muted-foreground tabular-nums">{cardCount}</span>
			</div>
		</div>
	);
}
