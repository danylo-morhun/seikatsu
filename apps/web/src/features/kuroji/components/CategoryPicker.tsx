"use client";

import { CategoryList } from "@/features/kuroji/components/CategoryList";
import { Popover, PopoverAnchor, PopoverContent } from "@seikatsu/ui";
import { type RefObject, useState } from "react";

type Category = { id: string; name: string };

interface Props {
	/** The element the picker opens from; focus returns to it on close. */
	anchor: HTMLElement | null;
	onClose: () => void;
	/** Categories to offer for a search, already ordered. */
	categoriesFor: (query: string) => Category[];
	currentId: string;
	currentName: string;
	onPick: (category: Category) => void;
	/** Keeps "show only this category" one click away now that the name opens the picker. */
	onShowOnly?: () => void;
}

/** One searchable category list, shared by every row and opened next to the row's control. */
export function CategoryPicker({
	anchor,
	onClose,
	categoriesFor,
	currentId,
	currentName,
	onPick,
	onShowOnly,
}: Props) {
	// A new anchor is a new row: start the list over from an empty search.
	const [openedFor, setOpenedFor] = useState(anchor);
	const [session, setSession] = useState(0);
	if (openedFor !== anchor) {
		setOpenedFor(anchor);
		setSession((n) => n + 1);
	}

	return (
		<Popover open={anchor !== null} onOpenChange={(open) => !open && onClose()}>
			<PopoverAnchor virtualRef={{ current: anchor } as RefObject<HTMLElement>} />
			<PopoverContent
				data-slot="popover-content"
				align="start"
				collisionPadding={8}
				className="w-[min(18rem,calc(100vw-1rem))] p-0"
				aria-label="Change category"
				onCloseAutoFocus={(e) => {
					e.preventDefault();
					if (anchor?.isConnected) anchor.focus();
				}}
			>
				<CategoryList
					key={session}
					groupsFor={(query) => [
						{
							key: "all",
							heading: null,
							options: categoriesFor(query).map((c) => ({ id: c.id, label: c.name })),
						},
					]}
					currentId={currentId}
					onPick={(o) => onPick({ id: o.id, name: o.label })}
					searchLabel={`Category for this transaction, now ${currentName}`}
					emptyText={(query) =>
						query ? `No category matches "${query}"` : "No other category in this currency"
					}
				/>
				{onShowOnly && (
					<div className="border-t border-rule p-1">
						<button
							type="button"
							onClick={onShowOnly}
							className="flex h-10 w-full items-center rounded-[0.3rem] px-3 text-left text-sm text-muted-foreground outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span className="truncate">Show only {currentName}</span>
						</button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
