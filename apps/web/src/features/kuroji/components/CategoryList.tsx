"use client";

import type { CategoryGroup, CategoryOption } from "@/features/kuroji/lib/category-groups";
import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input, cn } from "@seikatsu/ui";
import { useEffect, useId, useState } from "react";

interface Props {
	/** The groups to show for a search, already filtered and ordered. */
	groupsFor: (query: string) => CategoryGroup[];
	currentId: string;
	onPick: (option: CategoryOption) => void;
	/** Names the search field for screen readers. */
	searchLabel: string;
	emptyText: (query: string) => string;
	/** Sizing for the scrolling list, e.g. a taller cap on phones. */
	listClassName?: string;
}

/**
 * A search field over a listbox of categories: arrow keys move, Enter picks. Shared by the
 * transaction list's row picker and the capture form's category field. Lives inside a
 * popover, which unmounts it on close, so every opening starts from an empty search.
 */
export function CategoryList({
	groupsFor,
	currentId,
	onPick,
	searchLabel,
	emptyText,
	listClassName,
}: Props) {
	const listId = useId();
	const [query, setQuery] = useState("");
	const groups = groupsFor(query);
	// One flat order for the keyboard; the same category may sit in Recent and its group.
	const flat = groups.flatMap((g) =>
		g.options.map((o) => ({ o, domId: `${listId}-${g.key}-${o.id}` })),
	);
	const [active, setActive] = useState(() =>
		Math.max(
			0,
			flat.findIndex((f) => f.o.id === currentId),
		),
	);
	const offsets = groups.map((_, gi) =>
		groups.slice(0, gi).reduce((n, g) => n + g.options.length, 0),
	);
	const activeIndex = Math.min(active, Math.max(0, flat.length - 1));
	const activeDomId = flat[activeIndex]?.domId;

	useEffect(() => {
		if (activeDomId) document.getElementById(activeDomId)?.scrollIntoView({ block: "nearest" });
	}, [activeDomId]);

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const step = e.key === "ArrowDown" ? 1 : -1;
			setActive((activeIndex + step + flat.length) % Math.max(1, flat.length));
		} else if (e.key === "Enter" && flat[activeIndex]) {
			e.preventDefault();
			onPick(flat[activeIndex].o);
		}
	}

	return (
		<>
			<div className="relative shrink-0 border-b border-rule p-2">
				<HugeiconsIcon
					icon={Search01Icon}
					className="pointer-events-none absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					role="combobox"
					aria-label={searchLabel}
					aria-expanded
					aria-controls={listId}
					aria-activedescendant={activeDomId}
					placeholder="Find a category"
					autoComplete="off"
					className="pl-9 max-sm:h-11"
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
				className={cn(
					"max-h-72 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1",
					listClassName,
				)}
			>
				{flat.length === 0 && (
					<p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText(query)}</p>
				)}
				{groups.map((g, gi) => (
					<div
						key={g.key}
						role="group"
						aria-labelledby={g.heading ? `${listId}-${g.key}` : undefined}
						className="not-first:mt-1 not-first:border-t not-first:border-rule not-first:pt-1"
					>
						{g.heading && (
							<div
								id={`${listId}-${g.key}`}
								className="truncate px-3 pt-2 pb-1 text-xs text-muted-foreground"
							>
								{g.heading}
							</div>
						)}
						{g.options.map((o, oi) => {
							const i = offsets[gi] + oi;
							return (
								<div
									key={o.id}
									id={`${listId}-${g.key}-${o.id}`}
									role="option"
									aria-selected={o.id === currentId}
									tabIndex={-1}
									onPointerMove={() => setActive(i)}
									onClick={() => onPick(o)}
									className={cn(
										"flex h-10 cursor-pointer items-center gap-2 rounded-[0.3rem] px-3 text-sm max-sm:h-11",
										i === activeIndex && "bg-surface-2",
									)}
								>
									<span className="min-w-0 truncate">{o.label}</span>
									{o.hint && (
										<span className="min-w-0 shrink truncate text-xs text-muted-foreground">
											{o.hint}
										</span>
									)}
									{o.id === currentId && (
										<HugeiconsIcon
											icon={Tick02Icon}
											className="ml-auto h-4 w-4 shrink-0 text-primary"
										/>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
		</>
	);
}
