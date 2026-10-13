"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import type { SeriesBook } from "@/features/tsundoku/actions/books";
import { type TsundokuQuote, createQuote, deleteQuote } from "@/features/tsundoku/actions/quotes";
import { type TsundokuSession, deleteSession } from "@/features/tsundoku/actions/sessions";
import { type TsundokuShelf, createShelf } from "@/features/tsundoku/actions/shelves";
import { FIELD_TEXTAREA } from "@/features/tsundoku/components/BookDialogs";
import { STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { parseLocal } from "@/lib/dates";
import { LABEL_COLORS } from "@/lib/pigments";
import {
	Copy01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { forwardRef, useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

const ROW_MENU =
	"size-10 shrink-0 text-muted-foreground/50 hover:text-foreground md:size-8 data-[state=open]:text-foreground";

const failed = () => ({ error: "Couldn't save. Check your connection." });

function SectionTitle({
	id,
	children,
	aside,
}: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
	return (
		<div className="mb-3 flex items-baseline justify-between gap-3">
			<h2 id={id} className="text-sm font-medium">
				{children}
			</h2>
			{aside}
		</div>
	);
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

/** Passages worth keeping: a hairline list, newest first; adding opens only when wanted. */
export const QuotesSection = forwardRef<
	HTMLButtonElement,
	{ bookId: string; quotes: TsundokuQuote[]; adding: boolean; onAddingChange: (v: boolean) => void }
>(function QuotesSection({ bookId, quotes: saved, adding, onAddingChange }, ref) {
	const id = useId();
	const [text, setText] = useState("");
	const [page, setPage] = useState("");
	const [isSaving, startSave] = useTransition();
	const [, startDelete] = useTransition();
	const [quotes, removeQuote] = useOptimistic(saved, (list, quoteId: string) =>
		list.filter((q) => q.id !== quoteId),
	);
	// The quote just added drops in; the rest are already there.
	const [newest] = useState(() => new Set(saved.map((q) => q.id)));

	function close() {
		setText("");
		setPage("");
		onAddingChange(false);
	}

	function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!text.trim()) return;
		startSave(async () => {
			const result = await createQuote(bookId, {
				text,
				page: page ? Number.parseInt(page, 10) : null,
			}).catch(failed);
			if ("error" in result) toast.error(result.error);
			else close();
		});
	}

	function handleDelete(quoteId: string) {
		startDelete(async () => {
			removeQuote(quoteId);
			const result = await deleteQuote(quoteId).catch(failed);
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<section aria-labelledby={`${id}-title`}>
			<SectionTitle id={`${id}-title`}>Quotes</SectionTitle>
			{quotes.length > 0 && (
				<ul className="mb-2 divide-y divide-rule border-y border-rule">
					{quotes.map((q) => (
						<li
							key={q.id}
							className={cn("flex items-start gap-3 py-3", !newest.has(q.id) && "animate-drop")}
						>
							<blockquote className="min-w-0 flex-1 border-l-2 border-primary/40 pl-3">
								<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{q.text}</p>
								{q.page != null && (
									<footer className="mt-1 font-figures text-xs text-muted-foreground">
										p. {q.page}
									</footer>
								)}
							</blockquote>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className={ROW_MENU}
										aria-label="Quote actions"
									>
										<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={() =>
											navigator.clipboard
												.writeText(q.text)
												.then(() => toast.success("Quote copied"))
												.catch(() => toast.error("Couldn't copy"))
										}
									>
										<HugeiconsIcon icon={Copy01Icon} className="mr-2 h-4 w-4" />
										Copy
									</DropdownMenuItem>
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => handleDelete(q.id)}
									>
										<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}
			{adding ? (
				<form onSubmit={handleAdd} className="animate-swap space-y-3">
					<label htmlFor={`${id}-text`} className="sr-only">
						Quote
					</label>
					<textarea
						id={`${id}-text`}
						autoFocus
						value={text}
						maxLength={5000}
						placeholder="Paste or type the passage…"
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.stopPropagation();
								close();
							}
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e);
						}}
						className={cn(FIELD_TEXTAREA, "min-h-24")}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<label htmlFor={`${id}-page`} className="sr-only">
							Page
						</label>
						<Input
							id={`${id}-page`}
							value={page}
							inputMode="numeric"
							maxLength={5}
							placeholder="Page"
							className="w-24 font-figures"
							onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
						/>
						<div className="ml-auto flex gap-2">
							<Button type="button" variant="ghost" onClick={close} disabled={isSaving}>
								Cancel
							</Button>
							<Button type="submit" className="gap-1.5" disabled={isSaving || !text.trim()}>
								{isSaving && <Spinner />}
								{isSaving ? "Saving…" : "Save quote"}
							</Button>
						</div>
					</div>
				</form>
			) : (
				<QuietAdd ref={ref} onClick={() => onAddingChange(true)} aria-keyshortcuts="Q">
					{quotes.length > 0 ? "Add another" : "Add a quote"}
				</QuietAdd>
			)}
		</section>
	);
});

// ─── Reading days ────────────────────────────────────────────────────────────

const dayLabel = new Intl.DateTimeFormat("en", {
	weekday: "short",
	month: "short",
	day: "numeric",
});
const dayLabelYear = new Intl.DateTimeFormat("en", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
});

/** Every reading day of the book: the day, the pages it moved, and a way to take one back. */
export function SessionsSection({
	sessions: saved,
	today,
	onLogEarlier,
	onEdit,
}: {
	sessions: TsundokuSession[];
	today: string;
	onLogEarlier: () => void;
	onEdit: (session: TsundokuSession) => void;
}) {
	const id = useId();
	const [, startDelete] = useTransition();
	const [sessions, removeSession] = useOptimistic(saved, (list, sessionId: string) =>
		list.filter((s) => s.id !== sessionId),
	);
	const thisYear = today.slice(0, 4);

	function handleDelete(sessionId: string) {
		startDelete(async () => {
			removeSession(sessionId);
			const result = await deleteSession(sessionId).catch(failed);
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<section aria-labelledby={`${id}-title`}>
			<SectionTitle
				id={`${id}-title`}
				aside={
					sessions.length > 0 && (
						<span className="font-figures text-xs text-muted-foreground">
							{sessions.length} {sessions.length === 1 ? "day" : "days"}
						</span>
					)
				}
			>
				Reading days
			</SectionTitle>
			{sessions.length > 0 ? (
				<ul className="mb-2 divide-y divide-rule border-y border-rule">
					{sessions.map((s) => (
						<li key={s.id} className="flex items-center gap-3 py-1.5">
							<span className="min-w-0 flex-1 text-sm">
								{s.date === today
									? "Today"
									: (s.date.startsWith(thisYear) ? dayLabel : dayLabelYear).format(
											parseLocal(s.date),
										)}
							</span>
							<span className="font-figures text-sm font-medium">+{s.pagesRead} p.</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className={ROW_MENU}
										aria-label="Reading day actions"
									>
										<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => onEdit(s)}>
										<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
										Edit…
									</DropdownMenuItem>
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => handleDelete(s.id)}
									>
										<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
										Delete — takes its pages back
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			) : (
				<p className="mb-1 text-sm text-muted-foreground">
					Each progress update becomes a reading day.
				</p>
			)}
			<QuietAdd onClick={onLogEarlier}>Log an earlier day</QuietAdd>
		</section>
	);
}

// ─── Shelves ─────────────────────────────────────────────────────────────────

/** Shelves as Seiryu's label chips: filled and ticked when the book is on one. */
export function ShelfPicker({
	shelves,
	selected: savedSelected,
	onChange,
}: {
	shelves: TsundokuShelf[];
	selected: string[];
	onChange: (shelfIds: string[]) => Promise<void>;
}) {
	const inputId = useId();
	const [, startTransition] = useTransition();
	const [selected, setSelected] = useOptimistic(savedSelected);
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [isCreating, startCreate] = useTransition();
	const on = new Set(selected);

	function toggle(shelfId: string) {
		const next = new Set(on);
		if (next.has(shelfId)) next.delete(shelfId);
		else next.add(shelfId);
		startTransition(async () => {
			setSelected([...next]);
			await onChange([...next]);
		});
	}

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		startCreate(async () => {
			const color = LABEL_COLORS[shelves.length % LABEL_COLORS.length]?.hex ?? null;
			const result = await createShelf({ name: trimmed, color }).catch(failed);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			// A shelf made from a book is for that book.
			await onChange([...on, result.id]);
			setName("");
			setAdding(false);
		});
	}

	return (
		<section aria-labelledby={`${inputId}-title`} className="space-y-3">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id={`${inputId}-title`} className="text-sm font-medium">
					Shelves
				</h2>
				{shelves.length > 0 && (
					<Link
						href="/settings/tsundoku"
						prefetch
						className="text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Edit shelves
					</Link>
				)}
			</div>
			{shelves.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{shelves.map((shelf) => {
						const isOn = on.has(shelf.id);
						const color = shelf.color ?? "var(--muted-foreground)";
						return (
							<button
								key={shelf.id}
								type="button"
								onClick={() => toggle(shelf.id)}
								aria-pressed={isOn}
								className={cn(
									"inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
									isOn
										? "border-input bg-surface-2 text-foreground"
										: "border-dashed border-rule text-muted-foreground hover:border-input hover:text-foreground",
								)}
							>
								<span
									aria-hidden
									className="size-2 shrink-0 rounded-full transition-[background-color] duration-150"
									style={{
										backgroundColor: isOn ? color : "transparent",
										boxShadow: `inset 0 0 0 1.5px ${color}`,
									}}
								/>
								<span className="truncate">{shelf.name}</span>
								{isOn && (
									<HugeiconsIcon
										icon={Tick02Icon}
										aria-hidden
										className="-mr-0.5 size-3.5 animate-swap text-muted-foreground"
									/>
								)}
							</button>
						);
					})}
				</div>
			)}
			{adding ? (
				<form onSubmit={handleCreate} className="animate-swap flex gap-1.5">
					<label htmlFor={inputId} className="sr-only">
						New shelf
					</label>
					<Input
						id={inputId}
						autoFocus
						value={name}
						maxLength={100}
						autoComplete="off"
						placeholder="New shelf…"
						onChange={(e) => setName(e.target.value)}
						onBlur={() => !name.trim() && setAdding(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.stopPropagation();
								setName("");
								setAdding(false);
							}
						}}
					/>
					<Button
						type="submit"
						variant="outline"
						className="gap-1.5"
						disabled={isCreating || !name.trim()}
					>
						{isCreating && <Spinner />}
						Add
					</Button>
				</form>
			) : (
				<QuietAdd onClick={() => setAdding(true)}>New shelf</QuietAdd>
			)}
		</section>
	);
}

// ─── Series ──────────────────────────────────────────────────────────────────

/** The series in order: which one this is, and how far through it the reading has got. */
export function SeriesSection({
	name,
	books,
	currentId,
}: {
	name: string;
	books: SeriesBook[];
	currentId: string;
}) {
	const id = useId();
	const read = books.filter((b) => b.status === "read").length;
	return (
		<section aria-labelledby={`${id}-title`}>
			<SectionTitle
				id={`${id}-title`}
				aside={
					<span className="font-figures text-xs text-muted-foreground">
						{read} of {books.length} read
					</span>
				}
			>
				{name}
			</SectionTitle>
			<ol className="divide-y divide-rule border-y border-rule">
				{books.map((b) => (
					<li key={b.id}>
						<Link
							href={`/tsundoku/${b.id}`}
							prefetch={false}
							aria-current={b.id === currentId ? "page" : undefined}
							className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md py-2.5 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring md:-mx-2 md:px-2"
						>
							<span className="font-figures text-sm text-muted-foreground">
								{b.seriesPosition ?? "–"}
							</span>
							<span className={cn("truncate text-sm", b.id === currentId && "font-medium")}>
								{b.title}
							</span>
							<span className="text-xs text-muted-foreground">{STATUS_CONFIG[b.status].short}</span>
						</Link>
					</li>
				))}
			</ol>
		</section>
	);
}
