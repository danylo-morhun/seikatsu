"use client";

import { Spinner } from "@/components/Spinner";
import { type TsundokuQuote, createQuote, deleteQuote } from "@/features/tsundoku/actions/quotes";
import { Delete02Icon, QuoteUpIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function QuoteSection({
	bookId,
	quotes,
}: {
	bookId: string;
	quotes: TsundokuQuote[];
}) {
	const router = useRouter();
	const [text, setText] = useState("");
	const [page, setPage] = useState("");
	const [adding, setAdding] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	async function onAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!text.trim()) return;
		setAdding(true);
		const res = await createQuote(bookId, {
			text: text.trim(),
			page: page ? Number.parseInt(page, 10) : null,
		});
		setAdding(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		setText("");
		setPage("");
		router.refresh();
	}

	function onDelete(id: string) {
		setDeletingId(id);
		startTransition(async () => {
			const res = await deleteQuote(id);
			setDeletingId(null);
			if ("error" in res) toast.error(res.error);
			else router.refresh();
		});
	}

	return (
		<div className="space-y-3">
			<form onSubmit={onAdd} className="space-y-2">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={2}
					placeholder="Add a quote or highlight…"
					className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				/>
				<div className="flex items-center gap-2">
					<Input
						type="number"
						value={page}
						onChange={(e) => setPage(e.target.value)}
						placeholder="Page"
						className="w-24"
					/>
					<Button type="submit" size="sm" disabled={adding || !text.trim()} className="gap-1.5">
						{adding && <Spinner />}
						Add quote
					</Button>
				</div>
			</form>

			{quotes.length === 0 ? (
				<p className="text-sm text-muted-foreground">No quotes saved yet.</p>
			) : (
				<ul className="space-y-2">
					{quotes.map((qt) => (
						<li
							key={qt.id}
							className="group relative rounded-lg border border-border/50 bg-muted/30 p-3 pl-9 text-sm"
						>
							<HugeiconsIcon
								icon={QuoteUpIcon}
								className="absolute left-3 top-3 h-4 w-4 text-primary/50"
							/>
							<p className="whitespace-pre-wrap italic">{qt.text}</p>
							<div className="mt-1 flex items-center justify-between">
								{qt.page != null ? (
									<span className="text-xs text-muted-foreground">p. {qt.page}</span>
								) : (
									<span />
								)}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
									onClick={() => onDelete(qt.id)}
									disabled={isPending && deletingId === qt.id}
									aria-label="Delete quote"
								>
									{isPending && deletingId === qt.id ? (
										<Spinner />
									) : (
										<HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
