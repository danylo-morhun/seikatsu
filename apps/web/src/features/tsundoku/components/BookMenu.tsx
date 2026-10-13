"use client";

import type { LibraryBook } from "@/features/tsundoku/actions/books";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { formatStars } from "@/features/tsundoku/components/Stars";
import { BOOK_STATUSES, type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import {
	BookOpen01Icon,
	Bookshelf01Icon,
	CheckmarkCircle02Icon,
	Delete01Icon,
	Link01Icon,
	SidebarRightIcon,
	StarIcon,
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

export interface BookActions {
	open: (bookId: string) => void;
	progress: (bookId: string) => void;
	setStatus: (bookId: string, status: BookStatus) => void;
	setRating: (bookId: string, rating: number | null) => void;
	setShelves: (bookId: string, shelfIds: string[]) => void;
	copyLink: (bookId: string) => void;
	delete: (bookId: string) => void;
}

const NONE = "none";

/** A book's right-click menu: what the book page does, a click away, keys named beside. */
export function BookMenuItems({
	book,
	shelves,
	actions,
}: {
	book: LibraryBook;
	shelves: TsundokuShelf[];
	actions: BookActions;
}) {
	const id = book.id;
	const onShelf = new Set(book.shelfIds);

	return (
		<>
			<ContextMenuItem onSelect={() => actions.open(id)}>
				<HugeiconsIcon icon={SidebarRightIcon} />
				Open
				<ContextMenuShortcut>↵</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => actions.progress(id)}>
				<HugeiconsIcon icon={BookOpen01Icon} />
				Update progress…
				<ContextMenuShortcut>L</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => actions.copyLink(id)}>
				<HugeiconsIcon icon={Link01Icon} />
				Copy link
			</ContextMenuItem>
			<ContextMenuSeparator />

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={CheckmarkCircle02Icon} />
					Status
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-48">
					<ContextMenuRadioGroup
						value={book.status}
						onValueChange={(v) => v !== book.status && actions.setStatus(id, v as BookStatus)}
					>
						{BOOK_STATUSES.map((s) => (
							<ContextMenuRadioItem key={s} value={s}>
								{STATUS_CONFIG[s].label}
								{STATUS_CONFIG[s].key && (
									<ContextMenuShortcut>{STATUS_CONFIG[s].key}</ContextMenuShortcut>
								)}
							</ContextMenuRadioItem>
						))}
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={StarIcon} />
					Rating
					{book.rating != null && (
						<span className="ml-auto font-figures text-xs text-muted-foreground">
							{formatStars(book.rating)}
						</span>
					)}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-44">
					<ContextMenuRadioGroup
						value={book.rating != null ? String(book.rating) : NONE}
						onValueChange={(v) => actions.setRating(id, v === NONE ? null : Number(v))}
					>
						{[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
							<ContextMenuRadioItem key={r} value={String(r)}>
								<span className="font-figures">{formatStars(r)}</span>
								{r % 2 === 0 && <ContextMenuShortcut>{r / 2}</ContextMenuShortcut>}
							</ContextMenuRadioItem>
						))}
						<ContextMenuRadioItem value={NONE}>
							No rating
							<ContextMenuShortcut>0</ContextMenuShortcut>
						</ContextMenuRadioItem>
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<HugeiconsIcon icon={Bookshelf01Icon} />
					Shelves
					{onShelf.size > 0 && (
						<span className="ml-auto font-figures text-xs text-muted-foreground">
							{onShelf.size}
						</span>
					)}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="max-h-80 w-48 overflow-y-auto [scrollbar-width:thin]">
					{shelves.map((shelf) => (
						<ContextMenuCheckboxItem
							key={shelf.id}
							checked={onShelf.has(shelf.id)}
							// Stays open: a book often goes on two or three shelves at once.
							onSelect={(e) => {
								e.preventDefault();
								const next = new Set(onShelf);
								if (next.has(shelf.id)) next.delete(shelf.id);
								else next.add(shelf.id);
								actions.setShelves(id, [...next]);
							}}
						>
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: shelf.color ?? "var(--muted-foreground)" }}
							/>
							<span className="truncate">{shelf.name}</span>
						</ContextMenuCheckboxItem>
					))}
					{shelves.length > 0 && <ContextMenuSeparator />}
					<ContextMenuItem asChild>
						<Link href="/settings/tsundoku" prefetch>
							{shelves.length > 0 ? "Edit shelves…" : "Make a shelf…"}
						</Link>
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSeparator />
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
