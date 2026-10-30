"use client";

import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { formatStars } from "@/features/tsundoku/components/Stars";
import { SEGMENTS, type Segment } from "@/features/tsundoku/lib/constants";
import {
	type LibraryFilters,
	SORTS,
	type Sort,
	menuFilterCount,
} from "@/features/tsundoku/lib/filters";
import {
	Cancel01Icon,
	FilterHorizontalIcon,
	GridViewIcon,
	ListViewIcon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
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
import { forwardRef } from "react";

const ALL = "all";

/** All · Reading · Pile · Read, with counts: a macOS segmented control whose lens slides under the chosen pile. */
export function SegmentSwitch({
	value,
	counts,
	onChange,
}: {
	value: Segment | null;
	counts: Record<Segment, number>;
	onChange: (segment: Segment | null) => void;
}) {
	const options = [{ value: null, label: "All" }, ...SEGMENTS] as const;
	const index = options.findIndex((o) => o.value === value);
	return (
		<nav aria-label="Piles" className="relative flex rounded-full bg-surface p-0.5">
			<span
				aria-hidden
				className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/4)] rounded-full bg-surface-2 shadow-sm transition-transform duration-250 ease-in-out motion-reduce:transition-none"
				style={{ transform: `translateX(${index * 100}%)` }}
			/>
			{options.map((o) => {
				const active = o.value === value;
				const count = o.value ? counts[o.value] : null;
				return (
					<button
						key={o.label}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(o.value)}
						className={cn(
							"relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:min-w-20",
							active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{o.label}
						{count != null && count > 0 && (
							<span className="font-figures text-muted-foreground">{count}</span>
						)}
					</button>
				);
			})}
		</nav>
	);
}

export const SearchBox = forwardRef<
	HTMLInputElement,
	{ value: string; onChange: (value: string) => void }
>(function SearchBox({ value, onChange }, ref) {
	return (
		<div className="relative min-w-0 flex-1 sm:max-w-64">
			<HugeiconsIcon
				icon={Search01Icon}
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				ref={ref}
				type="search"
				value={value}
				aria-label="Search books"
				aria-keyshortcuts="/"
				placeholder="Search"
				autoComplete="off"
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape" && value) {
						e.stopPropagation();
						onChange("");
					}
				}}
				className="rounded-full border-transparent bg-surface pl-9 md:h-8"
			/>
		</div>
	);
});

