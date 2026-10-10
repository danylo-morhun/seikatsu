import type { MonthlyTrend } from "@/features/kuroji/actions/trends";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { flowRows } from "@/features/kuroji/lib/monthly-flow";
import { cn } from "@seikatsu/ui";
import Link from "next/link";

const RANGES = [
	{ label: "3M", value: "3m" },
	{ label: "6M", value: "6m" },
	{ label: "1Y", value: "1y" },
] as const;

interface Props {
	data: MonthlyTrend[];
	currency: string;
	trendParam: string;
	/** A custom period fixes the months shown, so the range switch is hidden. */
	hasDateFilter: boolean;
	/** Current search params, to keep the rest of the URL when switching range. */
	searchParams: Record<string, string | undefined>;
	/** First and last month shown (YYYY-MM); runs of empty months fold into one row. */
	range: { from: string; to: string };
}

function monthLabel(month: string, withYear: boolean) {
	const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
	return new Intl.DateTimeFormat("en", {
		month: "short",
		...(withYear ? { year: "2-digit" } : {}),
		timeZone: "UTC",
	}).format(d);
}

/** "Mar – Jun 2025", or "Nov 2024 – Feb 2025" across years; full years, never "Jan 15". */
function gapLabel(from: string, to: string) {
	const year = (m: string) => m.slice(0, 4);
	const start = monthLabel(from, false);
	const end = `${monthLabel(to, false)} ${year(to)}`;
	return year(from) === year(to) ? `${start} – ${end}` : `${start} ${year(from)} – ${end}`;
}

/**
 * Income against spending, one row per month, newest first. Both bars share one scale;
 * the right column says the only thing that matters about the month: what was left.
 */
export function MonthlyFlow({
	data,
	currency,
	trendParam,
	hasDateFilter,
	searchParams,
	range,
}: Props) {
	const rows = flowRows(data, range.from, range.to);
	const max = Math.max(1, ...data.flatMap((m) => [m.income, m.expenses]));
	const multiYear = range.from.slice(0, 4) !== range.to.slice(0, 4);

	function rangeHref(value: string) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(searchParams)) if (v) params.set(k, v);
		if (value === "6m") params.delete("trend");
		else params.set("trend", value);
		const qs = params.toString();
		return qs ? `/kuroji?${qs}` : "/kuroji";
	}

	return (
		<section aria-labelledby="flow-title">
			<div className="mb-3 flex items-center justify-between gap-3">
				<h2 id="flow-title" className="text-sm font-medium">
					Monthly flow
				</h2>
				{!hasDateFilter && (
					<nav aria-label="Range" className="flex rounded-md bg-surface p-0.5">
						{RANGES.map((r) => (
							<Link
								key={r.value}
								href={rangeHref(r.value)}
								prefetch
								aria-current={trendParam === r.value ? "true" : undefined}
								className={cn(
									"rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
									trendParam === r.value && "bg-surface-2 text-foreground",
								)}
							>
								{r.label}
							</Link>
						))}
					</nav>
				)}
			</div>

			{rows.length === 0 ? (
				<p className="py-6 text-sm text-muted-foreground">No income or spending in this range.</p>
			) : (
				<ol className="divide-y divide-rule">
					{rows.map((m) => {
						if (m.kind === "gap") {
							return (
								<li key={m.from} className="py-2.5 text-xs text-muted-foreground">
									{gapLabel(m.from, m.to)} · no activity
								</li>
							);
						}
						const net = m.income - m.expenses;
						return (
							<li
								key={m.month}
								className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
							>
								<span className="text-xs text-muted-foreground">
									{monthLabel(m.month, multiYear)}
								</span>
								<span className="flex flex-col gap-1" aria-hidden>
									<span className="h-1.5 rounded-full bg-surface-2">
										<span
											className="block h-full rounded-full bg-positive"
											style={{ width: `${(m.income / max) * 100}%` }}
										/>
									</span>
									<span className="h-1.5 rounded-full bg-surface-2">
										<span
											className="block h-full rounded-full bg-foreground/70"
											style={{ width: `${(m.expenses / max) * 100}%` }}
										/>
									</span>
								</span>
								<span className="text-right">
									<span
										className={cn(
											"block font-figures text-sm font-medium",
											net < 0
												? "text-negative"
												: net > 0
													? "text-positive"
													: "text-muted-foreground",
										)}
									>
										<span className="sr-only">Left </span>
										{net > 0 ? "+" : ""}
										{formatCurrency(net, currency)}
									</span>
									<span className="block text-[11px] text-muted-foreground">
										<span className="sr-only">, income </span>
										{formatCurrency(m.income, currency)}
										<span className="sr-only">, spent</span> /{" "}
										{formatCurrency(m.expenses, currency)}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
			)}
			<p className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-positive" />
					Income
				</span>
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-foreground/70" />
					Spent
				</span>
			</p>
		</section>
	);
}
