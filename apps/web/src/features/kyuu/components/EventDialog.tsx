"use client";

import { Spinner } from "@/components/Spinner";
import { FOOTER } from "@/features/keizoku/components/HabitDialog";
import {
	Button,
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
	cn,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";
import type { EventInput } from "../actions/progress";
import { localToday } from "../lib/format";
import { EVENT_KINDS, EVENT_LABELS, type EventKind } from "../lib/stages";
import type { KyuuEvent } from "../lib/types";
import { FIELD_TEXTAREA } from "./ApplicationDialog";

/** Booked ahead, with a time: a screen or an interview. */
const BOOKABLE: readonly EventKind[] = ["screening", "interview"];

export type EventTarget =
	| { mode: "new"; company: string; kind: EventKind }
	| { mode: "edit"; company: string; event: KyuuEvent };

interface Props {
	target: EventTarget | null;
	instant?: boolean;
	onOpenChange: (open: boolean) => void;
	/** Resolves to an error message, or nothing when saved. */
	onSave: (input: EventInput) => Promise<string | undefined>;
	onDelete?: () => Promise<string | undefined>;
}

/** Logs what happened, or books what's next: a screen, an interview, an answer, a follow-up. */
export function EventDialog({ target, instant = false, onOpenChange, onSave, onDelete }: Props) {
	const id = useId();
	const open = target != null;
	const [kind, setKind] = useState<EventKind>("screening");
	const [date, setDate] = useState("");
	const [time, setTime] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();
	const [isDeleting, startDeleting] = useTransition();

	useEffect(() => {
		if (!target) return;
		setError(null);
		if (target.mode === "new") {
			setKind(target.kind);
			setDate(localToday());
			setTime("");
			setNote("");
		} else {
			setKind(target.event.kind);
			setDate(target.event.date ?? "");
			setTime(target.event.time ?? "");
			setNote(target.event.note ?? "");
		}
	}, [target]);

	const isNew = target?.mode === "new";
	const today = localToday();
	const ahead = date > today;

	function submit(e: React.FormEvent) {
		e.preventDefault();
		startSaving(async () => {
			const message = await onSave({
				kind,
				date: date || null,
				time: BOOKABLE.includes(kind) && time ? time : null,
				note: note.trim() || null,
			});
			if (message) setError(message);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn(
					"max-sm:flex max-sm:flex-col sm:max-w-sm",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>
						{isNew
							? BOOKABLE.includes(kind)
								? kind === "interview"
									? "Book an interview"
									: "Book a screening"
								: "Log an update"
							: EVENT_LABELS[kind]}
					</DialogTitle>
					<DialogDescription>{target?.company}</DialogDescription>
				</DialogHeader>

				<form onSubmit={submit} className="flex flex-1 flex-col gap-4">
					{isNew && (
						<div className="space-y-2">
							<Label htmlFor={`${id}-kind`}>What</Label>
							<Select value={kind} onValueChange={(v) => setKind(v as EventKind)}>
								<SelectTrigger id={`${id}-kind`} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EVENT_KINDS.map((k) => (
										<SelectItem key={k} value={k}>
											{EVENT_LABELS[k]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					<div className={cn("grid gap-4", BOOKABLE.includes(kind) && "grid-cols-2")}>
						<div className="space-y-2">
							<Label htmlFor={`${id}-date`}>{ahead ? "On" : "Date"}</Label>
							<Input
								id={`${id}-date`}
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</div>
						{BOOKABLE.includes(kind) && (
							<div className="space-y-2">
								<Label htmlFor={`${id}-time`}>Time</Label>
								<Input
									id={`${id}-time`}
									type="time"
									value={time}
									onChange={(e) => setTime(e.target.value)}
								/>
							</div>
						)}
					</div>
					{!date && (
						<p className="-mt-2 text-xs text-muted-foreground">No date: the day isn't known.</p>
					)}

					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<textarea
							id={`${id}-note`}
							value={note}
							maxLength={2000}
							onChange={(e) => setNote(e.target.value)}
							placeholder={
								BOOKABLE.includes(kind) ? "Who, where, the call link…" : "What they said…"
							}
							className={cn(FIELD_TEXTAREA, "min-h-20")}
						/>
					</div>

					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}

					<div className={FOOTER}>
						{!isNew && onDelete && (
							<Button
								type="button"
								variant="ghost"
								className="mr-auto gap-1.5 text-destructive hover:text-destructive"
								disabled={isSaving || isDeleting}
								onClick={() =>
									startDeleting(async () => {
										const message = await onDelete();
										if (message) setError(message);
										else onOpenChange(false);
									})
								}
							>
								{isDeleting && <Spinner />}
								{isDeleting ? "Removing…" : "Remove"}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="gap-1.5 max-sm:flex-1"
							disabled={isSaving || isDeleting}
						>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
