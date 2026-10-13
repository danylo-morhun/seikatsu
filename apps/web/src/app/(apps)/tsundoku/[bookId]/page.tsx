import { getBook, getSeriesBooks } from "@/features/tsundoku/actions/books";
import { getQuotes } from "@/features/tsundoku/actions/quotes";
import { getSessions } from "@/features/tsundoku/actions/sessions";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { BookDetailView } from "@/features/tsundoku/components/BookDetailView";
import { notFound } from "next/navigation";

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
	const { bookId } = await params;
	const book = await getBook(bookId);
	if (!book) notFound();

	const [sessions, quotes, shelves, seriesBooks] = await Promise.all([
		getSessions(bookId),
		getQuotes(bookId),
		getShelves(),
		book.seriesName ? getSeriesBooks(book.seriesName) : [],
	]);

	return (
		<BookDetailView
			book={book}
			sessions={sessions}
			quotes={quotes}
			shelves={shelves}
			seriesBooks={seriesBooks}
		/>
	);
}
