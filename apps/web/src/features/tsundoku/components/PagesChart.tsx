"use client";

import type { MonthPages } from "@/features/tsundoku/actions/stats";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const config: ChartConfig = {
	pages: { label: "Pages", color: "var(--chart-2)" },
};

export function PagesChart({ data }: { data: MonthPages[] }) {
	const formatted = data.map((d) => ({ ...d, label: d.month.slice(5) }));
	const total = data.reduce((s, d) => s + d.pages, 0);

	if (total === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				No reading sessions logged this year.
			</p>
		);
	}

	return (
		<ChartContainer config={config} className="h-[220px] w-full">
			<BarChart data={formatted} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
				<YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="pages" fill="var(--color-pages)" radius={[4, 4, 0, 0]} />
			</BarChart>
		</ChartContainer>
	);
}
