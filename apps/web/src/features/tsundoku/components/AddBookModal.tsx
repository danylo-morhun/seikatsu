"use client";

import { Spinner } from "@/components/Spinner";
import { createBook } from "@/features/tsundoku/actions/books";
import { fetchWorkDescription } from "@/features/tsundoku/actions/search";
import { BookSearchPanel } from "@/features/tsundoku/components/BookSearchPanel";
import type { BookSearchResult } from "@/features/tsundoku/lib/book-search";
import { BOOK_STATUSES, GENRE_OPTIONS, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function AddBookModal({
	workspaceId,
	trigger,
}: {
	workspaceId: string;
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [pendingKey, setPendingKey] = useState<string | null>(null);
	const router = useRouter();

	// Manual form state
	const [title, setTitle] = useState("");
	const [authors, setAuthors] = useState("");
	const [pageCount, setPageCount] = useState("");
	const [publishedYear, setPublishedYear] = useState("");
	const [genre, setGenre] = useState<string>("");
	const [status, setStatus] = useState<string>("want");
	const [saving, setSaving] = useState(false);

	function resetManual() {
		setTitle("");
		setAuthors("");
		setPageCount("");
		setPublishedYear("");
		setGenre("");
		setStatus("want");
	}

	function onOpenChange(v: boolean) {
		setOpen(v);
		if (!v) {
			resetManual();
			setPendingKey(null);
		}
	}

	async function handlePick(r: BookSearchResult) {
		setPendingKey(r.externalId);
		// Google returns description inline; Open Library needs a lazy follow-up fetch.
		const description =
			r.description ??
			(r.source === "openlibrary" ? await fetchWorkDescription(r.externalId) : null);
		const result = await createBook(workspaceId, {
			title: r.title,
			authors: r.authors,
			isbn: r.isbn ?? undefined,
			coverUrl: r.coverUrl ?? undefined,
			olKey: r.externalId,
			pageCount: r.pageCount ?? null,
			publishedYear: r.publishedYear ?? null,
			description: description ?? undefined,
			genre: r.subjects[0] ?? undefined,
			source: r.source,
			status: "want",
		});
		setPendingKey(null);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		toast.success("Added to your library.");
		setOpen(false);
		router.push(`/tsundoku/${result.id}`);
	}

	async function handleManualSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) {
			toast.error("Title is required");
			return;
		}
		setSaving(true);
		const result = await createBook(workspaceId, {
			title: title.trim(),
			authors: authors
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean),
			pageCount: pageCount ? Number.parseInt(pageCount, 10) : null,
			publishedYear: publishedYear ? Number.parseInt(publishedYear, 10) : null,
			genre: genre || undefined,
			source: "manual",
			status: status as (typeof BOOK_STATUSES)[number],
		});
		setSaving(false);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		toast.success("Added to your library.");
		setOpen(false);
		router.push(`/tsundoku/${result.id}`);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger ?? <Button size="sm">Add book</Button>}</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add a book</DialogTitle>
				</DialogHeader>
				<Tabs defaultValue="search">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="search">Search</TabsTrigger>
						<TabsTrigger value="manual">Manual</TabsTrigger>
					</TabsList>
					<TabsContent value="search" className="pt-3">
						<BookSearchPanel onPick={handlePick} pendingKey={pendingKey} />
					</TabsContent>
					<TabsContent value="manual" className="pt-3">
						<form onSubmit={handleManualSubmit} className="space-y-3">
							<div className="space-y-1.5">
								<Label>Title</Label>
								<Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
							</div>
							<div className="space-y-1.5">
								<Label>Author(s)</Label>
								<Input
									value={authors}
									onChange={(e) => setAuthors(e.target.value)}
									placeholder="Comma-separated"
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label>Pages</Label>
									<Input
										type="number"
										value={pageCount}
										onChange={(e) => setPageCount(e.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label>Year</Label>
									<Input
										type="number"
										value={publishedYear}
										onChange={(e) => setPublishedYear(e.target.value)}
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label>Genre</Label>
									<Select value={genre} onValueChange={setGenre}>
										<SelectTrigger>
											<SelectValue placeholder="Select" />
										</SelectTrigger>
										<SelectContent>
											{GENRE_OPTIONS.map((g) => (
												<SelectItem key={g} value={g}>
													{g}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label>Status</Label>
									<Select value={status} onValueChange={setStatus}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{BOOK_STATUSES.map((s) => (
												<SelectItem key={s} value={s}>
													{STATUS_CONFIG[s].label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2 pt-1">
								<Button type="button" variant="outline" onClick={() => setOpen(false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={saving} className="gap-1.5">
									{saving && <Spinner />}
									{saving ? "Adding…" : "Add book"}
								</Button>
							</div>
						</form>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
