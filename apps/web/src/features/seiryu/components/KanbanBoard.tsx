"use client";

import {
	archiveCard,
	createCard,
	moveCard,
	reorderCards,
	updateCard,
} from "@/features/seiryu/actions/cards";
import { deleteColumn, reorderColumns, updateColumn } from "@/features/seiryu/actions/columns";
import { AddColumnButton } from "@/features/seiryu/components/AddColumnButton";
import { ArchivedCardsSheet } from "@/features/seiryu/components/ArchivedCardsSheet";
import { CardSheet, type CardUpdates } from "@/features/seiryu/components/CardSheet";
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
import { SeiryuMobileAddFab } from "@/features/seiryu/components/SeiryuMobileAddFab";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import { useServerState } from "@/features/seiryu/lib/server-state";
import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	TouchSensor,
	type UniqueIdentifier,
	closestCenter,
	closestCorners,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
	columns: ColumnData[];
	cards: CardData[];
	projectId: string;
	projectLabels: LabelData[];
}

const byPosition = (a: { position: string }, b: { position: string }) =>
	a.position < b.position ? -1 : 1;

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

/** Position for a card placed at `index` among `others` (the column without that card). */
function positionAt(others: CardData[], index: number) {
	return generateKeyBetween(others[index - 1]?.position ?? null, others[index]?.position ?? null);
}

