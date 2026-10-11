"use client";

import {
	archiveCard,
	createCard,
	deleteCard,
	moveCard,
	reorderCards,
	restoreCard,
	updateCard,
} from "@/features/seiryu/actions/cards";
import { deleteColumn, reorderColumns, updateColumn } from "@/features/seiryu/actions/columns";
import { AddColumnButton } from "@/features/seiryu/components/AddColumnButton";
import { CardSheet } from "@/features/seiryu/components/CardSheet";
import { FilterChips, FilterMenu } from "@/features/seiryu/components/FilterMenu";
import { KanbanCardOverlay, freshCards } from "@/features/seiryu/components/KanbanCard";
import { KanbanColumn, KanbanColumnOverlay } from "@/features/seiryu/components/KanbanColumn";
import { NewCardDialog } from "@/features/seiryu/components/NewCardDialog";
import { NEW_CARD_EVENT } from "@/features/seiryu/lib/events";
import {
	type Filters,
	applyFilters,
	filterCount,
	readFilters,
	writeFilters,
} from "@/features/seiryu/lib/filters";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import { useServerState } from "@/features/seiryu/lib/server-state";
import type {
	CardData,
	CardFieldUpdates,
	ColumnData,
	ColumnUpdates,
	LabelData,
} from "@/features/seiryu/lib/types";
import { OVERLAY_SELECTOR, isEditable, shouldOpenCapture } from "@/lib/capture-shortcut";
import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	type DropAnimation,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	type UniqueIdentifier,
	closestCenter,
	closestCorners,
	defaultDropAnimationSideEffects,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	horizontalListSortingStrategy,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Archive01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	project: { id: string; name: string };
	columns: ColumnData[];
	cards: CardData[];
	projectLabels: LabelData[];
	/** The user's calendar day (tz cookie), so "overdue" matches on server and client. */
	today: string;
}

const byPosition = (a: { position: string }, b: { position: string }) =>
	a.position < b.position ? -1 : 1;

/** Position for a card placed at `index` among `others` (the column without that card). */
function positionAt(others: CardData[], index: number) {
	return generateKeyBetween(others[index - 1]?.position ?? null, others[index]?.position ?? null);
}

