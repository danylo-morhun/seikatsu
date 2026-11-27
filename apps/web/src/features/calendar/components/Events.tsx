"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import {
	type CSSProperties,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { DRAGGABLE, DragLayer, dragProps } from "@/features/calendar/components/Drag";
import { EventDialog, type EventDraft } from "@/features/calendar/components/EventDialog";
import type { DragItem, EventFields, GoogleRef } from "@/features/calendar/lib/events";
import { pageKey } from "@/lib/capture-shortcut";

type Open = (draft: EventDraft) => void;
const EventsContext = createContext<Open | null>(null);

/** Opens the event dialog: an event to edit, or a new one on a day (and time). */
export function useOpenEvent(): Open {
	const open = useContext(EventsContext);
	if (!open) throw new Error("useOpenEvent outside <EventsProvider>");
	return open;
}

/**
 * The calendar's one event dialog, shared by every row and slot on the page. E opens a new
 * event on `day` (the day in view, or today).
 */
export function EventsProvider({ day, children }: { day: string; children: ReactNode }) {
	const [draft, setDraft] = useState<EventDraft | null>(null);
	const open = useCallback<Open>((d) => setDraft(d), []);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "e") return;
			e.preventDefault();
			setDraft({ date: day });
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [day]);

	return (
		<EventsContext value={open}>
			{children}
			<DragLayer />
			<EventDialog draft={draft} onClose={() => setDraft(null)} />
		</EventsContext>
	);
}

/** The header's "New event", on the day in view. */
export function NewEvent({ day }: { day: string }) {
	const open = useOpenEvent();
	return (
		<Button
			size="sm"
			onClick={() => open({ date: day })}
			aria-keyshortcuts="E"
			className="h-9 gap-1.5"
		>
			<HugeiconsIcon icon={Add01Icon} className="size-4" />
			Event
		</Button>
	);
}

/** A row's own link, or, for an event, the button that opens it. */
export function EntryLink({
	href,
	event,
	className,
	title,
	style,
	drag,
	google,
	children,
}: {
	href: string;
	event?: EventFields;
	/** A Google event: a writable one opens the dialog; else it opens in Google. */
	google?: GoogleRef;
	/** Set: the row can be dragged to another day or time. */
	drag?: DragItem;
	className?: string;
	title?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	const open = useContext(EventsContext);
	const draft: EventDraft | null = event
		? event
		: google?.writable
			? {
					...google,
					id: undefined,
					google: {
						calendarId: google.calendarId,
						googleId: google.googleId,
						calendarName: google.calendarName,
						recurring: google.recurring,
					},
				}
			: null;
	if (draft && open)
		return (
			<button
				type="button"
				title={title}
				style={style}
				{...dragProps(drag)}
				onClick={() => open(draft)}
				className={cn("text-left", drag && DRAGGABLE, className)}
			>
				{children}
			</button>
		);
	if (google)
		return (
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				title={title}
				className={className}
				style={style}
			>
				{children}
			</a>
		);
	return (
		<Link
			href={href}
			prefetch={false}
			title={title}
			className={cn(drag && DRAGGABLE, className)}
			style={style}
			{...dragProps(drag)}
		>
			{children}
		</Link>
	);
}

/** A click starts an event on the half hour; dragging over the hours sets its length. */
const STEP = 30;
const SNAP = 15;

const hh = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * The empty hours of one day: a click opens a new event at that half hour, lasting an hour; with
 * a mouse, dragging down (or up) over the hours opens one for the stretch drawn. Sits under the
 * rows, so a row's own click wins.
 */
export function NewAtSlot({ date, hour }: { date: string; hour: number }) {
	const open = useOpenEvent();
	const [range, setRange] = useState<[number, number] | null>(null);
	const minutesAt = (el: HTMLElement, y: number, step: number) =>
		Math.max(
			0,
			Math.min(
				24 * 60,
				Math.round((((y - el.getBoundingClientRect().top) / hour) * 60) / step) * step,
			),
		);
	return (
		<div
			aria-hidden
			className="absolute inset-0 cursor-cell"
			onPointerDown={(e) => {
				if (e.pointerType !== "mouse" || e.button !== 0) return;
				const el = e.currentTarget;
				const y0 = e.clientY;
				const anchor = Math.floor(minutesAt(el, e.clientY, 1) / SNAP) * SNAP;
				let drawn: [number, number] | null = null;
				const onMove = (ev: PointerEvent) => {
					if (!drawn && Math.abs(ev.clientY - y0) < 6) return;
					const at = minutesAt(el, ev.clientY, SNAP);
					drawn = at >= anchor ? [anchor, Math.max(anchor + SNAP, at)] : [at, anchor + SNAP];
					setRange(drawn);
				};
				const onUp = () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
					setRange(null);
					if (!drawn) return; // a click: onClick opens the hour
					// The click that ends the drag isn't one.
					el.dataset.drawn = "1";
					const [from, to] = drawn;
					open({ date, startTime: hh(from), endTime: hh(Math.min(23 * 60 + 59, to)) });
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
			}}
			onClick={(e) => {
				const el = e.currentTarget;
				if (el.dataset.drawn) {
					delete el.dataset.drawn;
					return;
				}
				const minutes = Math.min(
					23 * 60 + 30,
					Math.floor(minutesAt(el, e.clientY, 1) / STEP) * STEP,
				);
				open({ date, startTime: hh(minutes), endTime: hh(Math.min(23 * 60 + 59, minutes + 60)) });
			}}
		>
			{range && (
				<div
					className="pointer-events-none absolute inset-x-1 top-(--top) h-(--h) rounded-[0.5rem] bg-primary/25 px-2 py-1 text-[11px] font-medium tabular-nums text-primary ring-1 ring-primary/40"
					style={
						{
							"--top": `${(range[0] / 60) * hour}px`,
							"--h": `${((range[1] - range[0]) / 60) * hour}px`,
						} as CSSProperties
					}
				>
					{hh(range[0])}–{hh(Math.min(23 * 60 + 59, range[1]))}
				</div>
			)}
		</div>
	);
}

/** A month cell's quiet "+": a new all-day event on that day. */
export function NewOnDay({ date, label }: { date: string; label: string }) {
	const open = useOpenEvent();
	return (
		<button
			type="button"
			aria-label={`New event on ${label}`}
			onClick={() => open({ date })}
			className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-opacity duration-150 ease-out hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/cell:opacity-100 max-sm:hidden"
		>
			<HugeiconsIcon icon={Add01Icon} className="size-3.5" />
		</button>
	);
}
