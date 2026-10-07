import type { ActivityDay } from "@/features/keizoku/actions/stats";
import { GithubHeatmap, type HeatmapCell } from "@/features/keizoku/components/GithubHeatmap";

const LEGEND = [
	{ label: "None", className: "bg-muted" },
	{ label: "Partial", className: "bg-primary/40" },
	{ label: "All", className: "bg-primary" },
];

function bucket(status: ActivityDay["status"]): string {
	if (status === "all") return "bg-primary";
	if (status === "partial") return "bg-primary/40";
	return "bg-muted";
}

// Server component: rendered by the Keizoku page and handed to TodayList as a slot, so the
// year of day statuses never crosses the client boundary as props.
export function KeizokuActivityHeatmap({ days, today }: { days: ActivityDay[]; today?: string }) {
	const cellByDate = new Map<string, HeatmapCell>();
	for (const d of days) {
		cellByDate.set(d.date, { className: bucket(d.status), title: `${d.date}: ${d.status}` });
	}

	const fullDays = days.filter((d) => d.status === "all").length;

	return (
		<GithubHeatmap
			today={today}
			cellByDate={cellByDate}
			emptyClassName="bg-muted"
			legend={LEGEND}
			summary={`${fullDays} full ${fullDays === 1 ? "day" : "days"} in the last year`}
		/>
	);
}
