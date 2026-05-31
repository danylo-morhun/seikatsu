"use client";

import { Spinner } from "@/components/Spinner";
import {
	createChecklistItem,
	deleteChecklistItem,
	toggleChecklistItem,
} from "@/features/tasso/actions/checklist";
import type { ChecklistItemData } from "@/features/tasso/components/KanbanCard";
import { cn } from "@ethos/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	cardId: string;
	initialItems: ChecklistItemData[];
	onChange?: (items: ChecklistItemData[]) => void;
}

export function ChecklistSection({ cardId, initialItems, onChange }: Props) {
	const [items, setItems] = useState(initialItems);
	const [newTitle, setNewTitle] = useState("");
	const [isAdding, startAdd] = useTransition();

	function update(next: ChecklistItemData[]) {
		setItems(next);
		onChange?.(next);
	}

	function handleAdd() {
		const title = newTitle.trim();
		if (!title) return;
		setNewTitle("");

		const tempId = `temp-${Math.random()}`;
		const optimistic: ChecklistItemData = { id: tempId, title, isCompleted: false, position: "" };
		const withTemp = [...items, optimistic];
		update(withTemp);

		startAdd(async () => {
			const result = await createChecklistItem({ cardId, title });
			if ("error" in result) {
				toast.error(result.error);
				update(items);
				return;
			}
			update([
				...items,
				{ id: result.data.id, title, isCompleted: false, position: result.data.position },
			]);
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
				<div className="flex flex-col gap-1">
					{items.map((item) => (
						<div key={item.id} className="group flex items-center gap-2">
							<input
								type="checkbox"
								checked={item.isCompleted}
								onChange={() => handleToggle(item.id)}
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
								onClick={() => handleDelete(item.id)}
								className="invisible text-xs text-muted-foreground transition-colors hover:text-destructive group-hover:visible"
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex items-center gap-2">
				<input
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleAdd();
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
