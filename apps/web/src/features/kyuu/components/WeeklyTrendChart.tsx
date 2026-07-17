"use client";

import type { WeekStat } from "@/features/kyuu/actions/stats";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const config: ChartConfig = {
	count: { label: "Applications", color: "var(--chart-1)" },
};

export function WeeklyTrendChart({ data }: { data: WeekStat[] }) {
	if (data.length === 0) {
		return <p className="py-8 text-center text-sm text-muted-foreground">No applications yet.</p>;
	}

	const formatted = data.map((d) => ({ ...d, label: d.week.slice(5) }));

	return (
		<ChartContainer config={config} className="h-[220px] w-full">
			<BarChart data={formatted} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
				<YAxis
					tickLine={false}
					axisLine={false}
					tick={{ fontSize: 11 }}
					width={28}
					allowDecimals={false}
				/>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
			</BarChart>
		</ChartContainer>
	);
}
