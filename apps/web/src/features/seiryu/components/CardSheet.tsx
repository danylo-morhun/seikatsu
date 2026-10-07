"use client";

import { ChecklistSection } from "@/features/seiryu/components/ChecklistSection";
import type { CardData, LabelData } from "@/features/seiryu/components/KanbanCard";
import { LabelManager } from "@/features/seiryu/components/LabelManager";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@seikatsu/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

type Priority = "low" | "medium" | "high" | "urgent";

export type CardUpdates = Pick<CardData, "title" | "description" | "priority" | "dueDate">;

interface Props {
	card: CardData | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectLabels: LabelData[];
	/** Saves the form fields (the board applies them at once and persists). */
	onSave: (cardId: string, updates: CardUpdates) => void;
	/** Mirrors checklist/label edits, which persist themselves. */
	onChange: (cardId: string, updates: Partial<CardData>) => void;
	onArchive: (cardId: string) => void;
	onProjectLabelsChange?: (labels: LabelData[]) => void;
}

export function CardSheet({
	card,
	open,
	onOpenChange,
	projectLabels,
	onSave,
	onChange,
	onArchive,
	onProjectLabelsChange,
}: Props) {
	const [title, setTitle] = useState(card?.title ?? "");
	const [description, setDescription] = useState(card?.description ?? "");
	const [priority, setPriority] = useState<Priority | "">(card?.priority ?? "");
	const [dueDate, setDueDate] = useState(card?.dueDate ?? "");

	useEffect(() => {
		if (card) {
			setTitle(card.title);
			setDescription(card.description ?? "");
			setPriority(card.priority ?? "");
			setDueDate(card.dueDate ?? "");
		}
	}, [card?.id]);

	function handleSave() {
		if (!card) return;
		onSave(card.id, {
			title: title.trim() || card.title,
			description: description || null,
			priority: (priority || null) as Priority | null,
			dueDate: dueDate || null,
		});
	}

	function handleArchive() {
		if (card) onArchive(card.id);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex flex-col gap-0 p-0">
				<SheetTitle className="sr-only">Card details</SheetTitle>
				<SheetDescription className="sr-only">Edit card fields</SheetDescription>
				<SheetHeader className="px-6 pt-6 pb-4">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
						placeholder="Card title"
					/>
					{card && (
						<Link
							href={`/seiryu/${card.projectId}/${card.id}`}
							target="_blank"
							className="mt-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							Open in new tab →
						</Link>
					)}
				</SheetHeader>

				<Separator />

				<div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Priority</Label>
						<Select
							value={priority || "none"}
							onValueChange={(v) => setPriority(v === "none" ? "" : (v as Priority))}
						>
							<SelectTrigger className="h-8 text-xs">
								<SelectValue placeholder="No priority" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No priority</SelectItem>
								<SelectItem value="low">Low</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="urgent">Urgent</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Due date</Label>
						<input
							type="date"
							value={dueDate}
							onChange={(e) => setDueDate(e.target.value)}
							className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Description</Label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description…"
							rows={5}
							className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					<Separator />

					<LabelManager
						key={`labels-${card?.id ?? "none"}`}
						cardId={card?.id ?? ""}
						projectId={card?.projectId ?? ""}
						projectLabels={projectLabels}
						cardLabelIds={card?.labels.map((l) => l.id) ?? []}
						onChange={(labels) => card && onChange(card.id, { labels })}
						onProjectLabelsChange={onProjectLabelsChange}
					/>

					<Separator />

					<ChecklistSection
						key={`checklist-${card?.id ?? "none"}`}
						cardId={card?.id ?? ""}
						initialItems={card?.checklistItems ?? []}
						onChange={(checklistItems) => card && onChange(card.id, { checklistItems })}
					/>
				</div>

				<Separator />

				<div className="flex items-center justify-between px-6 py-4">
					<button
						type="button"
						onClick={handleArchive}
						className="text-xs text-muted-foreground transition-colors hover:text-destructive"
					>
						Archive card
					</button>

					<button
						type="button"
						disabled={!title.trim()}
						onClick={handleSave}
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						Save
					</button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
