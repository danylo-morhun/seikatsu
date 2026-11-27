"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Checkbox,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { deleteGoogleEvent, saveGoogleEvent } from "@/features/calendar/actions/google";
import {
	addDays,
	daysBetween,
	type EventFields,
	NO_REPEAT,
	REPEATS,
	type Repeat,
	type Scope,
	splitSeries,
	weekdayOf,
	weekOfMonth,
} from "@/features/calendar/lib/events";
import { removeEvent, storeEvent, storeEventSet } from "@/features/calendar/lib/offline";
import { eventSchema } from "@/features/calendar/lib/schemas";
import { FIELD_TEXTAREA } from "@/features/keizoku/components/DayNoteDialog";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";

/** What the dialog opens on: an event to edit, or a new one's first values; with `google`,
 * an event in one of the user's Google calendars. */
export type EventDraft = Partial<EventFields> & {
	date: string;
	/** A repeating event opened on one of its days: that day's start. A change then asks
	 * whether it's for this day, this and the following, or all of them. */
	occurrence?: string;
	google?: { calendarId: string; googleId: string; calendarName: string; recurring: boolean };
};

const REPEAT_NAMES: Record<Repeat, string> = {
	day: "Every day",
	week: "Every week",
	month: "Every month",
	year: "Every year",
};
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];
const NTH = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" } as Record<number, string>;
type Ends = "never" | "on" | "after";

const SCOPES: { scope: Scope; label: string }[] = [
	{ scope: "one", label: "This event" },
	{ scope: "following", label: "This and following" },
	{ scope: "all", label: "All events" },
];

const UNIT: Record<Repeat, [string, string]> = {
	day: ["day", "days"],
	week: ["week", "weeks"],
	month: ["month", "months"],
	year: ["year", "years"],
};

