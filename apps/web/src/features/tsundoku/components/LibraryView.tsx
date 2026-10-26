"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { type LibraryBook, deleteBook, setBookShelves } from "@/features/tsundoku/actions/books";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { BookRow, BookTile, ReadingRow } from "@/features/tsundoku/components/BookItems";
import { type BookActions, BookMenuItems } from "@/features/tsundoku/components/BookMenu";
import {
	FilterChips,
	FilterMenu,
	SearchBox,
	SegmentSwitch,
	ViewSwitch,
} from "@/features/tsundoku/components/LibraryFilters";
import { ProgressDialog } from "@/features/tsundoku/components/ProgressDialog";
import { neighbourBook, targetBook } from "@/features/tsundoku/lib/book-nav";
import {
	BOOK_STATUSES,
	type BookStatus,
	SEGMENTS,
	type Segment,
} from "@/features/tsundoku/lib/constants";
import { requestNewBook } from "@/features/tsundoku/lib/events";
import {
	type LibraryFilters,
	applyFilters,
	byFinishedYear,
	menuFilterCount,
	readFilters,
	segmentOf,
	writeFilters,
} from "@/features/tsundoku/lib/filters";
import {
	overlayBooks,
	rateBook,
	saveProgress as sendProgress,
	setBookStatus,
} from "@/features/tsundoku/lib/offline";
import { progressPatch, statusPatch } from "@/features/tsundoku/lib/progress";
import { pageKey } from "@/lib/capture-shortcut";
import { Button, cn } from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	useDeferredValue,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";

interface Props {
	books: LibraryBook[];
	shelves: TsundokuShelf[];
	/** The user's calendar day (tz cookie), for optimistic status dates. */
	today: string;
}

type Patch = { id: string; patch: Partial<LibraryBook> } | { id: string; remove: true };

const KEY_STATUS: Record<string, BookStatus> = Object.fromEntries(
	BOOK_STATUSES.flatMap((s) => {
		const key = ({ want: "p", reading: "r", read: "d" } as Partial<Record<BookStatus, string>>)[s];
		return key ? [[key, s]] : [];
	}),
);

const GRID =
	"grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";

