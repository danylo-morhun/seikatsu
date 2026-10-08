"use client";

import { DueDateChip } from "@/features/seiryu/components/DueDateChip";
import { PriorityBadge } from "@/features/seiryu/components/PriorityBadge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@seikatsu/ui";
import { memo } from "react";

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

/** Not saved yet: shown at once, but can't be opened or dragged until the server answers. */
export const isTempCard = (id: string) => id.startsWith("temp-");

interface Props {
	card: CardData;
	onOpen?: (cardId: string) => void;
}

// Every sortable re-renders on each drag move (dnd-kit context); the body skips that work.
export const KanbanCard = memo(function KanbanCard({ card, onOpen }: Props) {
	const isTemp = isTempCard(card.id);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: card.id,
		data: { type: "card", columnId: card.columnId },
		disabled: isTemp,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			onClick={() => !isTemp && onOpen?.(card.id)}
			onKeyDown={(e) => {
				if (!isTemp && (e.key === "Enter" || e.key === " ")) onOpen?.(card.id);
			}}
			className={cn(
				"rounded-md border border-border bg-card px-3 py-2.5",
				"cursor-grab text-left transition-colors hover:border-border/80 hover:bg-accent/30",
				"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				"active:cursor-grabbing select-none [-webkit-touch-callout:none]",
				isDragging && "opacity-40",
				isTemp && "cursor-default",
			)}
		>
			<CardBody card={card} />
		</div>
	);
}, sameCardProps);

export function KanbanCardOverlay({ card }: { card: CardData }) {
	return (
		<div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-xl opacity-95 rotate-1">
			<CardBody card={card} />
		</div>
	);
}

const CardBody = memo(function CardBody({ card }: { card: CardData }) {
	const totalItems = card.checklistItems.length;
	const doneItems = card.checklistItems.filter((i) => i.isCompleted).length;
	const hasMeta = card.priority || card.dueDate || totalItems > 0;

	return (
		<div className="flex flex-col gap-1.5">
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
}, sameCard);

function sameCardProps(a: Props, b: Props) {
	return a.onOpen === b.onOpen && sameCard({ card: a.card }, { card: b.card });
}

// Field-wise: a server re-render sends new objects for unchanged cards.
function sameCard({ card: a }: { card: CardData }, { card: b }: { card: CardData }) {
	if (a === b) return true;
	return (
		a.id === b.id &&
		a.columnId === b.columnId &&
		a.title === b.title &&
		a.priority === b.priority &&
		a.dueDate === b.dueDate &&
		a.position === b.position &&
		a.labels.length === b.labels.length &&
		a.labels.every(
			(l, i) =>
				l.id === b.labels[i]?.id && l.name === b.labels[i]?.name && l.color === b.labels[i]?.color,
		) &&
		a.checklistItems.length === b.checklistItems.length &&
		a.checklistItems.every((c, i) => c.isCompleted === b.checklistItems[i]?.isCompleted)
	);
}
