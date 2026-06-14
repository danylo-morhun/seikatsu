import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getBook, getBooks } from "@/features/tsundoku/actions/books";
import { getQuotes } from "@/features/tsundoku/actions/quotes";
import { getSessions } from "@/features/tsundoku/actions/sessions";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { BookDetailView } from "@/features/tsundoku/components/BookDetailView";
import { notFound, redirect } from "next/navigation";

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { bookId } = await params;
	const book = await getBook(bookId);
	if (!book) notFound();

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const [sessions, quotes, shelves, allBooks] = await Promise.all([
		getSessions(bookId),
		getQuotes(bookId),
		getShelves(workspace.id),
		book.seriesName ? getBooks(workspace.id) : Promise.resolve([]),
	]);

	const seriesBooks = book.seriesName
		? allBooks.filter((b) => b.seriesName === book.seriesName)
		: [];

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
