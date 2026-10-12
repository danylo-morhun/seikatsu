"use client";

import { PriorityBadge } from "@/features/seiryu/components/PriorityBadge";
import { PRIORITIES, PRIORITY_CONFIG } from "@/features/seiryu/lib/constants";
import {
	DUE_FILTERS,
	type DueFilter,
	type Filters,
	filterCount,
} from "@/features/seiryu/lib/filters";
import type { LabelData } from "@/features/seiryu/lib/types";
import { Cancel01Icon, FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";

interface Props {
	filters: Filters;
	labels: LabelData[];
	onChange: (filters: Filters) => void;
}

/** One quiet "Filter" button; choices live in its menu, the applied ones show as chips. */
export function FilterMenu({ filters, labels, onChange }: Props) {
	const count = filterCount(filters);

	function toggle<K extends "priorities" | "labelIds">(key: K, value: string) {
		const current = filters[key];
		onChange({
			...filters,
			[key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-1.5 md:h-8 md:px-3">
					<HugeiconsIcon icon={FilterHorizontalIcon} className="h-4 w-4" />
					Filter
					{count > 0 && (
						<span className="font-figures text-xs tabular-nums text-muted-foreground">{count}</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel>Priority</DropdownMenuLabel>
				{PRIORITIES.map((p) => (
					<DropdownMenuCheckboxItem
						key={p}
						checked={filters.priorities.includes(p)}
						onSelect={(e) => e.preventDefault()}
						onCheckedChange={() => toggle("priorities", p)}
					>
						<PriorityBadge priority={p} className="mr-2" />
						{PRIORITY_CONFIG[p].label}
					</DropdownMenuCheckboxItem>
				))}
				{labels.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Labels</DropdownMenuLabel>
						{labels.map((label) => (
							<DropdownMenuCheckboxItem
								key={label.id}
								checked={filters.labelIds.includes(label.id)}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => toggle("labelIds", label.id)}
							>
								<span
									aria-hidden
									className="mr-2 size-2 rounded-full"
									style={{ backgroundColor: label.color }}
								/>
								<span className="truncate">{label.name}</span>
							</DropdownMenuCheckboxItem>
						))}
					</>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuLabel>Due</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={filters.due || "any"}
					onValueChange={(v) => onChange({ ...filters, due: v === "any" ? "" : (v as DueFilter) })}
				>
					<DropdownMenuRadioItem value="any" onSelect={(e) => e.preventDefault()}>
						Any time
					</DropdownMenuRadioItem>
					{DUE_FILTERS.map(({ value, label }) => (
						<DropdownMenuRadioItem key={value} value={value} onSelect={(e) => e.preventDefault()}>
							{label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The applied filters as removable chips, as Kuroji shows its account/tag filters. */
export function FilterChips({ filters, labels, onChange }: Props) {
	const chips: { key: string; label: string; remove: () => void }[] = [
		...filters.priorities.map((p) => ({
			key: `p-${p}`,
			label: PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG]?.label ?? p,
			remove: () => onChange({ ...filters, priorities: filters.priorities.filter((v) => v !== p) }),
		})),
		...filters.labelIds.flatMap((id) => {
			const label = labels.find((l) => l.id === id);
			return label
				? [
						{
							key: `l-${id}`,
							label: label.name,
							remove: () =>
								onChange({ ...filters, labelIds: filters.labelIds.filter((v) => v !== id) }),
						},
					]
				: [];
		}),
		...(filters.due
			? [
					{
						key: "due",
						label: DUE_FILTERS.find((d) => d.value === filters.due)?.label ?? filters.due,
						remove: () => onChange({ ...filters, due: "" }),
					},
				]
			: []),
	];
	if (chips.length === 0) return null;

	return (
		<ul className="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
			{chips.map((chip) => (
				<li
					key={chip.key}
					className="animate-swap inline-flex h-7 items-center gap-1 rounded-full bg-surface pr-1 pl-2.5 text-xs"
				>
					{chip.label}
					<button
						type="button"
						onClick={chip.remove}
						aria-label={`Remove filter ${chip.label}`}
						className="flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
					</button>
				</li>
			))}
			{chips.length > 1 && (
				<li>
					<button
						type="button"
						onClick={() => onChange({ priorities: [], labelIds: [], due: "" })}
						className="h-7 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Clear all
					</button>
				</li>
			)}
		</ul>
	);
}
