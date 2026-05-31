"use client";

import { Spinner } from "@/components/Spinner";
import { createLabel, deleteLabel, setCardLabels } from "@/features/tasso/actions/labels";
import type { LabelData } from "@/features/tasso/components/KanbanCard";
import { LABEL_COLORS } from "@/features/tasso/lib/constants";
import { cn } from "@ethos/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	cardId: string;
	projectId: string;
	projectLabels: LabelData[];
	cardLabelIds: string[];
	onChange?: (labels: LabelData[]) => void;
	onProjectLabelsChange?: (labels: LabelData[]) => void;
}

export function LabelManager({
	cardId,
	projectId,
	projectLabels: initialProjectLabels,
	cardLabelIds: initialCardLabelIds,
	onChange,
	onProjectLabelsChange,
}: Props) {
	const [projectLabels, setProjectLabels] = useState(initialProjectLabels);
	const [selectedIds, setSelectedIds] = useState(() => new Set(initialCardLabelIds));
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);
	const [isCreating, startCreate] = useTransition();

	async function handleToggleLabel(labelId: string) {
		const prev = new Set(selectedIds);
		const next = new Set(prev);
		if (next.has(labelId)) next.delete(labelId);
		else next.add(labelId);

		setSelectedIds(next);
		onChange?.(projectLabels.filter((l) => next.has(l.id)));

		const result = await setCardLabels({ cardId, labelIds: [...next] });
		if ("error" in result) {
			toast.error(result.error);
			setSelectedIds(prev);
			onChange?.(projectLabels.filter((l) => prev.has(l.id)));
		}
	}

	function handleCreate() {
		const name = newName.trim();
		if (!name) return;

		startCreate(async () => {
			const result = await createLabel({ projectId, name, color: newColor });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			const newLabel: LabelData = { id: result.data.id, name, color: newColor };
			const updated = [...projectLabels, newLabel];
			setProjectLabels(updated);
			onProjectLabelsChange?.(updated);
			setNewName("");
		});
	}

	async function handleDeleteLabel(labelId: string) {
		const prevLabels = projectLabels;
		const prevSelected = selectedIds;

		const nextLabels = prevLabels.filter((l) => l.id !== labelId);
		const nextSelected = new Set(prevSelected);
		nextSelected.delete(labelId);

		setProjectLabels(nextLabels);
		setSelectedIds(nextSelected);

		const result = await deleteLabel({ labelId });
		if ("error" in result) {
			toast.error(result.error);
			setProjectLabels(prevLabels);
			setSelectedIds(prevSelected);
		} else {
			onChange?.(nextLabels.filter((l) => nextSelected.has(l.id)));
			onProjectLabelsChange?.(nextLabels);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs font-medium text-muted-foreground">Labels</span>

			{projectLabels.length === 0 && (
				<p className="text-xs text-muted-foreground">No labels yet.</p>
			)}

			{projectLabels.length > 0 && (
				<div className="flex flex-col gap-0.5">
					{projectLabels.map((label) => (
						<div key={label.id} className="group flex items-center gap-1">
							<button
								type="button"
								onClick={() => handleToggleLabel(label.id)}
								className={cn(
									"flex flex-1 items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-accent",
									selectedIds.has(label.id) && "bg-accent/50",
								)}
							>
								<span
									className="h-3 w-3 shrink-0 rounded-sm"
									style={{ backgroundColor: label.color }}
								/>
								<span className="flex-1 text-left">{label.name}</span>
								{selectedIds.has(label.id) && (
									<span className="text-[10px] text-muted-foreground">✓</span>
								)}
							</button>
							<button
								type="button"
								onClick={() => handleDeleteLabel(label.id)}
								className="invisible shrink-0 text-xs text-muted-foreground transition-colors hover:text-destructive group-hover:visible"
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex flex-col gap-2 border-t border-border pt-2">
				<div className="flex flex-wrap gap-1">
					{LABEL_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setNewColor(c)}
							className={cn(
								"h-4 w-4 rounded-sm transition-transform hover:scale-110",
								newColor === c && "ring-2 ring-ring ring-offset-1 ring-offset-background",
							)}
							style={{ backgroundColor: c }}
						/>
					))}
				</div>
				<div className="flex gap-2">
					<input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleCreate();
							}
						}}
						placeholder="Label name…"
						className="flex-1 rounded border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<button
						type="button"
						disabled={isCreating || !newName.trim()}
						onClick={handleCreate}
						className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
					>
						{isCreating ? <Spinner className="h-3 w-3" /> : "Create"}
					</button>
				</div>
			</div>
		</div>
	);
}
