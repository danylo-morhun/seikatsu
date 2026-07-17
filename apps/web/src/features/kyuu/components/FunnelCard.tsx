import type { KyuuStats } from "@/features/kyuu/actions/stats";

interface Stage {
	label: string;
	count: number;
}

export function FunnelCard({ stats }: { stats: KyuuStats }) {
	const stages: Stage[] = [
		{ label: "Applied", count: stats.total },
		{ label: "HR Screening", count: stats.hrScreeningCount },
		{ label: "Technical Interview", count: stats.technicalInterviewCount },
		{ label: "Offer", count: stats.offerCount },
	];
	const max = stats.total || 1;

	return (
		<div className="space-y-3">
			{stages.map((s) => {
				const pct = (s.count / max) * 100;
				return (
					<div key={s.label} className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between gap-2 text-sm">
							<span className="font-medium">{s.label}</span>
							<span className="text-muted-foreground">
								{s.count} · {pct.toFixed(0)}%
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${pct}%` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
