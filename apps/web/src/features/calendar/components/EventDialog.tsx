"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Checkbox,
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
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { addDays, type EventFields, REPEATS, type Repeat } from "@/features/calendar/lib/events";
import { removeEvent, storeEvent } from "@/features/calendar/lib/offline";
import { eventSchema } from "@/features/calendar/lib/schemas";
import { FIELD_TEXTAREA } from "@/features/keizoku/components/DayNoteDialog";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";

/** What the dialog opens on: an event to edit, or a new one's first values. */
export type EventDraft = Partial<EventFields> & { date: string };

const REPEAT_NAMES: Record<Repeat, string> = {
	day: "Every day",
	week: "Every week",
	month: "Every month",
	year: "Every year",
};
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
	const editing = Boolean(draft?.id);
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [allDay, setAllDay] = useState(true);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("10:00");
	const [repeat, setRepeat] = useState<Repeat | "none">("none");
	const [every, setEvery] = useState(1);
	const [until, setUntil] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();

	// Each open starts from the event, or the slot it was opened on.
	useEffect(() => {
		if (!draft) return;
		setTitle(draft.title ?? "");
		setDate(draft.date);
		setEndDate(draft.endDate ?? draft.date);
		setAllDay(!draft.startTime);
		setStartTime(draft.startTime ?? "09:00");
		setEndTime(draft.endTime ?? hourAfter(draft.startTime ?? "09:00"));
		setRepeat(draft.repeat ?? "none");
		setEvery(draft.repeatEvery ?? 1);
		setUntil(draft.repeatUntil ?? "");
		setNote(draft.note ?? "");
		setError(null);
	}, [draft]);

	function save(e: React.FormEvent) {
		e.preventDefault();
		const input = {
			id: draft?.id ?? crypto.randomUUID(),
			title,
			date,
			endDate: endDate && endDate > date ? endDate : null,
			startTime: allDay ? null : startTime,
			endTime: allDay ? null : endTime,
			repeat: repeat === "none" ? null : repeat,
			repeatEvery: repeat === "none" ? 1 : every,
			repeatUntil: repeat === "none" || !until ? null : until,
			note: note.trim() || null,
		};
		const parsed = eventSchema.safeParse(input);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check the event");
			return;
		}
		startSaving(async () => {
			const result = await storeEvent(parsed.data).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) {
				setError(result.error);
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			onClose();
		});
	}

	function remove() {
		if (!draft?.id) return;
		const eventId = draft.id;
		startSaving(async () => {
			const result = await removeEvent(eventId, draft.title ?? "Event").catch(() => ({
				error: "Couldn't delete. Check your connection.",
			}));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			onClose();
		});
	}

	return (
		<Dialog
			open={draft != null}
			onOpenChange={(v) => {
				if (!v && !isSaving) onClose();
			}}
		>
			<DialogContent className="[--app-kanji:'予'] max-sm:flex max-sm:flex-col sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
					<DialogDescription className="sr-only">
						An event of your own on the calendar: when it is, how often it repeats.
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
							<div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
								<div className="space-y-2">
									<Label htmlFor={`${id}-every`}>Every</Label>
									<Input
										id={`${id}-every`}
										type="number"
										inputMode="numeric"
										min={1}
										max={99}
										value={every}
										aria-describedby={`${id}-unit`}
										onChange={(e) =>
											setEvery(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
										}
									/>
									<span id={`${id}-unit`} className="sr-only">
										{UNIT[repeat][every === 1 ? 0 : 1]}
									</span>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${id}-until`}>Until</Label>
									<Input
										id={`${id}-until`}
										type="date"
										value={until}
										min={date}
										onChange={(e) => setUntil(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<textarea
							id={`${id}-note`}
							value={note}
							maxLength={2000}
							placeholder="Where, who, what to bring"
							onChange={(e) => setNote(e.target.value)}
							className={`${FIELD_TEXTAREA} max-h-40 min-h-16`}
						/>
					</div>

					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}

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
								Delete{draft?.repeat ? " all" : ""}
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
				</form>
			</DialogContent>
		</Dialog>
	);
}
