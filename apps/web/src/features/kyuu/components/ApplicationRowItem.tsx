"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { memo } from "react";
import { formatAge, formatDay, formatWhen } from "../lib/format";
import { STATUSES, STATUS_CONFIG, type Status } from "../lib/stages";
import type { ApplicationRow } from "../lib/types";
import { useApplicationArea } from "./ApplicationArea";
import { CountryFlag } from "./CountryFlag";
import { StatusMark } from "./StatusMark";

/** The table's columns: sent · company · role · country · source · status · menu. */
export const TABLE_GRID =
	"grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto_2.5rem] md:grid-cols-[5rem_minmax(0,1.1fr)_minmax(0,1fr)_3.5rem_7rem_11rem_2.5rem]";

/** What follows the status: the booked call, or how long it has waited (and a nudge due). */
export function statusDetail(row: ApplicationRow, today: string): string | undefined {
	if (row.next?.date) return formatWhen(row.next.date, row.next.time, today);
	if (row.waiting)
		return row.waiting.due === "follow_up"
			? `${formatAge(row.waiting.days)} · follow up`
			: formatAge(row.waiting.days);
	return undefined;
}

/** The status, and a menu to change it in place. */
function StatusPicker({ row, today }: { row: ApplicationRow; today: string }) {
	const { actions } = useApplicationArea();
	const due = row.waiting?.due;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={`Status: ${STATUS_CONFIG[row.status].label}. Change`}
					// Not a touch on the list (the list's long press would take it).
					onPointerDown={(e) => e.stopPropagation()}
					className="relative -mx-1.5 flex min-w-0 items-center rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
				>
					{/* Quiet for two weeks and more: it fades, so the live ones stand out. */}
					<StatusMark
						status={row.status}
						detail={statusDetail(row, today)}
						className={cn(due === "ghost" && "opacity-55")}
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuRadioGroup
					value={row.status}
					onValueChange={(v) => actions.setStatus(row.id, v as Status)}
				>
					{STATUSES.map((s) => (
						<DropdownMenuRadioItem key={s} value={s}>
							<StatusMark status={s} />
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const ApplicationRowItem = memo(function ApplicationRowItem({
	row: base,
	today,
}: {
	row: ApplicationRow;
	today: string;
}) {
	const { shown } = useApplicationArea();
	const row = shown(base);
	if (row.hidden) return null;

	// The row is its own stacking context: the hover sits under every cell, whatever their order.
	return (
		<li data-app-row className={cn(TABLE_GRID, "group/row relative isolate py-1 md:-mx-2 md:px-2")}>
			<span className="relative hidden font-figures text-xs whitespace-nowrap text-muted-foreground sm:block">
				{formatDay(row.dateApplied, today)}
			</span>
			{/* The whole row opens the application; the controls above it stay their own. */}
			<Link
				href={`/kyuu/${row.id}`}
				prefetch={false}
				data-app-id={row.id}
				className="min-w-0 rounded-md py-1.5 outline-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:transition-colors group-hover/row:before:bg-(--row-hover) focus-visible:before:ring-2 focus-visible:before:ring-ring"
			>
				<span className="relative block truncate text-sm font-medium">{row.company}</span>
				<span className="relative block truncate text-xs text-muted-foreground md:hidden">
					{row.role}
					<span className="sm:hidden"> · {formatDay(row.dateApplied, today)}</span>
				</span>
			</Link>
			<span className="relative hidden truncate text-sm text-muted-foreground md:block">
				{row.jobUrl ? (
					<a
						href={row.jobUrl}
						target="_blank"
						rel="noopener noreferrer"
						title="Open the posting"
						className="underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
					>
						{row.role}
					</a>
				) : (
					row.role
				)}
			</span>
			<span className="relative hidden items-center text-xs text-muted-foreground md:flex">
				{row.country ? <CountryFlag code={row.country} /> : "—"}
			</span>
			<span className="relative hidden truncate text-xs text-muted-foreground md:block">
				{row.source ?? "—"}
				{row.applyMethod === "auto" && (
					<span title="Sent by the job-search pipeline" className="ml-1.5 text-[11px] uppercase">
						auto
					</span>
				)}
			</span>
			<span className="relative flex min-w-0 justify-end sm:justify-start">
				<StatusPicker row={row} today={today} />
			</span>
			<Button
				variant="ghost"
				size="icon"
				aria-label={`${row.company} actions`}
				aria-keyshortcuts="."
				className="relative text-muted-foreground md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
				// Not a touch on the list: that would read as a long press and swallow the menu.
				onPointerDown={(e) => e.stopPropagation()}
				onClick={(e) => {
					const link = e.currentTarget
						.closest("[data-app-row]")
						?.querySelector<HTMLElement>("[data-app-id]");
					if (!link) return;
					// The row's menu, opened under the ⋯.
					const rect = e.currentTarget.getBoundingClientRect();
					link.dispatchEvent(
						new MouseEvent("contextmenu", {
							bubbles: true,
							cancelable: true,
							clientX: rect.left,
							clientY: rect.bottom,
						}),
					);
				}}
			>
				<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
			</Button>
		</li>
	);
});
