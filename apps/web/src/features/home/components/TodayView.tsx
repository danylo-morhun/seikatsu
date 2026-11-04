import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, Suspense } from "react";
import { DayTabs } from "@/features/home/components/DayTabs";
import { type AppHref, Line, LineAction, LineSkeleton } from "@/features/home/components/Line";
import { StartHere } from "@/features/home/components/StartHere";
import {
	Greeting,
	HabitsToday,
	HomeKeys,
	LogMileage,
	LogPages,
} from "@/features/home/components/TodayIslands";
import { CaptureBar, TodayQueue } from "@/features/home/components/TodayQueue";
import { loadAgenda } from "@/features/home/lib/agenda";
import { km, longDate, money, plural } from "@/features/home/lib/format";
import { buildQueue } from "@/features/home/lib/queue";
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
import { LazyAddTransactionModal } from "@/features/kuroji/components/LazyAddTransactionModal";
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
 * The home is the day to work through: one line to capture anything, what waits today with its
 * action right in the row, habits, what's running now, then one figure per app. The layout is
 * known from the start; each part streams in on its own.
 */
export function TodayView({ ws, today, started, firstName }: Props) {
	const hidden = APP_HREFS.filter((href) => ws.hiddenApps.includes(href));
	const listed = APP_HREFS.filter((href) => !ws.hiddenApps.includes(href));
	// An app with nothing in it yet waits on the start list, not as an empty figure.
	const fresh = listed.filter((href) => started[href] === false);
	const isNew = APP_HREFS.every((href) => started[href] === false);
	const shows = (href: AppHref) => listed.includes(href) && !fresh.includes(href);
	const side = shows("/keizoku") || shows("/tsundoku") || shows("/kuroji") || shows("/aisha");

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 pb-16 sm:px-8 md:space-y-8 md:py-8">
			<HomeKeys listed={listed} />
			{!isNew && <DayTabs current="today" />}
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
						<p className="mt-1 text-sm text-muted-foreground">
							<Greeting firstName={firstName} />
							{/* Holds the line's height until the summaries are in. */}
							<Suspense fallback={<span className="invisible">Nothing waiting on you today.</span>}>
								<Waiting ws={ws} today={today} />
							</Suspense>
						</p>
					</header>

					<div className="animate-rise [--i:1]">
						<CaptureBar />
					</div>

					{/* One grid for the day and the strip below: seven columns on a desktop, so the
					    columns' edges fall on the strip's seams, and both columns end on one line. */}
					<div className="grid gap-6 md:gap-8 lg:grid-cols-7 lg:gap-x-3">
						<Section
							title="To do"
							index={2}
							className={cn("lg:flex lg:flex-col", side ? "lg:col-span-4" : "lg:col-span-7")}
						>
							<Suspense fallback={<ListSkeleton rows={3} />}>
								<Queue ws={ws} today={today} />
							</Suspense>
						</Section>

						<div
							className={cn(
								"space-y-6 md:space-y-8 lg:col-span-3 lg:flex lg:flex-col",
								!side && "hidden",
							)}
						>
							{shows("/keizoku") && (
								<Section title="Habits" href="/keizoku" index={3}>
									<div className="group-card">
										<Suspense fallback={<ListSkeleton rows={2} bare />}>
											<Habits />
										</Suspense>
									</div>
								</Section>
							)}
							{(shows("/tsundoku") || shows("/kuroji") || shows("/aisha")) && (
								<Section title="Now" index={4} className="lg:flex lg:flex-1 lg:flex-col">
									<ul className="inset-group lg:flex-1">
										{shows("/tsundoku") && (
											<Suspense fallback={<LineSkeleton />}>
												<ReadingLine />
											</Suspense>
										)}
										{shows("/kuroji") && (
											<Suspense fallback={<LineSkeleton />}>
												<MoneyLine ws={ws} today={today} />
											</Suspense>
										)}
										{shows("/aisha") && (
											<Suspense fallback={<LineSkeleton />}>
												<CarLine today={today} />
											</Suspense>
										)}
									</ul>
								</Section>
							)}
						</div>
					</div>
				</>
			)}

			{/* First run: the start list is the page. After that it lives on Apps. */}
			{isNew && <StartHere apps={fresh} hidden={hidden} all offset={1} />}
		</div>
	);
}

