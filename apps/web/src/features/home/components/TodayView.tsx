import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, Suspense } from "react";
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
import { km, longDate, money, plural } from "@/features/home/lib/format";
import { buildQueue } from "@/features/home/lib/queue";
import {
	loadCaptures,
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadMoney,
	loadReading,
	loadWants,
	type Started,
} from "@/features/home/lib/today";
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

	return (
		<div className="mx-auto max-w-5xl space-y-6 px-4 pt-5 pb-16 sm:px-8 md:space-y-8 md:py-8">
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

					<div className="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
						<Section title="To do" index={2}>
							<Suspense fallback={<ListSkeleton rows={3} />}>
								<Queue ws={ws} today={today} />
							</Suspense>
						</Section>

						<div className="space-y-6 md:space-y-8">
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
								<Section title="Now" index={4}>
									<ul className="inset-group">
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

					<Section title="Apps" index={5}>
						<ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
							{listed.filter(shows).map((href) => (
								<AppFigure key={href} href={href}>
									<Suspense fallback={<FigureText value={null} label={APPS_CONFIG[href].label} />}>
										<Figure href={href} ws={ws} today={today} />
									</Suspense>
								</AppFigure>
							))}
						</ul>
					</Section>
				</>
			)}

			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={isNew} offset={isNew ? 1 : 6} />
			)}
		</div>
	);
}

function Section({
	title,
	href,
	index,
	children,
}: {
	title: string;
	href?: AppHref;
	index: number;
	children: React.ReactNode;
}) {
	return (
		<section
			aria-label={title}
			className="min-w-0 animate-rise"
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
	return bare ? <ul>{lines}</ul> : <ul className="inset-group">{lines}</ul>;
}

/** One app in the strip: its seal, one figure, its name. Opens the app. */
function AppFigure({ href, children }: { href: AppHref; children: React.ReactNode }) {
	const app = APPS_CONFIG[href];
	return (
		<li className={cn(app.theme, "min-w-0")}>
			<Link
				href={href}
				prefetch
				className="flex h-full flex-col gap-0.5 rounded-group bg-surface px-3 py-2.5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span aria-hidden className="text-[13px] font-semibold text-primary">
					{app.kanji}
				</span>
				{children}
			</Link>
		</li>
	);
}

function FigureText({ value, label }: { value: string | null; label: string }) {
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

async function Queue({ ws, today }: { ws: Workspace; today: string }) {
	const [captures, wants, cards, jobs, car] = await Promise.all([
		loadCaptures(ws),
		loadWants(ws, today),
		loadCards(ws, today),
		loadJobs(),
		loadCar(today),
	]);
	return <TodayQueue items={buildQueue({ captures, wants, cards, jobs, car }, today)} />;
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
					shortcut
					trigger={
						<LineAction label="Add transaction" keys="N">
							Add
						</LineAction>
					}
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
async function Figure({ href, ws, today }: { href: AppHref; ws: Workspace; today: string }) {
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
			return [`${habits.filter((h) => h.done).length} / ${habits.length}`, "habits today"];
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
