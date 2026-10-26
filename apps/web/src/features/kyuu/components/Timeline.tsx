"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { Mail01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Label, cn } from "@seikatsu/ui";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { deleteEvent, updateEvent } from "../actions/progress";
import { formatDay, formatWhen, localToday } from "../lib/format";
import { addEvent } from "../lib/offline";
import { EVENT_LABELS, type EventKind, STATUS_OF_EVENT } from "../lib/stages";
import type { KyuuEvent } from "../lib/types";
import { FIELD_TEXTAREA } from "./ApplicationDialog";
import { STATUS_LOOK } from "./StatusMark";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

/** What can be logged, in the order it tends to happen. */
const KINDS: EventKind[] = [
	"screening",
	"interview",
	"follow_up",
	"offer",
	"rejected",
	"withdrawn",
	"ghosted",
];
/** Booked ahead, with a time. */
const BOOKABLE: readonly EventKind[] = ["screening", "interview"];

function lookOf(kind: EventKind) {
	const status = STATUS_OF_EVENT[kind];
	return status ? STATUS_LOOK[status] : { icon: Mail01Icon, className: "text-muted-foreground" };
}

/** What happened and what's booked, oldest first; each entry edits in place. */
export function Timeline({
	applicationId,
	dateApplied,
	events,
	today,
	composer,
	onComposer,
}: {
	applicationId: string;
	dateApplied: string;
	events: KyuuEvent[];
	today: string;
	/** The kind being logged, or null when the composer is closed. */
	composer: EventKind | null;
	onComposer: (kind: EventKind | null) => void;
}) {
	const [editing, setEditing] = useState<string | null>(null);

	return (
		<div className="space-y-3">
			<ol className="relative space-y-1 border-l border-rule pl-5">
				<Entry
					tone={STATUS_LOOK.applied.className}
					label="Sent"
					when={formatDay(dateApplied, today)}
				/>
				{events.map((e) =>
					editing === e.id ? (
						<li key={e.id} className="relative py-2">
							<Dot className={lookOf(e.kind).className} />
							<EventForm applicationId={applicationId} event={e} onDone={() => setEditing(null)} />
						</li>
					) : (
						<li key={e.id} className="relative">
							<Dot className={lookOf(e.kind).className} />
							<button
								type="button"
								onClick={() => {
									onComposer(null);
									setEditing(e.id);
								}}
								className="-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
							>
								<EntryBody
									label={EVENT_LABELS[e.kind]}
									when={
										e.date
											? e.date >= today && BOOKABLE.includes(e.kind)
												? formatWhen(e.date, e.time, today)
												: formatDay(e.date, today)
											: "day unknown"
									}
									ahead={!!e.date && e.date > today}
									note={e.note}
								/>
							</button>
						</li>
					),
				)}
			</ol>

			{composer ? (
				<div className="rounded-lg bg-surface p-4">
					<EventForm
						key={composer}
						applicationId={applicationId}
						initialKind={composer}
						onDone={() => onComposer(null)}
					/>
				</div>
			) : (
				<QuietAdd
					onClick={() => {
						setEditing(null);
						onComposer("screening");
					}}
				>
					Log an update
				</QuietAdd>
			)}
		</div>
	);
}

function Dot({ className }: { className: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"absolute top-3 -left-[calc(1.25rem+4.5px)] size-2 rounded-full bg-current",
				className,
			)}
		/>
	);
}

function Entry({ tone, label, when }: { tone: string; label: string; when: string }) {
	return (
		<li className="relative py-1.5">
			<Dot className={tone} />
			<EntryBody label={label} when={when} ahead={false} note={null} />
		</li>
	);
}

function EntryBody({
	label,
	when,
	ahead,
	note,
}: {
	label: string;
	when: string;
	ahead: boolean;
	note: string | null;
}) {
	return (
		<>
			<span className="flex items-baseline justify-between gap-3">
				<span className="inline-flex items-center gap-1.5 text-sm">
					{label}
					{ahead && <span className="text-xs font-normal text-primary">booked</span>}
				</span>
				<span className={cn("shrink-0 text-xs", ahead ? "text-primary" : "text-muted-foreground")}>
					{when}
				</span>
			</span>
			{note && (
				<span className="mt-0.5 block text-sm whitespace-pre-wrap text-muted-foreground">
					{note}
				</span>
			)}
		</>
	);
}

