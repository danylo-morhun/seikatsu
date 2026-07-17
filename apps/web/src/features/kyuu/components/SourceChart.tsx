"use client";

import type { SourceStat } from "@/features/kyuu/actions/stats";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const config: ChartConfig = {
	count: { label: "Applied", color: "var(--chart-3)" },
	responded: { label: "Responded", color: "var(--chart-2)" },
};

export function SourceChart({ data }: { data: SourceStat[] }) {
	if (data.length === 0) {
		return <p className="py-8 text-center text-sm text-muted-foreground">No sources logged yet.</p>;
	}

	const top = data.slice(0, 8);

	return (
		<ChartContainer config={config} className="h-[240px] w-full">
			<BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
				<CartesianGrid horizontal={false} strokeDasharray="3 3" />
				<XAxis
					type="number"
					tickLine={false}
					axisLine={false}
					tick={{ fontSize: 11 }}
					allowDecimals={false}
				/>
				<YAxis
					type="category"
					dataKey="source"
					tickLine={false}
					axisLine={false}
					tick={{ fontSize: 11 }}
					width={100}
				/>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
				<Bar dataKey="responded" fill="var(--color-responded)" radius={[0, 4, 4, 0]} />
			</BarChart>
		</ChartContainer>
	);
}
