"use client";

import { ConfirmDelete } from "@/features/seiryu/components/ConfirmDelete";
import { KanbanCard, SORT_TRANSITION } from "@/features/seiryu/components/KanbanCard";
import { LABEL_COLORS } from "@/features/seiryu/lib/constants";
import type { CardData, ColumnData } from "@/features/seiryu/lib/types";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Add01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	PaintBoardIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Input,
	cn,
} from "@seikatsu/ui";
import { type CSSProperties, memo, useMemo, useRef, useState } from "react";

export type { ColumnData } from "@/features/seiryu/lib/types";

/** A lane is as wide as a comfortable card; on a phone, most of the screen so the next peeks in. */
export const LANE = "flex w-[min(18.5rem,82vw)] shrink-0 snap-start flex-col";

interface Props {
	column: ColumnData;
	cards: CardData[];
	index: number;
	today: string;
	onCardOpen: (cardId: string) => void;
	onAddCard: (columnId: string, title: string) => void;
	onRename: (columnId: string, name: string) => void;
	onRecolor: (columnId: string, color: string | null) => void;
	onDelete: (columnId: string) => Promise<unknown>;
}

// Skips re-rendering when the board changes another column (cards compared by reference).
export const KanbanColumn = memo(function KanbanColumn({
	column,
	cards,
	index,
	today,
	onCardOpen,
	onAddCard,
	onRename,
	onRecolor,
	onDelete,
}: Props) {
	const [adding, setAdding] = useState(false);
	const [title, setTitle] = useState("");
	const [renaming, setRenaming] = useState(false);
	const [name, setName] = useState(column.name);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const addRef = useRef<HTMLInputElement>(null);

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: column.id,
		data: { type: "column" },
		disabled: renaming,
		transition: SORT_TRANSITION,
	});

	const sortedCards = useMemo(
		() => [...cards].sort((a, b) => (a.position < b.position ? -1 : 1)),
		[cards],
	);
	const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

	function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		// Stays open for the next one: cards are often written down in a run.
		setTitle("");
		onAddCard(column.id, trimmed);
	}

	function closeAdd() {
		setAdding(false);
		setTitle("");
	}

	function submitRename() {
		const trimmed = name.trim();
		setRenaming(false);
		if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
		else setName(column.name);
	}

	return (
		<section
			ref={setNodeRef}
			aria-label={column.name}
			style={
				{ transform: CSS.Translate.toString(transform), transition, "--i": index } as CSSProperties
			}
			className={cn(LANE, "animate-rise", isDragging && "opacity-40")}
		>
			<header className="flex h-11 items-center gap-2 border-b border-rule">
				{renaming ? (
					<Input
						autoFocus
						value={name}
						maxLength={100}
						aria-label="Column name"
						onChange={(e) => setName(e.target.value)}
						onBlur={submitRename}
						onKeyDown={(e) => {
							if (e.key === "Enter") submitRename();
							if (e.key === "Escape") {
								setName(column.name);
								setRenaming(false);
							}
						}}
						className="h-8"
					/>
				) : (
					<div
						{...attributes}
						{...listeners}
						aria-label={`Move column ${column.name}`}
						aria-roledescription="sortable column"
						className="flex h-full min-w-0 flex-1 cursor-grab items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
					>
						{column.color && (
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: column.color }}
							/>
						)}
						<h2 className="truncate text-sm font-medium">{column.name}</h2>
						<span className="text-xs tabular-nums text-muted-foreground">{cards.length}</span>
					</div>
				)}

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8 shrink-0 text-muted-foreground/50 hover:text-foreground data-[state=open]:text-foreground"
							aria-label={`Actions for ${column.name}`}
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={() => {
								setName(column.name);
								setRenaming(true);
							}}
						>
							<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<HugeiconsIcon icon={PaintBoardIcon} className="mr-2 h-4 w-4" />
								Colour
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuRadioGroup
									value={column.color ?? "none"}
									onValueChange={(v) => onRecolor(column.id, v === "none" ? null : v)}
								>
									<DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
									{LABEL_COLORS.map(({ name: colorName, hex }) => (
										<DropdownMenuRadioItem key={hex} value={hex}>
											<span
												aria-hidden
												className="mr-2 size-2.5 rounded-full"
												style={{ backgroundColor: hex }}
											/>
											{colorName}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
							Delete…
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			<SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
				<div className="-mx-1 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-1 pt-3 pb-2 [scrollbar-width:thin]">
					{sortedCards.map((card) => (
						<KanbanCard
							key={card.clientKey ?? card.id}
							card={card}
							today={today}
							onOpen={onCardOpen}
						/>
					))}

					{adding ? (
						<form onSubmit={handleAdd} className="animate-swap space-y-2">
							<Input
								ref={addRef}
								autoFocus
								value={title}
								maxLength={500}
								autoComplete="off"
								aria-label={`New card in ${column.name}`}
								placeholder="Card title…"
								onChange={(e) => setTitle(e.target.value)}
								onBlur={() => !title.trim() && closeAdd()}
								onKeyDown={(e) => e.key === "Escape" && closeAdd()}
							/>
							<div className="flex gap-1.5">
								<Button type="submit" size="sm" disabled={!title.trim()}>
									Add card
								</Button>
								<Button type="button" size="sm" variant="ghost" onClick={closeAdd}>
									Done
								</Button>
							</div>
						</form>
					) : (
						<button
							type="button"
							onClick={() => setAdding(true)}
							className="inline-flex h-9 items-center gap-1.5 self-start rounded-md px-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
							Add card
						</button>
					)}
				</div>
			</SortableContext>

			<ConfirmDelete
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete "${column.name}"?`}
				description={
					cards.length > 0
						? `Its ${cards.length} card${cards.length === 1 ? "" : "s"} go with it, for good. Move them to another column first to keep them.`
						: "The column is empty; nothing else is lost."
				}
				onConfirm={() => onDelete(column.id)}
			/>
		</section>
	);
}, sameColumnProps);

function sameColumnProps(a: Props, b: Props) {
	return (
		a.column.id === b.column.id &&
		a.column.name === b.column.name &&
		a.column.color === b.column.color &&
		a.column.position === b.column.position &&
		a.index === b.index &&
		a.today === b.today &&
		a.onCardOpen === b.onCardOpen &&
		a.onAddCard === b.onAddCard &&
		a.onRename === b.onRename &&
		a.onRecolor === b.onRecolor &&
		a.onDelete === b.onDelete &&
		a.cards.length === b.cards.length &&
		a.cards.every((c, i) => c === b.cards[i])
	);
}

/** The column as it travels under the pointer. */
export function KanbanColumnOverlay({
	column,
	cardCount,
}: { column: ColumnData; cardCount: number }) {
	return (
		<div className={cn(LANE, "animate-lift cursor-grabbing rounded-lg bg-surface-2 px-3")}>
			<div className="flex h-11 items-center gap-2">
				{column.color && (
					<span
						className="size-2 shrink-0 rounded-full"
						style={{ backgroundColor: column.color }}
					/>
				)}
				<span className="truncate text-sm font-medium">{column.name}</span>
				<span className="text-xs tabular-nums text-muted-foreground">{cardCount}</span>
			</div>
		</div>
	);
}