// The dropped card settles into its slot on the strong ease-out; the slot holds until it lands.
const DROP_ANIMATION: DropAnimation = {
	duration: 220,
	easing: "cubic-bezier(0.23, 1, 0.32, 1)",
	sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

export function KanbanBoard({
	project,
	columns: serverColumns,
	cards: serverCards,
	projectLabels: serverLabels,
	today,
}: Props) {
	const projectId = project.id;
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
	const [capture, setCapture] = useState<{ open: boolean; instant: boolean }>({
		open: false,
		instant: false,
	});

	// Card drag state: where it started, and the hold that keeps fresh props out meanwhile.
	const dragStart = useRef<{
		cards: CardData[];
		columnId: string;
		release: (sync?: boolean) => void;
	} | null>(null);
	// Latest cards for event handlers, so callbacks stay stable for the memoized columns.
	const cardsRef = useRef(cards);
	cardsRef.current = cards;

	// A stable id keeps dnd-kit's aria ids equal on server and client (no hydration mismatch).
	const dndId = useId();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isFiltering, startFilter] = useTransition();
	const urlFilters = useMemo(() => readFilters(searchParams), [searchParams]);
	// The menu stays open for several quick picks; each builds on the last one, not on a URL
	// that hasn't caught up yet. The URL takes over again once no replace is pending.
	const [filters, setLocalFilters] = useState(urlFilters);
	useEffect(() => {
		if (!isFiltering) setLocalFilters(urlFilters);
	}, [urlFilters, isFiltering]);
	const isFiltered = filterCount(filters) > 0;

	function setFilters(next: Filters) {
		setLocalFilters(next);
		const query = writeFilters(searchParams, next).toString();
		startFilter(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
	}

	const filteredCards = useMemo(() => applyFilters(cards, filters, today), [cards, filters, today]);

	const cardsByColumn = useMemo(() => groupByColumn(filteredCards), [filteredCards]);
	const totalsByColumn = useMemo(() => {
		const totals = new Map<string, number>();
		for (const card of cards) totals.set(card.columnId, (totals.get(card.columnId) ?? 0) + 1);
		return totals;
	}, [cards]);

	const sortedColumns = useMemo(() => [...columns].sort(byPosition), [columns]);
	const columnIds = useMemo(() => sortedColumns.map((c) => c.id), [sortedColumns]);

	const selectedCard = useMemo(
		() => cards.find((c) => c.id === selectedCardId) ?? null,
		[cards, selectedCardId],
	);

	// "N" (and the header's New Card button) open capture; Kuroji's rule decides when N is free.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const context = {
				editableFocused: isEditable(e.target),
				overlayOpen: !!document.querySelector(OVERLAY_SELECTOR),
			};
			if (!shouldOpenCapture(e, context)) return;
			e.preventDefault();
			setCapture({ open: true, instant: true });
		}
		function onRequest() {
			setCapture({ open: true, instant: false });
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(NEW_CARD_EVENT, onRequest);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(NEW_CARD_EVENT, onRequest);
		};
	}, []);

	// Arriving from the bottom nav's add button on another page: open capture, drop the flag.
	const wantsNew = searchParams.get("new") === "1";
	useEffect(() => {
		if (!wantsNew) return;
		setCapture({ open: true, instant: false });
		const rest = new URLSearchParams(searchParams.toString());
		rest.delete("new");
		const query = rest.toString();
		router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
	}, [wantsNew, searchParams, pathname, router]);

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
			freshCards.add(tempId);
			const temp: CardData = {
				id: tempId,
				clientKey: tempId,
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

	const handleUpdateColumn = useCallback(
		(columnId: string, updates: ColumnUpdates) => {
			setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...updates } : c)));
			trackColumns(updateColumn({ columnId, ...updates })).then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					resetColumns();
				}
			});
		},
		[setColumns, trackColumns, resetColumns],
	);

	const handleDeleteColumn = useCallback(
		async (columnId: string) => {
			const result = await trackColumns(trackCards(deleteColumn({ columnId })));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			setColumns((prev) => prev.filter((c) => c.id !== columnId));
			setCards((prev) => prev.filter((c) => c.columnId !== columnId));
		},
		[setColumns, setCards, trackColumns, trackCards],
	);

	function handleCardSave(cardId: string, updates: CardFieldUpdates) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
		trackCards(updateCard({ cardId, ...updates })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
			}
		});
	}

	// From the sheet's Column picker: to the end of that column.
	function handleCardMove(cardId: string, columnId: string) {
		const last = cardsRef.current
			.filter((c) => c.columnId === columnId && c.id !== cardId)
			.sort(byPosition)
			.at(-1);
		const newPosition = generateKeyBetween(last?.position ?? null, null);
		setCards((prev) =>
			prev.map((c) => (c.id === cardId ? { ...c, columnId, position: newPosition } : c)),
		);
		trackCards(moveCard({ cardId, newColumnId: columnId, newPosition })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
			}
		});
	}

	async function handleCardDelete(cardId: string) {
		const result = await trackCards(deleteCard({ cardId }));
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		setSheetOpen(false);
		setCards((prev) => prev.filter((c) => c.id !== cardId));
	}

	// Checklist and label edits save themselves; this only mirrors them on the board.
	function handleCardChange(cardId: string, updates: Partial<CardData>) {
		setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
	}

	function handleCardArchive(cardId: string) {
		const card = cardsRef.current.find((c) => c.id === cardId);
		setCards((prev) => prev.filter((c) => c.id !== cardId));
		setSheetOpen(false);
		trackCards(archiveCard({ cardId })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				resetCards();
				return;
			}
			// Archiving is one tap away from a slip of the finger: offer the way back.
			toast("Card archived", {
				description: card?.title,
				action: {
					label: "Undo",
					onClick: () => {
						trackCards(restoreCard({ cardId })).then((restored) => {
							if ("error" in restored) toast.error(restored.error);
							else if (card)
								setCards((prev) => [
									...prev,
									{ ...card, columnId: restored.data.columnId, position: restored.data.position },
								]);
						});
					},
				},
			});
		});
	}

	function handleColumnAdded(column: ColumnData) {
		setColumns((prev) => [...prev, column]);
	}

	// Mouse drags after 5 px. Touch needs a 250 ms press first, so swipes over cards scroll
	// the column and the board (PointerSensor + touch-action: none blocked scrolling on phones).
	// Space lifts a focused card for the keyboard; arrows move it, Space drops it.
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
		// The keyboard has no pointer: nearest target wins.
		if (!args.pointerCoordinates) return closestCorners(args);

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

	// More lanes past an edge: fade that edge, so the board doesn't look like it ends there.
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState({ start: false, end: false });
	const updateEdges = useCallback(() => {
		const el = scrollerRef.current;
		if (!el) return;
		const start = el.scrollLeft > 1;
		const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
		setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
	}, []);
	useEffect(() => {
		const el = scrollerRef.current;
		if (!el) return;
		updateEdges();
		const observer = new ResizeObserver(updateEdges);
		observer.observe(el);
		for (const child of el.children) observer.observe(child);
		return () => observer.disconnect();
	}, [updateEdges, columns.length]);

	const nothingMatches = isFiltered && filteredCards.length === 0 && cards.length > 0;

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-6 pb-4 sm:px-8 md:pt-8">
				<h1 className="min-w-0 max-w-full truncate text-xl font-semibold">{project.name}</h1>
				<div className="flex items-center gap-1.5">
					<FilterMenu filters={filters} labels={projectLabels} onChange={setFilters} />
					<Button asChild variant="ghost" className="gap-1.5 text-muted-foreground">
						<Link href="/settings/seiryu?section=archive" prefetch>
							<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4" />
							<span className="max-sm:sr-only">Archived</span>
						</Link>
					</Button>
				</div>
				<FilterChips filters={filters} labels={projectLabels} onChange={setFilters} />
			</div>

			{nothingMatches && (
				<p className="animate-swap px-4 pb-2 text-sm text-muted-foreground sm:px-8">
					No cards match these filters.{" "}
					<button
						type="button"
						onClick={() => setFilters({ priorities: [], labelIds: [], due: "" })}
						className="text-foreground underline-offset-4 hover:underline"
					>
						Clear filters
					</button>
				</p>
			)}

			{sortedColumns.length === 0 ? (
				<div className="flex flex-col items-start gap-4 px-4 py-16 sm:px-8">
					<div>
						<p className="font-medium">No columns yet</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Columns are the stages a card moves through, like Todo, Doing and Done.
						</p>
					</div>
					<AddColumnButton projectId={projectId} onColumnAdded={handleColumnAdded} />
				</div>
			) : (
				<DndContext
					id={dndId}
					sensors={sensors}
					collisionDetection={collisionDetection}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
					onDragCancel={handleDragCancel}
				>
					<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
						<div className="relative min-h-0 flex-1">
							<div
								ref={scrollerRef}
								onScroll={updateEdges}
								className={cn(
									"absolute inset-0 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-28 sm:scroll-px-8 sm:px-8 md:snap-none md:pb-8 [scrollbar-width:thin]",
									EDGE_FADE[`${edges.start ? "s" : ""}${edges.end ? "e" : ""}`],
								)}
							>
								{sortedColumns.map((col, i) => (
									<KanbanColumn
										key={col.id}
										column={col}
										index={i}
										today={today}
										cards={cardsByColumn.get(col.id) ?? NO_CARDS}
										total={totalsByColumn.get(col.id) ?? 0}
										onCardOpen={handleCardOpen}
										onAddCard={handleAddCard}
										onUpdate={handleUpdateColumn}
										onDelete={handleDeleteColumn}
									/>
								))}
								<AddColumnButton
									projectId={projectId}
									onColumnAdded={handleColumnAdded}
									className="animate-rise pr-4 sm:pr-8"
								/>
							</div>
						</div>
					</SortableContext>

					<DragOverlay dropAnimation={DROP_ANIMATION}>
						{activeColumn && (
							<KanbanColumnOverlay
								column={activeColumn}
								cardCount={cardsByColumn.get(activeColumn.id)?.length ?? 0}
							/>
						)}
						{activeCard && <KanbanCardOverlay card={activeCard} today={today} />}
					</DragOverlay>
				</DndContext>
			)}

			<CardSheet
				card={selectedCard}
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				columns={sortedColumns}
				projectLabels={projectLabels}
				onSave={handleCardSave}
				onMove={handleCardMove}
				onChange={handleCardChange}
				onArchive={handleCardArchive}
				onDelete={handleCardDelete}
				onProjectLabelsChange={setProjectLabels}
			/>

			<NewCardDialog
				open={capture.open}
				instant={capture.instant}
				onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
				columns={sortedColumns}
				onAdd={handleAddCard}
			/>
		</div>
	);
}

const NO_CARDS: CardData[] = [];

const EDGE_FADE: Record<string, string> = {
	"": "",
	s: "md:[mask-image:linear-gradient(to_right,transparent,#000_3rem)]",
	e: "md:[mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)]",
	se: "md:[mask-image:linear-gradient(to_right,transparent,#000_3rem,#000_calc(100%-3rem),transparent)]",
};

function groupByColumn(cards: CardData[]) {
	const map = new Map<string, CardData[]>();
	for (const card of cards) {
		const list = map.get(card.columnId);
		if (list) list.push(card);
		else map.set(card.columnId, [card]);
	}
	return map;
}
