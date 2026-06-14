import type { TsundokuBook } from "@/features/tsundoku/actions/books";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import { StatusBadge } from "@/features/tsundoku/components/StatusBadge";
import { progressPercent } from "@/features/tsundoku/lib/pace";
import Link from "next/link";

export function BookListRow({ book }: { book: TsundokuBook }) {
	const pct = progressPercent(book.currentPage, book.pageCount);

	return (
		<Link
			href={`/tsundoku/${book.id}`}
			className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-colors hover:bg-accent/40"
		>
			<BookCover coverUrl={book.coverUrl} title={book.title} className="w-10 shrink-0 rounded" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{book.title}</p>
				{book.authors && book.authors.length > 0 && (
					<p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
				)}
			</div>
			{book.seriesName && (
				<span className="hidden truncate text-xs text-muted-foreground sm:block">
					{book.seriesName}
					{book.seriesPosition ? ` #${book.seriesPosition}` : ""}
				</span>
			)}
			{book.rating != null && (
				<span className="hidden text-xs text-amber-400 sm:inline">★ {book.rating}</span>
			)}
			{book.status === "reading" && pct != null && (
				<span className="hidden text-xs tabular-nums text-muted-foreground md:inline">{pct}%</span>
			)}
			<StatusBadge status={book.status} short />
		</Link>
	);
}
