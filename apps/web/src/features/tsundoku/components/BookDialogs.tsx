"use client";

import { Spinner } from "@/components/Spinner";
import type { TsundokuBook } from "@/features/tsundoku/actions/books";
import { GENRE_OPTIONS } from "@/features/tsundoku/lib/constants";
import type { UpdateBookValues } from "@/features/tsundoku/lib/tsundoku-schemas";
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

export const FOOTER =
	"mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4";

export const FIELD_TEXTAREA =
	"w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

const digits = (v: string) => v.replace(/\D/g, "");
const toInt = (v: string) => (v ? Number.parseInt(v, 10) : null);

type Form = {
	authors: string;
	pageCount: string;
	publishedYear: string;
	genre: string;
	seriesName: string;
	seriesPosition: string;
	coverUrl: string;
	isbn: string;
	description: string;
};

function formOf(book: TsundokuBook): Form {
	return {
		authors: (book.authors ?? []).join(", "),
		pageCount: book.pageCount?.toString() ?? "",
		publishedYear: book.publishedYear?.toString() ?? "",
		genre: book.genre ?? "",
		seriesName: book.seriesName ?? "",
		seriesPosition: book.seriesPosition?.toString() ?? "",
		coverUrl: book.coverUrl ?? "",
		isbn: book.isbn ?? "",
		description: book.description ?? "",
	};
}

/** The fields that changed, as the action takes them (blank clears). */
function changes(book: TsundokuBook, form: Form): UpdateBookValues {
	const next: UpdateBookValues = {
		authors: form.authors
			.split(",")
			.map((a) => a.trim())
			.filter(Boolean),
		pageCount: toInt(form.pageCount),
		publishedYear: toInt(form.publishedYear),
		genre: form.genre || null,
		seriesName: form.seriesName.trim() || null,
		seriesPosition: toInt(form.seriesPosition),
		coverUrl: form.coverUrl.trim() || null,
		isbn: form.isbn.trim() || null,
		description: form.description.trim() || null,
	};
	const before = changesBase(book);
	return Object.fromEntries(
		Object.entries(next).filter(
			([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof typeof before]),
		),
	);
}

function changesBase(book: TsundokuBook): UpdateBookValues {
	return {
		authors: book.authors ?? [],
		pageCount: book.pageCount,
		publishedYear: book.publishedYear,
		genre: book.genre,
		seriesName: book.seriesName,
		seriesPosition: book.seriesPosition,
		coverUrl: book.coverUrl,
		isbn: book.isbn,
		description: book.description,
	};
}

/**
 * The book's details (what search filled in, or gaps it left). Opens on the current values each
 * time and sends only what changed, so it never overwrites a newer edit made elsewhere.
 */
