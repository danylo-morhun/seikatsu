import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
	titleOf,
	VIEW_KEYS,
	type CalendarView as View,
	viewKeyHrefs,
	within,
} from "@/features/calendar/lib/calendar";
import { HomeKeys } from "@/features/home/components/TodayIslands";
import { CaptureBar } from "@/features/home/components/TodayQueue";
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

	return (
		<div className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-5 pb-28 sm:px-8 md:py-8">
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
			<header className="flex animate-rise flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">
						{titleOf(view, anchor)}
					</h1>
					<p className="mt-1 min-h-5 text-sm text-muted-foreground">
						{line ?? (current ? "Today" : "")}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<nav aria-label="Dates" className="flex items-center gap-1">
						<StepLink href={prev} label="Back">
							<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
						</StepLink>
						<Link
							href={hrefOf(view, today, today)}
							prefetch
							aria-keyshortcuts="T"
							className="rounded-button px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
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
				<CaptureBar />
			</div>

			<div className="animate-rise [--i:2]">
				{view === "month" && (
					<MonthGrid
						days={days}
						figures={new Map(dates.map((d) => [d, figuresOf(data, d)]))}
						month={anchor.slice(0, 7)}
						today={today}
						money={fmt}
					/>
				)}
				{view === "week" && (
					<>
						<div className="max-md:hidden">
							<TimeGrid days={days} today={today} />
						</div>
						<div className="md:hidden">
							<DayList days={days} today={today} />
						</div>
					</>
				)}
				{view === "day" && (
					<>
						<div className="max-md:hidden">
							<TimeGrid days={days} today={today} />
						</div>
						<div className="md:hidden">
							<DayList days={days} today={today} />
						</div>
					</>
				)}
				{view === "list" && <DayList days={days} today={today} />}
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
			className="flex size-9 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
		>
			{children}
		</Link>
	);
}