export function KanbanBoard({
	columns: serverColumns,
	cards: serverCards,
	projectId,
	projectLabels: serverLabels,
}: Props) {
	// Local copies change optimistically; fresh props from each action's re-render replace
	// them once nothing is in flight (see useServerState).
	const {
		state: columns,
		setState: setColumns,
		track: trackColumns,
		reset: resetColumns,
	} = useServerState(serverColumns);
	const {
		state: cards,
		setState: setCards,
		hold: holdCards,
		track: trackCards,
		reset: resetCards,
	} = useServerState(serverCards);
	const { state: projectLabels, setState: setProjectLabels } = useServerState(serverLabels);

	const [activeId, setActiveId] = useState<string | null>(null);
	const [activeType, setActiveType] = useState<"column" | "card" | null>(null);
	const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	// Card drag state: where it started, and the hold that keeps fresh props out meanwhile.
	const dragStart = useRef<{
		cards: CardData[];
		columnId: string;
		release: (sync?: boolean) => void;
	} | null>(null);
	// Latest cards for event handlers, so callbacks stay stable for the memoized columns.
	const cardsRef = useRef(cards);
	cardsRef.current = cards;

	const searchParams = useSearchParams();
	const priorityParam = searchParams.get("priority") ?? "";
	const labelParam = searchParams.get("label") ?? "";
	const activeDue = searchParams.get("due") ?? "";

	const filteredCards = useMemo(() => {
		const priorities = priorityParam.split(",").filter(Boolean);
		const labelIds = labelParam.split(",").filter(Boolean);
		const isFiltered = priorities.length > 0 || labelIds.length > 0 || activeDue !== "";
		return isFiltered ? applyFilters(cards, priorities, labelIds, activeDue) : cards;
	}, [cards, priorityParam, labelParam, activeDue]);

	const cardsByColumn = useMemo(() => {
		const map = new Map<string, CardData[]>();
		for (const card of filteredCards) {
			const list = map.get(card.columnId);
			if (list) list.push(card);
			else map.set(card.columnId, [card]);
		}
		return map;
	}, [filteredCards]);

	const sortedColumns = useMemo(() => [...columns].sort(byPosition), [columns]);
	const columnIds = useMemo(() => sortedColumns.map((c) => c.id), [sortedColumns]);

	const selectedCard = useMemo(
		() => cards.find((c) => c.id === selectedCardId) ?? null,
		[cards, selectedCardId],
	);

	const handleCardOpen = useCallback((cardId: string) => {
		setSelectedCardId(cardId);
		setSheetOpen(true);
	}, []);

	const handleAddCard = useCallback(
		(columnId: string, title: string) => {
			const last = cardsRef.current
				.filter((c) => c.columnId === columnId)
				.sort(byPosition)
				.at(-1);
			const tempId = `temp-${crypto.randomUUID()}`;
			const temp: CardData = {
				id: tempId,
				columnId,
				projectId,
				title,
				description: null,
				priority: null,
				dueDate: null,
				position: generateKeyBetween(last?.position ?? null, null),
				checklistItems: [],
				labels: [],
			};
			setCards((prev) => [...prev, temp]);

			trackCards(createCard({ columnId, projectId, title })).then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					setCards((prev) => prev.filter((c) => c.id !== tempId));
					return;
				}
				setCards((prev) =>
					prev.map((c) =>
						c.id === tempId ? { ...c, id: result.data.id, position: result.data.position } : c,
					),
				);
			});
		},
		[projectId, setCards, trackCards],
	);

	const handleRenameColumn = useCallback(
		(columnId: string, name: string) => {
			setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));
			trackColumns(updateColumn({ columnId, name })).then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					resetColumns();
				}
			});
		},
		[setColumns, trackColumns, resetColumns],
	);

	const handleDeleteColumn = useCallback(
		(columnId: string) => {
			setColumns((prev) => prev.filter((c) => c.id !== columnId));
			setCards((prev) => prev.filter((c) => c.columnId !== columnId));
			trackColumns(trackCards(deleteColumn({ columnId }))).then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					resetColumns();
					resetCards();
				}
			});
		},
		[setColumns, setCards, trackColumns, trackCards, resetColumns, resetCards],
	);

	function handleCardSave(cardId: string, updates: CardUpdates) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
		trackCards(updateCard({ cardId, ...updates })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
			}
		});
	}

	// Checklist and label edits save themselves; this only mirrors them on the board.
	function handleCardChange(cardId: string, updates: Partial<CardData>) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
	}

	function handleCardArchive(cardId: string) {
		setCards((prev) => prev.filter((c) => c.id !== cardId));
		setSheetOpen(false);
		trackCards(archiveCard({ cardId })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
			} else toast.success("Card archived");
		});
	}

	function handleColumnAdded(column: ColumnData) {
		setColumns((prev) => [...prev, column]);
	}

	function handleCardRestore(card: CardData) {
		setCards((prev) => [...prev, card]);
	}

	// Mouse drags after 5 px. Touch needs a 250 ms press first, so swipes over cards scroll
	// the column and the board (PointerSensor + touch-action: none blocked scrolling on phones).
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
	);

	const activeColumn = activeType === "column" ? columns.find((c) => c.id === activeId) : null;
	const activeCard = activeType === "card" ? cards.find((c) => c.id === activeId) : null;

	// Cards target the column under the pointer, then the nearest card in it. Comparing the
	// dragged card's corners instead flips between two columns near their border.
	const lastOverId = useRef<UniqueIdentifier | null>(null);
	const collisionDetection: CollisionDetection = useCallback((args) => {
		const { active, droppableContainers } = args;
		if (active.data.current?.type === "column") {
			return closestCorners({
				...args,
				droppableContainers: droppableContainers.filter((c) => c.data.current?.type === "column"),
			});
		}

		const hits = pointerWithin(args);
		const typeOf = (id: UniqueIdentifier) =>
			droppableContainers.find((c) => c.id === id)?.data.current?.type;
		const cardHit = hits.find((h) => typeOf(h.id) === "card");
		const columnHit = hits.find((h) => typeOf(h.id) === "column");

		let overId: UniqueIdentifier | null = cardHit?.id ?? null;
		if (!overId && columnHit) {
			const inColumn = droppableContainers.filter(
				(c) => c.data.current?.type === "card" && c.data.current?.columnId === columnHit.id,
			);
			overId =
				inColumn.length > 0
					? (closestCenter({ ...args, droppableContainers: inColumn })[0]?.id ?? columnHit.id)
					: columnHit.id;
		}
		// Between columns: keep the last target so dropping there doesn't cancel the move.
		if (overId) lastOverId.current = overId;
		return lastOverId.current ? [{ id: lastOverId.current }] : [];
	}, []);

	function handleDragStart(event: DragStartEvent) {
		lastOverId.current = null;
		const type = event.active.data.current?.type ?? null;
		setActiveId(event.active.id as string);
		setActiveType(type);
		if (type === "card") {
			const card = cards.find((c) => c.id === event.active.id);
			if (card) dragStart.current = { cards, columnId: card.columnId, release: holdCards() };
		}
	}

	// Move the card into the column it hovers, so that column opens a gap for it while dragging.
	function handleDragOver({ active, over }: DragOverEvent) {
		if (!over || over.id === active.id || active.data.current?.type !== "card") return;
		const card = cards.find((c) => c.id === active.id);
		if (!card) return;

		const overIsColumn = over.data.current?.type === "column";
		const overColumnId = overIsColumn ? (over.id as string) : over.data.current?.columnId;
		if (!overColumnId || overColumnId === card.columnId) return;

		const target = cards.filter((c) => c.columnId === overColumnId).sort(byPosition);
		let index = target.length;
		if (!overIsColumn) {
			const overIndex = target.findIndex((c) => c.id === over.id);
			const translated = active.rect.current.translated;
			const below = translated && translated.top > over.rect.top + over.rect.height / 2;
			if (overIndex !== -1) index = overIndex + (below ? 1 : 0);
		}
		const position = positionAt(target, index);

		setCards((prev) =>
			prev.map((c) => (c.id === card.id ? { ...c, columnId: overColumnId, position } : c)),
		);
	}

	function handleDragCancel() {
		const start = dragStart.current;
		dragStart.current = null;
		setActiveId(null);
		setActiveType(null);
		if (start) {
			setCards(start.cards);
			start.release(true);
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveId(null);
		setActiveType(null);

		if (active.data.current?.type === "column") {
			if (!over || active.id === over.id) return;
			const oldIdx = sortedColumns.findIndex((c) => c.id === active.id);
			const newIdx = sortedColumns.findIndex((c) => c.id === over.id);
			if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

			const reordered = arrayMove(sortedColumns, oldIdx, newIdx);
			const newPosition = generateKeyBetween(
				reordered[newIdx - 1]?.position ?? null,
				reordered[newIdx + 1]?.position ?? null,
			);

			setColumns((prev) =>
				prev.map((c) => (c.id === active.id ? { ...c, position: newPosition } : c)),
			);
			trackColumns(reorderColumns({ columnId: active.id as string, newPosition })).then(
				(result) => {
					if ("error" in result) {
						toast.error(result.error);
						resetColumns();
					}
				},
			);
			return;
		}

		const start = dragStart.current;
		dragStart.current = null;
		if (!start) return;

		const card = cards.find((c) => c.id === active.id);
		if (!card || !over) {
			setCards(start.cards);
			start.release(true);
			return;
		}

		// handleDragOver already put the card in its final column; settle the order inside it.
		let position = card.position;
		const column = cards.filter((c) => c.columnId === card.columnId).sort(byPosition);
		const oldIdx = column.findIndex((c) => c.id === card.id);
		const newIdx = column.findIndex((c) => c.id === over.id);
		if (newIdx !== -1 && newIdx !== oldIdx) {
			const reordered = arrayMove(column, oldIdx, newIdx);
			position = generateKeyBetween(
				reordered[newIdx - 1]?.position ?? null,
				reordered[newIdx + 1]?.position ?? null,
			);
			setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, position } : c)));
		}

		const original = start.cards.find((c) => c.id === card.id);
		const moved = card.columnId !== start.columnId;
		if (!moved && position === original?.position) {
			start.release(true);
			return;
		}

		const save = moved
			? moveCard({ cardId: card.id, newColumnId: card.columnId, newPosition: position })
			: reorderCards({ cardId: card.id, newPosition: position });
		trackCards(save).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
			}
		});
		start.release();
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
						collisionDetection={collisionDetection}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragEnd={handleDragEnd}
						onDragCancel={handleDragCancel}
					>
						<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
							<div className="relative flex-1">
								<div className="absolute inset-0 flex gap-3 overflow-x-auto p-4 pb-6">
									{sortedColumns.map((col) => (
										<KanbanColumn
											key={col.id}
											column={col}
											cards={cardsByColumn.get(col.id) ?? NO_CARDS}
											onCardOpen={handleCardOpen}
											onAddCard={handleAddCard}
											onRename={handleRenameColumn}
											onDelete={handleDeleteColumn}
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
									cardCount={cardsByColumn.get(activeColumn.id)?.length ?? 0}
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
						onSave={handleCardSave}
						onChange={handleCardChange}
						onArchive={handleCardArchive}
						onProjectLabelsChange={setProjectLabels}
					/>
				</>
			)}

			<SeiryuMobileAddFab columns={sortedColumns} onAddCard={handleAddCard} />
		</div>
	);
}

const NO_CARDS: CardData[] = [];
