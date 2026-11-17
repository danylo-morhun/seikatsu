"use client";

import { Delete01Icon, MoreHorizontalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import { useRef, useState } from "react";
import { QuietAdd } from "@/components/QuietAdd";
import type { GroupData } from "@/features/seiryu/lib/types";

export type GroupProgress = { done: number; total: number };

interface Props {
	groups: GroupData[];
	progress: Map<string, GroupProgress>;
	/** The picked group's id, "none", or "" for every card. */
	active: string;
	onPick: (group: string) => void;
	onCreate: (name: string) => void;
	onRename: (groupId: string, name: string) => void;
	onDelete: (groupId: string) => void;
}

const CHIP =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-button px-2.5 text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The project's groups as one row of chips, each with how far along it is; a chip filters
 * the board to its cards. A project with none shows only the quiet "Group" to start one.
 */
export function GroupStrip({
	groups,
	progress,
	active,
	onPick,
	onCreate,
	onRename,
	onDelete,
}: Props) {
	const [adding, setAdding] = useState(false);
	const [renaming, setRenaming] = useState<string | null>(null);

	return (
		<ul
			aria-label="Groups"
			className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
		>
			{groups.map((group) => {
				const lit = active === group.id;
				const p = progress.get(group.id) ?? { done: 0, total: 0 };
				if (renaming === group.id)
					return (
						<li key={group.id}>
							<NameField
								initial={group.name}
								label={`Rename ${group.name}`}
								onDone={(name) => {
									setRenaming(null);
									if (name && name !== group.name) onRename(group.id, name);
								}}
							/>
						</li>
					);
				return (
					<li key={group.id} className="flex shrink-0 items-center">
						<button
							type="button"
							aria-pressed={lit}
							onClick={() => onPick(lit ? "" : group.id)}
							className={cn(
								CHIP,
								lit
									? "bg-primary/15 text-primary"
									: "bg-surface text-muted-foreground hover:text-foreground",
								lit && "rounded-r-none pr-1.5",
							)}
						>
							<span className="max-w-40 truncate font-medium">{group.name}</span>
							<span className="font-figures tabular-nums opacity-70">
								{p.done}/{p.total}
								<span className="sr-only"> done</span>
							</span>
						</button>
						{lit && (
							<DropdownMenu>
								<DropdownMenuTrigger
									aria-label={`Actions for ${group.name}`}
									className={cn(
										CHIP,
										"rounded-l-none bg-primary/15 px-1.5 text-primary hover:bg-primary/25",
									)}
								>
									<HugeiconsIcon icon={MoreHorizontalIcon} className="h-3.5 w-3.5" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem onSelect={() => setRenaming(group.id)}>
										<HugeiconsIcon icon={PencilEdit01Icon} />
										Rename
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onSelect={() => onDelete(group.id)}
									>
										<HugeiconsIcon icon={Delete01Icon} />
										Delete group (keeps its cards)
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</li>
				);
			})}
			{groups.length > 0 && (
				<li>
					<button
						type="button"
						aria-pressed={active === "none"}
						onClick={() => onPick(active === "none" ? "" : "none")}
						className={cn(
							CHIP,
							active === "none"
								? "bg-primary/15 text-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						No group
					</button>
				</li>
			)}
			<li>
				{adding ? (
					<NameField
						label="New group"
						placeholder="Group name"
						onDone={(name) => {
							setAdding(false);
							if (name) onCreate(name);
						}}
					/>
				) : (
					<QuietAdd onClick={() => setAdding(true)} className="h-7 px-1 text-xs">
						Group
					</QuietAdd>
				)}
			</li>
		</ul>
	);
}

/** A one-line name: Enter or leaving it saves, Escape drops it. */
function NameField({
	initial = "",
	label,
	placeholder,
	onDone,
}: {
	initial?: string;
	label: string;
	placeholder?: string;
	onDone: (name: string) => void;
}) {
	const [value, setValue] = useState(initial);
	// Escape and the blur that may follow it end the field once.
	const ended = useRef(false);
	const end = (name: string) => {
		if (ended.current) return;
		ended.current = true;
		onDone(name);
	};
	return (
		<input
			// biome-ignore lint/a11y/noAutofocus: opened by the user's own click, to type at once
			autoFocus
			aria-label={label}
			placeholder={placeholder}
			value={value}
			maxLength={60}
			onChange={(e) => setValue(e.target.value)}
			onBlur={() => end(value.trim())}
			onKeyDown={(e) => {
				if (e.key === "Enter") e.currentTarget.blur();
				if (e.key === "Escape") {
					e.stopPropagation();
					end("");
				}
			}}
			className="h-7 w-36 rounded-field border border-input bg-transparent px-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-xs"
		/>
	);
}
