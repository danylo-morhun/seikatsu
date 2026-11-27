"use client";

import { cn } from "@seikatsu/ui";
import { type CSSProperties, type ReactNode, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { saveGoogleEvent } from "@/features/calendar/actions/google";
import {
	changeOneDay,
	type DragItem,
	type DropTarget,
	type EventFields,
	type GoogleRef,
	movedEvent,
	movedGoogle,
	sameDrop,
} from "@/features/calendar/lib/events";
import { storeEvent, storeEventSet } from "@/features/calendar/lib/offline";
import { QUEUED_TOAST, type RunResult } from "@/features/pwa/lib/run";
import { saveCard } from "@/features/seiryu/lib/offline";

// Dragging with pointer events, so a mouse and a finger move rows alike: a mouse starts once it
// has moved a few px, a finger after holding still (a quick swipe still scrolls the page). The
// day under the pointer is found by its `data-drop-date`, so the rows and slots need no wiring.

/** Dropped in the hours, a row snaps to the quarter hour. */
const SNAP = 15;
/** A mouse drags past this many px; less is a click. */
const MOUSE_SLOP = 4;
/** A finger holds this long to pick a row up; moving further than TOUCH_SLOP first scrolls. */
const HOLD_MS = 350;
const TOUCH_SLOP = 8;

type Over = { date: string; minutes: number | null };
type Dragging = { title: string; x: number; y: number; over: Over | null };

let dragging: Dragging | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
	listeners.add(l);
	return () => listeners.delete(l);
};
function set(next: Dragging | null) {
	dragging = next;
	for (const l of listeners) l();
}
const useDragging = () =>
	useSyncExternalStore(
		subscribe,
		() => dragging,
		() => null,
	);

/** How far below its top the dragged row was picked up: it lands with its top where it was. */
let grabbed = 0;

/** A drag or resize just ended: the click that follows it isn't a click. */
function swallowNextClick() {
	const stop = (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
	};
	window.addEventListener("click", stop, { capture: true, once: true });
	setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

const hhmm = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The day (and time, in the hours) under a point. */
function overAt(x: number, y: number): Over | null {
	const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-date]");
	const date = el?.dataset.dropDate;
	if (!el || !date) return null;
	const hour = Number(el.dataset.dropHour) || 0;
	if (!hour) return { date, minutes: null };
	const top = el.getBoundingClientRect().top;
	const minutes = Math.round((((y - top - grabbed) / hour) * 60) / SNAP) * SNAP;
	return { date, minutes: Math.max(0, Math.min(23 * 60 + 45, minutes)) };
}

const googleFields = ({ calendarName: _, writable: __, recurring: ___, ...g }: GoogleRef) => g;

/** A card moves its due day (and time) as Seiryu's own date field does; a Google event shifts. */
function move(item: Exclude<DragItem, { kind: "event" }>, to: DropTarget): Promise<RunResult> {
	if (item.kind === "card")
		return saveCard(item.id, item.title, {
			dueDate: to.date,
			...(to.time ? { dueTime: to.time } : {}),
		});
	// Google's own: online only, straight to its calendar.
	return saveGoogleEvent(googleFields(movedGoogle(item.google, item.from, to)));
}

/**
 * A change to an event; for a repeating one, to its one day (`occurrence`) alone, which then
 * stands apart. Returns how to undo it.
 */
function changeEvent(
	event: EventFields,
	occurrence: string | undefined,
	change: (e: EventFields) => EventFields,
): { run: () => Promise<RunResult>; undo: () => Promise<RunResult> } {
	if (!event.repeat || !occurrence)
		return { run: () => storeEvent(change(event)), undo: () => storeEvent(event) };
	const newId = crypto.randomUUID();
	const set = changeOneDay(event, occurrence, change, newId);
	return {
		run: () => storeEventSet(set, event.title),
		undo: () => storeEventSet({ save: [event], remove: [newId] }, event.title),
	};
}

/** Puts a moved card or Google event back where it was. */
function moveBack(item: Exclude<DragItem, { kind: "event" }>): Promise<RunResult> {
	if (item.kind === "card")
		return saveCard(item.id, item.title, { dueDate: item.from, dueTime: item.time ?? null });
	return saveGoogleEvent(googleFields(item.google));
}