export function ViewSwitch({
	view,
	onChange,
}: { view: "grid" | "list"; onChange: (view: "grid" | "list") => void }) {
	return (
		<div
			role="radiogroup"
			aria-label="View"
			className="relative flex rounded-full bg-surface p-0.5"
		>
			<span
				aria-hidden
				className="absolute inset-y-0.5 left-0.5 w-9 rounded-full bg-surface-2 shadow-sm transition-transform duration-200 ease-in-out motion-reduce:transition-none"
				style={{ transform: `translateX(${view === "list" ? 100 : 0}%)` }}
			/>
			{(
				[
					["grid", GridViewIcon, "Covers"],
					["list", ListViewIcon, "List"],
				] as const
			).map(([value, icon, label]) => (
				<button
					key={value}
					type="button"
					role="radio"
					aria-checked={view === value}
					aria-label={label}
					onClick={() => onChange(value)}
					className={cn(
						"relative flex h-9 w-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:h-7",
						view === value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
				>
					<HugeiconsIcon icon={icon} className="size-4" />
				</button>
			))}
		</div>
	);
}

interface MenuProps {
	filters: LibraryFilters;
	shelves: TsundokuShelf[];
	genres: string[];
	series: string[];
	authors: string[];
	onChange: (filters: LibraryFilters) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** One quiet "Filter" button: shelf, genre, series, author, rating, and the sort. */
export function FilterMenu({
	filters,
	shelves,
	genres,
	series,
	authors,
	onChange,
	open,
	onOpenChange,
}: MenuProps) {
	const count = menuFilterCount(filters);
	const pick = <K extends keyof LibraryFilters>(key: K) => ({
		value: filters[key] == null ? ALL : String(filters[key]),
		onValueChange: (v: string) =>
			onChange({
				...filters,
				[key]: v === ALL ? null : key === "rating" ? Number(v) : v,
			}),
	});
	const keep = (e: Event) => e.preventDefault();

	const sub = (
		label: string,
		key: "shelf" | "genre" | "series" | "author",
		items: { value: string; label: string; color?: string | null }[],
	) =>
		items.length > 0 && (
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>
					{label}
					{filters[key] && <span className="ml-auto pl-2 text-xs text-muted-foreground">1</span>}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto [scrollbar-width:thin]">
					<DropdownMenuRadioGroup {...pick(key)}>
						<DropdownMenuRadioItem value={ALL} onSelect={keep}>
							Any {label.toLowerCase()}
						</DropdownMenuRadioItem>
						{items.map((item) => (
							<DropdownMenuRadioItem key={item.value} value={item.value} onSelect={keep}>
								{item.color !== undefined && (
									<span
										aria-hidden
										className="mr-2 size-2 shrink-0 rounded-full"
										style={{ backgroundColor: item.color ?? "var(--muted-foreground)" }}
									/>
								)}
								<span className="truncate">{item.label}</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		);

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="shrink-0 gap-1.5 md:h-8 md:px-3" aria-keyshortcuts="F">
					<HugeiconsIcon icon={FilterHorizontalIcon} className="h-4 w-4" />
					<span className="max-sm:sr-only">Filter</span>
					{count > 0 && (
						<span className="font-figures text-xs tabular-nums text-muted-foreground">{count}</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{sub(
					"Shelf",
					"shelf",
					shelves.map((s) => ({ value: s.id, label: s.name, color: s.color })),
				)}
				{sub(
					"Genre",
					"genre",
					genres.map((g) => ({ value: g, label: g })),
				)}
				{sub(
					"Series",
					"series",
					series.map((s) => ({ value: s, label: s })),
				)}
				{sub(
					"Author",
					"author",
					authors.map((a) => ({ value: a, label: a })),
				)}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						Rating
						{filters.rating && (
							<span className="ml-auto pl-2 text-xs text-muted-foreground">1</span>
						)}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-44">
						<DropdownMenuRadioGroup {...pick("rating")}>
							<DropdownMenuRadioItem value={ALL} onSelect={keep}>
								Any rating
							</DropdownMenuRadioItem>
							{[10, 8, 6, 4, 2].map((r) => (
								<DropdownMenuRadioItem key={r} value={String(r)} onSelect={keep}>
									<span className="font-figures">
										{r === 10 ? "5" : `${formatStars(r)} and up`}
									</span>
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuLabel>Sort</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={filters.sort}
					onValueChange={(v) => onChange({ ...filters, sort: v as Sort })}
				>
					{SORTS.map((s) => (
						<DropdownMenuRadioItem key={s.value} value={s.value} onSelect={keep}>
							{s.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The applied menu filters as removable chips, as Seiryu shows its own. */
export function FilterChips({
	filters,
	shelves,
	onChange,
}: {
	filters: LibraryFilters;
	shelves: TsundokuShelf[];
	onChange: (filters: LibraryFilters) => void;
}) {
	const chips: { key: string; label: string; remove: () => void }[] = [];
	const add = (key: keyof LibraryFilters, label: string | null | undefined) => {
		if (label) chips.push({ key, label, remove: () => onChange({ ...filters, [key]: null }) });
	};
	add(
		"shelf",
		shelves.find((s) => s.id === filters.shelf)?.name ?? (filters.shelf && "Unknown shelf"),
	);
	add("genre", filters.genre);
	add("series", filters.series);
	add("author", filters.author);
	add("rating", filters.rating ? `${formatStars(filters.rating)}★ and up` : null);
	if (chips.length === 0) return null;

	return (
		<ul className="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
			{chips.map((chip) => (
				<li
					key={chip.key}
					className="animate-swap inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-surface pr-1 pl-2.5 text-xs"
				>
					<span className="truncate">{chip.label}</span>
					<button
						type="button"
						onClick={chip.remove}
						aria-label={`Remove filter ${chip.label}`}
						className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
					</button>
				</li>
			))}
			{chips.length > 1 && (
				<li>
					<button
						type="button"
						onClick={() =>
							onChange({
								...filters,
								shelf: null,
								genre: null,
								series: null,
								author: null,
								rating: null,
							})
						}
						className="h-7 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Clear all
					</button>
				</li>
			)}
		</ul>
	);
}
