import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getBooks } from "@/features/tsundoku/actions/books";
import { getShelves } from "@/features/tsundoku/actions/shelves";
import { BooksEmptyState } from "@/features/tsundoku/components/BooksEmptyState";
import { LibraryView } from "@/features/tsundoku/components/LibraryView";
import { redirect } from "next/navigation";

export default async function TsundokuPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const [books, shelves] = await Promise.all([getBooks(workspace.id), getShelves(workspace.id)]);

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				{books.length === 0 ? (
					<BooksEmptyState workspaceId={workspace.id} />
				) : (
					<LibraryView books={books} shelves={shelves} workspaceId={workspace.id} />
				)}
			</div>
		</main>
	);
}
