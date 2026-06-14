"use client";

import { Spinner } from "@/components/Spinner";
import { type TsundokuBook, deleteBook, updateRating } from "@/features/tsundoku/actions/books";
import type { TsundokuQuote } from "@/features/tsundoku/actions/quotes";
import type { TsundokuSession } from "@/features/tsundoku/actions/sessions";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import { EditBookModal } from "@/features/tsundoku/components/EditBookModal";
import { LogSessionModal } from "@/features/tsundoku/components/LogSessionModal";
import { ProgressBar } from "@/features/tsundoku/components/ProgressBar";
import { QuoteSection } from "@/features/tsundoku/components/QuoteSection";
import { RatingInput } from "@/features/tsundoku/components/RatingInput";
import { SeriesProgress } from "@/features/tsundoku/components/SeriesProgress";
import { SessionLog } from "@/features/tsundoku/components/SessionLog";
import { ShelfManager } from "@/features/tsundoku/components/ShelfManager";
import { StatusSelect } from "@/features/tsundoku/components/StatusSelect";
import { Add01Icon, ArrowLeft01Icon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	Card,
	CardContent,
	Separator,
} from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

interface Props {
	book: TsundokuBook;
	sessions: TsundokuSession[];
	quotes: TsundokuQuote[];
	shelves: TsundokuShelf[];
	seriesBooks: TsundokuBook[];
	workspaceId: string;
}

export function BookDetailView({
	book,
	sessions,
	quotes,
	shelves,
	seriesBooks,
	workspaceId,
}: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function onRating(value: number | null) {
		startTransition(async () => {
			const res = await updateRating(book.id, value);
			if ("error" in res) toast.error(res.error);
			else router.refresh();
		});
	}

	function onDelete() {
		startTransition(async () => {
			const res = await deleteBook(book.id);
			if ("error" in res) toast.error(res.error);
			else {
				toast.success("Book deleted.");
				router.push("/tsundoku");
			}
		});
	}

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
				<Link
					href="/tsundoku"
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
					Library
				</Link>

				<div className="flex flex-col gap-6 sm:flex-row">
					{/* Cover + primary actions */}
					<div className="mx-auto w-40 shrink-0 space-y-3 sm:mx-0">
						<BookCover coverUrl={book.coverUrl} title={book.title} className="shadow-md" />
						<LogSessionModal
							bookId={book.id}
							trigger={
								<Button className="w-full gap-1.5">
									<HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
									Log session
								</Button>
							}
						/>
						<div className="flex gap-2">
							<EditBookModal
								book={book}
								trigger={
									<Button variant="outline" size="sm" className="flex-1 gap-1.5">
										<HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
										Edit
									</Button>
								}
							/>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										className="text-muted-foreground hover:text-destructive"
										aria-label="Delete book"
									>
										{isPending ? (
											<Spinner />
										) : (
											<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
										)}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Delete this book?</AlertDialogTitle>
										<AlertDialogDescription>
											This removes “{book.title}” and all its sessions and quotes. This cannot be
											undone.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={onDelete}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											Delete
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>

					{/* Metadata */}
					<div className="min-w-0 flex-1 space-y-4">
						<div>
							<h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
							{book.authors && book.authors.length > 0 && (
								<p className="text-muted-foreground">{book.authors.join(", ")}</p>
							)}
							<p className="mt-1 text-xs text-muted-foreground">
								{[book.publishedYear, book.pageCount ? `${book.pageCount} pages` : null, book.genre]
									.filter(Boolean)
									.join(" · ")}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<StatusSelect bookId={book.id} status={book.status} />
							<RatingInput value={book.rating} onChange={onRating} />
						</div>

						<ProgressBar
							currentPage={book.currentPage}
							pageCount={book.pageCount}
							sessions={sessions}
							showPace={book.status === "reading"}
						/>

						{book.description && (
							<p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
								{book.description}
							</p>
						)}

						{book.review && (
							<Card>
								<CardContent className="pt-4">
									<p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
										My review
									</p>
									<p className="whitespace-pre-wrap text-sm">{book.review}</p>
								</CardContent>
							</Card>
						)}
					</div>
				</div>

				{book.seriesName && (
					<>
						<Separator />
						<SeriesProgress
							seriesName={book.seriesName}
							seriesBooks={seriesBooks}
							currentId={book.id}
						/>
					</>
				)}

				<Separator />
				<section className="space-y-3">
					<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Shelves
					</h2>
					<ShelfManager
						bookId={book.id}
						workspaceId={workspaceId}
						shelves={shelves}
						bookShelfIds={book.shelfIds}
					/>
				</section>

				<Separator />
				<section className="grid gap-6 md:grid-cols-2">
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
							Reading sessions
						</h2>
						<SessionLog sessions={sessions} />
					</div>
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
							Quotes
						</h2>
						<QuoteSection bookId={book.id} quotes={quotes} />
					</div>
				</section>
			</div>
		</main>
	);
}
