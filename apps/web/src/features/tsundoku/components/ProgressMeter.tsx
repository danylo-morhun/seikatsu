import { progressPercent } from "@/features/tsundoku/lib/pace";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";

interface Props {
	currentPage: number;
	pageCount: number | null;
	daysToFinish?: number | null;
	/** Position in a list: bars pour in one after another. */
	index?: number;
	className?: string;
	/** Tiles: the bar alone, the words for screen readers only. */
	compact?: boolean;
}

/** Where a book is, as a capacity bar that fills toward the end and says so in words. */
export function ProgressMeter({
	currentPage,
	pageCount,
	daysToFinish,
	index = 0,
	className,
	compact = false,
}: Props) {
	const pct = progressPercent(currentPage, pageCount);
	const words = [
		pageCount ? `p. ${currentPage} of ${pageCount}` : `p. ${currentPage}`,
		pct != null ? `${pct}%` : null,
		daysToFinish ? `≈ ${daysToFinish} ${daysToFinish === 1 ? "day" : "days"} left` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className={cn(compact ? "" : "space-y-1.5", className)}>
			<span aria-hidden className="relative block h-1 rounded-full bg-surface-2">
				<span
					className={cn("absolute inset-0 rounded-full bg-primary/80", BAR_FILL)}
					style={barClip((pct ?? 0) / 100, index)}
				/>
			</span>
			<p className={cn("font-figures text-xs text-muted-foreground", compact && "sr-only")}>
				{words}
			</p>
		</div>
	);
}