/** The library: three piles at a glance, or one pile, filtered and sorted from the URL. */
export function LibraryView({ books: server, shelves, today }: Props) {
	const params = useSearchParams();
	const pathname = usePathname();
	const router = useRouter();
	const filters = readFilters(params);
	const view = params.get("view") === "list" ? "list" : "grid";
	const [query, setQuery] = useState(filters.q);
	const deferredQuery = useDeferredValue(query);
	const [filterOpen, setFilterOpen] = useState(false);
	const [progressId, setProgressId] = useState<{ id: string; instant: boolean } | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [menuId, setMenuId] = useState<string | null>(null);
	const [, startTransition] = useTransition();
	const searchRef = useRef<HTMLInputElement>(null);

	// Changes queued offline show until the server has them.
	const pending = usePendingOps("tsundoku.");
	const saved = useMemo(() => overlayBooks(server, pending), [server, pending]);
	const [books, applyPatch] = useOptimistic(saved, (list, p: Patch) =>
		"remove" in p
			? list.filter((b) => b.id !== p.id)
			: list.map((b) => (b.id === p.id ? { ...b, ...p.patch } : b)),
	);

	// Filters live in the URL: a pile or filter is a history step, typing only replaces it.
	function navigate(next: LibraryFilters, nextView = view, replace = false) {
		let url = writeFilters(pathname, next);
		if (nextView === "list") url += `${url.includes("?") ? "&" : "?"}view=list`;
		window.history[replace ? "replaceState" : "pushState"](null, "", url);
	}

	useEffect(() => {
		if (deferredQuery.trim() !== filters.q)
			navigate({ ...filters, q: deferredQuery.trim() }, view, true);
	});

	const shown = useMemo(
		() => applyFilters(books, { ...filters, q: deferredQuery.trim() }),
		// The parsed filters are rebuilt each render; their URL is the stable key.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[books, params.toString(), deferredQuery],
	);
	const counts = useMemo(() => {
		const c = { reading: 0, pile: 0, read: 0 } as Record<Segment, number>;
		for (const b of books) c[segmentOf(b.status)]++;
		return c;
	}, [books]);
	const choices = useMemo(() => {
		const uniq = (values: (string | null | undefined)[]) =>
			[...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
		return {
			genres: uniq(books.map((b) => b.genre)),
			series: uniq(books.map((b) => b.seriesName)),
			authors: uniq(books.flatMap((b) => b.authors ?? [])),
		};
	}, [books]);

	const overview = !filters.segment && menuFilterCount(filters) === 0 && !deferredQuery.trim();

	// ── Actions (optimistic; a failure says so and the next render restores the truth) ──
	function run(patch: Patch, action: () => Promise<{ error: string } | { success: true }>) {
		startTransition(async () => {
			applyPatch(patch);
			const result = await action().catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}
	const find = (id: string) => books.find((b) => b.id === id);

	const actions: BookActions = {
		open: (id) => {
			startNavigationProgress();
			router.push(`/tsundoku/${id}`);
		},
		progress: (id) => setProgressId({ id, instant: false }),
		setStatus: (id, status) => {
			const book = find(id);
			if (!book || book.status === status) return;
			run({ id, patch: statusPatch(book, status, today) }, () => setBookStatus(book, status));
		},
		setRating: (id, rating) => {
			const book = find(id);
			if (book) run({ id, patch: { rating } }, () => rateBook(book, rating));
		},
		setShelves: (id, shelfIds) =>
			run({ id, patch: { shelfIds } }, () => setBookShelves(id, shelfIds)),
		copyLink: (id) => {
			navigator.clipboard
				.writeText(`${window.location.origin}/tsundoku/${id}`)
				.then(() => toast.success("Link copied"))
				.catch(() => toast.error("Couldn't copy the link"));
		},
		delete: (id) => setDeletingId(id),
	};

	function saveProgress(id: string, page: number) {
		const book = find(id);
		if (!book) return;
		run({ id, patch: progressPatch(book, page, today) }, () => sendProgress(book, page));
	}

	// ── Keys: / search, F filter; on the book in focus or under the pointer, the book keys ──
	const bookKeyRef = useRef<(key: string) => boolean>(() => false);
	bookKeyRef.current = (key) => {
		const el = targetBook();
		const book = el ? find(el.dataset.bookId ?? "") : undefined;
		if (!el || !book) return false;
		if (key === "l") setProgressId({ id: book.id, instant: true });
		else if (/^[1-5]$/.test(key)) actions.setRating(book.id, Number(key) * 2);
		else if (key === "0") actions.setRating(book.id, null);
		else if (KEY_STATUS[key]) actions.setStatus(book.id, KEY_STATUS[key]);
		else if (key === ".") openContextMenu(el);
		else if (key === "delete") setDeletingId(book.id);
		else return false;
		return true;
	};

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "/") searchRef.current?.focus();
			else if (k === "f") setFilterOpen(true);
			else if (!k || !bookKeyRef.current(k)) {
				// Arrows walk the books once one has focus.
				if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
				if (!(e.target instanceof HTMLElement) || !e.target.matches("[data-book-id]")) return;
				const next = neighbourBook(e.target, e.key);
				if (!next) return;
				next.focus();
				next.scrollIntoView({ block: "nearest" });
			}
			e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const progressBook = progressId ? find(progressId.id) : undefined;
	const deleting = deletingId ? find(deletingId) : undefined;
	const menuBook = menuId ? find(menuId) : undefined;

	const tiles = (list: LibraryBook[]) =>
		view === "grid" ? (
			<div className={GRID}>
				{list.map((b, i) => (
					<BookTile key={b.id} book={b} index={i} />
				))}
			</div>
		) : (
			<ul className="divide-y divide-rule border-y border-rule">
				{list.map((b, i) => (
					<BookRow key={b.id} book={b} index={i} />
				))}
			</ul>
		);

	const reading = (list: LibraryBook[]) => (
		<ol className="divide-y divide-rule border-y border-rule">
			{list.map((b, i) => (
				<ReadingRow key={b.id} book={b} index={i} onProgress={actions.progress} />
			))}
		</ol>
	);

	return (
		<div className="space-y-6">
			<h1 className="sr-only">Tsundoku — Library</h1>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<SegmentSwitch
					value={filters.segment}
					counts={counts}
					onChange={(segment) => navigate({ ...filters, segment })}
				/>
				<div className="flex items-center gap-2">
					<SearchBox ref={searchRef} value={query} onChange={setQuery} />
					<FilterMenu
						filters={filters}
						shelves={shelves}
						{...choices}
						open={filterOpen}
						onOpenChange={setFilterOpen}
						onChange={(next) => navigate(next)}
					/>
					<ViewSwitch view={view} onChange={(next) => navigate(filters, next)} />
				</div>
			</div>
			<FilterChips filters={filters} shelves={shelves} onChange={(next) => navigate(next)} />

			<ContextArea
				attr="data-book-id"
				onTarget={(id) => {
					setMenuId(id);
					return true;
				}}
				menu={menuBook && <BookMenuItems book={menuBook} shelves={shelves} actions={actions} />}
			>
				{overview ? (
					<Overview books={shown} reading={reading} tiles={tiles} />
				) : shown.length === 0 ? (
					<div className="animate-swap flex flex-wrap items-center gap-x-3 gap-y-2 py-6 text-sm text-muted-foreground">
						<span>No books match.</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setQuery("");
								navigate({ ...readFilters(new URLSearchParams()), sort: filters.sort });
							}}
						>
							Clear filters
						</Button>
					</div>
				) : filters.segment === "reading" ? (
					reading(shown)
				) : (
					tiles(shown)
				)}
			</ContextArea>

			<ProgressDialog
				book={progressBook ?? null}
				instant={progressId?.instant}
				onOpenChange={(open) => !open && setProgressId(null)}
				onSave={saveProgress}
			/>
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeletingId(null)}
				title={`Delete "${deleting?.title ?? ""}"?`}
				description="The book, its reading days and quotes go for good."
				onConfirm={async () => {
					if (!deleting) return;
					const id = deleting.id;
					const result = await deleteBook(id).catch(() => ({ error: "Couldn't delete the book." }));
					if ("error" in result) toast.error(result.error);
					else startTransition(() => applyPatch({ id, remove: true }));
				}}
			/>
		</div>
	);
}

