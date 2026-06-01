"use client";

import type { AccountBalance } from "@/features/kuroji/actions/balances";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@seikatsu/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";
import * as React from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

interface Props {
	balances: AccountBalance[];
	currency: string;
}

export function ExpenseChart({ balances, currency }: Props) {
	const expenses = balances.filter((b) => b.type === "EXPENSE" && Number.parseFloat(b.balance) > 0);

	const data = expenses.map((b, i) => ({
		name: b.name,
		value: Number.parseFloat(b.balance),
		fill: CHART_COLORS[i % CHART_COLORS.length],
	}));

	const total = data.reduce((sum, d) => sum + d.value, 0);

	const chartConfig: ChartConfig = Object.fromEntries(
		data.map((d) => [d.name, { label: d.name, color: d.fill }]),
	);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="text-base">Expenses</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				{data.length === 0 ? (
					<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
						No expenses in this period
					</div>
				) : (
					<>
						<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px]">
							<PieChart>
								<ChartTooltip
									cursor={false}
									content={<ChartTooltipContent hideLabel nameKey="name" />}
								/>
								<Pie
									data={data}
									dataKey="value"
									nameKey="name"
									innerRadius={55}
									outerRadius={80}
									strokeWidth={2}
								>
									{data.map((entry, i) => (
										<Cell key={`cell-${entry.name}`} fill={entry.fill} />
									))}
									<Label
										content={({ viewBox }) => {
											if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
											return (
												<text
													x={viewBox.cx}
													y={viewBox.cy}
													textAnchor="middle"
													dominantBaseline="middle"
												>
													<tspan
														x={viewBox.cx}
														dy={-5}
														className="fill-foreground text-lg font-bold"
													>
														{formatCurrency(total, currency)}
													</tspan>
													<tspan x={viewBox.cx} dy={20} className="fill-muted-foreground text-xs">
														Total
													</tspan>
												</text>
											);
										}}
									/>
								</Pie>
							</PieChart>
						</ChartContainer>
						<ul className="mt-3 space-y-1.5 pb-2">
							{data.map((d) => (
								<li key={d.name} className="flex items-center justify-between gap-2 text-xs">
									<span className="flex items-center gap-1.5 min-w-0">
										<span
											className="h-2.5 w-2.5 shrink-0 rounded-sm"
											style={{ backgroundColor: d.fill }}
										/>
										<span className="truncate text-muted-foreground">{d.name}</span>
									</span>
									<span className="shrink-0 font-medium tabular-nums">
										{((d.value / total) * 100).toFixed(1)}%
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
}