/** An hour after "HH:MM", kept within the day. */
function hourAfter(time: string): string {
	const [h, m] = time.split(":").map(Number);
	const end = Math.min(23 * 60 + 59, h * 60 + m + 60);
	return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/**
 * An event, made or changed: its name, when (all day or from–to, over one day or several), how
 * often it repeats, a note. Saving works offline; deleting a repeating event deletes them all.
 */
export function EventDialog({
	draft,
	onClose,
}: {
	/** Open while there is one. */
	draft: EventDraft | null;
	onClose: () => void;
}) {
	const id = useId();
	const google = draft?.google;
	const editing = Boolean(draft?.id || google);
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [allDay, setAllDay] = useState(true);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("10:00");
	const [repeat, setRepeat] = useState<Repeat | "none">("none");
	const [every, setEvery] = useState(1);
	const [until, setUntil] = useState("");
	const [count, setCount] = useState(10);
	const [ends, setEnds] = useState<Ends>("never");
	const [days, setDays] = useState<number[]>([]);
	const [byWeekday, setByWeekday] = useState(false);
	const [location, setLocation] = useState("");
	const [note, setNote] = useState("");
	/** Saving or deleting one day of a repeating event: which of them it's for. */
	const [asking, setAsking] = useState<"save" | "delete" | null>(null);
	const question = useRef<HTMLDivElement>(null);
	// The question sits at the bottom of a long form: brought into view when it's asked.
	useEffect(() => {
		if (asking) question.current?.scrollIntoView({ block: "nearest" });
	}, [asking]);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();

	// Each open starts from the event, or the slot it was opened on.
	useEffect(() => {
		if (!draft) return;
		// A day of a repeating event shows that day, its end as far after it as the series'.
		const shift = draft.occurrence ? daysBetween(draft.date, draft.occurrence) : 0;
		setTitle(draft.title ?? "");
		setDate(addDays(draft.date, shift));
		setEndDate(addDays(draft.endDate ?? draft.date, shift));
		setAllDay(!draft.startTime);
		setStartTime(draft.startTime ?? "09:00");
		setEndTime(draft.endTime ?? hourAfter(draft.startTime ?? "09:00"));
		setRepeat(draft.repeat ?? "none");
		setEvery(draft.repeatEvery ?? 1);
		setUntil(draft.repeatUntil ?? "");
		setCount(draft.repeatCount ?? 10);
		setEnds(draft.repeatCount ? "after" : draft.repeatUntil ? "on" : "never");
		setDays(draft.repeatDays ?? []);
		setByWeekday(draft.repeatByWeekday ?? false);
		setLocation(draft.location ?? "");
		setNote(draft.note ?? "");
		setError(null);
		setAsking(null);
	}, [draft]);

	/** The day this was opened on, when it's one day of a repeating event of the user's. */
	const occurrence =
		!google && draft?.id && draft.repeat && draft.occurrence ? draft.occurrence : null;

	/** The form as an event, checked; null (with the reason shown) when it doesn't hold. */
	function fromForm(): EventFields | null {
		const repeating = repeat !== "none";
		const input = {
			id: draft?.id ?? crypto.randomUUID(),
			title,
			date,
			endDate: endDate && endDate > date ? endDate : null,
			startTime: allDay ? null : startTime,
			endTime: allDay ? null : endTime,
			...NO_REPEAT,
			...(repeating && {
				repeat,
				repeatEvery: every,
				repeatUntil: ends === "on" && until ? until : null,
				repeatCount: ends === "after" ? count : null,
				repeatDays: repeat === "week" && days.length ? days : null,
				repeatByWeekday: repeat === "month" && byWeekday,
				skip: draft?.skip ?? [],
			}),
			location: location.trim() || null,
			note: note.trim() || null,
		};
		const parsed = eventSchema.safeParse(input);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check the event");
			return null;
		}
		return parsed.data as EventFields;
	}

	function done(result: { error: string } | object, fail: (m: string) => void) {
		if ("error" in result) {
			fail(result.error);
			return;
		}
		if ("queued" in result) toast(QUEUED_TOAST);
		onClose();
	}

	/** Saves (or with `next` null deletes) one day of the series, the following, or all. */
	function applyTo(scope: Scope, next: EventFields | null) {
		if (!draft?.id || !occurrence) return;
		const series = draft as EventFields;
		// "All": the series moves by as many days as this day was moved.
		const whole =
			next && scope === "all"
				? (() => {
						const shift = daysBetween(occurrence, next.date);
						return {
							...next,
							date: addDays(series.date, shift),
							endDate: next.endDate
								? addDays(series.date, shift + daysBetween(next.date, next.endDate))
								: null,
						};
					})()
				: next;
		const set = splitSeries(series, occurrence, scope, whole, crypto.randomUUID());
		startSaving(async () => {
			const result = await storeEventSet(set, series.title).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			done(result, next ? setError : (m) => toast.error(m));
		});
	}

	function save(e: React.FormEvent) {
		e.preventDefault();
		const parsed = fromForm();
		if (!parsed) return;
		if (google) {
			const {
				id: _,
				repeat: __,
				repeatEvery: ___,
				repeatUntil: ____,
				repeatCount: _____,
				repeatDays: ______,
				repeatByWeekday: _______,
				skip: ________,
				location: _________,
				...fields
			} = parsed;
			startSaving(async () => {
				const result = await saveGoogleEvent({ ...google, ...fields }).catch(() => ({
					error: "Couldn't reach Google. Check your connection.",
				}));
				if ("error" in result) setError(result.error);
				else onClose();
			});
			return;
		}
		if (occurrence) {
			setAsking("save");
			return;
		}
		startSaving(async () => {
			const result = await storeEvent(parsed).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			done(result, setError);
		});
	}

	function remove() {
		if (google) {
			startSaving(async () => {
				const result = await deleteGoogleEvent(google).catch(() => ({
					error: "Couldn't reach Google. Check your connection.",
				}));
				if ("error" in result) toast.error(result.error);
				else onClose();
			});
			return;
		}
		if (!draft?.id) return;
		if (occurrence) {
			setAsking("delete");
			return;
		}
		const eventId = draft.id;
		startSaving(async () => {
			const result = await removeEvent(eventId, draft.title ?? "Event").catch(() => ({
				error: "Couldn't delete. Check your connection.",
			}));
			done(result, (m) => toast.error(m));
		});
	}

	function answer(scope: Scope) {
		if (asking === "delete") applyTo(scope, null);
		else {
			const next = fromForm();
			if (next) applyTo(scope, next);
		}
	}

	return (
		<Dialog
			open={draft != null}
			onOpenChange={(v) => {
				if (!v && !isSaving) onClose();
			}}
		>
			<DialogContent
				className={cn(
					google ? "[--app-kanji:'外']" : "[--app-kanji:'予']",
					"max-sm:flex max-sm:flex-col sm:max-w-lg",
				)}
			>
				<DialogHeader>
					<DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
					<DialogDescription className={google ? "text-sm" : "sr-only"}>
						{google
							? `In ${google.calendarName}${google.recurring ? " · changes apply to this day only" : ""}`
							: "An event of your own on the calendar: when it is, how often it repeats."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={save} className="flex flex-1 flex-col gap-4">
					<Input
						aria-label="Event name"
						value={title}
						maxLength={200}
						autoComplete="off"
						placeholder="Dentist, a trip, a birthday…"
						onChange={(e) => setTitle(e.target.value)}
						className="h-11 text-base font-medium"
						autoFocus
					/>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor={`${id}-date`}>Starts</Label>
							<Input
								id={`${id}-date`}
								type="date"
								value={date}
								required
								onChange={(e) => {
									const next = e.target.value;
									// The end keeps its distance from the start.
									if (next && date && endDate >= date)
										setEndDate(
											addDays(
												next,
												Math.round((Date.parse(endDate) - Date.parse(date)) / 86_400_000),
											),
										);
									setDate(next);
								}}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-end`}>Ends</Label>
							<Input
								id={`${id}-end`}
								type="date"
								value={endDate}
								min={date}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-3">
						<Label className="flex w-fit items-center gap-2 font-normal">
							<Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
							All day
						</Label>
						{!allDay && (
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor={`${id}-from`}>From</Label>
									<Input
										id={`${id}-from`}
										type="time"
										value={startTime}
										onChange={(e) => {
											const next = e.target.value;
											if (next && endTime <= next) setEndTime(hourAfter(next));
											setStartTime(next);
										}}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${id}-to`}>To</Label>
									<Input
										id={`${id}-to`}
										type="time"
										value={endTime}
										onChange={(e) => setEndTime(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					{!google && (
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`${id}-repeat`}>Repeats</Label>
								<Select value={repeat} onValueChange={(v) => setRepeat(v as Repeat | "none")}>
									<SelectTrigger id={`${id}-repeat`} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Never</SelectItem>
										{REPEATS.map((r) => (
											<SelectItem key={r} value={r}>
												{REPEAT_NAMES[r]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{repeat !== "none" && (
								<div className="space-y-2">
									<Label htmlFor={`${id}-every`}>Every</Label>
									<div className="flex items-center gap-2">
										<Input
											id={`${id}-every`}
											type="number"
											inputMode="numeric"
											min={1}
											max={99}
											value={every}
											className="w-20"
											onChange={(e) =>
												setEvery(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
											}
										/>
										<span className="text-sm text-muted-foreground">
											{UNIT[repeat][every === 1 ? 0 : 1]}
										</span>
									</div>
								</div>
							)}
						</div>
					)}

					{!google && repeat === "week" && (
						<fieldset className="space-y-2">
							<legend className="text-sm font-medium">On</legend>
							<div className="flex gap-1.5">
								{WEEKDAYS.map((letter, i) => {
									const day = i + 1;
									// None picked: the start day's own weekday.
									const on = days.length ? days.includes(day) : date && weekdayOf(date) === day;
									return (
										<button
											key={WEEKDAY_NAMES[i]}
											type="button"
											aria-label={WEEKDAY_NAMES[i]}
											aria-pressed={Boolean(on)}
											onClick={() => {
												const now = days.length ? days : date ? [weekdayOf(date)] : [];
												const next = now.includes(day)
													? now.filter((d) => d !== day)
													: [...now, day];
												setDays(next.sort((a, b) => a - b));
											}}
											className={cn(
												"flex size-9 items-center justify-center rounded-button text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring",
												on
													? "bg-primary text-primary-foreground"
													: "bg-surface-2 text-muted-foreground hover:text-foreground",
											)}
										>
											{letter}
										</button>
									);
								})}
							</div>
						</fieldset>
					)}

					{!google && repeat === "month" && date && (
						<div className="space-y-2">
							<Label htmlFor={`${id}-by`}>On</Label>
							<Select
								value={byWeekday ? "weekday" : "day"}
								onValueChange={(v) => setByWeekday(v === "weekday")}
							>
								<SelectTrigger id={`${id}-by`} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="day">Day {Number(date.slice(8, 10))}</SelectItem>
									<SelectItem value="weekday">
										The {NTH[weekOfMonth(date)]} {WEEKDAY_NAMES[weekdayOf(date) - 1]}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					{!google && repeat !== "none" && (
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`${id}-ends`}>Stops</Label>
								<Select value={ends} onValueChange={(v) => setEnds(v as Ends)}>
									<SelectTrigger id={`${id}-ends`} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="never">Never</SelectItem>
										<SelectItem value="on">On a day</SelectItem>
										<SelectItem value="after">After a number of times</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{ends === "on" && (
								<div className="space-y-2">
									<Label htmlFor={`${id}-until`}>Last day</Label>
									<Input
										id={`${id}-until`}
										type="date"
										value={until}
										min={date}
										onChange={(e) => setUntil(e.target.value)}
									/>
								</div>
							)}
							{ends === "after" && (
								<div className="space-y-2">
									<Label htmlFor={`${id}-count`}>Times</Label>
									<Input
										id={`${id}-count`}
										type="number"
										inputMode="numeric"
										min={1}
										max={999}
										value={count}
										onChange={(e) =>
											setCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))
										}
									/>
								</div>
							)}
						</div>
					)}

					{!google && (
						<div className="space-y-2">
							<Label htmlFor={`${id}-where`}>Where</Label>
							<Input
								id={`${id}-where`}
								value={location}
								maxLength={500}
								autoComplete="off"
								placeholder="A place, an address, a call's link"
								onChange={(e) => setLocation(e.target.value)}
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<textarea
							id={`${id}-note`}
							value={note}
							maxLength={2000}
							placeholder="Who, what to bring"
							onChange={(e) => setNote(e.target.value)}
							className={`${FIELD_TEXTAREA} max-h-40 min-h-16`}
						/>
					</div>

					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}

					{asking ? (
						<div
							ref={question}
							role="group"
							aria-label={asking === "delete" ? "Delete which of them?" : "Change which of them?"}
							className="mt-auto space-y-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4"
						>
							<p className="text-sm font-medium">
								{asking === "delete" ? "Delete which of them?" : "Change which of them?"}
							</p>
							<div className="flex flex-wrap gap-2">
								{SCOPES.map(({ scope, label }) => (
									<Button
										key={scope}
										type="button"
										variant={
											asking === "delete" ? "outline" : scope === "one" ? "default" : "outline"
										}
										disabled={isSaving}
										onClick={() => answer(scope)}
										className={cn("max-sm:flex-1", asking === "delete" && "hover:text-destructive")}
									>
										{label}
									</Button>
								))}
								<Button
									type="button"
									variant="ghost"
									disabled={isSaving}
									onClick={() => setAsking(null)}
									className="gap-1.5 max-sm:w-full"
								>
									{isSaving && <Spinner />}
									{isSaving ? "Saving…" : "Back"}
								</Button>
							</div>
						</div>
					) : (
						<div className="mt-auto flex items-center gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4">
							{editing && (
								<Button
									type="button"
									variant="ghost"
									className="gap-1.5 text-muted-foreground hover:text-destructive"
									onClick={remove}
									disabled={isSaving}
								>
									<HugeiconsIcon icon={Delete02Icon} className="size-4" />
									{google?.recurring ? "Delete this day" : "Delete"}
								</Button>
							)}
							<div className="ml-auto flex gap-2 max-sm:flex-1">
								<Button
									type="button"
									variant="outline"
									onClick={onClose}
									disabled={isSaving}
									className="max-sm:flex-1"
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isSaving} className="gap-1.5 max-sm:flex-1">
									{isSaving && <Spinner />}
									{isSaving ? "Saving…" : "Save"}
								</Button>
							</div>
						</div>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
