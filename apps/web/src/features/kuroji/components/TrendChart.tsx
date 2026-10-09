"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import type { MonthlyTrend } from "@/features/kuroji/actions/trends";
import { formatCompactNumber, monthTickLabels } from "@/features/kuroji/lib/format";
import { ChartBarLineIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@seikatsu/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";
import { Button } from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig: ChartConfig = {
	income: { label: "Income", color: "oklch(0.68 0.18 142)" },
	expenses: { label: "Expenses", color: "oklch(0.62 0.22 25)" },
};

const PERIODS = [
	{ label: "3M", value: "3m" },
	{ label: "6M", value: "6m" },
	{ label: "1Y", value: "1y" },
] as const;

interface Props {
	data: MonthlyTrend[];
	currency: string;
	trendParam: string;
	hasDateFilter: boolean;
}

export function TrendChart({ data, currency, trendParam, hasDateFilter }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();

	function setTrend(value: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "6m") params.delete("trend");
		else params.set("trend", value);
		const qs = params.toString();
		startNavigationProgress();
		router.push(qs ? `${pathname}?${qs}` : pathname);
	}

	const formatted = data.map((d) => ({ ...d, label: d.month.slice(0, 7) }));
	const monthTick = monthTickLabels(formatted.map((d) => d.label));

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-base">Income vs Expenses</CardTitle>
				{!hasDateFilter && (
					<div className="flex items-center gap-1">
						{PERIODS.map((p) => (
							<Button
								key={p.value}
								variant={trendParam === p.value ? "secondary" : "ghost"}
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => setTrend(p.value)}
							>
								{p.label}
							</Button>
						))}
					</div>
				)}
			</CardHeader>
			<CardContent>
				{formatted.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
							<HugeiconsIcon icon={ChartBarLineIcon} size={20} className="text-muted-foreground" />
						</div>
						<p className="text-sm text-muted-foreground">No data in this period</p>
					</div>
				) : (
					<ChartContainer config={chartConfig} className="h-[220px] w-full">
						<BarChart data={formatted} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 11 }}
								tickFormatter={monthTick}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 11 }}
								tickFormatter={formatCompactNumber}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
							<Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
