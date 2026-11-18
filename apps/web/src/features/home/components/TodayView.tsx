import { Suspense } from "react";
import { DayBody } from "@/features/day/components/DayBody";
import { type AppHref, Line, LineSkeleton } from "@/features/home/components/Line";
import { StartHere } from "@/features/home/components/StartHere";
import {
	Greeting,
	HabitsToday,
	HomeKeys,
	LogMileage,
	LogPages,
} from "@/features/home/components/TodayIslands";
import { CaptureBar } from "@/features/home/components/TodayQueue";
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
import { formatMoney } from "@/features/hoshii/lib/format";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";

const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];

interface Props {
	ws: Workspace;
	today: string;
	started: Started;
	firstName: string | null;
}

/**
 * The home is the day to work through: one line to capture anything, then the day as its phase
 * has it (features/day DayBody): the morning's invitation and the list, the picks and the day's
 * parts with habits, the evening's close. Logging the rest (pages, km) belongs to the evening.
 */
export function TodayView({ ws, today, started, firstName }: Props) {
	const hidden = APP_HREFS.filter((href) => ws.hiddenApps.includes(href));
	const listed = APP_HREFS.filter((href) => !ws.hiddenApps.includes(href));
	// An app with nothing in it yet waits on the start list, not as an empty figure.
	const fresh = listed.filter((href) => started[href] === false);
	const isNew = APP_HREFS.every((href) => started[href] === false);
	const shows = (href: AppHref) => listed.includes(href) && !fresh.includes(href);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 pb-28 sm:px-8 md:space-y-8 md:py-8">
			<HomeKeys listed={listed} />
			{isNew ? (
				<header className="max-w-2xl animate-rise">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">
						{firstName ? `Welcome, ${firstName}.` : "Welcome."}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground md:text-base">
						生活 — everyday life. Seven small apps for money, projects, books, habits, the job
						search, the car and the things you want, under one sign-in. Start with whichever you
						need; the rest wait here until you do, and each one shows up on this page once it has
						something in it.
					</p>
				</header>
			) : null}
			{isNew && (
				<div className="max-w-2xl animate-rise [--i:1]">
					<CaptureBar />
				</div>
			)}
			{!isNew && (
				<>
					<header className="animate-rise">
						<h1 className="text-xl font-semibold tracking-tight md:text-3xl">{longDate(today)}</h1>
						<p className="mt-1 min-h-5 text-sm text-muted-foreground">
							<Greeting firstName={firstName} />
						</p>
					</header>

					<div className="animate-rise [--i:1]">
						<CaptureBar />
					</div>

					<div className="animate-rise [--i:2]">
						<Suspense fallback={<ListSkeleton rows={3} />}>
							<DayBody ws={ws} today={today} fmt={asMoney} showHabits={shows("/keizoku")} />
						</Suspense>
					</div>
				</>
			)}

			{/* First run: the start list is the page. After that it lives on Apps. */}
			{isNew && <StartHere apps={fresh} hidden={hidden} all offset={1} />}
		</div>
	);
}

const ROWS = ["a", "b", "c"];

function ListSkeleton({ rows, bare = false }: { rows: number; bare?: boolean }) {
	const lines = ROWS.slice(0, rows).map((key) => <LineSkeleton key={key} />);
	return bare ? <ul>{lines}</ul> : <ul className="inset-group lg:flex-1">{lines}</ul>;
}

// ── The parts ─────────────────────────────────────────────────────────────────

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

export async function Habits() {
	const data = await loadHabits();
	const habits = data?.habits ?? [];
	if (habits.length === 0)
		return <p className="text-sm text-muted-foreground">Nothing due today.</p>;
	// Undone first: what's left, then what's ticked.
	const sorted = [...habits].sort((a, b) => Number(a.done) - Number(b.done));
	return <HabitsToday habits={sorted} today={data?.today ?? ""} />;
}

export async function ReadingLine() {
	const book = (await loadReading())?.[0];
	if (!book) return <Line href="/tsundoku" title="No book on the go" note="Tsundoku" />;
	return (
		<Line
			href="/tsundoku"
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

export async function CarLine({ today }: { today: string }) {
	const car = await loadCar(today);
	if (!car) return <Line href="/aisha" title="No car yet" note="Aisha" />;
	const next = car.next;
	return (
		<Line
			href="/aisha"
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
			return [cards && String(cards.length), "cards due"];
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