/** No pile chosen, nothing filtered: Reading first, then the Pile, then Read by year. */
function Overview({
	books,
	reading,
	tiles,
}: {
	books: LibraryBook[];
	reading: (list: LibraryBook[]) => React.ReactNode;
	tiles: (list: LibraryBook[]) => React.ReactNode;
}) {
	const by = (segment: Segment) => books.filter((b) => segmentOf(b.status) === segment);
	const onTheGo = by("reading");
	const pile = by("pile");
	const read = by("read");
	const label = (s: Segment) => SEGMENTS.find((x) => x.value === s)?.label;

	return (
		<div className="space-y-10">
			<section aria-labelledby="lib-reading" className="animate-rise">
				<h2 id="lib-reading" className="mb-3 text-sm font-medium">
					{label("reading")}
				</h2>
				{onTheGo.length > 0 ? (
					reading(onTheGo)
				) : (
					<p className="border-y border-rule py-4 text-sm text-muted-foreground">
						{pile.length > 0
							? "Nothing on the go. Pick the next one from the pile."
							: "Nothing on the go."}
					</p>
				)}
			</section>

			<section
				aria-labelledby="lib-pile"
				className="animate-rise"
				style={{ "--i": 1 } as React.CSSProperties}
			>
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h2 id="lib-pile" className="text-sm font-medium">
						<span className="text-primary">積</span> {label("pile")}
					</h2>
					<button
						type="button"
						onClick={requestNewBook}
						className="text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Add to the pile
					</button>
				</div>
				{pile.length > 0 ? (
					tiles(pile)
				) : (
					<p className="border-y border-rule py-4 text-sm text-muted-foreground">
						The pile is empty. Books you want to read wait here.
					</p>
				)}
			</section>

			{read.length > 0 &&
				byFinishedYear(read).map(([year, list], i) => (
					<section
						key={year}
						aria-labelledby={`lib-read-${year}`}
						className="animate-rise"
						style={{ "--i": i + 2 } as React.CSSProperties}
					>
						<h2
							id={`lib-read-${year}`}
							className="mb-3 flex items-baseline gap-2 text-sm font-medium"
						>
							{label("read")} {year === "Earlier" ? "earlier" : `in ${year}`}
							<span className="font-figures text-xs font-normal text-muted-foreground">
								{list.length}
							</span>
						</h2>
						{tiles(list)}
					</section>
				))}
		</div>
	);
}
