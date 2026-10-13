import { getBooks } from "@/features/tsundoku/actions/books";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { BooksEmptyState } from "@/features/tsundoku/components/BooksEmptyState";
import { LibraryView } from "@/features/tsundoku/components/LibraryView";

export default async function TsundokuPage() {
	const [books, shelves] = await Promise.all([getBooks(), getShelves()]);

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				{books.length === 0 ? <BooksEmptyState /> : <LibraryView books={books} shelves={shelves} />}
			</div>
		</main>
	);
}
