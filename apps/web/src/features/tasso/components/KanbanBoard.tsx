"use client";

import {
	DndContext,
	DragOverlay,
	PointerSensor,
	type DragEndEvent,
	type DragStartEvent,
	closestCorners,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { moveCard, reorderCards } from "@/features/tasso/actions/cards";
import { reorderColumns } from "@/features/tasso/actions/columns";
import { CardSheet } from "@/features/tasso/components/CardSheet";
import { type CardData, KanbanCardOverlay } from "@/features/tasso/components/KanbanCard";
import { type ColumnData, KanbanColumn, KanbanColumnOverlay } from "@/features/tasso/components/KanbanColumn";
import { generateKeyBetween } from "@/features/tasso/lib/position";
import { useState, useTransition } from "react";

interface Props {
	columns: ColumnData[];
	cards: CardData[];
	projectId: string;
}

export function KanbanBoard({ columns: initialColumns, cards: initialCards }: Props) {
	const [columns, setColumns] = useState(initialColumns);
	const [cards, setCards] = useState(initialCards);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [activeType, setActiveType] = useState<"column" | "card" | null>(null);
	const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [, startTransition] = useTransition();

	function handleCardClick(card: CardData) {
		setSelectedCard(card);
		setSheetOpen(true);
	}

	function handleCardUpdate(
		cardId: string,
		updates: Partial<Pick<CardData, "title" | "description" | "priority" | "dueDate">>,
	) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
		setSelectedCard((prev) => (prev?.id === cardId ? { ...prev, ...updates } : prev));
	}

	function handleCardArchive(cardId: string) {
		setCards((prev) => prev.filter((c) => c.id !== cardId));
		setSheetOpen(false);
	}

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	const sortedColumns = [...columns].sort((a, b) => (a.position < b.position ? -1 : 1));
	const columnIds = sortedColumns.map((c) => c.id);

	const activeColumn = activeType === "column" ? columns.find((c) => c.id === activeId) : null;
	const activeCard = activeType === "card" ? cards.find((c) => c.id === activeId) : null;

	function handleDragStart(event: DragStartEvent) {
		setActiveId(event.active.id as string);
		setActiveType(event.active.data.current?.type ?? null);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveId(null);
		setActiveType(null);

		if (!over || active.id === over.id) return;

		if (active.data.current?.type === "column") {
			const oldIdx = sortedColumns.findIndex((c) => c.id === active.id);
			const newIdx = sortedColumns.findIndex((c) => c.id === over.id);
			if (oldIdx === newIdx) return;

			const reordered = arrayMove(sortedColumns, oldIdx, newIdx);
			const newPosition = generateKeyBetween(
				reordered[newIdx - 1]?.position ?? null,
				reordered[newIdx + 1]?.position ?? null,
			);

			setColumns((prev) =>
				prev.map((c) => (c.id === active.id ? { ...c, position: newPosition } : c)),
			);

			startTransition(async () => {
				await reorderColumns({ columnId: active.id as string, newPosition });
			});
			return;
		}

		if (active.data.current?.type === "card") {
			const activeCard = cards.find((c) => c.id === active.id);
			if (!activeCard) return;

			const overType = over.data.current?.type as "column" | "card" | undefined;
			const overColumnId =
				overType === "column"
					? (over.id as string)
					: (over.data.current?.columnId as string);

			const isNewColumn = activeCard.columnId !== overColumnId;

			const targetColCards = cards
				.filter((c) => c.columnId === overColumnId && c.id !== active.id)
				.sort((a, b) => (a.position < b.position ? -1 : 1));

			let newPosition: string;

			if (overType === "column") {
				newPosition = generateKeyBetween(targetColCards.at(-1)?.position ?? null, null);
			} else {
				const overIdx = targetColCards.findIndex((c) => c.id === over.id);
				newPosition = generateKeyBetween(
					targetColCards[overIdx - 1]?.position ?? null,
					targetColCards[overIdx]?.position ?? null,
				);
			}

			setCards((prev) =>
				prev.map((c) =>
					c.id === active.id ? { ...c, columnId: overColumnId, position: newPosition } : c,
				),
			);

			startTransition(async () => {
				if (isNewColumn) {
					await moveCard({
						cardId: active.id as string,
						newColumnId: overColumnId,
						newPosition,
					});
				} else {
					await reorderCards({ cardId: active.id as string, newPosition });
				}
			});
		}
	}

	if (sortedColumns.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-muted-foreground">No columns yet. Add one to get started.</p>
			</div>
		);
	}

	return (
		<>
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
				<div className="flex h-full gap-3 overflow-x-auto p-4 pb-6">
					{sortedColumns.map((col) => (
						<KanbanColumn
							key={col.id}
							column={col}
							cards={cards.filter((c) => c.columnId === col.id)}
							onCardClick={handleCardClick}
						/>
					))}
				</div>
			</SortableContext>

			<DragOverlay>
				{activeColumn && (
					<KanbanColumnOverlay
						column={activeColumn}
						cardCount={cards.filter((c) => c.columnId === activeColumn.id).length}
					/>
				)}
				{activeCard && <KanbanCardOverlay card={activeCard} />}
			</DragOverlay>
		</DndContext>

		<CardSheet
			card={selectedCard}
			open={sheetOpen}
			onOpenChange={setSheetOpen}
			onUpdate={handleCardUpdate}
			onArchive={handleCardArchive}
		/>
		</>
	);
}
