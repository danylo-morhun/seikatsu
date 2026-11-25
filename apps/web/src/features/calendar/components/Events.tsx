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
	useMemo,
	useState,
} from "react";
import { EventDialog, type EventDraft } from "@/features/calendar/components/EventDialog";
import type { EventFields } from "@/features/calendar/lib/events";
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
	children,
}: {
	href: string;
	event?: EventFields;
	className?: string;
	title?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	const open = useContext(EventsContext);
	if (event && open)
		return (
			<button
				type="button"
				title={title}
				style={style}
				onClick={() => open(event)}
				className={cn("text-left", className)}
			>
				{children}
			</button>
		);
	return (
		<Link href={href} prefetch={false} title={title} className={className} style={style}>
			{children}
		</Link>
	);
}

/** Half hours: a click in an empty stretch of a day's hours starts an event there. */
const STEP = 30;

/**
 * The empty hours of one day: clicking one opens a new event at that half hour, lasting an hour.
 * Sits under the rows, so a row's own click wins.
 */
export function NewAtSlot({ date, hour }: { date: string; hour: number }) {
	const open = useOpenEvent();
	const at = useMemo(
		() => (y: number) => {
			const minutes = Math.min(23 * 60 + 30, Math.floor(((y / hour) * 60) / STEP) * STEP);
			const hh = (m: number) =>
				`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
			return { startTime: hh(minutes), endTime: hh(Math.min(23 * 60 + 59, minutes + 60)) };
		},
		[hour],
	);
	return (
		<div
			aria-hidden
			className="absolute inset-0 cursor-cell"
			onClick={(e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				open({ date, ...at(e.clientY - rect.top) });
			}}
		/>
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
