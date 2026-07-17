"use client";

import { parseLocal } from "@/features/kuroji/lib/dates";
import { Calendar01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Calendar,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	cn,
} from "@seikatsu/ui";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

function fmt(d: Date) {
	return format(d, "yyyy-MM-dd");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PRESETS = [
	{
		label: "This month",
		range: () => {
			const t = new Date();
			return [fmt(startOfMonth(t)), fmt(endOfMonth(t))] as const;
		},
	},
	{
		label: "Last month",
		range: () => {
			const l = subMonths(new Date(), 1);
			return [fmt(startOfMonth(l)), fmt(endOfMonth(l))] as const;
		},
	},
	{
		label: "Last 3 months",
		range: () => {
			const t = new Date();
			return [fmt(startOfMonth(subMonths(t, 2))), fmt(endOfMonth(t))] as const;
		},
	},
] as const;

function buildLabel(from: string | undefined, to: string | undefined): string {
	if (!from && !to) return "Date range";
	if (!from || !to) return "Custom range";
	const f = parseLocal(from);
	const t = parseLocal(to);
	const isMonthStart = f.getDate() === 1;
	const isMonthEnd = t.getTime() === endOfMonth(t).setHours(0, 0, 0, 0);
	const singleMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth();
	if (isMonthStart && isMonthEnd && singleMonth) return format(f, "MMMM yyyy");
	return `${format(f, "MMM d")} – ${format(t, "MMM d, yyyy")}`;
}

export function KyuuDateRangeFilter() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const rawFrom = searchParams.get("from") ?? undefined;
	const rawTo = searchParams.get("to") ?? undefined;
	const committedFrom = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : undefined;
	const committedTo = rawTo && ISO_DATE.test(rawTo) ? rawTo : undefined;

	const [open, setOpen] = React.useState(false);
	const [localFrom, setLocalFrom] = React.useState(committedFrom);
	const [localTo, setLocalTo] = React.useState(committedTo);
	const [picking, setPicking] = React.useState<"from" | "to">("from");

	React.useEffect(() => setLocalFrom(committedFrom), [committedFrom]);
	React.useEffect(() => setLocalTo(committedTo), [committedTo]);

	function push(f: string | undefined, t: string | undefined) {
		const [safeFrom, safeTo] = f && t && f > t ? [t, f] : [f, t];
		setLocalFrom(safeFrom);
		setLocalTo(safeTo);
		const params = new URLSearchParams(searchParams.toString());
		if (safeFrom) params.set("from", safeFrom);
		else params.delete("from");
		if (safeTo) params.set("to", safeTo);
		else params.delete("to");
		params.delete("page");
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			setLocalFrom(committedFrom);
			setLocalTo(committedTo);
			setPicking("from");
		}
		setOpen(v);
	}

	function handleDayClick(day: Date) {
		const val = fmt(day);
		if (picking === "from") {
			setLocalFrom(val);
			setLocalTo(undefined);
			setPicking("to");
		} else {
			const base = localFrom ?? val;
			const [f, t] = base > val ? [val, base] : [base, val];
			push(f, t);
			setOpen(false);
			setPicking("from");
		}
	}

	const label = buildLabel(committedFrom, committedTo);
	const hasFilter = Boolean(committedFrom || committedTo);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8 md:w-auto md:px-3 md:gap-2 font-normal"
				>
					<HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 shrink-0 opacity-70" />
					<span className="hidden md:inline">{label}</span>
					{hasFilter && (
						<span
							role="button"
							aria-label="Clear date filter"
							className="hidden md:inline ml-0.5 rounded opacity-50 hover:opacity-100"
							onClick={(e) => {
								e.stopPropagation();
								push(undefined, undefined);
							}}
						>
							<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[min(420px,calc(100vw-1rem))] p-0"
				align="end"
				collisionPadding={{ top: 8, bottom: 8, left: 8, right: 0 }}
			>
				<div className="flex flex-col sm:flex-row">
					<div className="flex flex-col gap-1 border-b sm:border-b-0 sm:border-r p-3 min-w-[140px]">
						<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Presets</p>
						{PRESETS.map((p) => {
							const [pf, pt] = p.range();
							const active = committedFrom === pf && committedTo === pt;
							return (
								<Button
									key={p.label}
									variant={active ? "secondary" : "ghost"}
									size="sm"
									className="justify-start"
									onClick={() => {
										push(pf, pt);
										setOpen(false);
									}}
								>
									{p.label}
								</Button>
							);
						})}
						<Separator className="my-1" />
						<Button
							variant={!hasFilter ? "secondary" : "ghost"}
							size="sm"
							className="justify-start"
							onClick={() => {
								push(undefined, undefined);
								setOpen(false);
							}}
						>
							All time
						</Button>
					</div>

					<div className="flex flex-col p-3">
						<p className="mb-2 text-xs font-medium text-muted-foreground">Custom range</p>
						<div className="mb-3 flex w-full items-center gap-2">
							<span
								className={cn(
									"flex-1 cursor-pointer rounded-md border px-2 py-1 text-center text-sm transition-colors",
									picking === "from"
										? "border-primary bg-primary/10 text-foreground"
										: localFrom
											? "border-transparent bg-muted text-foreground"
											: "border-transparent text-muted-foreground",
								)}
								onClick={() => setPicking("from")}
							>
								{localFrom ? format(parseLocal(localFrom), "MMM d, yyyy") : "Start date"}
							</span>
							<span className="shrink-0 text-xs text-muted-foreground">–</span>
							<span
								className={cn(
									"flex-1 cursor-pointer rounded-md border px-2 py-1 text-center text-sm transition-colors",
									picking === "to"
										? "border-primary bg-primary/10 text-foreground"
										: localTo
											? "border-transparent bg-muted text-foreground"
											: "border-transparent text-muted-foreground",
								)}
								onClick={() => setPicking("to")}
							>
								{localTo ? format(parseLocal(localTo), "MMM d, yyyy") : "End date"}
							</span>
						</div>
						<Calendar
							className="mx-auto"
							mode="range"
							selected={{
								from: localFrom ? parseLocal(localFrom) : undefined,
								to: localTo ? parseLocal(localTo) : undefined,
							}}
							defaultMonth={localFrom ? parseLocal(localFrom) : undefined}
							onSelect={() => {}}
							onDayClick={handleDayClick}
							initialFocus
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
