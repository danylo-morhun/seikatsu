"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DueDateChip } from "@/features/tasso/components/DueDateChip";
import { PriorityBadge } from "@/features/tasso/components/PriorityBadge";
import { cn } from "@ethos/ui";

type Priority = "low" | "medium" | "high" | "urgent";

export type CardData = {
	id: string;
	columnId: string;
	projectId: string;
	title: string;
	description: string | null;
	priority: Priority | null;
	dueDate: string | null;
	position: string;
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

	const hasMeta = card.priority || card.dueDate;

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
			<p className="text-sm leading-snug text-card-foreground">{card.title}</p>

			{hasMeta && (
				<div className="flex flex-wrap items-center gap-1.5">
					{card.priority && <PriorityBadge priority={card.priority} showLabel />}
					{card.dueDate && <DueDateChip dueDate={card.dueDate} />}
				</div>
			)}
		</div>
	);
}

export function KanbanCardOverlay({ card }: { card: CardData }) {
	const hasMeta = card.priority || card.dueDate;
	return (
		<div className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2.5 shadow-xl opacity-95 rotate-1">
			<p className="text-sm leading-snug text-card-foreground">{card.title}</p>
			{hasMeta && (
				<div className="flex flex-wrap items-center gap-1.5">
					{card.priority && <PriorityBadge priority={card.priority} showLabel />}
					{card.dueDate && <DueDateChip dueDate={card.dueDate} />}
				</div>
			)}
		</div>
	);
}
