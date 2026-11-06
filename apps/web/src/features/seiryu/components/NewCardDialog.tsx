"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
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
import { useEffect, useId, useState } from "react";
import { addDays } from "@/features/seiryu/lib/filters";
import { type ParsedDue, parseDue } from "@/features/seiryu/lib/parse-due";
import { dueLabel } from "@/features/seiryu/lib/reminder";
import type { ColumnData } from "@/features/seiryu/lib/types";
import { useKeptDraft } from "@/hooks/useKeptDraft";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Sorted by position; the first is the default. */
	columns: ColumnData[];
	/** `due`: what was read from the title, or null to keep the title as typed. */
	onAdd: (columnId: string, title: string, due: ParsedDue | null) => void;
	/** The user's calendar day, to read "tomorrow" in the title against. */
	today: string;
	/** Opened from the keyboard: appears and leaves without motion (a shortcut is for speed). */
	instant?: boolean;
}

/** Capture in seconds: the title first and focused, the column beside it remembered. */
export function NewCardDialog({
	open,
	onOpenChange,
	columns,
	onAdd,
	today,
	instant = false,
}: Props) {
	const id = useId();
	const [title, setTitle] = useState("");
	// "Keep as text": the title names a day that isn't the card's due date.
	const [literal, setLiteral] = useState(false);
	const due = literal ? null : parseDue(title.trim(), today);
	const [columnId, setColumnId] = useState(columns[0]?.id ?? "");

	// A deleted column can't stay selected.
	useEffect(() => {
		if (!columns.some((c) => c.id === columnId)) setColumnId(columns[0]?.id ?? "");
	}, [columns, columnId]);

	// Escape or a click outside keeps the title for next time; Cancel and Add start blank.
	// Cleared on opening, so the closing dialog never shows an empty field.
	const draft = useKeptDraft();
	useEffect(() => {
		if (open && !draft.resume()) {
			setTitle("");
			setLiteral(false);
		}
	}, [open]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed || !columnId) return;
		onAdd(columnId, trimmed, due);
		onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) draft.keep();
				onOpenChange(next);
			}}
		>
			<DialogContent
				className={cn(
					"sm:max-w-md max-sm:flex max-sm:flex-col",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					const field = document.getElementById(`${id}-title`);
					if (!field) return;
					e.preventDefault();
					// No scroll-into-view: mid-entrance it scrolls the page and flashes a scrollbar.
					field.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>New Card</DialogTitle>
					<DialogDescription className="sr-only">
						Name the card and pick its column; the rest can wait.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-title`}>Title</Label>
						<Input
							id={`${id}-title`}
							value={title}
							maxLength={500}
							autoComplete="off"
							placeholder="What needs doing?"
							aria-describedby={due ? `${id}-due` : undefined}
							onChange={(e) => setTitle(e.target.value)}
						/>
						{due && (
							<p
								id={`${id}-due`}
								className="flex animate-swap items-center gap-2 text-xs text-muted-foreground"
							>
								<HugeiconsIcon icon={Calendar03Icon} className="h-3.5 w-3.5 shrink-0" />
								<span className="min-w-0 truncate">
									Due{" "}
									<span className="text-foreground">
										{dueLabel(due.dueDate, due.dueTime, today, addDays(today, 1))}
									</span>
									{due.dueTime && ", reminder at the time"}
								</span>
								<button
									type="button"
									onClick={() => setLiteral(true)}
									className="ml-auto shrink-0 rounded-button px-1.5 py-0.5 underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
								>
									Keep as text
								</button>
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-column`}>Column</Label>
						<Select value={columnId} onValueChange={setColumnId}>
							<SelectTrigger id={`${id}-column`}>
								<SelectValue placeholder="Pick a column" />
							</SelectTrigger>
							<SelectContent>
								{columns.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Phones: actions sit at the bottom of the full-screen sheet, in thumb reach. */}
					<div className="mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4">
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="max-sm:flex-1" disabled={!title.trim() || !columnId}>
							Add card
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
