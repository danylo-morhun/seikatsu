"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { Spinner } from "@/components/Spinner";
import { createBook } from "@/features/tsundoku/actions/books";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import type { BookSearchResult } from "@/features/tsundoku/lib/book-search";
import { type BookStatus, GENRE_OPTIONS } from "@/features/tsundoku/lib/constants";
import { markFresh } from "@/features/tsundoku/lib/fresh";
import { genreFromSubjects } from "@/features/tsundoku/lib/genre";
import { coverThumb } from "@/features/tsundoku/lib/open-library";
import { searchBooks } from "@/features/tsundoku/lib/search-client";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
	Tabs,
	TabsList,
	TabsTrigger,
	cn,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

/** Where a new book goes: the three piles, Pile first. */
const ADD_AS: { value: BookStatus; label: string }[] = [
	{ value: "want", label: "Pile" },
	{ value: "reading", label: "Reading" },
	{ value: "read", label: "Read" },
];

type Search =
	| { state: "idle" }
	| { state: "loading" }
	| { state: "error"; error: string }
	| { state: "done"; results: BookSearchResult[] };

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Opened from the keyboard: appears and leaves without motion (a shortcut is for speed). */
	instant?: boolean;
	defaultStatus?: BookStatus;
}

const FOOTER =
	"mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4";

/**
 * Capture a book in seconds: type, pick a result, done. A book the search can't find is
 * added by hand from what was typed. It lands on the chosen pile; the page underneath stays.
 */