/** Saves a change and says how it went; a change that took gets Undo. */
async function settle(run: () => Promise<RunResult>, undo: (() => Promise<RunResult>) | null) {
	const result = await run().catch(() => ({ error: "Couldn't move it. Check your connection." }));
	if ("error" in result) toast.error(result.error);
	else if ("queued" in result) toast(QUEUED_TOAST);
	else if (undo)
		toast("Moved", {
			action: { label: "Undo", onClick: () => void settle(undo, null) },
		});
}

function drop(item: DragItem, over: Over) {
	const to: DropTarget = {
		date: over.date,
		...(over.minutes != null && { time: hhmm(over.minutes) }),
	};
	if (sameDrop(item, to)) return;
	if (item.kind === "event") {
		const { run, undo } = changeEvent(item.event, item.occurrence, (e) =>
			movedEvent(e, item.from, to),
		);
		void settle(run, undo);
		return;
	}
	void settle(
		() => move(item, to),
		() => moveBack(item),
	);
}

/**
 * Follows one pointer from its press: `onStart` once it's a drag (past the slop for a mouse,
 * after holding for a finger), `onMove` while it goes, `onEnd` when it's let go. A finger that
 * moves before the hold lets the page scroll instead.
 */
function track(
	e: React.PointerEvent,
	handlers: {
		onStart: (x: number, y: number) => void;
		onMove: (x: number, y: number) => void;
		onEnd: (x: number, y: number) => void;
		onCancel: () => void;
	},
	immediate = false,
) {
	const touch = e.pointerType !== "mouse";
	const id = e.pointerId;
	const [x0, y0] = [e.clientX, e.clientY];
	let [x, y] = [x0, y0];
	let active = false;
	const begin = () => {
		active = true;
		if (touch) navigator.vibrate?.(8);
		handlers.onStart(x, y);
	};
	const timer = touch && !immediate ? setTimeout(begin, HOLD_MS) : null;
	const cleanup = () => {
		if (timer) clearTimeout(timer);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		window.removeEventListener("touchmove", onTouchMove);
		window.removeEventListener("contextmenu", onContextMenu, true);
	};
	const onMove = (ev: PointerEvent) => {
		if (ev.pointerId !== id) return;
		[x, y] = [ev.clientX, ev.clientY];
		if (!active) {
			const far = Math.hypot(x - x0, y - y0);
			if (immediate) begin();
			else if (touch) {
				if (far > TOUCH_SLOP) cleanup(); // a swipe: the page scrolls
				return;
			} else if (far > MOUSE_SLOP) begin();
			else return;
		}
		handlers.onMove(x, y);
	};
	const onUp = (ev: PointerEvent) => {
		if (ev.pointerId !== id) return;
		cleanup();
		if (!active) return;
		swallowNextClick();
		handlers.onEnd(ev.clientX, ev.clientY);
	};
	const onCancel = (ev: PointerEvent) => {
		if (ev.pointerId !== id) return;
		cleanup();
		if (active) handlers.onCancel();
	};
	// Once a finger holds a row, it moves the row, not the page.
	const onTouchMove = (ev: TouchEvent) => {
		if (active) ev.preventDefault();
	};
	// A long press opens no menu: it picks the row up.
	const onContextMenu = (ev: Event) => {
		if (touch) ev.preventDefault();
	};
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onCancel);
	window.addEventListener("touchmove", onTouchMove, { passive: false });
	window.addEventListener("contextmenu", onContextMenu, true);
}

/** Classes a draggable row needs: no text selection, no iOS link preview on a long press. */
export const DRAGGABLE = "select-none [-webkit-touch-callout:none]";

/** Makes a row draggable to another day or time: a card due that day, or an event. */
export function dragProps(item: DragItem | undefined) {
	if (!item) return {};
	const title =
		item.kind === "card"
			? item.title
			: item.kind === "event"
				? item.event.title
				: item.google.title;
	return {
		// The browser's own drag (of a link, an image) would take over.
		draggable: false,
		onDragStart: (e: React.DragEvent) => e.preventDefault(),
		onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
			if (e.button !== 0) return;
			const offset = e.clientY - e.currentTarget.getBoundingClientRect().top;
			track(e, {
				onStart: (x, y) => {
					grabbed = offset;
					set({ title, x, y, over: overAt(x, y) });
				},
				onMove: (x, y) => set({ title, x, y, over: overAt(x, y) }),
				onEnd: (x, y) => {
					const over = overAt(x, y);
					set(null);
					if (over) drop(item, over);
				},
				onCancel: () => set(null),
			});
		},
	};
}

