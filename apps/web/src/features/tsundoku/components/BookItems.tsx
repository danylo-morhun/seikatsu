"use client";

import type { LibraryBook } from "@/features/tsundoku/actions/books";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { Stars } from "@/features/tsundoku/components/Stars";
import { STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { takeFresh } from "@/features/tsundoku/lib/fresh";
import { progressPercent } from "@/features/tsundoku/lib/pace";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, memo, useState } from "react";

// Stagger only the first rows: a long wall shouldn't take a second to arrive.
const stagger = (index: number) => ({ "--i": Math.min(index, 8) }) as CSSProperties;

/** A just-added book drops in once; everything else rises with its list. */
function useEntrance(bookId: string) {
	const [fresh] = useState(() => takeFresh(bookId));
	return fresh ? "animate-drop" : "animate-rise";
}

const authorsOf = (b: LibraryBook) => (b.authors ?? []).join(", ");

/** What a tile or row says under the title, by where the book is. */
function Meta({ book }: { book: LibraryBook }) {
	if (book.status === "read" && book.rating != null) return <Stars rating={book.rating} />;
	if (book.status === "reading") {
		const pct = progressPercent(book.currentPage, book.pageCount);
		return pct != null ? <span className="font-figures">{pct}%</span> : null;
	}
	if (book.status === "paused" || book.status === "dnf")
		return <>{STATUS_CONFIG[book.status].label}</>;
	return null;
}

/** The cover wall's tile: the cover is the book; title and one quiet line under it. */
export const BookTile = memo(function BookTile({
	book,
	index,
}: { book: LibraryBook; index: number }) {
	const entrance = useEntrance(book.id);
	return (
		<Link
			href={`/tsundoku/${book.id}`}
			prefetch={false}
			data-book-id={book.id}
			aria-label={`${book.title}${authorsOf(book) ? `, ${authorsOf(book)}` : ""}`}
			className={cn(
				"group flex min-w-0 flex-col gap-2 rounded-md outline-none [contain-intrinsic-size:auto_18rem] [content-visibility:auto] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
				entrance,
			)}
			style={stagger(index)}
		>
			<BookCover
				coverUrl={book.coverUrl}
				title={book.title}
				className="transition-[filter] duration-150 ease-out group-hover:brightness-110"
			/>
			<span aria-hidden className="min-w-0 space-y-0.5">
				<span className="line-clamp-2 text-sm leading-snug font-medium break-words">
					{book.title}
				</span>
				{authorsOf(book) && (
					<span className="block truncate text-xs text-muted-foreground">{authorsOf(book)}</span>
				)}
				{book.status === "reading" ? (
					<ProgressMeter
						compact
						currentPage={book.currentPage}
						pageCount={book.pageCount}
						index={index}
						className="pt-1.5"
					/>
				) : (
					<span className="flex h-4 items-center text-xs text-muted-foreground">
						<Meta book={book} />
					</span>
				)}
			</span>
		</Link>
	);
});

/** The list view's row: hairline, cover thumb, title, and the figure that matters on the right. */
export const BookRow = memo(function BookRow({
	book,
	index,
}: { book: LibraryBook; index: number }) {
	const entrance = useEntrance(book.id);
	return (
		<li className={entrance} style={stagger(index)}>
			<Link
				href={`/tsundoku/${book.id}`}
				prefetch={false}
				data-book-id={book.id}
				className="flex items-center gap-3 rounded-md py-2.5 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring md:-mx-2 md:px-2"
			>
				<BookCover
					coverUrl={book.coverUrl}
					title={book.title}
					className="w-8 shrink-0 rounded-sm"
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium">{book.title}</span>
					<span className="block truncate text-xs text-muted-foreground">
						{[
							authorsOf(book),
							book.seriesName &&
								`${book.seriesName}${book.seriesPosition ? ` #${book.seriesPosition}` : ""}`,
						]
							.filter(Boolean)
							.join(" · ")}
					</span>
				</span>
				<span className="shrink-0 text-right text-xs text-muted-foreground">
					{book.status === "want" ? STATUS_CONFIG.want.short : <Meta book={book} />}
					{book.status === "read" && book.rating == null && STATUS_CONFIG.read.short}
				</span>
			</Link>
		</li>
	);
});

/** A book on the go: big enough to read its progress, with the update one tap away. */
export const ReadingRow = memo(function ReadingRow({
	book,
	index,
	onProgress,
}: {
	book: LibraryBook;
	index: number;
	onProgress: (bookId: string) => void;
}) {
	const entrance = useEntrance(book.id);
	return (
		<li
			className={cn("relative flex items-center gap-4 py-3 md:-mx-2 md:px-2", entrance)}
			style={stagger(index)}
		>
			<BookCover coverUrl={book.coverUrl} title={book.title} className="w-12 shrink-0" />
			<div className="min-w-0 flex-1 space-y-2">
				<div className="min-w-0">
					<Link
						href={`/tsundoku/${book.id}`}
						prefetch={false}
						data-book-id={book.id}
						className="block truncate rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-md after:transition-colors hover:after:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring"
					>
						{book.title}
					</Link>
					<p className="truncate text-xs text-muted-foreground">
						{[authorsOf(book), book.status === "paused" ? STATUS_CONFIG.paused.label : null]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</div>
				<ProgressMeter
					currentPage={book.currentPage}
					pageCount={book.pageCount}
					daysToFinish={book.daysToFinish}
					index={index}
				/>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="relative shrink-0"
				aria-label={`Update progress of ${book.title}`}
				aria-keyshortcuts="L"
				onClick={() => onProgress(book.id)}
			>
				Update
			</Button>
		</li>
	);
});
