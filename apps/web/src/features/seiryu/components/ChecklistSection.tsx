"use client";

import { Spinner } from "@/components/Spinner";
import {
	createChecklistItem,
	deleteChecklistItem,
	reorderChecklistItems,
	toggleChecklistItem,
} from "@/features/seiryu/actions/checklist";
import type { ChecklistItemData } from "@/features/seiryu/components/KanbanCard";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	DndContext,
	type DragEndEvent,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	cardId: string;
	initialItems: ChecklistItemData[];
	onChange?: (items: ChecklistItemData[]) => void;
}

function SortableChecklistItem({
	item,
	onToggle,
	onDelete,
}: {
	item: ChecklistItemData;
	onToggle: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		disabled: item.id.startsWith("temp-"),
	});
	const style = { transform: CSS.Transform.toString(transform), transition };

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn("group flex items-center gap-2", isDragging && "opacity-40")}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				className="cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
				aria-label="Drag to reorder"
			>
				⠿
			</button>
			<input
				type="checkbox"
				checked={item.isCompleted}
				onChange={() => onToggle(item.id)}
				className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded-sm accent-primary"
			/>
			<span
				className={cn(
					"flex-1 text-xs",
					item.isCompleted && "text-muted-foreground line-through",
				)}
			>
				{item.title}
			</span>
			<button
				type="button"
				onClick={() => onDelete(item.id)}
				className="invisible text-xs text-muted-foreground transition-colors hover:text-destructive group-hover:visible"
			>
				✕
			</button>
		</div>
	);
}

export function ChecklistSection({ cardId, initialItems, onChange }: Props) {
	const [items, setItems] = useState(initialItems);
	const [newTitle, setNewTitle] = useState("");
	const [isAdding, startAdd] = useTransition();
	const [, startReorder] = useTransition();

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const sortedItems = [...items].sort((a, b) => {
		if (!a.position) return 1;
		if (!b.position) return -1;
		return a.position < b.position ? -1 : 1;
	});

	function update(next: ChecklistItemData[]) {
		setItems(next);
		onChange?.(next);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIdx = sortedItems.findIndex((i) => i.id === active.id);
		const newIdx = sortedItems.findIndex((i) => i.id === over.id);
		if (oldIdx === -1 || newIdx === -1) return;

		const reordered = arrayMove(sortedItems, oldIdx, newIdx);
		const newPosition = generateKeyBetween(
			reordered[newIdx - 1]?.position ?? null,
			reordered[newIdx + 1]?.position ?? null,
		);

		update(items.map((i) => (i.id === active.id ? { ...i, position: newPosition } : i)));

		startReorder(async () => {
			const result = await reorderChecklistItems({ itemId: active.id as string, newPosition });
			if ("error" in result) {
				toast.error(result.error);
				update(items);
			}
		});
	}

	function handleAdd() {
		const title = newTitle.trim();
		if (!title) return;
		setNewTitle("");

		const tempId = `temp-${Math.random()}`;
		const optimistic: ChecklistItemData = { id: tempId, title, isCompleted: false, position: "" };
		update([...items, optimistic]);

		startAdd(async () => {
			const result = await createChecklistItem({ cardId, title });
			if ("error" in result) {
				toast.error(result.error);
				setItems((prev) => {
					const next = prev.filter((i) => i.id !== tempId);
					onChange?.(next);
					return next;
				});
				return;
			}
			setItems((prev) => {
				const next = prev
					.filter((i) => i.id !== tempId)
					.concat({ id: result.data.id, title, isCompleted: false, position: result.data.position });
				onChange?.(next);
				return next;
			});
		});
	}

	async function handleToggle(itemId: string) {
		const prev = items;
		update(prev.map((i) => (i.id === itemId ? { ...i, isCompleted: !i.isCompleted } : i)));

		const result = await toggleChecklistItem({ itemId });
		if ("error" in result) {
			toast.error(result.error);
			update(prev);
		}
	}

	async function handleDelete(itemId: string) {
		const prev = items;
		update(prev.filter((i) => i.id !== itemId));

		const result = await deleteChecklistItem({ itemId });
		if ("error" in result) {
			toast.error(result.error);
			update(prev);
		}
	}

	const done = items.filter((i) => i.isCompleted).length;
	const total = items.length;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-muted-foreground">Checklist</span>
				{total > 0 && (
					<span className="text-xs text-muted-foreground">
						{done}/{total}
					</span>
				)}
			</div>

			{total > 0 && (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					<SortableContext items={sortedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
						<div className="flex flex-col gap-1">
							{sortedItems.map((item) => (
								<SortableChecklistItem
									key={item.id}
									item={item}
									onToggle={handleToggle}
									onDelete={handleDelete}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<div className="flex items-center gap-2">
				<input
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							if (!isAdding) handleAdd();
						}
					}}
					placeholder="Add item…"
					className="flex-1 rounded border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<button
					type="button"
					disabled={isAdding || !newTitle.trim()}
					onClick={handleAdd}
					className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
				>
					{isAdding ? <Spinner className="h-3 w-3" /> : "Add"}
				</button>
			</div>
		</div>
	);
}
