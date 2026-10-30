"use client";

import type { ColumnData } from "@/features/seiryu/lib/types";
import { useKeptDraft } from "@/hooks/useKeptDraft";
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
import { useEffect, useId, useState } from "react";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Sorted by position; the first is the default. */
	columns: ColumnData[];
	onAdd: (columnId: string, title: string) => void;
	/** Opened from the keyboard: appears and leaves without motion (a shortcut is for speed). */
	instant?: boolean;
}

/** Capture in seconds: the title first and focused, the column beside it remembered. */
export function NewCardDialog({ open, onOpenChange, columns, onAdd, instant = false }: Props) {
	const id = useId();
	const [title, setTitle] = useState("");
	const [columnId, setColumnId] = useState(columns[0]?.id ?? "");

	// A deleted column can't stay selected.
	useEffect(() => {
		if (!columns.some((c) => c.id === columnId)) setColumnId(columns[0]?.id ?? "");
	}, [columns, columnId]);

	// Escape or a click outside keeps the title for next time; Cancel and Add start blank.
	// Cleared on opening, so the closing dialog never shows an empty field.
	const draft = useKeptDraft();
	useEffect(() => {
		if (open && !draft.resume()) setTitle("");
	}, [open]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed || !columnId) return;
		onAdd(columnId, trimmed);
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
							onChange={(e) => setTitle(e.target.value)}
						/>
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
