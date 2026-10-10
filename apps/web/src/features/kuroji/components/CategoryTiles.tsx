"use client";

import { CategoryPicker } from "@/features/kuroji/components/CategoryPicker";
import { categoryTiles, postableCategories } from "@/features/kuroji/lib/category-tiles";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import * as React from "react";

type Category = { id: string; name: string; parentId: string | null };

const TILE_COUNT = 5;

const tileClass =
	"flex h-10 min-w-0 items-center gap-1.5 rounded-md border border-input px-2.5 text-left text-sm leading-4 text-muted-foreground outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The capture form's category choice: the likeliest categories as one-tap tiles (a radio
 * group, arrow keys move), and "More…" for the full searchable list.
 */
export function CategoryTiles({
	categories,
	recentIds,
	value,
	onChange,
	invalid,
	"aria-labelledby": labelledBy,
}: {
	categories: Category[];
	recentIds: string[];
	value: string;
	onChange: (id: string) => void;
	invalid?: boolean;
	"aria-labelledby": string;
}) {
	const tiles = categoryTiles(categories, { recentIds, selectedId: value, count: TILE_COUNT });
	const selectedIndex = tiles.findIndex((c) => c.id === value);
	const tileRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
	const [moreAnchor, setMoreAnchor] = React.useState<HTMLElement | null>(null);

	function onKeyDown(e: React.KeyboardEvent, index: number) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const next = (index + step + tiles.length) % tiles.length;
		onChange(tiles[next].id);
		tileRefs.current[next]?.focus();
	}

	return (
		<>
			<div className="grid grid-cols-3 gap-2">
				<div
					role="radiogroup"
					aria-labelledby={labelledBy}
					aria-invalid={invalid || undefined}
					className="contents"
				>
					{tiles.map((c, i) => {
						const checked = i === selectedIndex;
						return (
							<button
								key={c.id}
								ref={(el) => {
									tileRefs.current[i] = el;
								}}
								type="button"
								role="radio"
								aria-checked={checked}
								tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
								title={c.name}
								onClick={() => onChange(c.id)}
								onKeyDown={(e) => onKeyDown(e, i)}
								className={cn(
									tileClass,
									checked && "bg-surface-2 text-foreground hover:bg-surface-2",
								)}
							>
								<span className="line-clamp-2 flex-1 hyphens-auto break-words">{c.name}</span>
								{checked && <HugeiconsIcon icon={Tick02Icon} className="h-3.5 w-3.5 shrink-0" />}
							</button>
						);
					})}
				</div>
				<button
					type="button"
					aria-haspopup="dialog"
					aria-expanded={moreAnchor !== null}
					onClick={(e) => setMoreAnchor(e.currentTarget)}
					className={cn(tileClass, moreAnchor && "bg-surface text-foreground")}
				>
					More…
				</button>
			</div>
			<CategoryPicker
				anchor={moreAnchor}
				onClose={() => setMoreAnchor(null)}
				categoriesFor={(query) => postableCategories(categories, recentIds, query)}
				currentId={value}
				currentName={categories.find((c) => c.id === value)?.name ?? "none"}
				onPick={(category) => {
					setMoreAnchor(null);
					onChange(category.id);
				}}
			/>
		</>
	);
}
