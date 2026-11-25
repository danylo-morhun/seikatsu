"use client";

import { cn } from "@seikatsu/ui";
import { type CSSProperties, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGoogleEvent } from "@/features/calendar/actions/google";
import {
	type DragItem,
	type DropTarget,
	movedEvent,
	movedGoogle,
} from "@/features/calendar/lib/events";
import { storeEvent } from "@/features/calendar/lib/offline";
import { QUEUED_TOAST, type RunResult } from "@/features/pwa/lib/run";
import { saveCard } from "@/features/seiryu/lib/offline";

/** The drag's own type, so only the calendar's rows drop on its days. */
const TYPE = "application/x-seikatsu-calendar";
/** Dropped in the hours, a row snaps to the quarter hour. */
const SNAP = 15;

/** How far below its top the dragged row was picked up: it lands with its top where it was. */
let grabbed = 0;

/** Starts dragging a row: a card due that day, or an event. */
export function dragProps(item: DragItem | undefined) {
	if (!item) return {};
	return {
		draggable: true,
		onDragStart: (e: React.DragEvent) => {
			e.dataTransfer.setData(TYPE, JSON.stringify(item));
			grabbed = e.clientY - e.currentTarget.getBoundingClientRect().top;
			e.dataTransfer.effectAllowed = "move";
		},
	};
}

/** A card moves its due day (and time) as Seiryu's own date field does; an event shifts. */
function move(item: DragItem, to: DropTarget): Promise<RunResult> {
	if (item.kind === "card")
		return saveCard(item.id, item.title, {
			dueDate: to.date,
			...(to.time ? { dueTime: to.time } : {}),
		});
	if (item.kind === "google") {
		// Google's own: online only, straight to its calendar.
		const {
			calendarName: _,
			writable: __,
			recurring: ___,
			...g
		} = movedGoogle(item.google, item.from, to);
		return saveGoogleEvent(g);
	}
	return storeEvent(movedEvent(item.event, item.from, to));
}

const hhmm = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * A day a row can be dropped on. With `hour` it's the day's column of hours: the drop sets the
 * time it lands at (a line shows where); without, it moves the day and keeps the time.
 */
export function DropDay({
	date,
	hour,
	className,
	children,
}: {
	date: string;
	/** One hour's height in px: the column is the whole day's hours. */
	hour?: number;
	className?: string;
	children: ReactNode;
}) {
	const [over, setOver] = useState<number | null>(null);
	const [, startMoving] = useTransition();

	const at = (e: React.DragEvent) => {
		if (!hour) return 0;
		const rect = e.currentTarget.getBoundingClientRect();
		const y = e.clientY - rect.top - grabbed;
		const minutes = Math.round(((y / hour) * 60) / SNAP) * SNAP;
		return Math.max(0, Math.min(23 * 60 + 45, minutes));
	};

	return (
		<div
			className={cn(className, over != null && !hour && "bg-primary/10")}
			onDragOver={(e) => {
				if (!e.dataTransfer.types.includes(TYPE)) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				setOver(at(e));
			}}
			onDragLeave={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
			}}
			onDrop={(e) => {
				const raw = e.dataTransfer.getData(TYPE);
				const minutes = at(e);
				setOver(null);
				if (!raw) return;
				e.preventDefault();
				const item = JSON.parse(raw) as DragItem;
				const to: DropTarget = { date, ...(hour ? { time: hhmm(minutes) } : {}) };
				startMoving(async () => {
					const result = await move(item, to).catch(() => ({
						error: "Couldn't move it. Check your connection.",
					}));
					if ("error" in result) toast.error(result.error);
					else if ("queued" in result) toast(QUEUED_TOAST);
				});
			}}
		>
			{children}
			{hour && over != null && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-1 top-(--top) z-30 flex h-0.5 items-center rounded-full bg-primary"
					style={{ "--top": `${(over / 60) * hour}px` } as CSSProperties}
				>
					<span className="ml-1 -translate-y-2.5 rounded-sm bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
						{hhmm(over)}
					</span>
				</div>
			)}
		</div>
	);
}
