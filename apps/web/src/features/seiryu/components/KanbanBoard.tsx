"use client";

import { moveCard, reorderCards } from "@/features/seiryu/actions/cards";
import { reorderColumns } from "@/features/seiryu/actions/columns";
import { AddColumnButton } from "@/features/seiryu/components/AddColumnButton";
import { ArchivedCardsSheet } from "@/features/seiryu/components/ArchivedCardsSheet";
import { CardSheet } from "@/features/seiryu/components/CardSheet";
import { FilterBar } from "@/features/seiryu/components/FilterBar";
import {
	type CardData,
	KanbanCardOverlay,
	type LabelData,
} from "@/features/seiryu/components/KanbanCard";
import {
	type ColumnData,
	KanbanColumn,
	KanbanColumnOverlay,
} from "@/features/seiryu/components/KanbanColumn";
import { TassoMobileAddFab } from "@/features/seiryu/components/TassoMobileAddFab";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	closestCorners,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
	columns: ColumnData[];
	cards: CardData[];
	projectId: string;
	projectLabels: LabelData[];
}

type Priority = "low" | "medium" | "high" | "urgent";

function applyFilters(
	cards: CardData[],
	priorities: string[],
	labelIds: string[],
	due: string,
): CardData[] {
	return cards.filter((card) => {
		if (priorities.length > 0 && !priorities.includes(card.priority ?? "")) return false;
		if (labelIds.length > 0 && !card.labels.some((l) => labelIds.includes(l.id))) return false;
		if (due) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (due === "none") return card.dueDate === null;
			if (!card.dueDate) return false;
			const [y, m, d] = card.dueDate.split("-").map(Number) as [number, number, number];
			const dueDate = new Date(y, m - 1, d);
			if (due === "overdue") return dueDate < today;
			if (due === "today") return dueDate.getTime() === today.getTime();
			if (due === "week") {
				const weekEnd = new Date(today);
				weekEnd.setDate(today.getDate() + 7);
				return dueDate >= today && dueDate <= weekEnd;
			}
		}
		return true;
	});
}

export function KanbanBoard({
	columns: initialColumns,
	cards: initialCards,
	projectId,
	projectLabels: initialProjectLabels,
}: Props) {
	const [columns, setColumns] = useState(initialColumns);
	const [cards, setCards] = useState(initialCards);
	const [projectLabels, setProjectLabels] = useState(initialProjectLabels);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [activeType, setActiveType] = useState<"column" | "card" | null>(null);
	const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [, startTransition] = useTransition();

	const searchParams = useSearchParams();
	const activePriorities = (searchParams.get("priority") ?? "").split(",").filter(Boolean);
	const activeLabels = (searchParams.get("label") ?? "").split(",").filter(Boolean);
	const activeDue = searchParams.get("due") ?? "";
	const isFiltered = activePriorities.length > 0 || activeLabels.length > 0 || activeDue !== "";
	const filteredCards = isFiltered
		? applyFilters(cards, activePriorities, activeLabels, activeDue)
		: cards;

	function handleCardClick(card: CardData) {
		setSelectedCard(card);
		setSheetOpen(true);
	}

	function handleCardUpdate(
		cardId: string,
		updates: Partial<
			Pick<CardData, "title" | "description" | "priority" | "dueDate" | "checklistItems" | "labels">
		>,
	) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
		setSelectedCard((prev) => (prev?.id === cardId ? { ...prev, ...updates } : prev));
	}

	function handleCardArchive(cardId: string) {
		setCards((prev) => prev.filter((c) => c.id !== cardId));
		setSheetOpen(false);
	}

	function handleColumnAdded(column: ColumnData) {
		setColumns((prev) => [...prev, column]);
	}

	function handleCardRestore(card: CardData) {
		setCards((prev) => [...prev, card]);
	}

	function handleCardAdded(card: CardData) {
		setCards((prev) => [...prev, card]);
	}

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
				overType === "column" ? (over.id as string) : (over.data.current?.columnId as string);

			const isNewColumn = activeCard.columnId !== overColumnId;

			const targetColCards = cards
				.filter((c) => c.columnId === overColumnId && c.id !== active.id)
				.sort((a, b) => (a.position < b.position ? -1 : 1));

			let newPosition: string;

			if (overType === "column") {
				newPosition = generateKeyBetween(targetColCards.at(-1)?.position ?? null, null);
			} else {
				const overIdx = targetColCards.findIndex((c) => c.id === over.id);
				if (overIdx === -1) return;
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

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
				<div className="flex-1">
					<FilterBar projectLabels={projectLabels} />
				</div>
				<ArchivedCardsSheet
					projectId={projectId}
					columns={columns}
					onCardRestore={handleCardRestore}
				/>
			</div>

			{sortedColumns.length === 0 ? (
				<div className="flex flex-1 items-center justify-center gap-4">
					<p className="text-sm text-muted-foreground">No columns yet.</p>
					<AddColumnButton projectId={projectId} onColumnAdded={handleColumnAdded} />
				</div>
			) : (
				<>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCorners}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					>
						<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
							<div className="relative flex-1">
								<div className="absolute inset-0 flex gap-3 overflow-x-auto p-4 pb-6">
									{sortedColumns.map((col) => (
										<KanbanColumn
											key={col.id}
											column={col}
											cards={filteredCards.filter((c) => c.columnId === col.id)}
											onCardClick={handleCardClick}
											onCardAdded={handleCardAdded}
										/>
									))}
									<AddColumnButton projectId={projectId} onColumnAdded={handleColumnAdded} />
								</div>
							</div>
						</SortableContext>

						<DragOverlay>
							{activeColumn && (
								<KanbanColumnOverlay
									column={activeColumn}
									cardCount={filteredCards.filter((c) => c.columnId === activeColumn.id).length}
								/>
							)}
							{activeCard && <KanbanCardOverlay card={activeCard} />}
						</DragOverlay>
					</DndContext>

					<CardSheet
						card={selectedCard}
						open={sheetOpen}
						onOpenChange={setSheetOpen}
						projectLabels={projectLabels}
						onUpdate={handleCardUpdate}
						onArchive={handleCardArchive}
						onProjectLabelsChange={setProjectLabels}
					/>
				</>
			)}

			<TassoMobileAddFab
				columns={sortedColumns}
				projectId={projectId}
				onCardAdded={handleCardAdded}
			/>
		</div>
	);
}
