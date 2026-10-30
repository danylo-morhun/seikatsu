import type { ServiceWithItems } from "@/features/aisha/actions/data";
import { FIGURES_ROW, Figure } from "@/features/aisha/components/Figure";
import { formatDate, formatKm, formatMoney, formatNumber } from "@/features/aisha/lib/format";
import type { CarYear } from "@/features/aisha/lib/year";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";

/** The year at a glance: what the car cost leads, then how far it went. */
export function YearFigures({ year, currency }: { year: CarYear; currency: string }) {
	const perThousand = year.driven > 0 ? (year.spent / year.driven) * 1000 : null;
	return (
		<section aria-label="Summary" className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
			<div className="col-span-2 md:col-span-1">
				<Figure
					lead
					index={0}
					label={`Spent on the car · ${year.year}`}
					value={formatMoney(year.spent, currency)}
					note={`${year.services} ${year.services === 1 ? "service" : "services"}`}
				/>
			</div>
			<Figure
				index={1}
				label="Driven"
				value={formatNumber(year.driven)}
				unit="km"
				note={paceNote(year)}
			/>
			<Figure
				index={2}
				label="Per 1 000 km"
				value={perThousand == null ? null : formatMoney(Math.round(perThousand), currency)}
				note="in services"
			/>
			<div className="col-span-2 md:col-span-1">
				<Figure index={3} label="Busiest month" value={busiest(year)} note={busiestNote(year)} />
			</div>
		</section>
	);
}

/** km a month over the days the readings span; under two weeks, just the span. */
function paceNote(year: CarYear) {
	if (year.driven <= 0 || year.trackedDays <= 0) return undefined;
	if (year.trackedDays < 14) return `over ${year.trackedDays} days`;
	return `≈ ${formatKm((year.driven / year.trackedDays) * 30)} a month`;
}

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
const monthName = (year: number, m: number, long = false) =>
	(long ? MONTH_LONG : MONTH).format(new Date(Date.UTC(year, m, 1)));

function busiestIndex(year: CarYear) {
	let best = -1;
	year.months.forEach((m, i) => {
		if (m.km > 0 && (best < 0 || m.km > year.months[best].km)) best = i;
	});
	return best;
}
function busiest(year: CarYear) {
	const i = busiestIndex(year);
	return i < 0 ? null : monthName(year.year, i, true);
}
function busiestNote(year: CarYear) {
	const i = busiestIndex(year);
	return i < 0 ? undefined : formatKm(year.months[i].km);
}

/**
 * One row per month, newest first: km driven in the pigment, money spent in ink, each on its
 * own scale. Runs of quiet months fold into one line.
 */
export function MonthRows({
	year,
	lastMonth,
	currency,
}: {
	year: CarYear;
	lastMonth: number;
	currency: string;
}) {
	const months = Array.from({ length: lastMonth + 1 }, (_, m) => lastMonth - m);
	const active = (m: number) => year.months[m].km > 0 || year.months[m].services > 0;
	if (!months.some(active)) {
		return (
			<p className="py-6 text-sm text-muted-foreground">
				Nothing this year yet: update the mileage now and then, and it fills in.
			</p>
		);
	}
	const maxKm = Math.max(1, ...year.months.map((m) => m.km));
	const maxSpent = Math.max(1, ...year.months.map((m) => m.spent));
	const rows: ({ kind: "month"; m: number } | { kind: "gap"; from: number; to: number })[] = [];
	for (const m of months) {
		const prev = rows.at(-1);
		if (active(m)) rows.push({ kind: "month", m });
		else if (prev?.kind === "gap") prev.from = m;
		else rows.push({ kind: "gap", from: m, to: m });
	}
	const name = (m: number) => monthName(year.year, m);

	return (
		<>
			<ol className="inset-group">
				{rows.map((row, i) => {
					if (row.kind === "gap") {
						return (
							<li key={`gap-${row.to}`} className="py-2.5 text-xs text-muted-foreground">
								{row.from === row.to ? name(row.from) : `${name(row.from)} – ${name(row.to)}`} ·
								nothing logged
							</li>
						);
					}
					const { km, spent } = year.months[row.m];
					return (
						<li
							key={row.m}
							className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
						>
							<span className="text-xs text-muted-foreground">{name(row.m)}</span>
							<span aria-hidden className="space-y-1">
								<span className="block h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
										style={barClip(km / maxKm, i)}
									/>
								</span>
								<span className="block h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-foreground/70", BAR_FILL)}
										style={barClip(spent / maxSpent, i)}
									/>
								</span>
							</span>
							<span className="text-right">
								<span className="block font-figures text-sm font-medium">{formatKm(km)}</span>
								<span className="block font-figures text-[11px] text-muted-foreground">
									{spent > 0 ? formatMoney(spent, currency) : "no spend"}
								</span>
							</span>
						</li>
					);
				})}
			</ol>
			<p className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-primary/80" />
					km driven
				</span>
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="h-1.5 w-3 rounded-full bg-foreground/70" />
					spent
				</span>
			</p>
		</>
	);
}

/** The year's visits, newest first: what was done and what it cost. */
export function YearServices({ services }: { services: ServiceWithItems[] }) {
	if (services.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No services this year.</p>;
	}
	return (
		<ol className="inset-group">
			{services.map((s) => (
				<li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5">
					<span className="min-w-0">
						<span className="block truncate text-sm">
							{s.items.map((i) => i.name).join(", ") || "Visit"}
						</span>
						<span className="block truncate text-xs text-muted-foreground">
							{[formatDate(s.date), formatKm(s.km), s.shop].filter(Boolean).join(" · ")}
						</span>
					</span>
					<span className="font-figures text-sm font-medium">
						{s.cost != null ? formatMoney(Number(s.cost), s.currency) : "—"}
					</span>
				</li>
			))}
		</ol>
	);
}
