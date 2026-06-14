import { computePace, progressPercent } from "@/features/tsundoku/lib/pace";
import type { SessionLike } from "@/features/tsundoku/lib/pace";
import { Progress } from "@seikatsu/ui";

interface Props {
	currentPage: number;
	pageCount: number | null;
	sessions?: SessionLike[];
	showPace?: boolean;
}

export function ProgressBar({ currentPage, pageCount, sessions = [], showPace = false }: Props) {
	const pct = progressPercent(currentPage, pageCount);
	const pace = showPace ? computePace(sessions, currentPage, pageCount) : null;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>
					{pageCount ? (
						<>
							p. {currentPage} / {pageCount}
						</>
					) : (
						<>p. {currentPage}</>
					)}
				</span>
				{pct != null && <span className="tabular-nums">{pct}%</span>}
			</div>
			<Progress value={pct ?? 0} className="h-1.5" />
			{pace && pace.daysToFinish != null && (
				<p className="text-xs text-muted-foreground">
					≈ {pace.pagesPerDay} pages/day · {pace.daysToFinish} day
					{pace.daysToFinish === 1 ? "" : "s"} to finish
				</p>
			)}
		</div>
	);
}
