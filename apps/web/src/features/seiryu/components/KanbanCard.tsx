"use client";

import { formatShortDate } from "@/features/kuroji/lib/dates";
import { DueDateChip } from "@/features/seiryu/components/DueDateChip";
import { PriorityBadge } from "@/features/seiryu/components/PriorityBadge";
import { PRIORITY_CONFIG } from "@/features/seiryu/lib/constants";
import { type CardData, isTempId } from "@/features/seiryu/lib/types";
import { BAR_FILL, barClip } from "@/lib/bar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckListIcon, Note01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { memo, useId, useState } from "react";

export type { CardData, ChecklistItemData, LabelData } from "@/features/seiryu/lib/types";

/** Cards just created on this board: their first mount drops in, later remounts don't. */
export const freshCards = new Set<string>();

// Neighbours make room on the strong ease-out, a beat quicker than a page move.
export const SORT_TRANSITION = { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

const TILE = "rounded-lg bg-surface px-3 py-2.5 text-left [-webkit-touch-callout:none] select-none";

interface Props {
	card: CardData;
	today: string;
	onOpen?: (cardId: string) => void;
}

// Every sortable re-renders on each drag move (dnd-kit context); the body skips that work.
export const KanbanCard = memo(function KanbanCard({ card, today, onOpen }: Props) {
	const isTemp = isTempId(card.id);
	const id = useId();
	const [fresh] = useState(() => freshCards.delete(card.clientKey ?? card.id));
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: card.id,
		data: { type: "card", columnId: card.columnId },
		disabled: isTemp,
		transition: SORT_TRANSITION,
	});

	return (
		<div
			ref={setNodeRef}
			data-card-id={card.id}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			{...attributes}
			{...listeners}
			// Named by its title; labels, due date and checklist read as its description,
			// then dnd-kit's how-to-move hint.
			aria-labelledby={`${id}-title`}
			aria-describedby={`${id}-meta ${attributes["aria-describedby"] ?? ""}`.trim()}
			aria-disabled={isTemp || undefined}
			onClick={() => !isTemp && onOpen?.(card.id)}
			onKeyDown={(e) => {
				listeners?.onKeyDown?.(e);
				if (!isTemp && e.key === "Enter") onOpen?.(card.id);
			}}
			className={cn(
				TILE,
				"cursor-grab outline-none transition-[background-color,opacity] duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
				fresh && "animate-drop",
				// The lifted card travels in the overlay; its place stays as an empty slot.
				isDragging && "bg-transparent ring-1 ring-rule ring-inset [&>*]:opacity-0",
				isTemp && "cursor-default opacity-70",
			)}
		>
			<CardBody card={card} today={today} id={id} />
		</div>
	);
}, sameCardProps);

/** The card as it travels under the pointer: lifted off the lane by a soft shadow. */
export function KanbanCardOverlay({ card, today }: { card: CardData; today: string }) {
	return (
		<div className={cn(TILE, "animate-lift cursor-grabbing bg-surface-2")}>
			<CardBody card={card} today={today} />
		</div>
	);
}

const CardBody = memo(function CardBody({
	card,
	today,
	id,
}: { card: CardData; today: string; id?: string }) {
	const total = card.checklistItems.length;
	const done = card.checklistItems.filter((i) => i.isCompleted).length;
	const hasMeta = card.priority || card.dueDate || total > 0 || card.description;

	return (
		<div className="flex flex-col gap-2">
			<span id={id && `${id}-meta`} className="sr-only">
				{[
					card.labels.length > 0 && `Labels: ${card.labels.map((l) => l.name).join(", ")}.`,
					card.priority && `${PRIORITY_CONFIG[card.priority].label} priority.`,
					card.dueDate &&
						`Due ${formatShortDate(card.dueDate, today)}${card.dueDate < today ? ", overdue" : ""}.`,
					total > 0 && `${done} of ${total} checklist items done.`,
					card.description && "Has a description.",
				]
					.filter(Boolean)
					.join(" ")}
			</span>
			{card.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{card.labels.map((label) => (
						<span
							key={label.id}
							title={label.name}
							className="h-1 w-6 rounded-full"
							style={{ backgroundColor: label.color }}
						/>
					))}
				</div>
			)}

			<p id={id && `${id}-title`} className="text-sm leading-snug [overflow-wrap:anywhere]">
				{card.title}
			</p>

			{hasMeta && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					{card.priority && <PriorityBadge priority={card.priority} />}
					{card.dueDate && <DueDateChip dueDate={card.dueDate} today={today} />}
					{total > 0 && (
						<span
							className={cn(
								"inline-flex items-center gap-1 text-xs tabular-nums",
								done === total ? "text-foreground" : "text-muted-foreground",
							)}
						>
							<HugeiconsIcon icon={CheckListIcon} className="h-3.5 w-3.5" />
							{done}/{total}
							<span className="sr-only"> checklist items done</span>
							<span
								aria-hidden
								className="relative ml-0.5 h-1 w-8 overflow-hidden rounded-full bg-surface-2"
							>
								<span
									className={cn(BAR_FILL, "absolute inset-0 rounded-full bg-primary/80")}
									style={barClip(done / total)}
								/>
							</span>
						</span>
					)}
					{card.description && (
						<HugeiconsIcon
							icon={Note01Icon}
							aria-label="Has a description"
							className="h-3.5 w-3.5 text-muted-foreground"
						/>
					)}
				</div>
			)}
		</div>
	);
}, sameCard);

function sameCardProps(a: Props, b: Props) {
	return a.onOpen === b.onOpen && a.today === b.today && sameCard(a, b);
}

// Field-wise: a server re-render sends new objects for unchanged cards.
function sameCard(
	{ card: a, today: ta }: { card: CardData; today: string },
	{ card: b, today: tb }: { card: CardData; today: string },
) {
	if (a === b && ta === tb) return true;
	return (
		ta === tb &&
		a.id === b.id &&
		a.columnId === b.columnId &&
		a.title === b.title &&
		a.description === b.description &&
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