/** What a row being dragged looks like under the pointer: its title, where it would land. */
export function DragLayer() {
	const d = useDragging();
	if (!d) return null;
	const at = d.over?.minutes != null ? hhmm(d.over.minutes) : null;
	return (
		<div
			aria-hidden
			className="glass pointer-events-none fixed top-0 left-0 z-50 flex max-w-56 translate-x-(--x) translate-y-(--y) items-center gap-1.5 rounded-menu px-2.5 py-1.5 text-xs font-medium shadow-lg"
			style={{ "--x": `${d.x + 12}px`, "--y": `${d.y - 36}px` } as CSSProperties}
		>
			{at && <span className="tabular-nums text-primary">{at}</span>}
			<span className="truncate">{d.title}</span>
		</div>
	);
}

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
	const d = useDragging();
	const over = d?.over?.date === date ? d.over : null;
	return (
		<div
			data-drop-date={date}
			data-drop-hour={hour}
			className={cn(className, over && !hour && "bg-primary/10")}
		>
			{children}
			{hour && over?.minutes != null && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-1 top-(--top) z-30 flex h-0.5 items-center rounded-full bg-primary"
					style={{ "--top": `${(over.minutes / 60) * hour}px` } as CSSProperties}
				>
					<span className="ml-1 -translate-y-2.5 rounded-sm bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
						{hhmm(over.minutes)}
					</span>
				</div>
			)}
		</div>
	);
}

/** What resizing an event changes: its end, the same day. */
export type Resizable =
	| { kind: "event"; event: EventFields; occurrence?: string }
	| { kind: "google"; google: GoogleRef };

/**
 * The bottom edge of a timed event in the hours: dragged, it sets where the event ends (to the
 * quarter hour, at least 15 minutes long). The row grows as it's dragged; saved on let go.
 */
export function ResizeEdge({
	item,
	start,
	hour,
}: {
	item: Resizable;
	start: string;
	hour: number;
}) {
	const startMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
	return (
		<span
			aria-hidden
			className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
			onClick={(e) => e.stopPropagation()}
			onPointerDown={(e) => {
				if (e.button !== 0) return;
				e.stopPropagation();
				e.preventDefault();
				const row = e.currentTarget.parentElement;
				const column = row?.closest<HTMLElement>("[data-drop-date]");
				if (!row || !column) return;
				const before = row.style.getPropertyValue("--h");
				let end = startMin;
				const endAt = (y: number) => {
					const m =
						Math.round((((y - column.getBoundingClientRect().top) / hour) * 60) / SNAP) * SNAP;
					return Math.max(startMin + SNAP, Math.min(23 * 60 + 59, m));
				};
				track(
					e,
					{
						onStart: () => {},
						onMove: (_, y) => {
							end = endAt(y);
							row.style.setProperty("--h", `${((end - startMin) / 60) * hour - 2}px`);
						},
						onEnd: () => {
							const endTime = hhmm(end);
							const was = item.kind === "event" ? item.event.endTime : item.google.endTime;
							if (endTime === was) return;
							// Didn't take: the row goes back to its length.
							const keep = async (run: Promise<RunResult>) => {
								const r = await run;
								if ("error" in r) row.style.setProperty("--h", before);
								return r;
							};
							if (item.kind === "event") {
								const { run, undo } = changeEvent(item.event, item.occurrence, (e) => ({
									...e,
									endTime,
								}));
								void settle(() => keep(run()), undo);
							} else
								void settle(
									() => keep(saveGoogleEvent(googleFields({ ...item.google, endTime }))),
									() => saveGoogleEvent(googleFields(item.google)),
								);
						},
						onCancel: () => row.style.setProperty("--h", before),
					},
					true,
				);
			}}
		/>
	);
}
