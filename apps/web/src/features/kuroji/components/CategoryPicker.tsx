"use client";

import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input, Popover, PopoverAnchor, PopoverContent, cn } from "@seikatsu/ui";
import { type RefObject, useId, useState } from "react";

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
	const listId = useId();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const options = anchor ? categoriesFor(query) : [];
	const activeIndex = Math.min(active, Math.max(0, options.length - 1));

	// A new anchor is a new row: start from an empty search.
	const [openedFor, setOpenedFor] = useState(anchor);
	if (openedFor !== anchor) {
		setOpenedFor(anchor);
		setQuery("");
		setActive(0);
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const step = e.key === "ArrowDown" ? 1 : -1;
			setActive((activeIndex + step + options.length) % Math.max(1, options.length));
		} else if (e.key === "Enter" && options[activeIndex]) {
			e.preventDefault();
			onPick(options[activeIndex]);
		}
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
				<div className="relative border-b border-rule p-2">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						role="combobox"
						aria-label={`Category for this transaction, now ${currentName}`}
						aria-expanded
						aria-controls={listId}
						aria-activedescendant={
							options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined
						}
						placeholder="Find a category"
						className="pl-9"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActive(0);
						}}
						onKeyDown={onKeyDown}
					/>
				</div>
				<div
					id={listId}
					role="listbox"
					aria-label="Categories"
					className="max-h-72 overflow-y-auto p-1"
				>
					{options.length === 0 && (
						<p className="px-3 py-6 text-center text-sm text-muted-foreground">
							{query ? `No category matches "${query}"` : "No other category in this currency"}
						</p>
					)}
					{options.map((c, i) => (
						<div
							key={c.id}
							id={`${listId}-${c.id}`}
							role="option"
							aria-selected={i === activeIndex}
							tabIndex={-1}
							onPointerMove={() => setActive(i)}
							onClick={() => onPick(c)}
							className={cn(
								"flex h-10 cursor-pointer items-center justify-between gap-2 rounded-[0.3rem] px-3 text-sm",
								i === activeIndex && "bg-surface-2",
							)}
						>
							<span className="truncate">{c.name}</span>
							{c.id === currentId && (
								<HugeiconsIcon icon={Tick02Icon} className="h-4 w-4 shrink-0 text-primary" />
							)}
						</div>
					))}
				</div>
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