function Section({
	title,
	href,
	index,
	className,
	children,
}: {
	title: string;
	href?: AppHref;
	index: number;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			aria-label={title}
			className={cn("min-w-0 animate-rise", className)}
			style={{ "--i": index } as CSSProperties}
		>
			<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
				{href ? (
					<Link href={href} prefetch className="transition-colors hover:text-foreground">
						{title}
					</Link>
				) : (
					title
				)}
			</h2>
			{children}
		</section>
	);
}

const ROWS = ["a", "b", "c"];

function ListSkeleton({ rows, bare = false }: { rows: number; bare?: boolean }) {
	const lines = ROWS.slice(0, rows).map((key) => <LineSkeleton key={key} />);
	return bare ? <ul>{lines}</ul> : <ul className="inset-group lg:flex-1">{lines}</ul>;
}

export function FigureText({ value, label }: { value: string | null; label: string }) {
	return (
		<>
			<span
				className={cn(
					"truncate font-figures text-sm font-semibold",
					value == null && "text-muted-foreground/50",
				)}
			>
				{value ?? "—"}
			</span>
			<span className="truncate text-[11px] text-muted-foreground">{label}</span>
		</>
	);
}

// ── What's waiting ────────────────────────────────────────────────────────────

async function Waiting({ ws, today }: { ws: Workspace; today: string }) {
	const [habits, cards, car, jobs, wants] = await Promise.all([
		loadHabits(),
		loadCards(ws, today),
		loadCar(today),
		loadJobs(),
		loadWants(ws, today),
	]);
	const left = (habits?.habits ?? []).filter((h) => !h.done).length;
	const overdue = (cards ?? []).filter((c) => c.dueDate < today).length;
	const attention = [
		left > 0 && `${plural(left, "habit")} left`,
		overdue > 0 && `${plural(overdue, "card")} overdue`,
		car?.next?.status === "overdue" && "car service overdue",
		(jobs?.toSend ?? 0) > 0 && `${jobs?.toSend} to send`,
		(wants?.decide ?? 0) > 0 && `${plural(wants?.decide ?? 0, "want")} to decide`,
	].filter(Boolean);
	return attention.length > 0 ? `${attention.join(", ")}.` : "Nothing waiting on you today.";
}

// ── The parts ─────────────────────────────────────────────────────────────────

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

async function Queue({ ws, today }: { ws: Workspace; today: string }) {
	const agenda = await loadAgenda(ws, today);
	return (
		<TodayQueue items={buildQueue(agenda, today, asMoney)} workspaceId={ws.id} today={today} />
	);
}

async function Habits() {
	const data = await loadHabits();
	const habits = data?.habits ?? [];
	if (habits.length === 0)
		return <p className="text-sm text-muted-foreground">Nothing due today.</p>;
	// Undone first: what's left, then what's ticked.
	const sorted = [...habits].sort((a, b) => Number(a.done) - Number(b.done));
	return <HabitsToday habits={sorted} today={data?.today ?? ""} />;
}

async function ReadingLine() {
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

async function MoneyLine({ ws, today }: { ws: Workspace; today: string }) {
	const m = await loadMoney(ws, today);
	return (
		<Line
			href="/kuroji"
			title={m ? `${money(m.spentToday, m.currency)} spent today` : "Money"}
			note={m ? `${money(m.spentThisMonth, m.currency)} this month` : "Couldn't load"}
			action={
				<LazyAddTransactionModal
					workspaceId={ws.id}
					baseCurrency={ws.baseCurrency}
					trigger={<LineAction label="Add transaction">Add</LineAction>}
				/>
			}
		/>
	);
}

async function CarLine({ today }: { today: string }) {
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
export async function Figure({ href, ws, today }: { href: AppHref; ws: Workspace; today: string }) {
	const [value, label] = await figureOf(href, ws, today);
	return <FigureText value={value} label={label} />;
}

async function figureOf(
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