/** Logs a new event, or edits one in place (its kind stays; remove it to change that). */
function EventForm({
	applicationId,
	event,
	initialKind,
	onDone,
}: {
	applicationId: string;
	event?: KyuuEvent;
	initialKind?: EventKind;
	onDone: () => void;
}) {
	const id = useId();
	const [kind, setKind] = useState<EventKind>(event?.kind ?? initialKind ?? "screening");
	const [date, setDate] = useState(event ? (event.date ?? "") : localToday());
	const [time, setTime] = useState(event?.time ?? "");
	const [note, setNote] = useState(event?.note ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();
	const [isRemoving, startRemoving] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	// Opened from a key or a button: bring it into view, ready to type.
	useEffect(() => {
		formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		document.getElementById(`${id}-date`)?.focus({ preventScroll: true });
	}, [id]);

	const bookable = BOOKABLE.includes(kind);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		startSaving(async () => {
			const input = {
				date: date || null,
				time: bookable && time ? time : null,
				note: note.trim() || null,
			};
			const result = await (event
				? updateEvent(event.id, input)
				: addEvent(applicationId, `${EVENT_LABELS[kind]} logged`, { kind, ...input })
			).catch(() => FAILED);
			if ("error" in result) setError(result.error);
			else onDone();
		});
	}

	return (
		<form
			ref={formRef}
			onSubmit={submit}
			onKeyDown={(e) => {
				if (e.key === "Escape") onDone();
			}}
			className="space-y-4"
		>
			{event ? (
				<p className={cn("text-sm font-medium", lookOf(kind).className)}>{EVENT_LABELS[kind]}</p>
			) : (
				<div role="radiogroup" aria-label="What happened" className="flex flex-wrap gap-1.5">
					{KINDS.map((k) => {
						const look = lookOf(k);
						return (
							<button
								key={k}
								type="button"
								role="radio"
								aria-checked={kind === k}
								onClick={() => setKind(k)}
								className={cn(
									"inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
									kind === k
										? cn("bg-background shadow-[inset_0_0_0_1.5px_currentColor]", look.className)
										: "text-muted-foreground hover:bg-background hover:text-foreground",
								)}
							>
								<HugeiconsIcon icon={look.icon} className="size-3.5" strokeWidth={2} />
								{EVENT_LABELS[k]}
							</button>
						);
					})}
				</div>
			)}

			<div className={cn("grid gap-3", bookable ? "grid-cols-2" : "grid-cols-1 sm:max-w-[50%]")}>
				<div className="space-y-1.5">
					<Label htmlFor={`${id}-date`} className="text-xs text-muted-foreground">
						{date > localToday() ? "On" : "Date"}
					</Label>
					<Input
						id={`${id}-date`}
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
				</div>
				{bookable && (
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-time`} className="text-xs text-muted-foreground">
							Time
						</Label>
						<Input
							id={`${id}-time`}
							type="time"
							value={time}
							onChange={(e) => setTime(e.target.value)}
						/>
					</div>
				)}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor={`${id}-note`} className="text-xs text-muted-foreground">
					Note
				</Label>
				<textarea
					id={`${id}-note`}
					value={note}
					maxLength={2000}
					onChange={(e) => setNote(e.target.value)}
					placeholder={bookable ? "Who, where, the call link…" : "What they said…"}
					className={cn(FIELD_TEXTAREA, "min-h-16")}
				/>
			</div>

			{error && (
				<p role="alert" className="text-[0.8rem] text-destructive">
					{error}
				</p>
			)}

			<div className="flex items-center gap-2">
				{event && (
					<Button
						type="button"
						variant="ghost"
						className="mr-auto gap-1.5 text-destructive hover:text-destructive"
						disabled={isSaving || isRemoving}
						onClick={() =>
							startRemoving(async () => {
								const result = await deleteEvent(event.id).catch(() => FAILED);
								if ("error" in result) setError(result.error);
								else onDone();
							})
						}
					>
						{isRemoving && <Spinner />}
						{isRemoving ? "Removing…" : "Remove"}
					</Button>
				)}
				<Button type="button" variant="ghost" className={cn(!event && "ml-auto")} onClick={onDone}>
					Cancel
				</Button>
				<Button type="submit" className="gap-1.5" disabled={isSaving || isRemoving}>
					{isSaving && <Spinner />}
					{isSaving ? "Saving…" : event ? "Save" : "Log it"}
				</Button>
			</div>
		</form>
	);
}
