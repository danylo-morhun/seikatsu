import { FIGURES_ROW, Figure } from "@/features/aisha/components/Figure";
import type { HoshiiItem } from "@/features/hoshii/actions/data";
import { formatDay } from "@/features/hoshii/lib/dates";
import { formatMoney, plural } from "@/features/hoshii/lib/format";
import type { YearSummary } from "@/features/hoshii/lib/summary";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const monthName = (year: number, m: number) => MONTH.format(new Date(Date.UTC(year, m, 1)));

/** Saved by letting go (the lead), spent, and how often a want survived cooling. */
export function SummaryFigures({ summary, currency }: { summary: YearSummary; currency: string }) {
	const share = summary.decided > 0 ? Math.round((summary.kept / summary.decided) * 100) : null;
	return (
		<section
			aria-label="The year in wants"
			className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr]`}
		>
			<div className="col-span-2 md:col-span-1">
				<Figure
					lead
					index={0}
					label="Saved by letting go"
					value={formatMoney(summary.saved, currency, true)}
					note={
						summary.released > 0
							? `${plural(summary.released, "want")} let go after cooling`
							: "Nothing let go yet"
					}
				/>
			</div>
			<Figure
				index={1}
				label="Bought"
				value={formatMoney(summary.spent, currency, true)}
				note={
					summary.bought > 0
						? `${plural(summary.bought, "want")} · waited ${plural(summary.averageWait ?? 0, "day")} on average`
						: "Nothing bought yet"
				}
			/>
			<Figure
				index={2}
				label="Still wanted after cooling"
				value={share != null ? `${share}%` : null}
				note={
					summary.decided > 0
						? `${summary.kept} of ${summary.decided} decided${summary.skipped ? ` · ${summary.skipped} skipped cooling` : ""}`
						: "No decisions yet"
				}
			/>
		</section>
	);
}

/** One row a month, newest first: bought in pigment, let go in ink. */
export function SummaryMonths({
	summary,
	year,
	lastMonth,
	currency,
}: {
	summary: YearSummary;
	year: number;
	lastMonth: number;
	currency: string;
}) {
	const months = Array.from({ length: lastMonth + 1 }, (_, m) => lastMonth - m).filter(
		(m) => summary.months[m].bought > 0 || summary.months[m].released > 0,
	);
	if (months.length === 0) {
		return (
			<p className="py-6 text-sm text-muted-foreground">Nothing bought or let go this year yet.</p>
		);
	}
	const max = Math.max(1, ...summary.months.map((m) => Math.max(m.bought, m.released)));
	return (
		<>
			<ol className="inset-group rounded-2xl bg-surface px-4 py-1 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
				{months.map((m, i) => {
					const { bought, released } = summary.months[m];
					return (
						<li
							key={m}
							className="grid grid-cols-[3.25rem_minmax(0,1fr)_7.5rem] items-center gap-x-3 py-2.5"
						>
							<span className="text-xs text-muted-foreground">{monthName(year, m)}</span>
							<span aria-hidden className="space-y-1">
								<span className="block h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
										style={barClip(bought / max, i)}
									/>
								</span>
								<span className="block h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-foreground/50", BAR_FILL)}
										style={barClip(released / max, i)}
									/>
								</span>
							</span>
							<span className="text-right">
								<span className="block font-figures text-sm font-medium">
									{bought > 0 ? formatMoney(bought, currency, true) : "—"}
								</span>
								<span className="block font-figures text-[11px] text-muted-foreground">
									{released > 0 ? `${formatMoney(released, currency, true)} let go` : "none let go"}
								</span>
							</span>
						</li>
					);
				})}
			</ol>
			<p className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-primary/80" />
					bought
				</span>
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-foreground/50" />
					let go
				</span>
			</p>
		</>
	);
}

/** The year's wants that ended: bought or let go, newest first. */
export function SummaryWants({
	items,
	today,
	currency,
}: {
	items: HoshiiItem[];
	today: string;
	currency: string;
}) {
	if (items.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">None this year.</p>;
	}
	return (
		<ol className="inset-group rounded-2xl bg-surface px-4 py-1 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
			{items.map((i) => {
				const bought = i.state === "bought";
				const day = (bought ? i.boughtOn : i.releasedOn) ?? today;
				const amount =
					bought && i.boughtPrice != null
						? Number(i.boughtPrice)
						: i.price != null
							? Number(i.price)
							: null;
				return (
					<li
						key={i.id}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5"
					>
						<span className="min-w-0">
							<span className={cn("block truncate text-sm", !bought && "text-muted-foreground")}>
								{i.title}
							</span>
							<span className="block truncate text-xs text-muted-foreground">
								{bought ? "Bought" : "Let go"} {formatDay(day, today)}
								{i.skippedCooling && " · skipped cooling"}
							</span>
						</span>
						<span
							className={cn("font-figures text-sm font-medium", !bought && "text-muted-foreground")}
						>
							{amount != null
								? formatMoney(amount, (bought ? i.boughtCurrency : null) ?? i.currency ?? currency)
								: "—"}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
