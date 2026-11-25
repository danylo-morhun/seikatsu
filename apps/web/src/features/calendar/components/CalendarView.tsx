import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { PageTab, PageTabs } from "@/components/PageTabs";
import { CalendarKeys } from "@/features/calendar/components/CalendarKeys";
import { DayList } from "@/features/calendar/components/DayList";
import { MonthGrid } from "@/features/calendar/components/MonthGrid";
import { TimeGrid } from "@/features/calendar/components/TimeGrid";
import {
	CALENDAR_VIEWS,
	daysOf,
	figuresOf,
	hrefOf,
	showsToday,
	stepOf,
	titleParts,
	VIEW_KEYS,
	type CalendarView as View,
	viewKeyHrefs,
	within,
} from "@/features/calendar/lib/calendar";
import { HomeKeys } from "@/features/home/components/TodayIslands";
import { layoutOf } from "@/features/home/lib/dashboard";
import { money } from "@/features/home/lib/format";
import { getWeekData } from "@/features/week/lib/data";
import { loadExtras } from "@/features/week/lib/extras";
import { buildWeek, weekLine } from "@/features/week/lib/week";
import { type AppHref, modulesOn } from "@/lib/modules";
import type { Workspace } from "@/lib/session";

/**
 * The home as a calendar: every app's dated rows on one page — a month, a week or a day over the
 * hours, or a list of days. Days ahead show what's planned, days behind what happened (summed up
 * in the month, row by row in the day). Each row opens its app.
 */
export async function CalendarView({
	ws,
	today,
	view,
	anchor,
}: {
	ws: Workspace;
	today: string;
	view: View;
	/** Any day the view should hold. */
	anchor: string;
}) {
	const dates = daysOf(view, anchor);
	const on = modulesOn(ws.modulesOff);
	const fmt = (amount: number, currency = ws.baseCurrency) => money(amount, currency);
	const [data, { carried, later }] = await Promise.all([
		getWeekData(ws, today, dates, on),
		loadExtras(ws, today, dates, fmt),
	]);
	const { days } = buildWeek(data, today, dates, fmt, carried, later);
	// A month's figures count its own days, not the weeks' spill-over around it.
	const own =
		view === "month"
			? within(
					data,
					`${anchor.slice(0, 7)}-01`,
					dates.filter((d) => d.startsWith(anchor.slice(0, 7))).at(-1) ?? anchor,
				)
			: data;
	const { totals } = buildWeek(own, today, dates, fmt);
	const current = showsToday(view, anchor, today);
	const prev = hrefOf(view, stepOf(view, anchor, -1), today);
	const next = hrefOf(view, stepOf(view, anchor, 1), today);
	const apps = layoutOf(ws.dashboard, on)
		.filter((s) => !s.hidden && s.id !== "today")
		.map((s) => s.id as AppHref);
	const line = view === "day" ? null : weekLine(totals, fmt);
	const [main, context] = titleParts(view, anchor);
	const figures = new Map(dates.map((d) => [d, figuresOf(data, d)]));

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-5 pb-28 sm:px-8 md:py-8">
			<HomeKeys listed={apps} />
			<CalendarKeys
				view={view}
				hrefs={{
					...viewKeyHrefs(anchor, today),
					"[": prev,
					"]": next,
					t: hrefOf(view, today, today),
				}}
			/>
			<header className="flex animate-rise flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div className="min-w-0">
					<h1 className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] md:text-[2.5rem]">
						{main} <span className="font-normal text-muted-foreground">{context}</span>
					</h1>
					<p className="mt-2.5 min-h-5 text-sm text-muted-foreground">
						{line ?? (current ? "Today" : "")}
					</p>
				</div>
				<div className="flex max-w-full flex-wrap items-center gap-2">
					<nav aria-label="Dates" className="flex items-center rounded-button bg-surface p-0.5">
						<StepLink href={prev} label="Back">
							<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
						</StepLink>
						<Link
							href={hrefOf(view, today, today)}
							prefetch
							aria-keyshortcuts="T"
							aria-disabled={current}
							className={cn(
								"rounded-button px-3 py-1.5 text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring",
								current ? "text-muted-foreground" : "text-foreground hover:bg-surface-2",
							)}
						>
							Today
						</Link>
						<StepLink href={next} label="Ahead">
							<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
						</StepLink>
					</nav>
					<PageTabs label="Home view">
						{CALENDAR_VIEWS.map((v) => (
							<PageTab key={v} href={hrefOf(v, anchor, today)} current={v === view}>
								{VIEW_KEYS[v].name}
							</PageTab>
						))}
						<PageTab href={hrefOf("widgets")} current={false}>
							Widgets
						</PageTab>
					</PageTabs>
				</div>
			</header>

			<div className="animate-rise [--i:1]">
				{view === "month" && (
					<MonthGrid
						days={days}
						figures={figures}
						month={anchor.slice(0, 7)}
						today={today}
						money={fmt}
					/>
				)}
				{view === "week" && (
					<>
						<div className="max-md:hidden">
							<TimeGrid days={days} today={today} figures={figures} money={fmt} />
						</div>
						<div className="md:hidden">
							<DayList days={days} today={today} figures={figures} money={fmt} />
						</div>
					</>
				)}
				{view === "day" && (
					// The hours at the left, the day's whole list (with notes) beside them.
					<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
						<div className="max-lg:hidden">
							<TimeGrid days={days} today={today} figures={figures} money={fmt} strip={false} />
						</div>
						<DayList days={days} today={today} figures={figures} money={fmt} />
					</div>
				)}
				{view === "list" && <DayList days={days} today={today} figures={figures} money={fmt} />}
			</div>
		</div>
	);
}

function StepLink({
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
			className="flex size-8 items-center justify-center rounded-button text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
		>
			{children}
		</Link>
	);
}
