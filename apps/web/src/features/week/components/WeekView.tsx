import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DayTabs } from "@/features/home/components/DayTabs";
import { Seal } from "@/features/home/components/Line";
import { money } from "@/features/home/lib/format";
import { addDays } from "@/features/keizoku/lib/streak";
import { MoveCard } from "@/features/week/components/MoveCard";
import { getWeekData } from "@/features/week/lib/data";
import { buildWeek, type WeekEntry, type WeekTotals, weekOf } from "@/features/week/lib/week";
import type { Workspace } from "@/lib/session";

const DAY_NAME = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "2 – 8 November", or across months "30 November – 6 December". */
function rangeTitle(week: string[]) {
	const [first, last] = [utc(week[0]), utc(week[6])];
	return first.getUTCMonth() === last.getUTCMonth()
		? `${first.getUTCDate()} – ${DAY_MONTH.format(last)}`
		: `${DAY_MONTH.format(first)} – ${DAY_MONTH.format(last)}`;
}

/**
 * The week: what happened on the days behind and what's dated on the days ahead, across the
 * apps, with the week's figures on top. Cards due ahead can move to another day; the rest
 * open their app. Earlier and later weeks are a link away.
 */
export async function WeekView({ ws, today, day }: { ws: Workspace; today: string; day: string }) {
	const week = weekOf(day);
	const current = week.includes(today);
	const data = await getWeekData(ws, today, week);
	const fmt = (amount: number, currency = ws.baseCurrency) => money(amount, currency);
	const { days, totals } = buildWeek(data, today, week, fmt);
	// Days a due card can move to: the rest of this week, from today.
	const ahead = week.filter((d) => d >= today);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 pb-16 sm:px-8 md:space-y-8 md:py-8">
			<DayTabs current="week" />
			<header className="flex animate-rise flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">{rangeTitle(week)}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{current ? "This week" : week[6] < today ? "A week behind you" : "A week ahead"}
						{" · "}
						<Totals totals={totals} fmt={fmt} />
					</p>
				</div>
				<nav aria-label="Weeks" className="flex items-center gap-1">
					<WeekLink href={`/week?w=${addDays(week[0], -7)}`} label="Previous week">
						<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
					</WeekLink>
					{!current && (
						<Link
							href="/week"
							prefetch
							className="rounded-button px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
						>
							This week
						</Link>
					)}
					<WeekLink href={`/week?w=${addDays(week[0], 7)}`} label="Next week">
						<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
					</WeekLink>
				</nav>
			</header>

			<ol aria-label="Days" className="space-y-5 md:space-y-6">
				{days.map((d, i) => {
					const entries = [...d.done, ...d.plan];
					return (
						<li
							key={d.date}
							aria-label={DAY_NAME.format(utc(d.date))}
							className="grid animate-rise gap-2 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-4"
							style={{ "--i": i + 1 } as CSSProperties}
						>
							<h2
								className={cn(
									"px-1 text-sm md:pt-4",
									d.isToday ? "font-semibold text-foreground" : "text-muted-foreground",
								)}
							>
								{DAY_NAME.format(utc(d.date))} {utc(d.date).getUTCDate()}
								{d.isToday && <span className="ml-2 font-normal text-primary">Today</span>}
							</h2>
							{entries.length > 0 ? (
								<ul className="inset-group">
									{d.done.map((e) => (
										<Entry key={e.key} entry={e} />
									))}
									{d.plan.map((e) => (
										<Entry
											key={e.key}
											entry={e}
											move={
												e.card && (
													<MoveCard
														card={e.card}
														from={d.date}
														days={ahead.filter((x) => x !== d.date)}
													/>
												)
											}
										/>
									))}
								</ul>
							) : (
								<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-3.5 text-sm text-muted-foreground">
									{d.past ? "Nothing logged" : "Nothing planned"}
								</p>
							)}
						</li>
					);
				})}
			</ol>
		</div>
	);
}

function WeekLink({
	href,
	label,
	children,
}: {
	href: string;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			prefetch
			aria-label={label}
			className="flex size-9 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
		>
			{children}
		</Link>
	);
}

function Entry({ entry, move }: { entry: WeekEntry; move?: React.ReactNode }) {
	return (
		<li className="flex min-h-14 items-center gap-3 py-2">
			<Seal href={entry.app} />
			<Link href={entry.href} prefetch className="group min-w-0 flex-1 outline-none">
				<span className="block truncate text-sm font-medium group-hover:underline group-focus-visible:underline">
					{entry.title}
				</span>
				{entry.note && (
					<span className="block truncate text-xs text-muted-foreground">{entry.note}</span>
				)}
			</Link>
			{move}
		</li>
	);
}

/** The week in one line: only what moved. */
function Totals({ totals, fmt }: { totals: WeekTotals; fmt: (n: number) => string }) {
	const parts = [
		totals.spent > 0 && `${fmt(totals.spent)} spent`,
		totals.expected > 0 && `${totals.ticks} of ${totals.expected} habits`,
		totals.pages > 0 && `${totals.pages} pages`,
		totals.cardsDone > 0 && `${totals.cardsDone} cards done`,
		totals.km > 0 && `${totals.km.toLocaleString("en-US")} km`,
		totals.applied > 0 && `${totals.applied} applied`,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(" · ") : "nothing logged yet";
}
