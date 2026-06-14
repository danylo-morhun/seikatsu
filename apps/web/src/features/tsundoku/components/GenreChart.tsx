"use client";

import type { GenreSlice } from "@/features/tsundoku/actions/stats";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Cell, Pie, PieChart } from "recharts";

const COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function GenreChart({ genres }: { genres: GenreSlice[] }) {
	if (genres.length === 0) {
		return <p className="py-8 text-center text-sm text-muted-foreground">No genres yet.</p>;
	}

	const data = genres.map((g, i) => ({ ...g, fill: COLORS[i % COLORS.length] }));
	const config: ChartConfig = Object.fromEntries(
		genres.map((g, i) => [g.genre, { label: g.genre, color: COLORS[i % COLORS.length] }]),
	);

	return (
		<ChartContainer config={config} className="mx-auto aspect-square max-h-[220px]">
			<PieChart>
				<ChartTooltip content={<ChartTooltipContent nameKey="genre" />} />
				<Pie data={data} dataKey="count" nameKey="genre" innerRadius={50} strokeWidth={2}>
					{data.map((d) => (
						<Cell key={d.genre} fill={d.fill} />
					))}
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
