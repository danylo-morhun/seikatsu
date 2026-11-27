import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { PageTab, PageTabs } from "@/components/PageTabs";
import { CalendarKeys } from "@/features/calendar/components/CalendarKeys";
import { CalendarSearch } from "@/features/calendar/components/CalendarSearch";
import { DayList } from "@/features/calendar/components/DayList";
import { EventsProvider, NewEvent } from "@/features/calendar/components/Events";
import { MonthGrid } from "@/features/calendar/components/MonthGrid";
import { SearchResults } from "@/features/calendar/components/SearchResults";
import { TimeGrid } from "@/features/calendar/components/TimeGrid";
import { readGoogleEvents } from "@/features/calendar/google/sync";
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
import { readEvents } from "@/features/calendar/lib/data";
import { type CalDay, eventRows, googleRows, withEvents } from "@/features/calendar/lib/events";
import { searchEvents } from "@/features/calendar/lib/search";
import { Invite } from "@/features/day/components/Invite";
import { MyDay } from "@/features/day/components/MyDay";
import { loadDay } from "@/features/day/lib/data";
import { HomeKeys } from "@/features/home/components/TodayIslands";
import { layoutOf } from "@/features/home/lib/dashboard";
import { money } from "@/features/home/lib/format";
import {
	HabitWeek,
	loadWeekRhythmParts,
	WeekRhythmHead,
} from "@/features/week/components/WeekRhythm";
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
	q = "",
}: {
	ws: Workspace;
	today: string;
	view: View;
	/** Any day the view should hold. */
	anchor: string;
	/** Searching the events: what's found shows in place of the days. */
	q?: string;
}) {
	const found = q.trim().length >= 2 ? await searchEvents(ws.id, q, today) : null;
	const dates = daysOf(view, anchor);
	const on = modulesOn(ws.modulesOff);
	const fmt = (amount: number, currency = ws.baseCurrency) => money(amount, currency);
	const [data, { carried, later }] = await Promise.all([
		getWeekData(ws, today, dates, on),
		loadExtras(ws, today, dates, fmt),
	]);
	const [events, google] = await Promise.all([
		readEvents(ws.id, dates[0] ?? anchor, dates.at(-1) ?? anchor),
		readGoogleEvents(ws.id, dates[0] ?? anchor, dates.at(-1) ?? anchor),
	]);
	const days = withEvents(
		buildWeek(data, today, dates, fmt, carried, later).days as CalDay[],
		eventRows(events, dates),
		googleRows(google, dates),
	);
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
	// The week's rhythm (plan it, its focus, each day's own plan) when Week is on.
	const rhythm =
		view === "week" && on.includes("/week")
			? await loadWeekRhythmParts(ws, today, dates, fmt, on)
			: null;
	const notes = rhythm?.notes;
	// Today's own plan beside its hours, when Day is on.
	const myDay =
		view === "day" && anchor === today && on.includes("/day")
			? await loadDay(ws, today, fmt)
			: null;
	const figures = new Map(dates.map((d) => [d, figuresOf(data, d)]));

	return (
		<EventsProvider day={current ? today : anchor}>
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
						<CalendarSearch q={q} />
						<NewEvent day={current ? today : anchor} />
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
					{found && <SearchResults q={q.trim()} found={found} today={today} />}
					{!found && view === "month" && (
						<MonthGrid
							days={days}
							figures={figures}
							month={anchor.slice(0, 7)}
							today={today}
							money={fmt}
						/>
					)}
					{!found && view === "week" && (
						<div className="space-y-6">
							{rhythm && <WeekRhythmHead parts={rhythm} today={today} />}
							<div className="max-md:hidden">
								<TimeGrid days={days} today={today} figures={figures} money={fmt} notes={notes} />
							</div>
							<div className="md:hidden">
								<DayList days={days} today={today} figures={figures} money={fmt} notes={notes} />
							</div>
							{rhythm && data.habits && <HabitWeek habits={data.habits} today={today} />}
						</div>
					)}
					{!found && view === "day" && (
						// The hours at the left, the day's whole list (with notes) beside them.
						<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
							<div className="max-lg:hidden">
								<TimeGrid days={days} today={today} figures={figures} money={fmt} strip={false} />
							</div>
							<div className="min-w-0 space-y-6">
								{myDay?.plan?.plannedAt && myDay.picks.length > 0 ? (
									<MyDay day={today} picks={myDay.picks} />
								) : (
									myDay &&
									!myDay.plan?.closedAt && (
										<Invite
											href="/morning"
											eyebrow="Morning"
											title="Plan the day"
											note="Sort what's waiting, pick up to three."
										/>
									)
								)}
								<DayList days={days} today={today} figures={figures} money={fmt} />
							</div>
						</div>
					)}
					{!found && view === "list" && (
						<DayList days={days} today={today} figures={figures} money={fmt} />
					)}
				</div>
			</div>
		</EventsProvider>
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
