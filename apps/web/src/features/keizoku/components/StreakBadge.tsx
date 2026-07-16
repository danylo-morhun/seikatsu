import { Award01Icon, FireIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function StreakBadge({ current, best }: { current: number; best: number }) {
	return (
		<div className="flex gap-3">
			<div className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-border/50 bg-card px-4 py-4">
				<HugeiconsIcon icon={FireIcon} className="h-6 w-6 text-orange-400" />
				<span className="text-4xl font-bold leading-none">{current}</span>
				<span className="text-xs text-muted-foreground">Current streak</span>
			</div>
			<div className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-border/50 bg-card px-4 py-4">
				<HugeiconsIcon icon={Award01Icon} className="h-6 w-6 text-amber-400" />
				<span className="text-4xl font-bold leading-none">{best}</span>
				<span className="text-xs text-muted-foreground">Best streak</span>
			</div>
		</div>
	);
}
