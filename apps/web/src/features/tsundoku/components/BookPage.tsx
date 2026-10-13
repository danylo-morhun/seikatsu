"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { QuietAdd } from "@/components/QuietAdd";
import {
	type SeriesBook,
	type TsundokuBook,
	deleteBook,
	setBookShelves,
	setProgress,
	updateBook,
	updateRating,
	updateStatus,
} from "@/features/tsundoku/actions/books";
import type { TsundokuQuote } from "@/features/tsundoku/actions/quotes";
import { type TsundokuSession, logSession } from "@/features/tsundoku/actions/sessions";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import {
	EditDetailsDialog,
	FIELD_TEXTAREA,
	LogDayDialog,
} from "@/features/tsundoku/components/BookDialogs";
import {
	QuotesSection,
	SeriesSection,
	SessionsSection,
	ShelfPicker,
} from "@/features/tsundoku/components/BookSections";
import { ProgressField } from "@/features/tsundoku/components/ProgressField";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { StarRating } from "@/features/tsundoku/components/StarRating";
import { BOOK_STATUSES, type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { computePace } from "@/features/tsundoku/lib/pace";
import { progressPatch, statusPatch } from "@/features/tsundoku/lib/progress";
import { daysBetween } from "@/features/tsundoku/lib/streak";
import { useDraft } from "@/hooks/useDraft";
import { pageKey } from "@/lib/capture-shortcut";
import { parseLocal } from "@/lib/dates";
import {
	ArrowLeft01Icon,
	Calendar03Icon,
	Delete01Icon,
	Link01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
	book: TsundokuBook;
	sessions: TsundokuSession[];
	quotes: TsundokuQuote[];
	shelves: TsundokuShelf[];
	seriesBooks: SeriesBook[];
	/** The user's calendar day (tz cookie). */
	today: string;
}

type Result = { error: string } | { success: true };
const offline = (): Result => ({ error: "Couldn't save. Check your connection." });
const KEY_STATUS: Record<string, BookStatus> = { p: "want", r: "reading", d: "read" };
const pluralDays = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const longDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

/**
 * One book: who wrote it and where you are in it, then what stayed with you — notes, quotes —
 * and the record. Every field saves itself; nothing waits for a Save button.
 */
export function BookPage({ book: initial, sessions, quotes, shelves, seriesBooks, today }: Props) {
	const id = useId();
	const [book, setBook] = useState(initial);
	const [editing, setEditing] = useState<{ open: boolean; instant: boolean }>({
		open: false,
		instant: false,
	});
	const [loggingDay, setLoggingDay] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [addingQuote, setAddingQuote] = useState(false);
	const [writingNotes, setWritingNotes] = useState(false);
	const progressRef = useRef<HTMLInputElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);

	// The server's version wins whenever it changes (after any action's re-render).
	useEffect(() => setBook(initial), [initial]);

	/** Shows the change at once; a failure says so and puts the old value back. */
	async function persist(changes: Partial<TsundokuBook>, save: () => Promise<Result>) {
		const before = book;
		setBook((b) => ({ ...b, ...changes }));
		const result = await save().catch(offline);
		if ("error" in result) {
			toast.error(result.error);
			setBook(before);
			return result.error;
		}
	}

	const setStatus = (status: BookStatus) =>
		status !== book.status &&
		persist(statusPatch(book, status, today), () => updateStatus(book.id, status));
	const setRating = (rating: number | null) =>
		persist({ rating }, () => updateRating(book.id, rating));
	const saveProgress = (page: number) =>
		persist(progressPatch(book, page, today), () => setProgress(book.id, { currentPage: page }));

	const title = useDraft(book.title, (next) => {
		const trimmed = next.trim();
		if (trimmed && trimmed !== book.title)
			persist({ title: trimmed }, () => updateBook(book.id, { title: trimmed }));
		else title.revert();
	});
	const notes = useDraft(book.review ?? "", (next) => {
		const value = next.trim() ? next : null;
		if (value !== book.review)
			persist({ review: value }, () => updateBook(book.id, { review: value }));
	});

	// Book keys on its own page: L progress, 1–5 stars, P/R/D status, E details, Q quote, ⌫ delete.
	const keyRef = useRef<(key: string) => boolean>(() => false);
	keyRef.current = (key) => {
		if (key === "l") {
			progressRef.current?.focus();
			progressRef.current?.scrollIntoView({ block: "nearest" });
		} else if (/^[1-5]$/.test(key)) setRating(Number(key) * 2);
		else if (key === "0") setRating(null);
		else if (KEY_STATUS[key]) setStatus(KEY_STATUS[key]);
		else if (key === "e") setEditing({ open: true, instant: true });
		else if (key === "q") setAddingQuote(true);
		else if (key === ".") setMenuOpen(true);
		else if (key === "delete") setConfirmDelete(true);
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k && keyRef.current(k)) e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const pace =
		book.status === "reading" ? computePace(sessions, book.currentPage, book.pageCount) : null;
	const meta = [
		book.publishedYear,
		book.pageCount && `${book.pageCount} pages`,
		book.genre,
		book.seriesName &&
			`${book.seriesPosition ? `#${book.seriesPosition} · ` : ""}${book.seriesName}`,
	].filter(Boolean);
	const finished = book.status === "read" && book.finishedAt;

	return (
		<div className="max-w-3xl px-4 pt-5 pb-28 sm:px-8 md:pb-10">
			<div className="mb-6 flex items-center justify-between gap-4">
				<Link
					href="/tsundoku"
					prefetch
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4 shrink-0" />
					Library
				</Link>
				<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="Book actions">
							<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuItem onClick={() => setEditing({ open: true, instant: false })}>
							<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
							Edit details…
							<DropdownMenuShortcut>E</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setLoggingDay(true)}>
							<HugeiconsIcon icon={Calendar03Icon} className="mr-2 h-4 w-4" />
							Log an earlier day…
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								navigator.clipboard
									.writeText(window.location.href)
									.then(() => toast.success("Link copied"))
									.catch(() => toast.error("Couldn't copy the link"))
							}
						>
							<HugeiconsIcon icon={Link01Icon} className="mr-2 h-4 w-4" />
							Copy link
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
							Delete…
							<DropdownMenuShortcut>⌫</DropdownMenuShortcut>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-8">
				<BookCover
					coverUrl={book.coverUrl}
					title={book.title}
					priority
					className="animate-rise self-start"
				/>

				<div className="animate-rise min-w-0 space-y-1" style={{ "--i": 1 } as React.CSSProperties}>
					<h1 className="sr-only">{book.title}</h1>
					<textarea
						aria-label="Title"
						value={title.draft}
						rows={1}
						maxLength={500}
						onChange={(e) => title.change(e.target.value)}
						onBlur={title.flush}
						onKeyDown={(e) => {
							// A title is one line: Enter commits instead of breaking it.
							if (e.key === "Enter") {
								e.preventDefault();
								e.currentTarget.blur();
							}
						}}
						className="-mx-2 block w-[calc(100%+1rem)] resize-none rounded-md bg-transparent px-2 py-1 text-xl leading-snug font-semibold tracking-tight break-words outline-none transition-colors duration-150 [field-sizing:content] hover:bg-surface focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
					/>
					{book.authors && book.authors.length > 0 && (
						<p className="text-sm break-words">{book.authors.join(", ")}</p>
					)}
					{meta.length > 0 && (
						<p className="font-figures text-xs text-muted-foreground break-words">
							{meta.join(" · ")}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 max-sm:hidden">
						<StatusAndRating id={id} book={book} onStatus={setStatus} onRating={setRating} />
					</div>
				</div>

				{/* Phones: the controls take the full width under cover and title. */}
				<div className="col-span-2 -mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:hidden">
					<StatusAndRating id={`${id}-m`} book={book} onStatus={setStatus} onRating={setRating} />
				</div>
			</div>

			<div className="mt-10 space-y-10">
				{/* Where you are */}
				<section
					aria-labelledby={`${id}-progress`}
					className="animate-rise"
					style={{ "--i": 2 } as React.CSSProperties}
				>
					<h2 id={`${id}-progress`} className="mb-3 text-sm font-medium">
						{finished ? "Finished" : "Progress"}
					</h2>
					{finished ? (
						<p className="text-sm text-muted-foreground">
							{longDate.format(parseLocal(book.finishedAt as string))}
							{book.startedAt &&
								` · in ${pluralDays(daysBetween(book.startedAt, book.finishedAt as string) + 1)}`}
						</p>
					) : (
						<div className="space-y-4">
							<ProgressMeter
								currentPage={book.currentPage}
								pageCount={book.pageCount}
								daysToFinish={pace?.daysToFinish}
							/>
							<ProgressField
								ref={progressRef}
								id={`${id}-page`}
								currentPage={book.currentPage}
								pageCount={book.pageCount}
								onSubmit={saveProgress}
								className="max-w-sm"
							/>
						</div>
					)}
				</section>

				{/* What stayed with you */}
				<section aria-labelledby={`${id}-notes`}>
					<h2 id={`${id}-notes`} className="mb-3 text-sm font-medium">
						Notes
					</h2>
					{!notes.draft && !writingNotes ? (
						<QuietAdd onClick={() => setWritingNotes(true)}>Add notes</QuietAdd>
					) : (
						<div className="animate-swap">
							<label htmlFor={`${id}-notes-field`} className="sr-only">
								Notes
							</label>
							<textarea
								id={`${id}-notes-field`}
								value={notes.draft}
								maxLength={20000}
								autoFocus={writingNotes && !book.review}
								onChange={(e) => notes.change(e.target.value)}
								// Emptying it while typing keeps the field; leaving it empty folds it away.
								onFocus={() => setWritingNotes(true)}
								onBlur={() => {
									notes.flush();
									setWritingNotes(false);
								}}
								placeholder="What it was about, what stayed with you…"
								className={cn(FIELD_TEXTAREA, "min-h-28 leading-relaxed")}
							/>
						</div>
					)}
				</section>

				<QuotesSection
					bookId={book.id}
					quotes={quotes}
					adding={addingQuote}
					onAddingChange={setAddingQuote}
				/>

				{book.seriesName && seriesBooks.length > 1 && (
					<SeriesSection name={book.seriesName} books={seriesBooks} currentId={book.id} />
				)}

				<ShelfPicker
					shelves={shelves}
					selected={book.shelfIds}
					onChange={async (shelfIds) => {
						await persist({ shelfIds }, () => setBookShelves(book.id, shelfIds));
					}}
				/>

				<SessionsSection
					sessions={sessions}
					today={today}
					onLogEarlier={() => setLoggingDay(true)}
				/>

				{book.description && <About text={book.description} />}
			</div>

			<EditDetailsDialog
				book={book}
				open={editing.open}
				instant={editing.instant}
				onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
				onSave={(values) =>
					persist(values as Partial<TsundokuBook>, () => updateBook(book.id, values))
				}
			/>
			<LogDayDialog
				open={loggingDay}
				onOpenChange={setLoggingDay}
				today={today}
				onLog={async (values) => {
					const result = await logSession(book.id, values).catch(offline);
					return "error" in result ? result.error : undefined;
				}}
			/>
			<ConfirmDelete
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete "${book.title}"?`}
				description="The book, its reading days and quotes go for good."
				onConfirm={async () => {
					// Redirects to the library in the same round trip.
					const result = await deleteBook(book.id, { redirect: true }).catch(offline);
					if (result && "error" in result) toast.error(result.error);
				}}
			/>
		</div>
	);
}

function StatusAndRating({
	id,
	book,
	onStatus,
	onRating,
}: {
	id: string;
	book: TsundokuBook;
	onStatus: (status: BookStatus) => void;
	onRating: (rating: number | null) => void;
}) {
	return (
		<>
			<Label htmlFor={`${id}-status`} className="sr-only">
				Status
			</Label>
			<Select value={book.status} onValueChange={(v) => onStatus(v as BookStatus)}>
				<SelectTrigger id={`${id}-status`} className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{BOOK_STATUSES.map((s) => (
						<SelectItem key={s} value={s}>
							{STATUS_CONFIG[s].label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<span id={`${id}-rating`} className="sr-only">
				Rating
			</span>
			<StarRating value={book.rating} onChange={onRating} aria-labelledby={`${id}-rating`} />
		</>
	);
}

/** The publisher's description: four lines, the rest on request. */
function About({ text }: { text: string }) {
	const id = useId();
	const long = text.length > 320;
	return (
		<section aria-labelledby={id}>
			<h2 id={id} className="mb-3 text-sm font-medium">
				About the book
			</h2>
			{long ? (
				<details className="group/more">
					<summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
						<p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground group-open/more:line-clamp-none">
							{text}
						</p>
						<span className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground">
							<span className="group-open/more:hidden">Show more</span>
							<span className="hidden group-open/more:inline">Show less</span>
						</span>
					</summary>
				</details>
			) : (
				<p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{text}</p>
			)}
		</section>
	);
}
