"use client";

import type { TsundokuBook } from "@/features/tsundoku/actions/books";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { AddBookModal } from "@/features/tsundoku/components/AddBookModal";
import { BookCard } from "@/features/tsundoku/components/BookCard";
import { BookListRow } from "@/features/tsundoku/components/BookListRow";
import { FilterBar } from "@/features/tsundoku/components/FilterBar";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

interface Props {
	books: TsundokuBook[];
	shelves: TsundokuShelf[];
	workspaceId: string;
}

export function LibraryView({ books, shelves, workspaceId }: Props) {
	const params = useSearchParams();
	const view = params.get("view") === "list" ? "list" : "grid";
	const status = params.get("status");
	const shelf = params.get("shelf");
	const genre = params.get("genre");
	const sort = params.get("sort") ?? "added";
	const q = (params.get("q") ?? "").toLowerCase().trim();

	const genres = useMemo(
		() => Array.from(new Set(books.map((b) => b.genre).filter((g): g is string => !!g))).sort(),
		[books],
	);

	const filtered = useMemo(() => {
		let out = books;
		if (status) out = out.filter((b) => b.status === status);
		if (shelf) out = out.filter((b) => b.shelfIds.includes(shelf));
		if (genre) out = out.filter((b) => b.genre === genre);
		if (q) {
			out = out.filter(
				(b) =>
					b.title.toLowerCase().includes(q) ||
					(b.authors ?? []).some((a) => a.toLowerCase().includes(q)),
			);
		}
		const sorted = [...out];
		sorted.sort((a, b) => {
			switch (sort) {
				case "title":
					return a.title.localeCompare(b.title);
				case "author":
					return (a.authors?.[0] ?? "").localeCompare(b.authors?.[0] ?? "");
				case "rating":
					return (b.rating ?? -1) - (a.rating ?? -1);
				case "finished":
					return (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "");
				default:
					return a.position.localeCompare(b.position);
			}
		});
		return sorted;
	}, [books, status, shelf, genre, q, sort]);

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold">Library</h1>
					<p className="text-sm text-muted-foreground">
						{filtered.length} {filtered.length === 1 ? "book" : "books"}
						{filtered.length !== books.length ? ` of ${books.length}` : ""}
					</p>
				</div>
				<div className="hidden md:block">
					<AddBookModal workspaceId={workspaceId} />
				</div>
			</div>

			<FilterBar shelves={shelves} genres={genres} />

			{filtered.length === 0 ? (
				<p className="py-16 text-center text-sm text-muted-foreground">
					No books match these filters.
				</p>
			) : view === "grid" ? (
				<div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
					{filtered.map((b) => (
						<BookCard key={b.id} book={b} />
					))}
				</div>
			) : (
				<div className="space-y-1.5">
					{filtered.map((b) => (
						<BookListRow key={b.id} book={b} />
					))}
				</div>
			)}
		</div>
	);
}
