"use client";

import type { AccountActivity } from "@/features/kuroji/actions/account-detail";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@seikatsu/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig: ChartConfig = {
	credit: { label: "In", color: "var(--chart-2)" },
	debit: { label: "Out", color: "var(--chart-1)" },
};

interface Props {
	data: AccountActivity[];
	currency: string;
}

export function AccountActivityChart({ data, currency }: Props) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">Monthly Activity</CardTitle>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
						No activity yet
					</div>
				) : (
					<ChartContainer config={chartConfig} className="h-[200px] w-full">
						<BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
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
							<ChartTooltip content={<ChartTooltipContent />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar dataKey="credit" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
							<Bar dataKey="debit" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