export function EditDetailsDialog({
	book,
	open,
	onOpenChange,
	onSave,
	instant = false,
}: {
	book: TsundokuBook;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Resolves with an error message, or nothing when saved. */
	onSave: (values: UpdateBookValues) => Promise<string | undefined>;
	instant?: boolean;
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(book));
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();
	const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

	useEffect(() => {
		if (open) {
			setForm(formOf(book));
			setError(null);
		}
	}, [open, book]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const values = changes(book, form);
		if (Object.keys(values).length === 0) {
			onOpenChange(false);
			return;
		}
		startSave(async () => {
			const failed = await onSave(values);
			if (failed) setError(failed);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn(
					"sm:max-w-lg max-sm:flex max-sm:flex-col",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
			>
				<DialogHeader>
					<DialogTitle>Edit Details</DialogTitle>
					<DialogDescription className="sr-only">
						Author, length, genre, series and the rest of what describes the book.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-authors`}>Author</Label>
						<Input
							id={`${id}-authors`}
							value={form.authors}
							autoComplete="off"
							placeholder="Separate several with commas"
							onChange={(e) => set("authors", e.target.value)}
						/>
					</div>
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${id}-pages`}>Pages</Label>
							<Input
								id={`${id}-pages`}
								value={form.pageCount}
								inputMode="numeric"
								maxLength={6}
								className="font-figures"
								onChange={(e) => set("pageCount", digits(e.target.value))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-year`}>Year</Label>
							<Input
								id={`${id}-year`}
								value={form.publishedYear}
								inputMode="numeric"
								maxLength={4}
								className="font-figures"
								onChange={(e) => set("publishedYear", digits(e.target.value))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-genre`}>Genre</Label>
							<Select
								value={form.genre || "none"}
								onValueChange={(v) => set("genre", v === "none" ? "" : v)}
							>
								<SelectTrigger id={`${id}-genre`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{/* An imported genre outside the list stays pickable. */}
									{[...new Set([...GENRE_OPTIONS, ...(book.genre ? [book.genre] : [])])].map(
										(g) => (
											<SelectItem key={g} value={g}>
												{g}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${id}-series`}>Series</Label>
							<Input
								id={`${id}-series`}
								value={form.seriesName}
								maxLength={300}
								autoComplete="off"
								onChange={(e) => set("seriesName", e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-position`}>Number</Label>
							<Input
								id={`${id}-position`}
								value={form.seriesPosition}
								inputMode="numeric"
								maxLength={4}
								className="font-figures"
								onChange={(e) => set("seriesPosition", digits(e.target.value))}
							/>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
						<div className="space-y-2">
							<Label htmlFor={`${id}-cover`}>Cover image URL</Label>
							<Input
								id={`${id}-cover`}
								value={form.coverUrl}
								inputMode="url"
								autoComplete="off"
								placeholder="https://…"
								onChange={(e) => set("coverUrl", e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-isbn`}>ISBN</Label>
							<Input
								id={`${id}-isbn`}
								value={form.isbn}
								maxLength={32}
								autoComplete="off"
								className="font-figures"
								onChange={(e) => set("isbn", e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-description`}>Description</Label>
						<textarea
							id={`${id}-description`}
							value={form.description}
							maxLength={20000}
							onChange={(e) => set("description", e.target.value)}
							className={cn(FIELD_TEXTAREA, "max-h-48 min-h-20")}
						/>
					</div>
					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** An earlier reading day: pages first (the number that matters), the day beside it. */
/** Logs a forgotten day, or corrects a logged one when `day` is given. */
export function LogDayDialog({
	open,
	onOpenChange,
	today,
	day,
	onLog,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	today: string;
	day?: { date: string; pagesRead: number } | null;
	/** Resolves with an error message, or nothing when saved. */
	onLog: (values: { date: string; pagesRead: number }) => Promise<string | undefined>;
}) {
	const id = useId();
	const [pages, setPages] = useState("");
	const [date, setDate] = useState(today);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	useEffect(() => {
		if (open) {
			setPages(day ? String(day.pagesRead) : "");
			setDate(day?.date ?? today);
			setError(null);
		}
	}, [open, today, day]);

	const pagesRead = toInt(pages) ?? 0;
	const valid = pagesRead > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!valid) return;
		startSave(async () => {
			const failed = await onLog({ date, pagesRead });
			if (failed) setError(failed);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className="sm:max-w-sm max-sm:flex max-sm:flex-col"
				onOpenAutoFocus={(e) => {
					const field = document.getElementById(`${id}-pages`);
					if (!field) return;
					e.preventDefault();
					field.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{day ? "Edit Reading Day" : "Log a Reading Day"}</DialogTitle>
					<DialogDescription>
						{day
							? "The book's progress follows the pages."
							: "For a day you forgot; the pages move the book on."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${id}-pages`}>Pages read</Label>
							<Input
								id={`${id}-pages`}
								value={pages}
								inputMode="numeric"
								maxLength={5}
								autoComplete="off"
								className="font-figures text-lg font-semibold"
								onChange={(e) => setPages(digits(e.target.value))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-date`}>Day</Label>
							<Input
								id={`${id}-date`}
								type="date"
								value={date}
								max={today}
								onChange={(e) => setDate(e.target.value)}
							/>
						</div>
					</div>
					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving || !valid}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : day ? "Save" : "Log"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
