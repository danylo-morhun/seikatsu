"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import { type CSSProperties, memo } from "react";
import { requestOpenApplication } from "../lib/events";
import { formatAge, formatDay, formatWhen } from "../lib/format";
import type { ApplicationRow } from "../lib/types";
import { useApplicationArea } from "./ApplicationArea";
import { StatusMark } from "./StatusMark";

/** All's columns: sent · company & role · source · status · what's next · menu. */
export const TABLE_GRID =
	"grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_7.5rem_auto_2.5rem] lg:grid-cols-[5.5rem_minmax(0,1fr)_8rem_7.5rem_9rem_2.5rem]";
/** Now's rows: company & role · what's next · menu. */
export const LIST_GRID = "grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-4";

/** The pipeline's note on a drafted row, without its "Apply by hand:" lead. */
function reasonOf(notes: string | null): string | null {
	const line = notes?.split("\n")[0]?.trim();
	if (!line) return null;
	return line.replace(/^apply by hand:\s*/i, "").replace(/\s+https?:\/\/\S+$/, "");
}

/** What's next for it, in a few words: the booked call, or how long it's waited. */
export function Trail({ row, today }: { row: ApplicationRow; today: string }) {
	if (row.next?.date)
		return (
			<span className="text-xs whitespace-nowrap text-primary">
				{formatWhen(row.next.date, row.next.time, today)}
			</span>
		);
	if (row.waiting)
		return (
			<span className="text-xs whitespace-nowrap text-muted-foreground">
				<span className="font-figures">{formatAge(row.waiting.days)}</span>
				{row.waiting.due === "follow_up" && <span className="text-foreground"> · follow up</span>}
				{row.waiting.due === "ghost" && " · no answer"}
			</span>
		);
	return null;
}

interface Props {
	row: ApplicationRow;
	today: string;
	/** All's columns, or Now's plain list. */
	table?: boolean;
	/** The pipeline's reason it wasn't sent, under the role (To send). */
	showReason?: boolean;
	index?: number;
}

export const ApplicationRowItem = memo(function ApplicationRowItem({
	row: base,
	today,
	table = false,
	showReason = false,
	index = 0,
}: Props) {
	const { shown } = useApplicationArea();
	const row = shown(base);
	if (row.hidden) return null;
	const reason = showReason ? reasonOf(row.notes) : null;

	return (
		<li
			data-app-row
			className={cn(
				table ? TABLE_GRID : LIST_GRID,
				"group/row relative animate-rise py-1.5 md:-mx-2 md:px-2",
			)}
			style={{ "--i": Math.min(index, 8) } as CSSProperties}
		>
			{table && (
				<span className="hidden text-xs whitespace-nowrap text-muted-foreground font-figures sm:block">
					{formatDay(row.dateApplied, today)}
				</span>
			)}
			<button
				type="button"
				data-app-id={row.id}
				onClick={() => requestOpenApplication(row.id)}
				className="min-w-0 rounded-md py-1 text-left outline-none before:absolute before:inset-0 before:rounded-md before:transition-colors hover:before:bg-surface focus-visible:before:ring-2 focus-visible:before:ring-ring"
			>
				<span className="relative block truncate text-sm font-medium">{row.company}</span>
				<span className="relative block truncate text-xs text-muted-foreground">
					{row.role}
					{table && <span className="sm:hidden"> · {formatDay(row.dateApplied, today)}</span>}
				</span>
				{reason && (
					<span className="relative mt-0.5 block truncate text-xs text-muted-foreground/80">
						{reason}
					</span>
				)}
			</button>
			{table && (
				<span className="relative hidden truncate text-xs text-muted-foreground sm:block">
					{row.source ?? "—"}
					{row.applyMethod === "auto" && (
						<span title="Sent by the job-search pipeline" className="ml-1.5 text-[11px] uppercase">
							auto
						</span>
					)}
				</span>
			)}
			<span className="relative flex justify-end sm:justify-start">
				{table ? (
					<>
						<StatusMark status={row.status} className="max-lg:hidden" />
						<span className="lg:hidden">
							{row.next || row.waiting ? (
								<Trail row={row} today={today} />
							) : (
								<StatusMark status={row.status} />
							)}
						</span>
					</>
				) : row.next || row.waiting ? (
					<Trail row={row} today={today} />
				) : row.status === "drafted" || row.status === "sourced" ? (
					<span className="text-xs text-muted-foreground">{row.source}</span>
				) : (
					<StatusMark status={row.status} />
				)}
			</span>
			{table && (
				<span className="relative hidden lg:block">
					<Trail row={row} today={today} />
				</span>
			)}
			<Button
				variant="ghost"
				size="icon"
				aria-label={`${row.company} actions`}
				aria-keyshortcuts="."
				className="relative text-muted-foreground opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
				// Not a touch on the list: that would read as a long press and swallow the menu.
				onPointerDown={(e) => e.stopPropagation()}
				onClick={(e) => {
					const button = e.currentTarget
						.closest("[data-app-row]")
						?.querySelector<HTMLElement>("[data-app-id]");
					if (!button) return;
					// The row's menu, opened under the ⋯.
					const rect = e.currentTarget.getBoundingClientRect();
					button.dispatchEvent(
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
