"use client";

import { type CardData, KanbanCard } from "@/features/seiryu/components/KanbanCard";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@seikatsu/ui";
import { memo, useMemo, useState } from "react";

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
	onCardOpen: (cardId: string) => void;
	onAddCard: (columnId: string, title: string) => void;
	onRename: (columnId: string, name: string) => void;
	onDelete: (columnId: string) => void;
}

// Skips re-rendering when the board changes another column (cards compared by reference).
export const KanbanColumn = memo(function KanbanColumn({
	column,
	cards,
	onCardOpen,
	onAddCard,
	onRename,
	onDelete,
}: Props) {
	const [addingCard, setAddingCard] = useState(false);
	const [title, setTitle] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState("");

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: column.id,
		data: { type: "column" },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const sortedCards = useMemo(
		() => [...cards].sort((a, b) => (a.position < b.position ? -1 : 1)),
		[cards],
	);
	const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

	function openAddCard() {
		setAddingCard(true);
		setTitle("");
	}

	function cancelAddCard() {
		setAddingCard(false);
		setTitle("");
	}

	function handleCreateCard(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		setTitle("");
		setAddingCard(false);
		onAddCard(column.id, trimmed);
	}

	function handleRenameStart() {
		setEditName(column.name);
		setIsEditing(true);
	}

	function handleRenameCancel() {
		setIsEditing(false);
	}

	function handleRenameSubmit() {
		const trimmed = editName.trim();
		setIsEditing(false);
		if (!trimmed || trimmed === column.name) return;
		onRename(column.id, trimmed);
	}

	function handleDeleteColumn() {
		if (!confirm(`Delete column "${column.name}"? All cards inside will be deleted.`)) return;
		onDelete(column.id);
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
					{...(isEditing ? {} : listeners)}
					className={cn(
						"flex min-w-0 flex-1 items-center gap-2",
						isEditing ? "cursor-default" : "cursor-grab active:cursor-grabbing",
					)}
				>
					{column.color && (
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: column.color }}
						/>
					)}
					{isEditing ? (
						<input
							autoFocus
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							onBlur={handleRenameSubmit}
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									e.preventDefault();
									handleRenameCancel();
								}
								if (e.key === "Enter") {
									e.preventDefault();
									handleRenameSubmit();
								}
							}}
							className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
						/>
					) : (
						<span
							onDoubleClick={handleRenameStart}
							className="flex-1 truncate text-sm font-medium text-foreground"
						>
							{column.name}
						</span>
					)}
					<span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
				</div>
				<button
					type="button"
					onClick={handleDeleteColumn}
					className={cn(
						"ml-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground",
						"opacity-0 transition-opacity group-hover/col:opacity-100 hover:text-destructive",
					)}
					aria-label={`Delete column ${column.name}`}
				>
					×
				</button>
			</div>

			{/* Cards */}
			<SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
				<div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2">
					{sortedCards.map((card) => (
						<KanbanCard key={card.id} card={card} onOpen={onCardOpen} />
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
									disabled={!title.trim()}
									className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
								>
									Add card
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
}, sameColumnProps);

function sameColumnProps(a: Props, b: Props) {
	return (
		a.column.id === b.column.id &&
		a.column.name === b.column.name &&
		a.column.color === b.column.color &&
		a.column.position === b.column.position &&
		a.onCardOpen === b.onCardOpen &&
		a.onAddCard === b.onAddCard &&
		a.onRename === b.onRename &&
		a.onDelete === b.onDelete &&
		a.cards.length === b.cards.length &&
		a.cards.every((c, i) => c === b.cards[i])
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
