import { auth } from "@/auth";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getBook, getSeriesBooks } from "@/features/tsundoku/actions/books";
import { getQuotes } from "@/features/tsundoku/actions/quotes";
import { getSessions } from "@/features/tsundoku/actions/sessions";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { BookDetailView } from "@/features/tsundoku/components/BookDetailView";
import { notFound, redirect } from "next/navigation";

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { bookId } = await params;
	const [book, workspace] = await Promise.all([
		getBook(bookId),
		initializeWorkspace(session.user.id),
	]);
	if (!book) notFound();

	const [sessions, quotes, shelves, seriesBooks] = await Promise.all([
		getSessions(bookId),
		getQuotes(bookId),
		getShelves(workspace.id),
		book.seriesName ? getSeriesBooks(workspace.id, book.seriesName) : Promise.resolve([]),
	]);

	return (
		<BookDetailView
			book={book}
			sessions={sessions}
			quotes={quotes}
			shelves={shelves}
			seriesBooks={seriesBooks}
			workspaceId={workspace.id}
		/>
	);
}
