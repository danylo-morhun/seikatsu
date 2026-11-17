"use client";

import {
	Archive01Icon,
	ArrowLeftRightIcon,
	Calendar03Icon,
	Cancel01Icon,
	FolderOpenIcon,
	Moon02Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import type { ColumnData, GroupData } from "@/features/seiryu/lib/types";

export interface SelectionActions {
	finish?: () => void;
	move: (columnId: string) => void;
	setGroup: (groupId: string | null) => void;
	setDue: (when: "today" | "tomorrow" | "week" | null) => void;
	later: () => void;
	archive: () => void;
	clear: () => void;
}

interface Props {
	count: number;
	columns: ColumnData[];
	groups: GroupData[];
	actions: SelectionActions;
}

const ACTION = "h-9 gap-1.5 rounded-button px-3 text-sm";

/** Several cards picked (Shift- or ⌘-click): one floating bar acts on them all. */
export function SelectionBar({ count, columns, groups, actions }: Props) {
	return (
		<div
			role="toolbar"
			aria-label={`${count} selected cards`}
			className="glass glass-thick animate-rise fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-max flex-wrap items-center gap-1 rounded-overlay p-1.5 md:bottom-6"
		>
			<span className="px-2 text-sm font-medium tabular-nums">{count} selected</span>
			{actions.finish && (
				<Button variant="ghost" className={ACTION} aria-keyshortcuts="X" onClick={actions.finish}>
					<HugeiconsIcon icon={Tick02Icon} className="h-4 w-4" />
					Done
				</Button>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className={ACTION}>
						<HugeiconsIcon icon={ArrowLeftRightIcon} className="h-4 w-4" />
						Move
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" side="top">
					{columns.map((c) => (
						<DropdownMenuItem key={c.id} onSelect={() => actions.move(c.id)}>
							{c.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className={ACTION}>
						<HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4" />
						Due
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" side="top">
					<DropdownMenuItem onSelect={() => actions.setDue("today")}>Today</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => actions.setDue("tomorrow")}>Tomorrow</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => actions.setDue("week")}>In a week</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => actions.setDue(null)}>No date</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{groups.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className={ACTION}>
							<HugeiconsIcon icon={FolderOpenIcon} className="h-4 w-4" />
							Group
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" side="top">
						{groups.map((g) => (
							<DropdownMenuItem key={g.id} onSelect={() => actions.setGroup(g.id)}>
								{g.name}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => actions.setGroup(null)}>No group</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Button variant="ghost" className={ACTION} aria-keyshortcuts="L" onClick={actions.later}>
				<HugeiconsIcon icon={Moon02Icon} className="h-4 w-4" />
				Later
			</Button>
			<Button variant="ghost" className={ACTION} aria-keyshortcuts="A" onClick={actions.archive}>
				<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4" />
				Archive
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="size-9 rounded-button text-muted-foreground"
				aria-label="Clear selection"
				aria-keyshortcuts="Escape"
				onClick={actions.clear}
			>
				<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
			</Button>
		</div>
	);
}
