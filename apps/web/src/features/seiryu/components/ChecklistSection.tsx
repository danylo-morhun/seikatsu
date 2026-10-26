"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { reorderChecklistItems } from "@/features/seiryu/actions/checklist";
import {
	addChecklistItem,
	removeChecklistItem,
	renameChecklistItem,
	setChecklistItem,
} from "@/features/seiryu/lib/offline";
import { overlayChecklist } from "@/features/seiryu/lib/overlay";
import { type ChecklistItemData, isTempId } from "@/features/seiryu/lib/types";
import { useDraft } from "@/hooks/useDraft";
import { BAR_FILL, barClip } from "@/lib/bar";
import { generateKeyBetween } from "@/lib/position";
import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	type Modifier,
	MouseSensor,
	TouchSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Checkbox, Input, cn } from "@seikatsu/ui";
import { memo, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const byPosition = (a: ChecklistItemData, b: ChecklistItemData) =>
	a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// Same rhythm as the board: settle on the strong ease-out, quicker than a page move.
const SORT_TRANSITION = { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

interface Props {
	cardId: string;
	initialItems: ChecklistItemData[];
	/** Mirrors every change to the board, so the card's N/M updates live. */
	onChange?: (items: ChecklistItemData[]) => void;
}

export function ChecklistSection({ cardId, initialItems, onChange }: Props) {
	const [items, setItems] = useState(initialItems);
	const itemsRef = useRef(items);
	const [newTitle, setNewTitle] = useState("");
	const [adding, setAdding] = useState(false);
	const dndId = useId();
	const inputId = useId();

	// Mouse drags after 5px; touch after a 250ms press so swipes still scroll the sheet.
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// Item changes queued offline show until the server has them; re-applying the ones made
	// here is a no-op (lib/overlay.ts).
	const pending = usePendingOps("seiryu.");
	const shown = useMemo(() => overlayChecklist(cardId, items, pending), [cardId, items, pending]);
	// Handlers read the shown list, so an item restored from the queue can be ticked too.
	itemsRef.current = shown;
	const sorted = useMemo(() => [...shown].sort(byPosition), [shown]);
	const done = shown.filter((i) => i.isCompleted).length;
	const total = shown.length;

	function update(next: ChecklistItemData[]) {
		itemsRef.current = next;
		setItems(next);
		onChange?.(next);
	}

	function patch(itemId: string, changes: Partial<ChecklistItemData>) {
		update(itemsRef.current.map((i) => (i.id === itemId ? { ...i, ...changes } : i)));
	}

	async function run(mutation: Promise<{ error: string } | { success: true }>, undo: () => void) {
		const result = await mutation;
		if ("error" in result) {
			toast.error(result.error);
			undo();
		}
	}

	function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title) return;
		setNewTitle("");

		const last = [...itemsRef.current].sort(byPosition).at(-1);
		// The id is made here: an item queued offline can be ticked and renamed at once.
		const id = crypto.randomUUID();
		const tempId = `temp-${id}`;
		update([
			...itemsRef.current,
			{
				id: tempId,
				clientKey: tempId,
				title,
				isCompleted: false,
				position: generateKeyBetween(last?.position ?? null, null),
			},
		]);

		addChecklistItem(id, cardId, title).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				update(itemsRef.current.filter((i) => i.id !== tempId));
				return;
			}
			patch(tempId, { id });
		});
	}

	function handleToggle(itemId: string) {
		const item = itemsRef.current.find((i) => i.id === itemId);
		if (!item) return;
		patch(itemId, { isCompleted: !item.isCompleted });
		run(setChecklistItem(itemId, item.title, !item.isCompleted), () =>
			patch(itemId, { isCompleted: item.isCompleted }),
		);
	}

	function handleRename(itemId: string, title: string) {
		const item = itemsRef.current.find((i) => i.id === itemId);
		if (!item || title === item.title) return;
		patch(itemId, { title });
		run(renameChecklistItem(itemId, title), () => patch(itemId, { title: item.title }));
	}

	function handleDelete(itemId: string) {
		const before = itemsRef.current;
		const title = before.find((i) => i.id === itemId)?.title ?? "item";
		update(before.filter((i) => i.id !== itemId));
		run(removeChecklistItem(itemId, title), () => update(before));
	}

	function handleDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return;
		const oldIdx = sorted.findIndex((i) => i.id === active.id);
		const newIdx = sorted.findIndex((i) => i.id === over.id);
		if (oldIdx === -1 || newIdx === -1) return;

		const reordered = arrayMove(sorted, oldIdx, newIdx);
		const newPosition = generateKeyBetween(
			reordered[newIdx - 1]?.position ?? null,
			reordered[newIdx + 1]?.position ?? null,
		);
		const itemId = active.id as string;
		const oldPosition = sorted[oldIdx]?.position ?? newPosition;
		patch(itemId, { position: newPosition });
		run(reorderChecklistItems({ itemId, newPosition }), () =>
			patch(itemId, { position: oldPosition }),
		);
	}

	return (
		<section aria-labelledby={`${inputId}-title`} className="space-y-3">
			<div className="flex items-baseline justify-between gap-3">
				<h3 id={`${inputId}-title`} className="text-sm font-medium">
					Checklist
				</h3>
				{total > 0 && (
					<span className="text-xs tabular-nums text-muted-foreground">
						{done}/{total}
					</span>
				)}
			</div>

			{total > 0 && (
				<>
					<div className="relative h-1 overflow-hidden rounded-full bg-surface-2">
						<div
							className={cn(BAR_FILL, "absolute inset-0 rounded-full bg-primary/80")}
							style={barClip(done / total)}
						/>
					</div>
					<DndContext
						id={dndId}
						sensors={sensors}
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragEnd={handleDragEnd}
					>
						<SortableContext items={sorted.map((i) => i.id)} strategy={verticalListSortingStrategy}>
							<ul className="-mx-2">
								{sorted.map((item) => (
									<ChecklistRow
										key={item.clientKey ?? item.id}
										item={item}
										onToggle={handleToggle}
										onRename={handleRename}
										onDelete={handleDelete}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				</>
			)}

			{adding ? (
				<form onSubmit={handleAdd} className="animate-swap flex gap-1.5">
					<label htmlFor={inputId} className="sr-only">
						New checklist item
					</label>
					<Input
						id={inputId}
						autoFocus
						value={newTitle}
						maxLength={500}
						autoComplete="off"
						enterKeyHint="enter"
						onChange={(e) => setNewTitle(e.target.value)}
						onBlur={() => !newTitle.trim() && setAdding(false)}
						onKeyDown={(e) => {
							// Closes the field, not the sheet around it.
							if (e.key === "Escape") {
								e.stopPropagation();
								setNewTitle("");
								setAdding(false);
							}
						}}
						placeholder="Add an item…"
					/>
					<Button type="submit" variant="outline" disabled={!newTitle.trim()}>
						Add
					</Button>
				</form>
			) : (
				<QuietAdd onClick={() => setAdding(true)}>Add item</QuietAdd>
			)}
		</section>
	);
}

const ChecklistRow = memo(function ChecklistRow({
	item,
	onToggle,
	onRename,
	onDelete,
}: {
	item: ChecklistItemData;
	onToggle: (id: string) => void;
	onRename: (id: string, title: string) => void;
	onDelete: (id: string) => void;
}) {
	const isTemp = isTempId(item.id);
	const checkboxId = useId();
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		disabled: isTemp,
		transition: SORT_TRANSITION,
	});
	const { draft, change, flush, revert } = useDraft(item.title, (title) => {
		const trimmed = title.trim();
		if (trimmed) onRename(item.id, trimmed);
		else revert();
	});

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"group flex items-center gap-1 rounded-md px-0.5 transition-colors duration-150 hover:bg-surface",
				item.clientKey && "animate-drop",
				isDragging && "relative z-10 bg-surface shadow-[0_24px_48px_-16px_oklch(0_0_0/55%)]",
			)}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				disabled={isTemp}
				aria-label={`Reorder ${item.title}`}
				className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/50 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-default disabled:opacity-0"
			>
				<HugeiconsIcon icon={DragDropVerticalIcon} className="h-4 w-4" />
			</button>
			<Checkbox
				id={checkboxId}
				checked={item.isCompleted}
				disabled={isTemp}
				onCheckedChange={() => onToggle(item.id)}
				aria-label={item.title}
			/>
			<input
				value={draft}
				disabled={isTemp}
				maxLength={500}
				aria-label={`Rename ${item.title}`}
				onChange={(e) => change(e.target.value)}
				onBlur={flush}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") {
						// Esc undoes the edit; it shouldn't also close the sheet.
						e.stopPropagation();
						revert();
						e.currentTarget.blur();
					}
				}}
				className={cn(
					"h-9 min-w-0 flex-1 rounded bg-transparent px-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
					item.isCompleted && "text-muted-foreground line-through decoration-muted-foreground/60",
				)}
			/>
			<button
				type="button"
				onClick={() => onDelete(item.id)}
				disabled={isTemp}
				aria-label={`Delete ${item.title}`}
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0"
			>
				<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
			</button>
		</li>
	);
});
