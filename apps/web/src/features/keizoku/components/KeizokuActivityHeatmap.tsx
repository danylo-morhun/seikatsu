"use client";

import type { ActivityDay } from "@/features/keizoku/actions/stats";
import { GithubHeatmap, type HeatmapCell } from "@/features/keizoku/components/GithubHeatmap";
import { useMemo } from "react";

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

export function KeizokuActivityHeatmap({ days }: { days: ActivityDay[] }) {
	const cellByDate = useMemo(() => {
		const map = new Map<string, HeatmapCell>();
		for (const d of days) {
			map.set(d.date, { className: bucket(d.status), title: `${d.date}: ${d.status}` });
		}
		return map;
	}, [days]);

	const fullDays = days.filter((d) => d.status === "all").length;

	return (
		<GithubHeatmap
			cellByDate={cellByDate}
			emptyClassName="bg-muted"
			legend={LEGEND}
			summary={`${fullDays} full ${fullDays === 1 ? "day" : "days"} in the last year`}
		/>
	);
}
