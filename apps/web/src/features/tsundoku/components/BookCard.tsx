import type { TsundokuBook } from "@/features/tsundoku/actions/books";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import { StatusBadge } from "@/features/tsundoku/components/StatusBadge";
import { progressPercent } from "@/features/tsundoku/lib/pace";
import { Progress } from "@seikatsu/ui";
import Link from "next/link";

export function BookCard({ book }: { book: TsundokuBook }) {
	const pct = book.status === "reading" ? progressPercent(book.currentPage, book.pageCount) : null;

	return (
		<Link href={`/tsundoku/${book.id}`} className="group flex flex-col gap-2">
			<BookCover
				coverUrl={book.coverUrl}
				title={book.title}
				className="shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md"
			/>
			<div className="space-y-1">
				<p className="line-clamp-2 text-sm font-medium leading-tight">{book.title}</p>
				{book.authors && book.authors.length > 0 && (
					<p className="line-clamp-1 text-xs text-muted-foreground">{book.authors.join(", ")}</p>
				)}
				<div className="flex items-center gap-1.5 pt-0.5">
					<StatusBadge status={book.status} short />
					{book.rating != null && (
						<span className="text-[11px] text-amber-400">★ {book.rating}</span>
					)}
				</div>
				{pct != null && <Progress value={pct} className="mt-1 h-1" />}
			</div>
		</Link>
	);
}
