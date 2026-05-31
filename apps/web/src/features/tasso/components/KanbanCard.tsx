"use client";

import { DueDateChip } from "@/features/tasso/components/DueDateChip";
import { PriorityBadge } from "@/features/tasso/components/PriorityBadge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@ethos/ui";

type Priority = "low" | "medium" | "high" | "urgent";

export type ChecklistItemData = {
	id: string;
	title: string;
	isCompleted: boolean;
	position: string;
};

export type LabelData = {
	id: string;
	name: string;
	color: string;
};

export type CardData = {
	id: string;
	columnId: string;
	projectId: string;
	title: string;
	description: string | null;
	priority: Priority | null;
	dueDate: string | null;
	position: string;
	checklistItems: ChecklistItemData[];
	labels: LabelData[];
};

interface Props {
	card: CardData;
	onClick?: (card: CardData) => void;
}

export function KanbanCard({ card, onClick }: Props) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: card.id,
		data: { type: "card", columnId: card.columnId },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const totalItems = card.checklistItems.length;
	const doneItems = card.checklistItems.filter((i) => i.isCompleted).length;
	const hasMeta = card.priority || card.dueDate || totalItems > 0;

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			onClick={() => onClick?.(card)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") onClick?.(card);
			}}
			className={cn(
				"flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2.5",
				"cursor-grab text-left transition-colors hover:border-border/80 hover:bg-accent/30",
				"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				"active:cursor-grabbing touch-none",
				isDragging && "opacity-40",
			)}
		>
			{card.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{card.labels.map((label) => (
						<span
							key={label.id}
							title={label.name}
							className="h-1.5 w-7 rounded-full"
							style={{ backgroundColor: label.color }}
						/>
					))}
				</div>
			)}

			<p className="text-sm leading-snug text-card-foreground">{card.title}</p>

			{hasMeta && (
				<div className="flex flex-wrap items-center gap-1.5">
					{card.priority && <PriorityBadge priority={card.priority} showLabel />}
					{card.dueDate && <DueDateChip dueDate={card.dueDate} />}
					{totalItems > 0 && (
						<span
							className={cn(
								"rounded px-1.5 py-0.5 text-[10px] font-medium",
								doneItems === totalItems
									? "bg-green-500/20 text-green-400"
									: "bg-muted text-muted-foreground",
							)}
						>
							{doneItems}/{totalItems}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

export function KanbanCardOverlay({ card }: { card: CardData }) {
	const totalItems = card.checklistItems.length;
	const doneItems = card.checklistItems.filter((i) => i.isCompleted).length;
	const hasMeta = card.priority || card.dueDate || totalItems > 0;
	return (
		<div className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2.5 shadow-xl opacity-95 rotate-1">
			{card.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{card.labels.map((label) => (
						<span
							key={label.id}
							title={label.name}
							className="h-1.5 w-7 rounded-full"
							style={{ backgroundColor: label.color }}
						/>
					))}
				</div>
			)}
			<p className="text-sm leading-snug text-card-foreground">{card.title}</p>
			{hasMeta && (
				<div className="flex flex-wrap items-center gap-1.5">
					{card.priority && <PriorityBadge priority={card.priority} showLabel />}
					{card.dueDate && <DueDateChip dueDate={card.dueDate} />}
					{totalItems > 0 && (
						<span
							className={cn(
								"rounded px-1.5 py-0.5 text-[10px] font-medium",
								doneItems === totalItems
									? "bg-green-500/20 text-green-400"
									: "bg-muted text-muted-foreground",
							)}
						>
							{doneItems}/{totalItems}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
