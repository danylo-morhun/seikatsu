import { getBooks } from "@/features/tsundoku/actions/books";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { LibraryView } from "@/features/tsundoku/components/LibraryView";
import { TsundokuWelcome } from "@/features/tsundoku/components/TsundokuWelcome";
import { getUserToday } from "@/lib/timezone";

export default async function TsundokuPage() {
	const [books, shelves, today] = await Promise.all([getBooks(), getShelves(), getUserToday()]);

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			{books.length === 0 ? (
				<TsundokuWelcome />
			) : (
				<LibraryView books={books} shelves={shelves} today={today} />
			)}
		</div>
	);
}
