"use client";

import { PRIORITIES, PRIORITY_CONFIG, type Priority } from "@/features/seiryu/lib/constants";
import { addDays } from "@/features/seiryu/lib/filters";
import type { CardData, ColumnData, LabelData } from "@/features/seiryu/lib/types";
import {
	Archive01Icon,
	ArrowLeftRightIcon,
	Calendar03Icon,
	Delete01Icon,
	Flag02Icon,
	Link01Icon,
	SidebarRightIcon,
	Tag01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ContextMenuCheckboxItem,
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@seikatsu/ui";
import Link from "next/link";

export interface CardActions {
	open: (cardId: string) => void;
	copyLink: (cardId: string) => void;
	move: (cardId: string, columnId: string) => void;
	setPriority: (cardId: string, priority: Priority | null) => void;
	setDueDate: (cardId: string, dueDate: string | null) => void;
	setLabels: (cardId: string, labels: LabelData[]) => void;
	archive: (cardId: string) => void;
	delete: (cardId: string) => void;
}

interface Props {
	card: CardData;
	/** Sorted by position. */
	columns: ColumnData[];
	projectLabels: LabelData[];
	today: string;
	actions: CardActions;
}

const NONE = "none";

/** A card's right-click menu: everything the sheet does, a click away, keys named beside. */
export function CardMenuItems({ card, columns, projectLabels, today, actions }: Props) {
	const id = card.id;
	const dueOptions = [
		{ label: "Today", date: today },
		{ label: "Tomorrow", date: addDays(today, 1) },
		{ label: "In a week", date: addDays(today, 7) },
	];
	const picked = new Set(card.labels.map((l) => l.id));

	function toggleLabel(labelId: string) {
		const next = new Set(picked);
		if (next.has(labelId)) next.delete(labelId);
		else next.add(labelId);
		actions.setLabels(
			id,
			projectLabels.filter((l) => next.has(l.id)),
		);
	}

	return (
		<>
			<ContextMenuItem onSelect={() => actions.open(id)}>
				<HugeiconsIcon icon={SidebarRightIcon} />
				Open
				<ContextMenuShortcut>↵</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => actions.copyLink(id)}>
				<HugeiconsIcon icon={Link01Icon} />
				Copy link
			</ContextMenuItem>
			<ContextMenuSeparator />

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={ArrowLeftRightIcon} />
					Move to
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-48">
					<ContextMenuRadioGroup
						value={card.columnId}
						onValueChange={(columnId) => columnId !== card.columnId && actions.move(id, columnId)}
					>
						{columns.map((column) => (
							<ContextMenuRadioItem key={column.id} value={column.id}>
								<span className="truncate">{column.name}</span>
							</ContextMenuRadioItem>
						))}
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={Flag02Icon} />
					Priority
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-44">
					<ContextMenuRadioGroup
						value={card.priority ?? NONE}
						onValueChange={(value) =>
							actions.setPriority(id, value === NONE ? null : (value as Priority))
						}
					>
						{PRIORITIES.map((priority) => (
							<ContextMenuRadioItem key={priority} value={priority}>
								{PRIORITY_CONFIG[priority].label}
								<ContextMenuShortcut>{PRIORITY_CONFIG[priority].level}</ContextMenuShortcut>
							</ContextMenuRadioItem>
						))}
						<ContextMenuRadioItem value={NONE}>
							None
							<ContextMenuShortcut>0</ContextMenuShortcut>
						</ContextMenuRadioItem>
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={Calendar03Icon} />
					Due date
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-44">
					<ContextMenuRadioGroup
						value={card.dueDate ?? NONE}
						onValueChange={(value) => actions.setDueDate(id, value === NONE ? null : value)}
					>
						{dueOptions.map((option) => (
							<ContextMenuRadioItem key={option.label} value={option.date}>
								{option.label}
							</ContextMenuRadioItem>
						))}
						<ContextMenuRadioItem value={NONE}>No date</ContextMenuRadioItem>
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={Tag01Icon} />
					Labels
					{card.labels.length > 0 && (
						<span className="font-figures ml-auto text-xs text-muted-foreground tabular-nums">
							{card.labels.length}
						</span>
					)}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="max-h-80 w-48 overflow-y-auto [scrollbar-width:thin]">
					{projectLabels.map((label) => (
						<ContextMenuCheckboxItem
							key={label.id}
							checked={picked.has(label.id)}
							// Stays open: labels are often picked two or three at a time.
							onSelect={(e) => {
								e.preventDefault();
								toggleLabel(label.id);
							}}
						>
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: label.color }}
							/>
							<span className="truncate">{label.name}</span>
						</ContextMenuCheckboxItem>
					))}
					{projectLabels.length > 0 && <ContextMenuSeparator />}
					<ContextMenuItem asChild>
						<Link href="/settings/seiryu?section=labels" prefetch>
							{projectLabels.length > 0 ? "Edit labels…" : "Make a label…"}
						</Link>
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => actions.archive(id)}>
				<HugeiconsIcon icon={Archive01Icon} />
				Archive
				<ContextMenuShortcut>E</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				className="text-destructive focus:text-destructive"
				onSelect={() => actions.delete(id)}
			>
				<HugeiconsIcon icon={Delete01Icon} />
				Delete…
				<ContextMenuShortcut>⌫</ContextMenuShortcut>
			</ContextMenuItem>
		</>
	);
}
