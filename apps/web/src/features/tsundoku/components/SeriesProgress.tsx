import type { TsundokuBook } from "@/features/tsundoku/actions/books";
import { Progress } from "@seikatsu/ui";
import Link from "next/link";

/** "X / Y read" for the current book's series. `seriesBooks` includes the current book. */
export function SeriesProgress({
	seriesName,
	seriesBooks,
	currentId,
}: {
	seriesName: string;
	seriesBooks: TsundokuBook[];
	currentId: string;
}) {
	if (seriesBooks.length < 2) return null;
	const read = seriesBooks.filter((b) => b.status === "read").length;
	const pct = Math.round((read / seriesBooks.length) * 100);
	const sorted = [...seriesBooks].sort(
		(a, b) => (a.seriesPosition ?? 999) - (b.seriesPosition ?? 999),
	);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm">
				<span className="font-medium">{seriesName}</span>
				<span className="text-muted-foreground">
					{read} / {seriesBooks.length} read
				</span>
			</div>
			<Progress value={pct} className="h-1.5" />
			<div className="flex flex-wrap gap-1.5">
				{sorted.map((b) => (
					<Link
						key={b.id}
						href={`/tsundoku/${b.id}`}
						className={
							b.id === currentId
								? "rounded border border-primary px-2 py-0.5 text-xs text-primary"
								: "rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50"
						}
					>
						{b.seriesPosition ? `#${b.seriesPosition}` : b.title.slice(0, 18)}
					</Link>
				))}
			</div>
		</div>
	);
}
