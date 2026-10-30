"use client";

import { CategoryPopover } from "@/features/kuroji/components/CategoryCombobox";
import { type CategoryUsage, categoryTiles } from "@/features/kuroji/lib/category-tiles";
import { cn } from "@seikatsu/ui";
import * as React from "react";

type Category = { id: string; name: string; parentId: string | null };

const TILE_COUNT = 5;

const tileClass =
	"relative flex h-10 min-w-0 items-center rounded-xl border border-input pr-7 pl-2.5 text-left text-sm leading-4 text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

// Lit like the active app in the sidebar: a pigment wash, a pigment edge, label and check in
// pigment. Light pigments are too pale for text on the wash, so there the label leans to ink.
const checkedText =
	"text-[color-mix(in_oklch,var(--primary)_60%,var(--foreground))] dark:text-primary";
const checkedClass = cn(
	"border-primary/55 bg-primary/15 hover:bg-primary/20",
	checkedText,
	"hover:text-[color-mix(in_oklch,var(--primary)_60%,var(--foreground))] dark:hover:text-primary",
);

/**
 * The capture form's category choice: the most used categories as one-tap tiles (a radio
 * group, arrow keys move), and "More…" for the full searchable list.
 */
export function CategoryTiles({
	categories,
	usage,
	recentIds,
	value,
	onChange,
	invalid,
	"aria-labelledby": labelledBy,
}: {
	categories: Category[];
	usage: CategoryUsage;
	/** For the Recent group in "More…", most recent first. */
	recentIds: string[];
	value: string;
	onChange: (id: string) => void;
	invalid?: boolean;
	"aria-labelledby": string;
}) {
	const tiles = categoryTiles(categories, { usage, selectedId: value, count: TILE_COUNT });
	const selectedIndex = tiles.findIndex((c) => c.id === value);
	const tileRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
	const [moreOpen, setMoreOpen] = React.useState(false);

	function onKeyDown(e: React.KeyboardEvent, index: number) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const next = (index + step + tiles.length) % tiles.length;
		onChange(tiles[next].id);
		tileRefs.current[next]?.focus();
	}

	return (
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
							className={cn(tileClass, checked && checkedClass)}
						>
							<span className="min-w-0 flex-1 truncate">{c.name}</span>
							{/* Out of the flow, in space every tile keeps free, so the label never reflows. */}
							{checked && (
								<svg
									aria-hidden
									viewBox="0 0 12 12"
									className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.75"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path
										d="M2 6l3 3 5-5"
										pathLength={1}
										className="[stroke-dasharray:1] animate-[check-draw_240ms_var(--ease-out)_backwards] motion-reduce:animate-none"
									/>
								</svg>
							)}
						</button>
					);
				})}
			</div>
			<CategoryPopover
				value={value}
				onValueChange={onChange}
				categories={categories}
				recentIds={recentIds}
				open={moreOpen}
				onOpenChange={setMoreOpen}
			>
				<button
					type="button"
					className={cn(
						tileClass,
						"data-[state=open]:bg-surface-2 data-[state=open]:text-foreground",
					)}
				>
					More…
				</button>
			</CategoryPopover>
		</div>
	);
}
