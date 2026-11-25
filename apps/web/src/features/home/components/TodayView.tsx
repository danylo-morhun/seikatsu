import { PageTab, PageTabs } from "@/components/PageTabs";
import { CalendarKeys } from "@/features/calendar/components/CalendarKeys";
import {
	CALENDAR_VIEWS,
	type CalendarView,
	hrefOf,
	VIEW_KEYS,
	viewKeyHrefs,
} from "@/features/calendar/lib/calendar";
import { Dashboard } from "@/features/home/components/Dashboard";
import { Line } from "@/features/home/components/Line";
import {
	Greeting,
	HabitsToday,
	LogMileage,
	LogPages,
} from "@/features/home/components/TodayIslands";
import { CaptureBar } from "@/features/home/components/TodayQueue";
import { Widget } from "@/features/home/components/Widgets";
import { layoutOf } from "@/features/home/lib/dashboard";
import { km, longDate, money, plural } from "@/features/home/lib/format";
import {
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadMoney,
	loadReading,
	loadWants,
	type Started,
} from "@/features/home/lib/today";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { type AppHref, modulesOn } from "@/lib/modules";
import type { Workspace } from "@/lib/session";

interface Props {
	ws: Workspace;
	today: string;
	started: Started;
	firstName: string | null;
	/** The calendar view C (or the Calendar tab) goes back to. */
	calendar: CalendarView;
}

/**
 * The home: the date, one line to capture anything, then the user's own dashboard — a widget
 * per app that's on (its figure, what waits in it, its quick acts) and, if they want it, To do
 * across all of them. They order, size and hide the widgets (Dashboard's Edit).
 */
export function TodayView({ ws, today, started, firstName, calendar }: Props) {
	const on = modulesOn(ws.modulesOff);
	const slots = layoutOf(ws.dashboard, on);
	const widgets = Object.fromEntries(
		slots
			.filter((s) => !s.hidden)
			.map((s) => [
				s.id,
				<Widget
					key={s.id}
					id={s.id}
					size={s.size}
					ws={ws}
					today={today}
					on={on}
					started={started}
				/>,
			]),
	);

	return (
		<div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-8 md:py-8">
			<CalendarKeys view="widgets" hrefs={{ ...viewKeyHrefs(today, today), c: hrefOf(calendar) }} />
			<Dashboard
				slots={slots}
				widgets={widgets}
				header={
					<header>
						<h1 className="text-xl font-semibold tracking-tight md:text-3xl">{longDate(today)}</h1>
						<p className="mt-1 min-h-5 text-sm text-muted-foreground">
							<Greeting firstName={firstName} />
						</p>
						<div className="mt-3">
							<PageTabs label="Home view">
								{CALENDAR_VIEWS.map((v) => (
									<PageTab key={v} href={hrefOf(v)} current={false}>
										{VIEW_KEYS[v].name}
									</PageTab>
								))}
								<PageTab href={hrefOf("widgets")} current>
									Widgets
								</PageTab>
							</PageTabs>
						</div>
					</header>
				}
			>
				<CaptureBar />
			</Dashboard>
		</div>
	);
}

// ── The parts ─────────────────────────────────────────────────────────────────

export async function Habits() {
	const data = await loadHabits();
	const habits = data?.habits ?? [];
	if (habits.length === 0)
		return <p className="text-sm text-muted-foreground">Nothing due today.</p>;
	// Undone first: what's left, then what's ticked.
	const sorted = [...habits].sort((a, b) => Number(a.done) - Number(b.done));
	return <HabitsToday habits={sorted} today={data?.today ?? ""} />;
}

export async function ReadingLine({ seal = true }: { seal?: boolean }) {
	const book = (await loadReading())?.[0];
	if (!book) return <Line href="/tsundoku" seal={seal} title="No book on the go" note="Tsundoku" />;
	return (
		<Line
			href="/tsundoku"
			seal={seal}
			title={book.title}
			note={[
				`p. ${book.currentPage}${book.pageCount ? ` of ${book.pageCount}` : ""}`,
				book.daysToFinish != null && `about ${plural(book.daysToFinish, "day")} to go`,
			]
				.filter(Boolean)
				.join(" · ")}
			action={<LogPages book={book} />}
		>
			<div className="mt-1.5">
				<ProgressMeter
					compact
					currentPage={book.currentPage}
					pageCount={book.pageCount}
					daysToFinish={book.daysToFinish}
				/>
			</div>
		</Line>
	);
}

export async function CarLine({ today, seal = true }: { today: string; seal?: boolean }) {
	const car = await loadCar(today);
	if (!car) return <Line href="/aisha" seal={seal} title="No car yet" note="Aisha" />;
	const next = car.next;
	return (
		<Line
			href="/aisha"
			seal={seal}
			title={`${car.name} · ${km(car.currentKm)}`}
			note={
				!next
					? "on the odometer"
					: next.kmLeft != null
						? `${next.name} ${next.kmLeft < 0 ? `${km(next.kmLeft)} overdue` : `in ${km(next.kmLeft)}`}`
						: next.daysLeft != null
							? `${next.name} ${next.daysLeft < 0 ? `${plural(-next.daysLeft, "day")} overdue` : `in ${plural(next.daysLeft, "day")}`}`
							: next.name
			}
			action={<LogMileage vehicleId={car.vehicleId} currentKm={car.currentKm} />}
		/>
	);
}

/** The strip's one figure per app: short enough for a quarter of a phone. */
export async function figureOf(
	href: AppHref,
	ws: Workspace,
	today: string,
): Promise<[string | null, string]> {
	switch (href) {
		case "/kuroji": {
			const m = await loadMoney(ws, today);
			return [m && money(m.netWorth, m.currency), "net worth"];
		}
		case "/seiryu": {
			const cards = await loadCards(ws, today);
			return [cards && String(cards.length), cards?.length === 1 ? "card due" : "cards due"];
		}
		case "/tsundoku": {
			const book = (await loadReading())?.[0];
			return [book ? `p. ${book.currentPage}` : null, "reading"];
		}
		case "/keizoku": {
			const habits = (await loadHabits())?.habits ?? [];
			return [`${habits.filter((h) => h.done).length} / ${habits.length}`, "habits"];
		}
		case "/kyuu": {
			const jobs = await loadJobs();
			return [jobs && String(jobs.toSend), "to send"];
		}
		case "/aisha": {
			const car = await loadCar(today);
			return [car && new Intl.NumberFormat("pl-PL").format(car.currentKm), "km"];
		}
		case "/hoshii": {
			const wants = await loadWants(ws, today);
			return [wants && String(wants.plan), "in the Plan"];
		}
	}
}