export function AddBookDialog({ open, onOpenChange, instant = false, defaultStatus }: Props) {
	const id = useId();
	const router = useRouter();
	const [mode, setMode] = useState<"search" | "manual">("search");
	const [status, setStatus] = useState<BookStatus>(defaultStatus ?? "want");
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState<Search>({ state: "idle" });
	const [retry, setRetry] = useState(0);
	const [pendingKey, setPendingKey] = useState<string | null>(null);
	const [manual, setManual] = useState({ title: "", authors: "", pages: "", year: "", genre: "" });
	const [saving, setSaving] = useState(false);
	const reqId = useRef(0);

	useEffect(() => {
		if (open) setStatus(defaultStatus ?? "want");
	}, [open, defaultStatus]);

	// Search as you type, cancelling the previous request; a failure is said, not hidden.
	useEffect(() => {
		const q = query.trim();
		const req = ++reqId.current;
		if (q.length < 2) {
			setSearch({ state: "idle" });
			return;
		}
		setSearch({ state: "loading" });
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const res = await searchBooks(q, controller.signal).catch(() => null);
			if (!res || req !== reqId.current) return;
			setSearch(
				"error" in res
					? { state: "error", error: res.error }
					: { state: "done", results: res.results },
			);
		}, 350);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query, retry]);

	function reset() {
		setMode("search");
		setQuery("");
		setSearch({ state: "idle" });
		setManual({ title: "", authors: "", pages: "", year: "", genre: "" });
		setPendingKey(null);
		setSaving(false);
	}

	function handleOpenChange(next: boolean) {
		if (saving || pendingKey) return;
		onOpenChange(next);
		if (!next) reset();
	}

	function added(bookId: string, title: string) {
		markFresh(bookId);
		onOpenChange(false);
		reset();
		toast.success(`Added “${title}”`, {
			action: { label: "Open", onClick: () => router.push(`/tsundoku/${bookId}`) },
		});
	}

	async function addResult(r: BookSearchResult) {
		setPendingKey(r.externalId);
		const result = await createBook({
			title: r.title,
			authors: r.authors,
			isbn: r.isbn,
			coverUrl: r.coverUrl,
			olKey: r.source === "openlibrary" ? r.externalId : null,
			pageCount: r.pageCount,
			publishedYear: r.publishedYear,
			description: r.description,
			genre: genreFromSubjects(r.subjects) ?? null,
			source: r.source,
			status,
		}).catch(() => ({ error: "Couldn't add the book. Try again." }));
		setPendingKey(null);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		added(result.id, r.title);
	}

	async function addManual(e: React.FormEvent) {
		e.preventDefault();
		const title = manual.title.trim();
		if (!title) return;
		setSaving(true);
		const pages = Number.parseInt(manual.pages, 10);
		const year = Number.parseInt(manual.year, 10);
		const result = await createBook({
			title,
			authors: manual.authors
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean),
			pageCount: pages > 0 ? pages : null,
			publishedYear: year > 0 ? year : null,
			genre: manual.genre || null,
			source: "manual",
			status,
		}).catch(() => ({ error: "Couldn't add the book. Try again." }));
		setSaving(false);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		added(result.id, title);
	}

	function byHand() {
		setManual((m) => ({ ...m, title: m.title || query.trim() }));
		setMode("manual");
	}

	const busy = saving || pendingKey != null;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"sm:max-w-lg max-sm:flex max-sm:flex-col",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					const field = document.getElementById(`${id}-${mode === "search" ? "query" : "title"}`);
					if (!field) return;
					e.preventDefault();
					// No scroll-into-view: mid-entrance it scrolls the page and flashes a scrollbar.
					field.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>Add Book</DialogTitle>
					<DialogDescription className="sr-only">
						Search by title, author or ISBN, or add the book by hand.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-1 flex-col gap-4">
					<Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
						<TabsList className="w-full">
							<TabsTrigger value="search" className="flex-1">
								Search
							</TabsTrigger>
							<TabsTrigger value="manual" className="flex-1">
								By hand
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<div className="space-y-2">
						<Label id={`${id}-as`}>Add to</Label>
						<div
							role="radiogroup"
							aria-labelledby={`${id}-as`}
							className="relative grid grid-cols-3 rounded-md bg-surface p-0.5"
						>
							{/* One chip slides under the chosen pile. */}
							<span
								aria-hidden
								className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded bg-surface-2 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
								style={{
									transform: `translateX(${ADD_AS.findIndex((a) => a.value === status) * 100}%)`,
								}}
							/>
							{ADD_AS.map((a) => (
								<button
									key={a.value}
									type="button"
									role="radio"
									aria-checked={status === a.value}
									onClick={() => setStatus(a.value)}
									className={cn(
										"relative h-8 rounded text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
										status === a.value
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{a.label}
								</button>
							))}
						</div>
					</div>

					<AutoHeight className="flex flex-col gap-4">
						{mode === "search" ? (
							<div className="animate-swap flex flex-col gap-3">
								<div className="relative">
									<label htmlFor={`${id}-query`} className="sr-only">
										Search books
									</label>
									<HugeiconsIcon
										icon={Search01Icon}
										aria-hidden
										className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										id={`${id}-query`}
										value={query}
										autoComplete="off"
										placeholder="Title, author or ISBN"
										onChange={(e) => setQuery(e.target.value)}
										className="pr-9 pl-9"
									/>
									{search.state === "loading" && (
										<span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
											<Spinner />
										</span>
									)}
								</div>
								<SearchResults
									search={search}
									pendingKey={pendingKey}
									disabled={busy}
									onPick={addResult}
									onRetry={() => setRetry((n) => n + 1)}
									onByHand={byHand}
								/>
							</div>
						) : (
							<form
								id={`${id}-manual`}
								onSubmit={addManual}
								className="animate-swap flex flex-col gap-4"
							>
								<div className="space-y-2">
									<Label htmlFor={`${id}-title`}>Title</Label>
									<Input
										id={`${id}-title`}
										value={manual.title}
										maxLength={500}
										autoComplete="off"
										onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${id}-authors`}>Author</Label>
									<Input
										id={`${id}-authors`}
										value={manual.authors}
										autoComplete="off"
										placeholder="Separate several with commas"
										onChange={(e) => setManual((m) => ({ ...m, authors: e.target.value }))}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor={`${id}-pages`}>Pages</Label>
										<Input
											id={`${id}-pages`}
											value={manual.pages}
											inputMode="numeric"
											maxLength={6}
											className="font-figures"
											onChange={(e) =>
												setManual((m) => ({ ...m, pages: e.target.value.replace(/\D/g, "") }))
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`${id}-year`}>Year</Label>
										<Input
											id={`${id}-year`}
											value={manual.year}
											inputMode="numeric"
											maxLength={4}
											className="font-figures"
											onChange={(e) =>
												setManual((m) => ({ ...m, year: e.target.value.replace(/\D/g, "") }))
											}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${id}-genre`}>Genre</Label>
									<Select
										value={manual.genre || "none"}
										onValueChange={(v) =>
											setManual((m) => ({ ...m, genre: v === "none" ? "" : v }))
										}
									>
										<SelectTrigger id={`${id}-genre`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">No genre</SelectItem>
											{GENRE_OPTIONS.map((g) => (
												<SelectItem key={g} value={g}>
													{g}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</form>
						)}
					</AutoHeight>

					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={busy}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						{mode === "manual" && (
							<Button
								type="submit"
								form={`${id}-manual`}
								className="gap-1.5 max-sm:flex-1"
								disabled={busy || !manual.title.trim()}
							>
								{saving && <Spinner />}
								{saving ? "Adding…" : "Add book"}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SearchResults({
	search,
	pendingKey,
	disabled,
	onPick,
	onRetry,
	onByHand,
}: {
	search: Search;
	pendingKey: string | null;
	disabled: boolean;
	onPick: (r: BookSearchResult) => void;
	onRetry: () => void;
	onByHand: () => void;
}) {
	const quiet = "py-3 text-sm text-muted-foreground";
	const handLink = (
		<button
			type="button"
			onClick={onByHand}
			className="text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
		>
			Add it by hand
		</button>
	);

	if (search.state === "idle") {
		return <p className={quiet}>Open Library and Google Books, searched together.</p>;
	}
	if (search.state === "loading") return <p className={quiet}>Searching…</p>;
	if (search.state === "error") {
		return (
			<p role="alert" className={quiet}>
				{search.error}{" "}
				<button
					type="button"
					onClick={onRetry}
					className="text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
				>
					Try again
				</button>{" "}
				· {handLink}
			</p>
		);
	}
	if (search.results.length === 0) {
		return <p className={quiet}>Nothing found. {handLink}</p>;
	}

	return (
		<ul
			aria-label="Search results"
			className="-mx-1 max-h-[min(22rem,50vh)] divide-y divide-rule overflow-y-auto border-y border-rule [scrollbar-width:thin] max-sm:max-h-none max-sm:flex-1"
		>
			{search.results.map((r) => {
				const pending = pendingKey === r.externalId;
				const meta = [
					r.authors.slice(0, 2).join(", "),
					r.publishedYear,
					r.pageCount && `${r.pageCount} p.`,
				]
					.filter(Boolean)
					.join(" · ");
				return (
					<li key={`${r.source}:${r.externalId}`}>
						<button
							type="button"
							disabled={disabled}
							aria-busy={pending || undefined}
							onClick={() => onPick(r)}
							className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
						>
							<BookCover
								coverUrl={coverThumb(r.coverUrl)}
								title={r.title}
								unoptimized
								className="w-9 shrink-0 rounded-sm"
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">{r.title}</span>
								{meta && (
									<span className="block truncate font-figures text-xs text-muted-foreground">
										{meta}
									</span>
								)}
							</span>
							{pending && <Spinner />}
						</button>
					</li>
				);
			})}
		</ul>
	);
}
