"use client";

import type { NetWorthPoint } from "@/features/kuroji/actions/net-worth";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

const chartConfig: ChartConfig = {
	netWorth: { label: "Net Worth", color: "var(--chart-2)" },
};

interface Props {
	data: NetWorthPoint[];
	currency: string;
}

export function NetWorthChart({ data, currency }: Props) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">Net Worth History</CardTitle>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
						No data yet
					</div>
				) : (
					<ChartContainer config={chartConfig} className="h-[220px] w-full">
						<LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
							<YAxis
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 11 }}
								tickFormatter={(v) =>
									new Intl.NumberFormat("en", {
										notation: "compact",
										currency,
										style: "currency",
									}).format(v)
								}
							/>
							<ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 2" />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Line
								type="monotone"
								dataKey="netWorth"
								stroke="var(--chart-2)"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 4 }}
							/>
						</LineChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
