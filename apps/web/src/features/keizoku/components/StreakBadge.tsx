export function StreakBadge({ current, best }: { current: number; best: number }) {
	return (
		<div className="flex gap-3">
			<div className="flex flex-1 flex-col items-center rounded-lg border border-border/50 bg-card px-4 py-3">
				<span className="text-2xl font-bold">🔥 {current}</span>
				<span className="text-xs text-muted-foreground">Current streak</span>
			</div>
			<div className="flex flex-1 flex-col items-center rounded-lg border border-border/50 bg-card px-4 py-3">
				<span className="text-2xl font-bold">🏆 {best}</span>
				<span className="text-xs text-muted-foreground">Best streak</span>
			</div>
		</div>
	);
}
